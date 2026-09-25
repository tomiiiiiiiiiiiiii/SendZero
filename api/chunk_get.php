<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

$id = isset($_GET['id']) ? strtolower($_GET['id']) : '';
$index = isset($_GET['index']) ? (int)$_GET['index'] : -1;
$token = isset($_GET['token']) ? strtolower($_GET['token']) : '';

$meta = sz_require_ready_meta($id);

if ($index < 0 || $index >= (int)$meta['chunk_count']) {
    http_response_code(400);
    exit;
}

if (!sz_check_transfer_download_token($id, $meta, $token)) {
    http_response_code(403);
    exit;
}

$path = sz_chunk_path($id, $index);
if (!is_file($path)) {
    http_response_code(404);
    exit;
}

$bytes = (int)filesize($path);

if (!sz_download_egress_consume($id, $meta, $bytes)) {
    header('Retry-After: 3600');
    http_response_code(429);
    exit;
}

header('Content-Type: application/octet-stream');
header('Content-Length: ' . $bytes);
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
readfile($path);
