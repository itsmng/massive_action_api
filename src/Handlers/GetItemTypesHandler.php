<?php

namespace GlpiPlugin\MassiveActionApi\Handlers;

class GetItemTypesHandler {
    public function handle() {
        global $CFG_GLPI;

        $itemTypes = array_merge(
            $CFG_GLPI['project_asset_types'], 
            $CFG_GLPI['document_types'], 
            $CFG_GLPI['consumables_types'],
            $CFG_GLPI['infocom_types']
        );

        $itemTypes = array_values(array_unique($itemTypes));
        sort($itemTypes);
        return $itemTypes;
    }
}