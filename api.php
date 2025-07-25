<?php

include("../../inc/includes.php");
include("./src/MassiveActionApi.php");
include("./vendor/autoload.php");

header('Content-Type: application/json');
ini_set('session.use_cookies', 0);

// Check if plugin is activated...
if (!(new Plugin())->isActivated('massive_action_api')) {
    http_response_code(404);
    echo json_encode(['error' => 'Plugin not activated']);
    exit;
}

$request_uri = $_SERVER['REQUEST_URI'];
$verb = $_SERVER['REQUEST_METHOD'];
$uri = (isset($_SERVER['PATH_INFO'])) ? str_replace("api/", "", trim($_SERVER['PATH_INFO'], '/')) : '';

$api = new GlpiPlugin\MassiveActionApi\ApiRouter();

if (false !== $pos = strpos($uri, '?')) {
    $uri = substr($uri, 0, $pos);
}
$uri = rawurldecode($uri);

$api->handleRequest($verb, "/" . $uri);