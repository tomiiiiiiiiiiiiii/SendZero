<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

$id = isset($_GET['id']) ? strtolower($_GET['id']) : '';
$meta = sz_require_ready_meta($id);
$path = sz_manifest_path($id);

if (!is_file($path)) {
    http_response_code(404);
    exit;
}

header('Content-Type: application/octet-stream');
header('Content-Length: ' . filesize($path));
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
readfile($path);
