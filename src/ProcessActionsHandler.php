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
            $ma = new MassiveAction($data, [], 'process');
            $results = $ma->process();
            http_response_code(200);
            return $results;
        } catch (\Exception $e) {
            http_response_code(400);
            return ['error' => $e->getMessage()];
        }
    }
}
