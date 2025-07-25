<?php

namespace GlpiPlugin\MassiveActionApi;

use FastRoute;
use FastRoute\Dispatcher;
use GlpiPlugin\MassiveActionApi\Handlers\AvailableActionsHandler;
use GlpiPlugin\MassiveActionApi\Handlers\SpecializeActionHandler;
use GlpiPlugin\MassiveActionApi\Handlers\ProcessActionsHandler;
use GlpiPlugin\MassiveActionApi\Handlers\GetItemTypesHandler;

if (!defined('GLPI_ROOT')) {
    define('GLPI_ROOT', realpath(dirname(__FILE__) . '/../../../..'));
}
include_once(GLPI_ROOT . '/inc/includes.php');

class ApiRouter
{
    private $dispatcher;
    private $iptxt;
    private $ipnum;
    private $app_tokens;

    public function __construct()
    {
        $this->dispatcher = FastRoute\simpleDispatcher(function (FastRoute\RouteCollector $r) {
            $r->addRoute('GET', '/available_actions/{itemtype}', function ($itemtype) {
                $handler = new AvailableActionsHandler();
                echo json_encode($handler->handle($itemtype));
            });
            $r->addRoute('POST', '/specialize_action', function () {
                $handler = new SpecializeActionHandler();
                $data = json_decode(file_get_contents('php://input'), true);
                echo json_encode($handler->handle($data));
            });
            $r->addRoute('POST', '/process_action', function () {
                $handler = new ProcessActionsHandler();
                $data = json_decode(file_get_contents('php://input'), true);
                echo json_encode($handler->handle($data));
            });

            $r->addRoute('GET', '/ui/itsm-itemtypes', function () {
                $handler = new GetItemTypesHandler();
                echo json_encode($handler->handle());
            });
        });
    }

    private function retrieveSession()
    {
        $headers = getallheaders();
        $sessionToken = $headers['Session-Token'] ?? null;

        // If the session token is not in the headers, check the cookies
        if (!$sessionToken) {
            // Dynamically search for the session token in cookies
            foreach ($_COOKIE as $key => $value) {
                if (preg_match('/^glpi_[^_]+$/', $key)) { // Match glpi_<random> but exclude glpi_<random>_rememberme
                    $sessionToken = $value;
                    break;
                }
            }
        }

        if ($sessionToken) {
            // Initialize GLPI session with the token
            if (session_id() !== '') {
                session_write_close();
            }

            session_id($sessionToken);
            session_start();

            // Check if session is valid and user is authenticated
            if (isset($_SESSION['glpiID']) && $_SESSION['glpiID'] > 0) {
                // Session is already valid
                return $sessionToken;
            }

            session_destroy();
            return null;
        }
        return null;
    }

    private function initApi()
    {
        global $CFG_GLPI;

        // Check if user is properly authenticated
        if (!isset($_SESSION['glpiID']) || $_SESSION['glpiID'] <= 0) {
            return [
                "error" => __("User not authenticated"),
            ];
        }

        // Verify user has necessary permissions by checking if active profile exists
        if (!isset($_SESSION['glpiactiveprofile']) || empty($_SESSION['glpiactiveprofile'])) {
            return [
                "error" => __("No active profile found"),
            ];
        }

        ini_set('display_errors', 'Off');

        // Avoid keeping messages between api calls
        $_SESSION["MESSAGE_AFTER_REDIRECT"] = [];

        // check if api is enabled
        if (!$CFG_GLPI['enable_api']) {
            return [
                "error" => __("API disabled"),
            ];
        }

        // retrieve ip of client
        $this->iptxt = \Toolbox::getRemoteIpAddress();
        $this->ipnum = strstr($this->iptxt, ':') === false ? ip2long($this->iptxt) : '';

        // check ip access
        $apiclient = new \APIClient();
        $where_ip = [];
        if ($this->ipnum) {
            $where_ip = [
                'OR' => [
                    'ipv4_range_start' => null,
                    [
                        'ipv4_range_start' => ['<=', $this->ipnum],
                        'ipv4_range_end' => ['>=', $this->ipnum]
                    ]
                ]
            ];
        } else {
            $where_ip = [
                'OR' => [
                    ['ipv6' => null],
                    ['ipv6' => $this->iptxt]
                ]
            ];
        }
        $found_clients = $apiclient->find(['is_active' => 1] + $where_ip);
        if (count($found_clients) <= 0) {
            return [
                "error" => __("There isn't an active API client matching your IP address in the configuration") .
                    " (" . $this->iptxt . ")",
            ];
        }
        $app_tokens = array_column($found_clients, 'app_token');
        $apiclients_id = array_column($found_clients, 'id');
        $this->app_tokens = array_combine($apiclients_id, $app_tokens);
        return null;
    }

    public function handleRequest(string $httpMethod, string $uri)
    {
        $sessionToken = $this->retrieveSession();
        if ($sessionToken === null) {
            http_response_code(401);
            echo json_encode(['error' => 'Unauthorized']);
            return;
        }

        $apiInit = $this->initApi();
        if ($apiInit !== null) {
            http_response_code(403);
            echo json_encode($apiInit);
            return;
        }
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