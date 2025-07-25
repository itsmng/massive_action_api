const { h, render } = preact;
const { useState, useEffect } = preactHooks;
const html = htm.bind(h);

function App() {
  const [itemTypes, setItemTypes] = useState([]);
  const [selectedItemType, setSelectedItemType] = useState('');
  const [actions, setActions] = useState([]);
  const [selectedAction, setSelectedAction] = useState('');
  const [keyValuePairs, setKeyValuePairs] = useState([{ key: '', value: '' }]);
  const [itemIds, setItemIds] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processResult, setProcessResult] = useState(null);

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

    if (itemType) {
      fetch(`/plugins/massive_action_api/api.php/available_actions/${itemType}`, {
        headers: {
          'Content-Type': 'application/json',
        }
      })
        .then(response => response.json())
        .then(data => setActions(data.actions || []))
        .catch(error => console.error('Error fetching actions:', error));
    } else {
      setActions([]);
    }
  };

  const handleActionChange = (event) => {
    setSelectedAction(event.target.value);
  };

  const handleKeyValueChange = (index, field, value) => {
    const updatedPairs = [...keyValuePairs];
    updatedPairs[index][field] = value;
    setKeyValuePairs(updatedPairs);
  };

  const addKeyValuePair = () => {
    setKeyValuePairs([...keyValuePairs, { key: '', value: '' }]);
  };

  const removeKeyValuePair = (index) => {
    setKeyValuePairs(keyValuePairs.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (!selectedItemType || !selectedAction || !itemIds.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    const ids = itemIds.split(',')
      .map(id => parseInt(id.trim()))
      .filter(id => !isNaN(id));

    if (ids.length === 0) {
      alert('Please enter valid item IDs');
      return;
    }

    const actionData = {};
    keyValuePairs.forEach(pair => {
      if (pair.key.trim() && pair.value.trim()) {
        actionData[pair.key.trim()] = pair.value.trim();
      }
    });

    const [processor, action] = selectedAction.split(':');
    
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
    <div style="padding: 20px; font-family: Arial, sans-serif;">
      <h1 style="margin-bottom: 20px;">Massive Action API</h1>
      <div style="margin-bottom: 20px;">
        <label for="itemType" style="display: block; margin-bottom: 5px;">Select Item Type:</label>
        <select id="itemType" onChange=${handleItemTypeChange} style="padding: 5px; width: 100%; max-width: 300px;">
          <option value="">-- Select an Item Type --</option>
          ${itemTypes.map(item => html`<option value="${item}">${item}</option>`)}</select>
      </div>

      ${actions.length > 0 && html`
        <div style="margin-bottom: 20px;">
          <label for="action" style="display: block; margin-bottom: 5px;">Select Action:</label>
          <select id="action" onChange=${handleActionChange} style="padding: 5px; width: 100%; max-width: 300px;">
            <option value="">-- Select an Action --</option>
            ${actions.map(action => html`<option value="${action.key}">${action.label}</option>`)}</select>
        </div>`}

      ${selectedAction && html`
        <div style="margin-bottom: 20px;">
          <h2 style="margin-bottom: 10px;">Define Data for Action</h2>
          ${keyValuePairs.map((pair, index) => html`
            <div style="display: flex; align-items: center; margin-bottom: 10px;">
              <input
                type="text"
                placeholder="Key"
                value="${pair.key}"
                onInput=${(e) => handleKeyValueChange(index, 'key', e.target.value)}
                style="padding: 5px; margin-right: 10px; flex: 1;"
              />
              <input
                type="text"
                placeholder="Value"
                value="${pair.value}"
                onInput=${(e) => handleKeyValueChange(index, 'value', e.target.value)}
                style="padding: 5px; margin-right: 10px; flex: 1;"
              />
              <button onClick=${() => removeKeyValuePair(index)} style="padding: 5px 10px; background-color: #f44336; color: white; border: none; cursor: pointer;">Remove</button>
            </div>`)}
          <button onClick=${addKeyValuePair} style="padding: 10px 15px; background-color: #4CAF50; color: white; border: none; cursor: pointer;">Add Key-Value Pair</button>
        </div>`}

      ${selectedAction && html`
        <div style="margin-bottom: 20px;">
          <label for="itemIds" style="display: block; margin-bottom: 5px;">Item IDs (comma-separated):</label>
          <textarea
            id="itemIds"
            value=${itemIds}
            onInput=${(e) => setItemIds(e.target.value)}
            style="width: 100%; max-width: 600px; height: 100px; padding: 10px; margin-bottom: 10px;"
            placeholder="Enter item IDs separated by commas (e.g., 1, 2, 3)"
          ></textarea>
        </div>
        <div style="margin-bottom: 20px;">
          <button 
            onClick=${handleSubmit}
            disabled=${isProcessing}
            style="padding: 10px 20px; background-color: #2196F3; color: white; border: none; cursor: pointer; ${isProcessing ? 'opacity: 0.7;' : ''}"
          >
            ${isProcessing ? 'Processing...' : 'Process Action'}
          </button>
        </div>`}

      ${processResult && html`
        <div style="margin-top: 20px; padding: 15px; border-radius: 4px; ${processResult.error ? 'background-color: #ffebee;' : 'background-color: #e8f5e9;'}">
          ${processResult.error ? html`
            <h3 style="color: #c62828; margin: 0 0 10px 0;">Error</h3>
            <p style="margin: 0;">${processResult.error}</p>
          ` : html`
            <h3 style="color: #2e7d32; margin: 0 0 10px 0;">Result</h3>
            <p style="margin: 0 0 5px 0;">✓ Successful: ${processResult.ok || 0}</p>
            <p style="margin: 0 0 5px 0;">✗ Failed: ${processResult.ko || 0}</p>
            <p style="margin: 0 0 5px 0;">⚠ No Rights: ${processResult.noright || 0}</p>
            ${processResult.messages && processResult.messages.length > 0 && html`
              <div style="margin-top: 10px;">
                <strong>Messages:</strong>
                <ul style="margin: 5px 0 0 0; padding-left: 20px;">
                  ${processResult.messages.map(msg => html`<li>${msg}</li>`)}
                </ul>
              </div>
            `}
          `}
        </div>`}
    </div>`;
}

document.addEventListener('DOMContentLoaded', () => {
  render(html`<${App} />`, document.getElementById('plugin_massive_action_api_api_console'));
});