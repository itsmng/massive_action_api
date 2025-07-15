<?php

global $CFG_GLPI;
// Version of the plugin (major.minor.bugfix)
define('MASSIVE_ACTION_API_VERSION', '1.0.0');

define('MASSIVE_ACTION_API_ITSMNG_MIN_VERSION', '2.0');

// This code injects the autoloader for the plugin
$hostLoader = require __DIR__ . '/../../vendor/autoload.php';

$hostLoader->addPsr4(
    'Itsmng\\Plugin\\MassiveActionApi\\',
    __DIR__ . '/src/'
);

/**
 * Define the plugin's version and informations
 *
 * @return array [name, version, author, homepage, license, minGlpiVersion]
 */
function plugin_version_massive_action_api() {
   $requirements = [
      'name'           => 'Massive Action API',
      'version'        => MASSIVE_ACTION_API_VERSION,
      'author'         => 'ITSMNG Team',
      'homepage'       => 'https://github.com/itsmng/massive_action_api',
      'license'        => '<a href="../plugins/massive_action_api/LICENSE" target="_blank">GPLv3</a>',
   ];
   return $requirements;
}

/**
 * Initialize all classes and generic variables of the plugin
 */
function plugin_init_massive_action_api() {
   global $PLUGIN_HOOKS, $CFG_GLPI;

   // Set the plugin CSRF compliance (required since GLPI 0.84)
   $PLUGIN_HOOKS['csrf_compliant']['massive_action_api'] = true;

   // Register profile rights
   Plugin::registerClass(PluginMassiveActionApiProfile::class, ['addtabon' => 'Profile']);
   $PLUGIN_HOOKS['change_profile']['massive_action_api'] = [PluginMassiveActionApiProfile::class, 'changeProfile'];

   if (Session::haveRight('plugin_massive_action_api_config', UPDATE)) {
       $PLUGIN_HOOKS['config_page']['massive_action_api'] = 'front/config.form.php';
   }
}

/**
 * Check plugin's prerequisites before installation
 *
 * @return boolean
 */
function massive_action_api_check_prerequisites() {
   $prerequisitesSuccess = true;

   if (version_compare(ITSM_VERSION, MASSIVE_ACTION_API_ITSMNG_MIN_VERSION, 'lt')) {
      echo "This plugin requires ITSM >= " . MASSIVE_ACTION_API_ITSMNG_MIN_VERSION . "<br>";
      $prerequisitesSuccess = false;
   }

   return $prerequisitesSuccess;
}

/**
 * Check plugin's config before activation (if needed)
 *
 * @param string $verbose Set true to show all messages (false by default)
 * @return boolean
 */
function massive_action_api_check_config($verbose = false) {
   if ($verbose) {
      echo "Checking plugin configuration<br>";
   }
   return true;
}
