<?php

namespace Itsmng\Plugin\MassiveActionApi;

use FastRoute;
use FastRoute\Dispatcher;

class MassiveActionApi {
    private $dispatcher;

    public function __construct() {
        $this->dispatcher = FastRoute\simpleDispatcher(function(FastRoute\RouteCollector $r) {
            $r->addRoute('GET', '/available_actions/{itemtype}', function($itemtype) {
                $handler = new AvailableActionsHandler();
                echo json_encode($handler->handle($itemtype));
            });
            $r->addRoute('POST', '/specialize_action', function() {
                $handler = new SpecializeActionHandler();
                $data = json_decode(file_get_contents('php://input'), true);
                echo json_encode($handler->handle($data));
            });
            $r->addRoute('POST', '/process_action', function() {
                $handler = new ProcessActionsHandler();
                $data = json_decode(file_get_contents('php://input'), true);
                echo json_encode($handler->handle($data));
            });
        });
    }

    public function handleRequest(string $httpMethod, string $uri) {
        $routeInfo = $this->dispatcher->dispatch($httpMethod, $uri);

        switch ($routeInfo[0]) {
            case Dispatcher::NOT_FOUND:
                http_response_code(404);
                echo json_encode(['error' => 'Not Found']);
                break;
            case Dispatcher::METHOD_NOT_ALLOWED:
                http_response_code(405);
                echo json_encode(['error' => 'Method Not Allowed']);
                break;
            case Dispatcher::FOUND:
                $handler = $routeInfo[1];
                $vars = $routeInfo[2];
                // Call the handler with the variables
                if (is_callable($handler)) {
                    call_user_func_array($handler, $vars);
                } else {
                    http_response_code(500);
                    echo json_encode(['error' => 'Internal Server Error']);
                }
                break;
        }
    }
}