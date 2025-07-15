<?php

class PluginSkeletonProfile extends CommonDBTM {

    static function install() {
        global $DB;

        $table = self::getTable();

        if (!$DB->tableExists($table)) {
            $query = <<<SQL
              CREATE TABLE `$table` (
                  `id` int(11) NOT NULL AUTO_INCREMENT COMMENT 'RELATION to glpi_profiles (id)' ,
                  `name` VARCHAR(255) collate utf8_unicode_ci NOT NULL,
                  `value` TEXT collate utf8_unicode_ci default NULL,
                  PRIMARY KEY (`id`)
              ) ENGINE=InnoDB  DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
            SQL;

            $DB->queryOrDie($query, $DB->error());
        }

        return true;
    }

    static function uninstall() {
        global $DB;

        $table = self::getTable();

        if ($DB->tableExists($table)) {
            $query = <<<SQL
              DROP TABLE `$table`
            SQL;

            $DB->queryOrDie($query, $DB->error());
        }

        return true;
    }

	/**
	 * canCreate
	 *
	 * @return boolean
	 */
	static function canCreate() {
		if (isset($_SESSION["profile"])) return ($_SESSION["profile"]['pluginskeleton'] == 'w');
		return false;
	}

	/**
	 * canView
	 *
	 * @return boolean
	 */
	static function canView() {
		if (isset($_SESSION["profile"])) return ($_SESSION["profile"]['pluginskeleton'] == 'w' || $_SESSION["profile"]['pluginskeleton'] == 'r');
		return false;
	}

	/**
	 * createAdminAccess
	 *
	 * @param  int $ID
	 * @return void
	 */
	static function createAdminAccess($ID) {
		$myProf = new self();
		if (!$myProf->getFromDB($ID)) $myProf->add(array('id' => $ID, 'right' => 'w'));
	}

	/**
	 * addDefaultProfileInfos
	 *
	 * @param  int $profiles_id
	 * @param  array $rights
	 * @return void
	 */
	static function addDefaultProfileInfos($profiles_id, $rights) {
		$profileRight = new ProfileRight();

		foreach ($rights as $right => $value) {
			if (!countElementsInTable('glpi_profilerights', ['profiles_id' => $profiles_id, 'name' => $right])) {
				$myright['profiles_id'] = $profiles_id;
				$myright['name']        = $right;
				$myright['rights']      = $value;

				$profileRight->add($myright);

				$_SESSION['glpiactiveprofile'][$right] = $value;
			}
		}
	}

	/**
	 * changeProfile
	 *
	 * @return void
	 */
	static function changeProfile() {
		$prof = new self();

		if ($prof->getFromDB($_SESSION['glpiactiveprofile']['id'])) {
			$_SESSION["glpi_plugin_skeleton_profile"] = $prof->fields;
		} else {
			unset($_SESSION["glpi_plugin_skeleton_profile"]);
		}
	}

	/**
	 * getTabNameForItem
	 *
	 * @param  object $item
	 * @param  int $withtemplate
	 * @return string
	 */
	function getTabNameForItem(CommonGLPI $item, $withtemplate=0) {
		if (Session::haveRight("profile", UPDATE) && $item->getType() == 'Profile') {
			return __('Skeleton', 'skeleton');
		}

		return '';
	}

	/**
	 * displayTabContentForItem
	 *
	 * @param  object $item
	 * @param  int $tabnum
	 * @param  int $withtemplate
	 * @return boolean
	 */
	static function displayTabContentForItem(CommonGLPI $item, $tabnum=1, $withtemplate=0) {
		if ($item->getType() == 'Profile') {

			$ID = $item->getID();
			$prof = new self();

			foreach (self::getRightsGeneral() as $right) {
				self::addDefaultProfileInfos($ID, [$right['field'] => 0]);
			}

			$prof->showForm($ID);
		}

		return true;
	}

	/**
	 * getRightsGeneral
	 *
	 * @return array
	 */
	static function getRightsGeneral() {
		$rights = [
			[
				'itemtype'  => 'PluginSkeletonProfile',
				'label'     => __('Config update', 'pluginskeleton'),
				'field'     => 'plugin_skeleton_config',
				'rights'    =>  [UPDATE => __('Allow editing', 'pluginskeleton')],
				'default'   => 23
            ]
		];

		return $rights;
	}

	/**
	 * showForm
	 *
	 * @param  int $profiles_id
	 * @param  boolean $openform
	 * @param  boolean $closeform
	 * @return void
	 */
	function showForm($profiles_id = 0, $openform = true, $closeform = true) {

		if (!Session::haveRight("profile",READ)) return false;

		echo "<div class='firstbloc'>";

		if (($canedit = Session::haveRight('profile', UPDATE)) && $openform) {
			$profile = new Profile();
			echo "<form method='post' action='".$profile->getFormURL()."'>";
		}

		$profile = new Profile();
		$profile->getFromDB($profiles_id);
		$rights = $this->getRightsGeneral();
		$profile->displayRightsChoiceMatrix($rights, ['default_class' => 'tab_bg_2', 'title' => __('General')]);

		if ($canedit && $closeform) {
			echo "<div class='center'>";
			echo Html::hidden('id', ['value' => $profiles_id]);
			echo Html::submit(_sx('button', 'Save'), ['name' => 'update']);
			echo "</div>\n";
			Html::closeForm();
		}

		echo "</div>";
	}
}
