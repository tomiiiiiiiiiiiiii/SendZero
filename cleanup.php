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

$allocationRemoved = 0;
$allocationDir = DATA_DIR . '/.allocations';

if (is_dir($allocationDir)) {
    $allocationFiles = @scandir($allocationDir);

    if (is_array($allocationFiles)) {
        foreach ($allocationFiles as $name) {
            if ($name === '.' || $name === '..' || !preg_match('/^[a-f0-9]{32}$/', $name)) {
                continue;
            }

            $path = $allocationDir . '/' . $name;
            $expiresAt = (int)@file_get_contents($path);

            if ($expiresAt <= time()) {
                @unlink($path);
                $allocationRemoved++;
            }
        }
    }
}

echo 'Removed transfers: ' . $removed .
    '; allocation tokens: ' . $allocationRemoved . PHP_EOL;
