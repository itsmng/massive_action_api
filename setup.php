<?php

global $CFG_GLPI;
// Version of the plugin (major.minor.bugfix)
define('SKELETON_VERSION', '1.0.0');

define ('SKELETON_ITSMNG_MIN_VERSION', '2.0');

/**
 * Define the plugin's version and informations
 *
 * @return Array [name, version, author, homepage, license, minGlpiVersion]
 */
function plugin_version_skeleton() {
   $requirements = [
      'name'           => 'Skeleton Plugin',
      'version'        => SKELETON_VERSION,
      'author'         => 'ITSMNG Team',
      'homepage'       => 'https://github.com/itsmng/plugin-skeleton',
      'license'        => '<a href="../plugins/plugin-skeleton/LICENSE" target="_blank">GPLv3</a>',
   ];
   return $requirements;
}

/**
 * Initialize all classes and generic variables of the plugin
 */
function plugin_init_skeleton() {
   global $PLUGIN_HOOKS, $CFG_GLPI;

   // Set the plugin CSRF compliance (required since GLPI 0.84)
   $PLUGIN_HOOKS['csrf_compliant']['skeleton'] = true;

   // Register profile rights
   Plugin::registerClass(PluginSkeletonProfile::class, ['addtabon' => 'Profile']);
   $PLUGIN_HOOKS['change_profile']['skeleton'] = [PluginSkeletonProfile::class, 'changeProfile'];

   if (Session::haveRight('plugin_skeleton_config', UPDATE)) {
       $PLUGIN_HOOKS['config_page']['skeleton'] = 'front/config.form.php';
   }
}

/**
 * Check plugin's prerequisites before installation
 *
 * @return boolean
 */
function skeleton_check_prerequisites() {
   $prerequisitesSuccess = true;

   if (version_compare(ITSM_VERSION, SKELETON_ITSMNG_MIN_VERSION, 'lt')) {
      echo "This plugin requires ITSM >= " . SKELETON_ITSMNG_MIN_VERSION . "<br>";
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
function skeleton_check_config($verbose = false) {
   if ($verbose) {
      echo "Checking plugin configuration<br>";
   }
   return true;
}
