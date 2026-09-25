<?php
require_once __DIR__ . '/common.php';

$id = isset($_GET['id']) ? strtolower($_GET['id']) : '';
$index = isset($_GET['index']) ? (int)$_GET['index'] : -1;
$token = isset($_GET['token']) ? strtolower($_GET['token']) : '';

$meta = sz_require_ready_meta($id);

if ($index < 0 || $index >= (int)$meta['chunk_count']) {
    http_response_code(400);
    exit;
}

if (!sz_check_download_token($meta, $token)) {
    http_response_code(403);
    exit;
}

$path = sz_chunk_path($id, $index);
if (!is_file($path)) {
    http_response_code(404);
    exit;
}

header('Content-Type: application/octet-stream');
header('Content-Length: ' . filesize($path));
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
readfile($path);
