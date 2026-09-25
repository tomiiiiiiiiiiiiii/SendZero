<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

$id = isset($_GET['id']) ? strtolower($_GET['id']) : '';
$meta = sz_require_ready_meta($id);

sz_json(array(
    'ok' => true,
    'version' => 2,
    'expires_at' => (int)$meta['expires_at'],
    'file_size' => (int)$meta['file_size'],
    'chunk_size' => (int)$meta['chunk_size'],
    'chunk_count' => (int)$meta['chunk_count'],
    'once' => !empty($meta['once'])
), 200);
