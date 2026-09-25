<?php
require_once __DIR__ . '/common.php';

sz_require_role('master');

$nodeId = isset($_GET['n']) ? (string)$_GET['n'] : '';
if (!sz_valid_node_id($nodeId)) {
    sz_json(array('ok' => false, 'error' => 'invalid_node'), 400);
}

$node = sz_master_find_node($nodeId);

/*
 * Backward compatibility for links created before node IDs were embedded.
 * Old links resolve as "local". If the master now has exactly one node,
 * route that legacy alias to the only configured node.
 */
if ($node === false && $nodeId === 'local') {
    $nodes = sz_master_nodes();
    if (count($nodes) === 1) {
        foreach ($nodes as $legacyId => $legacyNode) {
            $nodeId = $legacyId;
            $node = $legacyNode;
            break;
        }
    }
}

if ($node === false) {
    sz_json(array('ok' => false, 'error' => 'node_not_found'), 404);
}

/*
 * Downloads must continue to resolve even when a node no longer accepts new
 * uploads, so this endpoint intentionally ignores the node's enabled flag.
 */
sz_json(array(
    'ok' => true,
    'node_id' => $nodeId,
    'api_base' => sz_master_node_url($node)
), 200);
