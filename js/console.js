const { h, render } = preact;
const { useState, useEffect } = preactHooks;
const html = htm.bind(h);

// Utility: parse IDs from textarea (comma/space/newline separated)
function parseIds(text) {
  return Array.from(
    new Set(
      (text || '')
        .split(/[\s,]+/)
        .map((t) => parseInt(t, 10))
        .filter((n) => Number.isInteger(n) && n > 0)
    )
  );
}

// Utility: fetch action subform HTML from GLPI ajax and return text
async function fetchActionSubform({ itemtype, ids, action }) {
  // Build the POST body to mimic GLPI's expected payload (as seen in devtools)
  // Key elements:
  // - action: selected action key (e.g., "ITILFollowup:add_followup")
  // - container: using SearchTableFor{Itemtype} to match GLPI context
  // - is_deleted: default 0
  // - actions[]: map of action key => label (we don't know labels here, but server mainly needs the keys present)
  // - action_filter[]: allow selected action for the itemtype
  // - items[itemtype][id]=id and initial_items[itemtype][id]=id for each id
  //
  // Note: We only include the selected action in actions and action_filter to keep payload minimal, which is enough
  // for the endpoint to render the subform for that action given these items.
  const form = new URLSearchParams();

  // Set the selected action
  form.set('action', action);

  // Container naming similar to GLPI's "SearchTableForTicket" etc.
  const shortType = itemtype.replace(/^.*\\\\?/, ''); // keep class tail if namespaced
  form.set('container', `SearchTableFor${shortType}`);

  // Deleted flag (0 by default)
  form.set('is_deleted', '0');

  // Allow the selected action for this itemtype
  form.append(`action_filter[${action}][]`, shortType);

  // Provide the actions map entry (label can be same as key if unknown; backend mainly checks presence)
  form.set(`actions[${action}]`, action);

  // Items and initial_items
  ids.forEach((id) => {
    form.set(`items[${shortType}][${id}]`, String(id));
    form.set(`initial_items[${shortType}][${id}]`, String(id));
  });

  // Ask for subform (GLPI uses this to render parameters)
  form.set('sub_form', '1');

  const res = await fetch('/ajax/dropdownMassiveAction.php', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
    },
    body: form.toString()
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch action subform (${res.status})`);
  }
  return res.text();
}

  // Utility: naive HTML -> schema extraction for common inputs
  // Ensure we do not render or expose internal/hidden fields controlling GLPI POST flow.
  function htmlToSchema(htmlString) {
    const wrapper = document.createElement('div');
    wrapper.innerHTML = htmlString;

    const fields = [];

    // Helper to get label for a control
    function findLabel(ctrl) {
      // Prefer a label explicitly associated via for=ID
      if (ctrl.id) {
        const lbl = wrapper.querySelector(`label[for="${cssEscape(ctrl.id)}"]`);
        if (lbl) {
          // Only take the immediate text content of the label itself,
          // excluding any nested elements (like inputs, divs, scripts)
          const ownText = Array.from(lbl.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join('')
            .trim();
          if (ownText) return ownText;
          // Fallback to full textContent if own text is empty
          return (lbl.textContent || '').trim();
        }
      }

      // Fallback: look for a wrapping/preceding label
      let node = ctrl;
      while (node && node !== wrapper) {
        if (node.tagName && node.tagName.toLowerCase() === 'label') {
          const ownText = Array.from(node.childNodes)
            .filter((n) => n.nodeType === Node.TEXT_NODE)
            .map((n) => n.textContent)
            .join('')
            .trim();
          if (ownText) return ownText;
          return (node.textContent || '').trim();
        }
        node = node.previousElementSibling || node.parentElement;
      }
      return '';
    }

    // Decide whether a field is user-facing or internal transport-only
    function isInternalName(name) {
      if (!name) return true;
      // Exclude known transport/meta fields
      if (name === 'action' || name === 'container' || name === 'is_deleted') return true;
      if (name.startsWith('actions[') || name.startsWith('action_filter[')) return true;
      if (name.startsWith('items[') || name.startsWith('initial_items[')) return true;
      // Exclude CSRF and common hidden tokens/flags
      if (name === '_glpi_csrf_token' || name === 'sub_form') return true;
      return false;
    }

    // CSS.escape polyfill for older environments (GLPI bundles may lack it)
    function cssEscape(ident) {
      if (window.CSS && typeof window.CSS.escape === 'function') {
        return window.CSS.escape(ident);
      }
      return String(ident).replace(/[^a-zA-Z0-9_\-]/g, (c) => '\\' + c);
    }

    // inputs
    wrapper.querySelectorAll('input').forEach((input) => {
      const type = (input.getAttribute('type') || 'text').toLowerCase();
      const name = input.getAttribute('name');

      // Ignore missing name, submits/buttons, and any internal/hidden transport fields
      if (!name) return;
      if (['submit', 'button'].includes(type)) return;
      if (type === 'hidden' || isInternalName(name)) return;

      const schema = {
        name,
        label: findLabel(input) || name,
        type: type,
        required: input.required || false,
        default: input.value || ''
      };

      if (type === 'checkbox' || type === 'radio') {
        schema.default = input.checked;
        schema.value = input.value || '1';
      }

      fields.push(schema);
    });

    // selects
    wrapper.querySelectorAll('select').forEach((select) => {
      const name = select.getAttribute('name');
      if (!name || isInternalName(name)) return;

      const options = Array.from(select.options).map((opt) => ({
        value: opt.value,
        label: opt.textContent.trim(),
        selected: opt.selected
      }));

      fields.push({
        name,
        label: findLabel(select) || name,
        type: 'select',
        required: select.required || false,
        multiple: select.multiple || false,
        options,
        default: options.find((o) => o.selected)?.value ?? (options[0]?.value ?? '')
      });
    });

    // textareas
    wrapper.querySelectorAll('textarea').forEach((ta) => {
      const name = ta.getAttribute('name');
      if (!name || isInternalName(name)) return;

      fields.push({
        name,
        label: findLabel(ta) || name,
        type: 'textarea',
        required: ta.required || false,
        default: ta.value || ta.textContent || ''
      });
    });

    // Deduplicate by name (first wins)
    const byName = new Map();
    for (const f of fields) {
      if (!byName.has(f.name)) {
        byName.set(f.name, f);
      }
    }

    return Array.from(byName.values());
  }

// Render a field from schema
function renderField(field, value, onChange) {
  const label = field.label || field.name;

  if (field.type === 'select') {
    return html`
      <div class="maapi-param-field">
        <label class="maapi-label">${label}${field.required ? ' *' : ''}</label>
        <select
          class="maapi-select"
          value=${value ?? field.default ?? ''}
          multiple=${field.multiple || false}
          onChange=${(e) => {
            if (field.multiple) {
              const vals = Array.from(e.target.selectedOptions).map((o) => o.value);
              onChange(field.name, vals);
            } else {
              onChange(field.name, e.target.value);
            }
          }}
        >
          ${(field.options || []).map((opt) => html`<option value="${opt.value}">${opt.label}</option>`)}
        </select>
      </div>
    `;
  }

  if (field.type === 'checkbox') {
    const checked = value ?? field.default ?? false;
    return html`
      <div class="maapi-param-field">
        <label class="maapi-label">
          <input
            type="checkbox"
            checked=${!!checked}
            onChange=${(e) => onChange(field.name, e.target.checked ? (field.value ?? '1') : '0')}
            style="margin-right:6px;"
          />
          ${label}${field.required ? ' *' : ''}
        </label>
      </div>
    `;
  }

  if (field.type === 'radio') {
    // Radios often share the same name; render as checkbox-like fallback
    const checked = value ?? field.default ?? false;
    return html`
      <div class="maapi-param-field">
        <label class="maapi-label">
          <input
            type="checkbox"
            checked=${!!checked}
            onChange=${(e) => onChange(field.name, e.target.checked ? (field.value ?? '1') : '0')}
            style="margin-right:6px;"
          />
          ${label}${field.required ? ' *' : ''}
        </label>
      </div>
    `;
  }

  if (field.type === 'textarea') {
    return html`
      <div class="maapi-param-field">
        <label class="maapi-label">${label}${field.required ? ' *' : ''}</label>
        <textarea
          class="maapi-textarea"
          value=${value ?? field.default ?? ''}
          onInput=${(e) => onChange(field.name, e.target.value)}
        ></textarea>
      </div>
    `;
  }

  // default to text/number/hidden treated as text input
  const inputType = ['number', 'hidden'].includes(field.type) ? 'text' : field.type;
  return html`
    <div class="maapi-param-field">
      <label class="maapi-label">${label}${field.required ? ' *' : ''}</label>
      <input
        class="maapi-input"
        type="${inputType}"
        value=${value ?? field.default ?? ''}
        onInput=${(e) => onChange(field.name, e.target.value)}
      />
    </div>
  `;
}

function App() {
  const [itemTypes, setItemTypes] = useState([]);
  const [selectedItemType, setSelectedItemType] = useState('');
  const [actions, setActions] = useState([]);
  const [selectedAction, setSelectedAction] = useState('');
  const [itemIds, setItemIds] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);

  // New: action-defined form
  const [actionSchema, setActionSchema] = useState([]);
  const [actionFormValues, setActionFormValues] = useState({});
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  useEffect(() => {
    fetch('/plugins/massive_action_api/api.php/ui/itsm-itemtypes', {
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then(data => setItemTypes(data))
      .catch(error => console.error('Error fetching item types:', error));
  }, []);

  const handleItemTypeChange = (event) => {
    const itemType = event.target.value;
    setSelectedItemType(itemType);

    // Reset downstream state
    setActions([]);
    setSelectedAction('');
    setActionSchema([]);
    setActionFormValues({});
    setSchemaError('');

    if (itemType) {
      fetch(`/plugins/massive_action_api/api.php/available_actions/${itemType}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      })
        .then(response => response.json())
        .then(data => setActions(data.actions || []))
        .catch(error => console.error('Error fetching actions:', error));
    }
  };

  const handleActionChange = async (event) => {
    const actionKey = event.target.value;
    setSelectedAction(actionKey);

    // Reset schema and values when action changes
    setActionSchema([]);
    setActionFormValues({});
    setSchemaError('');

    // We must have item IDs before fetching subform to specialize fields
    const ids = parseIds(itemIds);
    if (!selectedItemType || !actionKey || ids.length === 0) {
      return;
    }

    try {
      setLoadingSchema(true);
      const html = await fetchActionSubform({
        itemtype: selectedItemType,
        ids,
        action: actionKey
      });
      const schema = htmlToSchema(html);
      setActionSchema(schema);

      // Initialize default values
      const initialValues = {};
      schema.forEach((f) => {
        if (f.multiple) {
          // preselect selected options
          const selected = (f.options || []).filter((o) => o.selected).map((o) => o.value);
          initialValues[f.name] = selected.length ? selected : (Array.isArray(f.default) ? f.default : []);
        } else if (f.type === 'checkbox') {
          initialValues[f.name] = f.default ?? false;
        } else {
          initialValues[f.name] = f.default ?? '';
        }
      });
      setActionFormValues(initialValues);
    } catch (e) {
      console.error(e);
      setSchemaError('Failed to derive action parameters from AJAX endpoint.');
    } finally {
      setLoadingSchema(false);
    }
  };

  const handleIdsBlur = async () => {
    // If action already selected and ids changed, refetch schema to specialize
    if (!selectedAction) return;
    const ids = parseIds(itemIds);
    if (!selectedItemType || ids.length === 0) return;

    try {
      setLoadingSchema(true);
      const html = await fetchActionSubform({
        itemtype: selectedItemType,
        ids,
        action: selectedAction
      });
      const schema = htmlToSchema(html);
      setActionSchema(schema);

      const initialValues = {};
      schema.forEach((f) => {
        if (f.multiple) {
          const selected = (f.options || []).filter((o) => o.selected).map((o) => o.value);
          initialValues[f.name] = selected.length ? selected : (Array.isArray(f.default) ? f.default : []);
        } else if (f.type === 'checkbox') {
          initialValues[f.name] = f.default ?? false;
        } else {
          initialValues[f.name] = f.default ?? '';
        }
      });
      setActionFormValues(initialValues);
      setSchemaError('');
    } catch (e) {
      console.error(e);
      setSchemaError('Failed to derive action parameters from AJAX endpoint.');
    } finally {
      setLoadingSchema(false);
    }
  };

  const updateActionFormValue = (name, value) => {
    setActionFormValues((prev) => ({ ...prev, [name]: value }));
  };

  const validateRequired = () => {
    for (const f of actionSchema) {
      if (f.required) {
        const v = actionFormValues[f.name];
        if (f.multiple && Array.isArray(v)) {
          if (v.length === 0) return false;
        } else if (v === undefined || v === null || String(v).trim() === '') {
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!selectedItemType || !selectedAction || !itemIds.trim()) {
      alert(__('Please fill in all required fields', 'massive_action_api'));
      return;
    }

    const ids = parseIds(itemIds);
    if (ids.length === 0) {
      alert(__('Please enter valid item IDs', 'massive_action_api'));
      return;
    }

    if (!validateRequired()) {
      alert(__('Please fill in all required action fields', 'massive_action_api'));
      return;
    }

    // Build action_data from our action-defined form
    const actionData = {};
    for (const f of actionSchema) {
      const name = f.name;
      const value = actionFormValues[name];
      if (value === undefined) continue;

      // Handle [] array names
      if (name.endsWith('[]')) {
        const base = name.slice(0, -2);
        // Ensure array value
        const arr = Array.isArray(value) ? value : (value != null && value !== '' ? [value] : []);
        actionData[base] = arr;
      } else {
        actionData[name] = value;
      }
    }

    const [processor] = selectedAction.split(':');

    const requestData = {
      items: {
        [selectedItemType]: ids
      },
      action: selectedAction,
      processor,
      initial_items: {
        [selectedItemType]: ids
      },
      action_data: actionData
    };

    setIsProcessing(true);
    setProcessResult(null);

    try {
      const response = await fetch('/plugins/massive_action_api/api.php/process_action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      });

      const result = await response.json();
      setProcessResult(result);
    } catch (error) {
      console.error('Error processing action:', error);
      setProcessResult({ error: 'Failed to process action' });
    } finally {
      setIsProcessing(false);
    }
  };

  return html`
    <div class="maapi-container">
      <h1 class="maapi-title">${__('Massive Action API', 'massive_action_api')}</h1>

      <div class="maapi-panel">
        <div class="maapi-topbar">
          <div class="maapi-field">
            <label for="itemType" class="maapi-label">${__('Select Item Type:', 'massive_action_api')}</label>
            <select id="itemType" onChange=${handleItemTypeChange} class="maapi-select">
              <option value="">${__('-- Select an Item Type --', 'massive_action_api')}</option>
              ${itemTypes.map(item => html`<option value="${item}">${item}</option>`)}
            </select>
          </div>

          ${actions.length > 0 && html`
            <div class="maapi-field">
              <label for="action" class="maapi-label">${__('Select Action:', 'massive_action_api')}</label>
              <select id="action" onChange=${handleActionChange} class="maapi-select">
                <option value="">${__('-- Select an Action --', 'massive_action_api')}</option>
                ${actions.map(action => html`<option value="${action.key}">${action.label}</option>`)}
              </select>
            </div>
          `}
        </div>
      </div>

      ${(selectedAction || '').length > 0 && html`
        <div class="maapi-panel">
          <div class="maapi-field" style="max-width: 820px;">
            <label for="itemIds" class="maapi-label">${__('Item IDs (comma/space separated):', 'massive_action_api')}</label>
            <textarea
              id="itemIds"
              value=${itemIds}
              onInput=${(e) => setItemIds(e.target.value)}
              onBlur=${handleIdsBlur}
              class="maapi-textarea"
              placeholder=${__('Enter item IDs (e.g., 1, 2 3 4)', 'massive_action_api')}
            ></textarea>
            <div class="maapi-help">${__('Provide at least one ID to load action parameters specific to the selection.', 'massive_action_api')}</div>
          </div>
        </div>`}

      ${(selectedAction || '').length > 0 && html`
        <div class="maapi-panel">
          <h2 class="maapi-title" style="font-size:18px; margin-bottom: 10px;">${__('Action parameters', 'massive_action_api')}</h2>
          ${loadingSchema && html`<div class="maapi-help">${__('Loading action parameters…', 'massive_action_api')}</div>`}
          ${schemaError && html`<div class="maapi-result maapi-result--error">${__('Failed to derive action parameters from AJAX endpoint.', 'massive_action_api')}</div>`}
          ${!loadingSchema && !schemaError && actionSchema.length === 0 && html`
            <div class="maapi-help">${__('No specific parameters required for this action or unable to infer fields.', 'massive_action_api')}</div>
          `}
          ${actionSchema.length > 0 && html`
            <div class="maapi-params">
              ${actionSchema.map((f) => html`<div class="maapi-param-field">${renderField(f, actionFormValues[f.name], updateActionFormValue)}</div>`)}
            </div>
          `}
        </div>`}

      ${(selectedAction || '').length > 0 && html`
        <div class="maapi-panel" style="display:flex; gap: 12px; align-items:center;">
          <button 
            onClick=${handleSubmit}
            disabled=${isProcessing}
            class="maapi-btn maapi-btn--primary"
          >
            ${isProcessing ? __('Processing…', 'massive_action_api') : __('Process Action', 'massive_action_api')}
          </button>
        </div>`}

      ${processResult && html`
        <div class="maapi-panel">
          <div class="maapi-result ${processResult.error ? 'maapi-result--error' : 'maapi-result--ok'}">
            ${processResult.error ? html`
              <h3 style="color: #c62828; margin: 0 0 10px 0;">${__('Error', 'massive_action_api')}</h3>
              <p style="margin: 0;">${processResult.error}</p>
            ` : html`
              <h3 style="color: #2e7d32; margin: 0 0 10px 0;">${__('Result', 'massive_action_api')}</h3>
              <p style="margin: 0 0 5px 0;">${__('✓ Successful:', 'massive_action_api')} ${processResult.ok || 0}</p>
              <p style="margin: 0 0 5px 0;">${__('✗ Failed:', 'massive_action_api')} ${processResult.ko || 0}</p>
              <p style="margin: 0 0 5px 0;">${__('⚠ No Rights:', 'massive_action_api')} ${processResult.noright || 0}</p>
              ${processResult.messages && processResult.messages.length > 0 && html`
                <div style="margin-top: 10px;">
                  <strong>${__('Messages:', 'massive_action_api')}</strong>
                  <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                    ${processResult.messages.map(msg => html`<li>${msg}</li>`)}
                  </ul>
                </div>
              `}
            `}
          </div>
        </div>`}
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  render(html`<${App} />`, document.getElementById('plugin_massive_action_api_api_console'));
});
