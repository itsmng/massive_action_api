<?php

use GlpiPlugin\MassiveActionApi\PluginMassiveActionApiConfig;
use GlpiPlugin\MassiveActionApi\PluginMassiveActionApiProfile;

function plugin_massive_action_api_install() {
   set_time_limit(900);
   ini_set('memory_limit', '2048M');

   $classesToInstall = [
      PluginMassiveActionApiConfig::class,
      PluginMassiveActionApiProfile::class,
   ];

   echo "<center>";
   echo "<table class='tab_cadre_fixe'>";
   echo "<tr><th>".__("MySQL tables installation", "massive_action_api")."<th></tr>";

   echo "<tr class='tab_bg_1'>";
   echo "<td align='center'>";

   //install
   foreach ($classesToInstall as $class) {
      if (isPluginItemType($class)) {
         if (!call_user_func([$class,'install'])) {
            return false;
         }
      }
   }

   echo "</td>";
   echo "</tr>";
   echo "</table></center>";

   return true;
}

function plugin_massive_action_api_uninstall() {
   echo "<center>";
   echo "<table class='tab_cadre_fixe'>";
   echo "<tr><th>".__("MySQL tables uninstallation", "massive_action_api")."<th></tr>";

   echo "<tr class='tab_bg_1'>";
   echo "<td align='center'>";

   $classesToUninstall = [
      PluginMassiveActionApiConfig::class,
      PluginMassiveActionApiProfile::class,
   ];

   foreach ($classesToUninstall as $class) {
      if (isPluginItemType($class)) {
         if (!call_user_func([$class,'uninstall'])) {
            return false;
         }
      }
   }

   echo "</td>";
   echo "</tr>";
   echo "</table></center>";

   return true;
}
