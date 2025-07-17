# ITSM Massive Action API

This plugin exposes a simple REST API that allows users to create massive actions.

## Installation

1. Install the plugin as usual.
2. Run
```bash
./tools/skeleton.sh
composer install
```

## Features
- REST API
- OpenAPI 3.0 document

## Examples

1. Create a followup on several tickets:

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

## Understanding Massive Actions

This plugin provides an endpoint at `/available_actions/{itemtype}` to discover available massive actions. However, determining the required `action_data` for a specific action is more complex.

The `action_data` field stores the specific parameters for massive action forms. To perform a massive action via the API, you'll need to inspect the UI/web requests of a graphical massive action first before writing your API call most likely.

Currently, there isn't a straightforward way to display which `action_data` is available for each endpoint, as this information is primarily managed within Ajax UI endpoints.
