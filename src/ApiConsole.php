<?php

namespace GlpiPlugin\MassiveActionApi;

use CommonDBTM;

class ApiConsole extends CommonDBTM {
    function defineTabs($options = []) {
        $tabs = [];
        $this->addStandardTab(__CLASS__, $tabs, $options);
        return $tabs;
    }

    public static function getMenuContent(): array
    {
        $menu = [];
        $menu['title'] = __('Massive Action API Console', 'massive_action_api');
        $menu['icon'] = 'fas fa-terminal';
        $menu['page']  = "/plugins/massive_action_api/front/console.php";

        return $menu;
    }
}