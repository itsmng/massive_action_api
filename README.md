# ITSM Massive Action API

This plugin provides a REST API and a lightweight UI to build and execute massive actions, avoiding several limitations of the built-in massive action system.

## Key capabilities

- REST API to execute massive actions
- OpenAPI 3.0 document for the API
- UI console to build and test actions
- No request timeouts for long-running operations
- Action parameters inferred from ITSM Ajax subforms

## Installation

1) Install the plugin as usual (copy to plugins/massive_action_api and enable it).
2) Install dependencies:
```bash
composer install
yarn install --prod
```
3) Grant rights to your profile:
   - Go to Setup > Profiles
   - Edit the relevant profile
   - Enable the “Massive Action API” plugin permission

## Usage

### Massive Action API Console (recommended)
Use the "Massive Action API Console" under the Plugins menu to interactively:
- Select an item type
- Select an available massive action (list provided by the plugin)
- Enter target item IDs
- Fill the action parameters (derived from ITSM's Ajax subform)
- Execute and wait for the results

This is the easiest way to discover the parameters a massive action expects before calling the API.

### REST API

Base path:
```
/plugins/massive_action_api/api.php
```

Endpoints (non-exhaustive):
- GET `/ui/itsm-itemtypes` — List supported item types
- GET `/available_actions/{itemtype}` — List actions available for a given item type
- POST `/process_action` — Execute a massive action

Authentication:
- Use your existing GLPI session token via `Session-Token` header.

OpenAPI:
- An OpenAPI 3.0 document is provided to help generate clients and explore the API.

## Examples

Create a followup on several tickets:
```bash
curl -X POST \
  http://itsm.lan/plugins/massive_action_api/api.php/process_action \
  -H 'Content-Type: application/json' \
  -H 'Session-Token: <session-token>' \
  -d '{
    "items": {
      "Ticket": [1, 2, 3]
    },
    "action": "ITILFollowup:add_followup",
    "action_data": {
      "content": "This is a test followup created by the massive action API plugin.",
      "is_private": "0",
      "requesttypes_id": 4
    }
  }'
```

Response contains counters (ok, ko, noright) and messages, mirroring the ITSM massive action behavior.

## Understanding action_data

- The `action_data` object contains action-specific parameters.
- Available actions can be discovered via:
  ```
  GET /plugins/massive_action_api/api.php/available_actions/{itemtype}
  ```
- The required fields for `action_data` depend on the selected action. The Console UI derives these from ITSM's Ajax massive action subform and renders native inputs, so you can:
  1) Build the action in the Console
  2) Inspect the fields used
  3) Reuse the same structure when calling `/process_action`

Tip: The Console is the preferred way to identify the correct field names and formats for each action.

## Notes and limitations

- Action lists and forms are subject to user permissions and the selected items.
- Some complex widgets are simplified in the Console; values map to the underlying form fields used by ITSM.
- Actions and parameters can vary across ITSM versions/plugins.

## Troubleshooting

- If no actions are listed, verify your profile rights and that the selected item type is correct.
- If an action fails for all items, check the server logs and ensure the required `action_data` fields are present.
- Network tools (browser devtools) can help observe the Ajax subform payload when diagnosing unusual actions.
