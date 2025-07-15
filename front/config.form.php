<?php
include("../../../inc/includes.php");
require_once(Plugin::getPhpDir('massive_action_api') . "/inc/config.class.php");

$plugin = new Plugin();

if($plugin->isActivated("massive_action_api")) {
    $config = new PluginMassiveActionApiConfig();
    if(isset($_POST["update"])) {
        Session::checkRight("plugin_massive_action_api_config", UPDATE);
        $config::updateConfigValues($_POST);
    } else {
        if (!Session::haveRight("plugin_massive_action_api_config", READ | UPDATE)) {
            Html::displayRightError();
            return;
        }
        Html::header("Massive Action API", $_SERVER["PHP_SELF"], "config", Plugin::class);
        $config->showConfigForm();
    }
} else {
    Html::header("settings", '', "config", "plugins");
    echo "<div class='center'><br><br><img src=\"".$CFG_GLPI["root_doc"]."/pics/warning.png\" alt='warning'><br><br>";
    echo "<b>Please enable the plugin before configuring it</b></div>";
    Html::footer();
}

Html::footer();
