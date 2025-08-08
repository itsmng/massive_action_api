const { h, render } = preact;
const { useState, useEffect, useRef } = preactHooks;
const html = htm.bind(h);

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

async function fetchActionSubform({ itemtype, ids, action }) {
  const form = new URLSearchParams();

  form.set('action', action);

  const shortType = itemtype.replace(/^.*\\\\?/, ''); // keep class tail if namespaced
  form.set('container', `SearchTableFor${shortType}`);
  form.set('is_deleted', '0');
  form.append(`action_filter[${action}][]`, shortType);
  form.set(`actions[${action}]`, action);
  ids.forEach((id) => {
    form.set(`items[${shortType}][${id}]`, String(id));
    form.set(`initial_items[${shortType}][${id}]`, String(id));
  });
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
        const ownText = Array.from(lbl.childNodes)
          .filter((n) => n.nodeType === Node.TEXT_NODE)
          .map((n) => n.textContent)
          .join('')
          .trim();
        if (ownText) return ownText;
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
            class="maapi-input-gap"
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
            class="maapi-input-gap"
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

  const [actionSchema, setActionSchema] = useState([]);
  const [actionFormValues, setActionFormValues] = useState({});
  const [loadingSchema, setLoadingSchema] = useState(false);
  const [schemaError, setSchemaError] = useState('');

  const [batchSize, setBatchSize] = useState(50);
  const [concurrency, setConcurrency] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [processedCount, setProcessedCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const [isCancelled, setIsCancelled] = useState(false);
  const [processingMessages, setProcessingMessages] = useState([]);
  const [processingErrors, setProcessingErrors] = useState([]);
  const [aggregatedResult, setAggregatedResult] = useState({ ok: 0, ko: 0, noright: 0 });

  const controllersRef = useRef(new Set()); // store active AbortControllers
  const isCancelledRef = useRef(false);
  const startTimeRef = useRef(null);

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
  };

  useEffect(() => {
    if (!selectedItemType) return;
    fetch(`/plugins/massive_action_api/api.php/available_actions/${selectedItemType}`, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
      .then(response => response.json())
      .then(data => setActions(data.actions || []))
      .catch(error => console.error('Error fetching actions:', error));
  }, [selectedItemType]);

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

  // Update elapsed/ETA while processing
  useEffect(() => {
    if (!isProcessing) {
      setElapsedSeconds(0);
      setEtaSeconds(null);
      return;
    }
    const id = setInterval(() => {
      if (!startTimeRef.current) return;
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedSeconds(elapsed);
      const avgPerItem = processedCount ? (elapsed / processedCount) : 0;
      const remaining = Math.max(0, totalCount - processedCount);
      setEtaSeconds(avgPerItem ? Math.round(avgPerItem * remaining) : null);
    }, 1000);
    return () => clearInterval(id);
  }, [isProcessing, processedCount, totalCount]);

  const resetProcessingState = () => {
    controllersRef.current.forEach((c) => {
      try { c.abort(); } catch (e) { }
    });
    controllersRef.current.clear();
    isCancelledRef.current = false;
    setIsCancelled(false);
    setProcessingMessages([]);
    setProcessingErrors([]);
    setAggregatedResult({ ok: 0, ko: 0, noright: 0 });
    setProcessedCount(0);
    setTotalCount(0);
    setElapsedSeconds(0);
    setEtaSeconds(null);
  };

  const handleCancel = () => {
    setIsCancelled(true);
    isCancelledRef.current = true;
    controllersRef.current.forEach((c) => {
      try { c.abort(); } catch (e) { }
    });
    controllersRef.current.clear();
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

    // Build action_data
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

    // chunks
    const chunks = [];
    for (let i = 0; i < ids.length; i += batchSize) {
      chunks.push(ids.slice(i, i + batchSize));
    }

    const requestTemplate = {
      action: selectedAction,
      processor,
      action_data: actionData
    };

    // reset any previous processing state
    resetProcessingState();
    setIsProcessing(true);
    setProcessResult(null);
    setTotalCount(ids.length);
    startTimeRef.current = Date.now();
    isCancelledRef.current = false;

    const retries = 3;

    // fetcher w/ retry
    async function fetchChunkWithRetry(chunk) {
      let attempt = 0;
      while (attempt <= retries && !isCancelledRef.current) {
        attempt++;
        const controller = new AbortController();
        controllersRef.current.add(controller);

        const body = {
          ...requestTemplate,
          items: { [selectedItemType]: chunk },
          initial_items: { [selectedItemType]: chunk }
        };

        try {
          const res = await fetch('/plugins/massive_action_api/api.php/process_action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            signal: controller.signal
          });
          controllersRef.current.delete(controller);

          if (!res.ok) {
            const text = await res.text().catch(() => '');
            throw new Error(`HTTP ${res.status} ${text}`);
          }
          const json = await res.json();
          return { success: true, json };
        } catch (err) {
          controllersRef.current.delete(controller);
          if (err && err.name === 'AbortError') {
            return { aborted: true, error: err };
          }
          if (attempt > retries) {
            return { success: false, error: err };
          }
          // backoff before retry
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
      return { success: false, error: new Error('Cancelled') };
    }

    // worker pool
    let index = 0;
    const workers = Math.max(1, Math.min(concurrency, 4));
    const workerPromises = Array.from({ length: workers }).map(async () => {
      while (true) {
        if (isCancelledRef.current) break;
        const current = index++;
        if (current >= chunks.length) break;
        const chunk = chunks[current];
        const result = await fetchChunkWithRetry(chunk);

        if (result.aborted) {
          // cancelled; stop
          break;
        }

        if (!result.success) {
          setProcessingErrors((prev) => prev.concat([`Chunk ${current} failed: ${result.error && result.error.message ? result.error.message : String(result.error)}`]));
          // still count these items as processed to advance progress
          setProcessedCount((prev) => prev + chunk.length);
          continue;
        }

        const json = result.json || {};
        setAggregatedResult((prev) => ({
          ok: prev.ok + (json.ok || 0),
          ko: prev.ko + (json.ko || 0),
          noright: prev.noright + (json.noright || 0)
        }));

        if (json.messages && Array.isArray(json.messages) && json.messages.length) {
          setProcessingMessages((prev) => prev.concat(json.messages));
        }

        setProcessedCount((prev) => prev + chunk.length);
      }
    });

    // wait for workers to finish
    await Promise.all(workerPromises);

    // aggregate results
    const final = {
      ok: aggregatedResult.ok,
      ko: aggregatedResult.ko,
      noright: aggregatedResult.noright,
      messages: processingMessages,
      errors: processingErrors,
      cancelled: isCancelledRef.current
    };

    setProcessResult(final);
    setIsProcessing(false);
    // clear controllers
    controllersRef.current.forEach((c) => {
      try { c.abort(); } catch (e) { }
    });
    controllersRef.current.clear();
  };

  // helpers for rendering time
  function formatSeconds(s) {
    if (s === null || s === undefined) return '—';
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`;
  }

  return html`
    <div class="maapi-container">
      <h1 class="maapi-title">${__('Massive Action API', 'massive_action_api')}</h1>

      <div class="maapi-panel">
        <div class="maapi-topbar maapi-topbar--wrap">
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
        ${(selectedAction || '').length > 0 && html`
          <div class="maapi-topbar maapi-topbar--nowrap">
            <div class="maapi-field maapi-field--small">
              <label class="maapi-label">${__('Batch size:', 'massive_action_api')}</label>
              <input
                type="number"
                min="1"
                class="maapi-input maapi-input--small"
                value=${batchSize}
                onInput=${(e) => setBatchSize(Math.max(1, parseInt(e.target.value || '10', 10)))}
              />
            </div>
            <div class="maapi-field maapi-field--small">
              <label class="maapi-label">${__('Concurrency:', 'massive_action_api')}</label>
              <select
                class="maapi-select maapi-select--small"
                value=${concurrency}
                onChange=${(e) => setConcurrency(parseInt(e.target.value, 10))}
              >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="4">4</option>
              </select>
            </div>
          </div>
        `}
      </div>

      ${(selectedAction || '').length > 0 && html`
        <div class="maapi-panel">
          <div class="maapi-field maapi-field--wide">
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
          <h2 class="maapi-title maapi-subtitle">${__('Action parameters', 'massive_action_api')}</h2>
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
        <div class="maapi-panel maapi-panel--actions">
          <button 
            onClick=${handleSubmit}
            disabled=${isProcessing}
            class="maapi-btn maapi-btn--primary"
          >
            ${isProcessing ? __('Processing…', 'massive_action_api') : __('Process Action', 'massive_action_api')}
          </button>

          ${isProcessing && html`
            <button
              onClick=${handleCancel}
              class="maapi-btn maapi-cancel-btn"
            >
              ${__('Cancel', 'massive_action_api')}
            </button>
          `}
        </div>`}

      ${isProcessing && html`
        <div class="maapi-panel">
          <div class="maapi-progress-wrapper">
            <div class="maapi-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow=${totalCount ? Math.round((processedCount / totalCount) * 100) : 0}>
              <div class="maapi-progress__bar" style=${`width:${totalCount ? Math.round((processedCount / totalCount) * 100) : 0}%`}></div>
            </div>
          </div>
          <div class="maapi-meta">
            <div>${__('Processed:', 'massive_action_api')} ${processedCount}/${totalCount}</div>
            <div>${__('Elapsed:', 'massive_action_api')} ${formatSeconds(elapsedSeconds)}</div>
            <div>${__('ETA:', 'massive_action_api')} ${etaSeconds !== null ? formatSeconds(etaSeconds) : '—'}</div>
            <div>${__('Batch size:', 'massive_action_api')} ${batchSize}</div>
            <div>${__('Concurrency:', 'massive_action_api')} ${concurrency}</div>
          </div>
          ${processingMessages.length > 0 && html`
            <div class="maapi-section">
              <strong>${__('Messages:', 'massive_action_api')}</strong>
              <ul class="maapi-list">
                ${processingMessages.map(m => html`<li>${m}</li>`)}
              </ul>
            </div>
          `}
          ${processingErrors.length > 0 && html`
            <div class="maapi-section">
              <strong class="maapi-errors-title">${__('Errors:', 'massive_action_api')}</strong>
              <ul class="maapi-list maapi-list--errors">
                ${processingErrors.map(e => html`<li>${e}</li>`)}
              </ul>
            </div>
          `}
        </div>
      `}

      ${processResult && html`
        <div class="maapi-panel">
          <div class="maapi-result ${processResult.error ? 'maapi-result--error' : 'maapi-result--ok'}">
            ${processResult.error ? html`
              <h3 class="maapi-result__title maapi-result__title--error">${__('Error', 'massive_action_api')}</h3>
              <p class="maapi-result__line">${processResult.error}</p>
            ` : html`
              <h3 class="maapi-result__title maapi-result__title--ok">${__('Result', 'massive_action_api')}</h3>
              <p class="maapi-result__line maapi-result__line--small">${__('✓ Successful:', 'massive_action_api')} ${processResult.ok || aggregatedResult.ok || 0}</p>
              <p class="maapi-result__line maapi-result__line--small">${__('✗ Failed:', 'massive_action_api')} ${processResult.ko || aggregatedResult.ko || 0}</p>
              <p class="maapi-result__line maapi-result__line--small">${__('⚠ No Rights:', 'massive_action_api')} ${processResult.noright || aggregatedResult.noright || 0}</p>
              ${processResult.messages && processResult.messages.length > 0 && html`
                <div class="maapi-section">
                  <strong>${__('Messages:', 'massive_action_api')}</strong>
                  <ul class="maapi-list">
                    ${processResult.messages.map(msg => html`<li>${msg}</li>`)}
                  </ul>
                </div>
              `}
              ${processResult.errors && processResult.errors.length > 0 && html`
                <div class="maapi-section">
                  <strong class="maapi-errors-title">${__('Errors:', 'massive_action_api')}</strong>
                  <ul class="maapi-list maapi-list--errors">
                    ${processResult.errors.map(msg => html`<li>${msg}</li>`)}
                  </ul>
                </div>
              `}
              ${processResult.cancelled && html`
                <div class="maapi-section maapi-cancelled"><strong>${__('Processing was cancelled by user.', 'massive_action_api')}</strong></div>
              `}
            `}
          </div>
        </div>`}
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  render(html`<${App} />`, document.getElementById('plugin_massive_action_api_api_console'));
});