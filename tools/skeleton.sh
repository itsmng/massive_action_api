#!/bin/bash

# Ask for the name of the plugin
echo -n "Enter the name of the plugin: "
read plugin_name

# replace skeleton with the name of the plugin
echo "Replacing skeleton with $plugin_name"
find ./inc/ ./front/ -type f -exec sed -i "s/skeleton/$plugin_name/g" {} \;
sed -i "s/skeleton/$plugin_name/g" setup.php hook.php

# replace Skeleton with the name of the plugin with a capital letter
echo "Replacing Skeleton with ${plugin_name^}"
find ./inc/ ./front/ -type f -exec sed -i "s/Skeleton/${plugin_name^}/g" {} \;
sed -i "s/Skeleton/${plugin_name^}/g" setup.php hook.php

# replace skeleton with the name of the plugin
echo "Replacing SKELETON with ${plugin_name^^}"
find ./inc/ ./front/ -type f -exec sed -i "s/SKELETON/${plugin_name^^}/g" {} \;
sed -i "s/SKELETON/${plugin_name^^}/g" setup.php hook.php
