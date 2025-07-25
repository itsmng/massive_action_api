<?php

namespace GlpiPlugin\MassiveActionApi\Handlers;

use MassiveAction;

/**
 * @OA\Info(
 *   title="Massive Action API",
 *   version="1.0.0",
 *   description="API for performing massive actions in ITSM-NG"
 * )
 */
class AvailableActionsHandler
{
    /**
     * @OA\Get(
     *     path="/available_actions/{itemtype}",
     *     summary="Get available massive actions for an item type",
     *     @OA\Parameter(
     *         name="itemtype",
     *         in="path",
     *         required=true,
     *         description="The type of item to get actions for",
     *         @OA\Schema(type="string")
     *     ),
     *     @OA\Parameter(
     *         name="is_deleted",
     *         in="query",
     *         description="Whether to get actions for deleted items",
     *         @OA\Schema(type="integer", enum={0, 1}, default=0)
     *     ),
     *      @OA\Parameter(
     *         name="single",
     *         in="query",
     *         description="Whether to get actions for a single item",
     *         @OA\Schema(type="integer", enum={0, 1}, default=0)
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="A list of available actions",
     *         @OA\JsonContent(
     *             type="object",
     *             @OA\Property(property="actions", type="array", @OA\Items(
     *                 type="object",
     *                 @OA\Property(property="key", type="string", description="The key of the action"),
     *                 @OA\Property(property="label", type="string", description="The localized label of the action"),
     *                 @OA\Property(property="category", type="string", description="The category of the action")
     *             )),
     *             @OA\Property(property="itemtype", type="string", description="The type of item"),
     *             @OA\Property(property="is_deleted", type="integer", description="Whether the item is deleted"),
     *             @OA\Property(property="single", type="integer", description="Whether action is for a single item"),
     *             @OA\Property(property="count", type="integer", description="The number of available actions")
     *         )
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Invalid item type"
     *     )
     * )
     */
    public function handle(string $itemtype)
    {
        $is_deleted = (int)($_GET['is_deleted'] ?? 0);
        $single = (int)($_GET['single'] ?? 0);

        $item = getItemForItemtype($itemtype);
        if (!$item) {
            http_response_code(400);
            return ['error' => 'Invalid item type'];
        }

        $actions = MassiveAction::getAllMassiveActions($itemtype, $is_deleted, null, $single);
        if ($actions === false) {
            http_response_code(400);
            return ['error' => 'Cannot retrieve actions for this item type'];
        }

        $forbidden_actions = $item->getForbiddenStandardMassiveAction() ?? [];
        if (count($forbidden_actions) > 0) {
            $actions = array_diff_key($actions, array_flip($forbidden_actions));
        }

        $formatted_actions = [];
        foreach ($actions as $action_key => $action_label) {
            $formatted_actions[] = [
                'key' => $action_key,
                'label' => $action_label,
                'category' => explode(':', $action_key)[0] ?? 'unknown'
            ];
        }

        http_response_code(200);
        return [
            'actions' => $formatted_actions,
            'itemtype' => $itemtype,
            'is_deleted' => $is_deleted,
            'single' => $single,
            'count' => count($formatted_actions)
        ] ?? [];
    }
}