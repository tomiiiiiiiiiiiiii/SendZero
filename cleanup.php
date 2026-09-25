<?php
require_once __DIR__ . '/api/common.php';

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

$removed = 0;
$items = @scandir(DATA_DIR);
if (!is_array($items)) {
    exit("Removed: 0\n");
}

foreach ($items as $id) {
    if ($id === '.' || $id === '..' || !sz_valid_id($id)) {
        continue;
    }

    $meta = sz_load_meta($id);
    if ($meta === false || sz_is_expired($meta)) {
        sz_delete_transfer($id);
        $removed++;
    }
}

echo 'Removed: ' . $removed . PHP_EOL;
