<?php

include("../../../inc/includes.php");

// Check if plugin is activated...
if (!(new Plugin())->isActivated('massive_action_api')) {
    Html::displayNotFoundError();
}

$console = new GlpiPlugin\MassiveActionApi\ApiConsole();

Session::checkRight('pluginmassive_action_api', READ);

Html::header(
    __('Massive Action API Console', 'massive_action_api'),
    $_SERVER['PHP_SELF'],
    'plugins',
    GlpiPlugin\MassiveActionApi\ApiConsole::class,
    'option'
);

echo "<script type='module' src='" . Plugin::getWebDir('massive_action_api') . "/js/console.js'></script>";
echo "<div id='plugin_massive_action_api_api_console'></div>";

Html::footer();
