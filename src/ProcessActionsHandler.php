<?php

namespace Itsmng\Plugin\MassiveActionApi;

use MassiveAction;

class ProcessActionsHandler
{
    /**
     * @OA\Post(
     *     path="/process_action",
     *     summary="Process a massive action",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             type="object",
     *             @OA\Property(property="is_deleted", type="integer", enum={0, 1}, default=0),
     *             @OA\Property(
     *                 property="items",
     *                 type="object",
     *                 description="A map of item types to arrays of item IDs.",
     *                 additionalProperties={
     *                     "type": "array",
     *                     "items": {"type": "integer"}
     *                 }
     *             ),
     *             @OA\Property(property="action", type="string", description="The key of the action to perform."),
     *             @OA\Property(property="processor", type="string", description="The class name of the action processor."),
     *             @OA\Property(
     *                 property="initial_items",
     *                 type="object",
     *                 description="The initial set of items, used by the process stage.",
     *                 additionalProperties={
     *                     "type": "array",
     *                     "items": {"type": "integer"}
     *                 }
     *             ),
     *             @OA\Property(
     *                 property="action_data",
     *                 type="object",
     *                 description="Additional data required by the action (e.g., content for followup)",
     *                 additionalProperties=true
     *             )
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="The result of the action",
     *         @OA\JsonContent(
     *             type="object",
     *             @OA\Property(property="ok", type="integer"),
     *             @OA\Property(property="ko", type="integer"),
     *             @OA\Property(property="noright", type="integer"),
     *             @OA\Property(property="messages", type="array", @OA\Items(type="string"))
     *         )
     *     ),
     *     @OA\Response(
     *         response=400,
     *         description="Invalid input"
     *     )
     * )
     */
    public function handle(array $data)
    {
        try {
            // Extract action_data if provided
            $action_data = $data['action_data'] ?? [];
            
            $action_split = explode(':', $data['action']);
            if (count($action_split) < 2) {
                throw new \Exception('Invalid action format. Expected "plugin:action".');
            }
            $processor = $action_split[0];
            $action = $action_split[1];

            $ma_params = [
                'items' => $data['items'] ?? [],
                'massiveaction' => $data['action'] ?? '',
                'processor' => $processor,
                'action' => $action,
                'initial_items' => $data['initial_items'] ?? $data['items'] ?? [],
                'is_deleted' => $data['is_deleted'] ?? 0,
            ];
            
            $ma_params = array_merge($ma_params, $action_data);

            if (empty($ma_params['items'])) {
                http_response_code(400);
                return ['error' => 'No items provided'];
            }
            if (empty($ma_params['action'])) {
                http_response_code(400);
                return ['error' => 'No action provided'];
            }
            if (empty($ma_params['processor'])) {
                http_response_code(400);
                return ['error' => 'No processor provided'];
            }
            
            
            $ma = new MassiveAction($ma_params, [], 'process');
            $results = $ma->process();
            http_response_code(200);
            return $results;
        } catch (\Exception $e) {
            http_response_code(400);
            return ['error' => $e->getMessage()];
        }
    }
}
