<?php

namespace GlpiPlugin\MassiveActionApi\Handlers;

use Exception;
use MassiveAction;

class SpecializeActionHandler
{
    /**
     * @OA\Post(
     *     path="/specialize_action",
     *     summary="Specialize a massive action",
     *     operationId="specializeAction",
     *     @OA\RequestBody(
     *         required=true,
     *         @OA\JsonContent(
     *             type="object",
     *             required={"action", "items"},
     *             @OA\Property(property="is_deleted", type="integer", enum={0, 1}, default=0),
     *             @OA\Property(
     *                 property="items",
     *                 type="object",
     *                 description="A map of item types to arrays of item IDs.",
     *             ),
     *             @OA\Property(property="action", type="string", description="The key of the action to perform."),
     *             @OA\Property(property="specialize_itemtype", type="string", description="The item type to specialize on, if required by the action.")
     *         )
     *     ),
     *     @OA\Response(
     *         response=200,
     *         description="The HTML form for the specialized action and the data for the process stage",
     *         @OA\JsonContent(
     *             type="object",
     *             @OA\Property(property="form_html", type="string"),
     *             @OA\Property(property="data_for_process", type="object")
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
        $initial_post = [];
        $initial_post['is_deleted'] = $data['is_deleted'] ?? 0;
        $initial_post['item'] = [];
        if (empty($data['items'])) {
            http_response_code(400);
            return ['error' => 'No items provided'];
        }
        foreach ($data['items'] as $itemtype => $ids) {
            foreach ($ids as $id) {
                $initial_post['item'][$itemtype][$id] = 1;
            }
        }

        try {
            $ma_initial = new MassiveAction($initial_post, [], 'initial');
            $specialize_post = $ma_initial->getInput();
            $specialize_post['items'] = $ma_initial->getItems();
        } catch (Exception $e) {
            http_response_code(400);
            return ['error' => "Initial stage failed: " . $e->getMessage()];
        }

        // Specialize stage

        $specialize_post['action'] = $data['action'] ?? null;
        if (empty($specialize_post['action'])) {
            http_response_code(400);
            return ['error' => 'No action provided'];
        }
        // For actions that need to select an itemtype first
        if (isset($data['specialize_itemtype'])) {
            $specialize_post['specialize_itemtype'] = $data['specialize_itemtype'];
        }

        try {
            $ma_specialize = new MassiveAction($specialize_post, [], 'specialize');
        } catch (Exception $e) {
            http_response_code(400);
            return ['error' => "Specialize stage failed: " . $e->getMessage()];
        }

        ob_start();
        $ma_specialize->showSubForm();
        $form_html = ob_get_clean();

        $process_data = $ma_specialize->getInput();
        $process_data['items'] = $ma_specialize->getItems();
        $process_data['action'] = $ma_specialize->getAction();
        $process_data['processor'] = $ma_specialize->getInput()['processor'] ?? 'MassiveAction';
        $process_data['is_deleted'] = $data['is_deleted'] ?? 0;
        
        if (isset($specialize_post['initial_items'])) {
            $process_data['initial_items'] = $specialize_post['initial_items'];
        }


        http_response_code(200);
        return [
            'form_html' => $form_html,
            'data_for_process' => $process_data
        ];
    }
}
