<?php

include("../../inc/includes.php");
include("./vendor/autoload.php");

$openapi = \OpenApi\Generator::scan([
    __DIR__ . '/src',
]);

if (!isset($_GET['yaml'])) {
    header('Content-Type: application/json');
    echo $openapi->toJson();
    exit;
}

header('Content-Type: application/x-yaml');
echo $openapi->toYaml();
exit;