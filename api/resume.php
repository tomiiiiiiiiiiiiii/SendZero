<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$id = strtolower((string)sz_read_request_value('id', ''));
$token = strtolower((string)sz_read_request_value('token', ''));

if (!sz_valid_id($id)) {
    sz_json(array('ok' => false, 'error' => 'invalid_id'), 400);
}

$metaPath = sz_meta_path($id);
$fh = @fopen($metaPath, 'c+');
if (!$fh) {
    sz_json(array('ok' => false, 'error' => 'not_found'), 404);
}

if (!@flock($fh, LOCK_EX)) {
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'busy'), 503);
}

rewind($fh);
$meta = json_decode(stream_get_contents($fh), true);

if (!is_array($meta)) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'metadata_failed'), 500);
}

if (sz_is_expired($meta)) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_delete_transfer($id);
    sz_json(array('ok' => false, 'error' => 'expired'), 410);
}

if (!isset($meta['state']) || $meta['state'] !== 'uploading') {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'not_uploading'), 409);
}

if (!sz_check_upload_token($meta, $token)) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'forbidden'), 403);
}

/*
 * A legitimate resume attempt extends the incomplete-upload lease.
 * The upload token is required, so an unauthenticated request cannot
 * keep abandoned transfers alive.
 */
$meta['expires_at'] = time() + UPLOAD_SESSION_TTL;

if (!empty($meta['client_tag'])) {
    /*
     * Refresh the active-upload lease on a legitimate resume. If the
     * bookkeeping file was removed, reacquire the slot when possible.
     * A bookkeeping failure must not destroy an otherwise valid transfer.
     */
    @sz_active_upload_acquire(
        (string)$meta['client_tag'],
        $id,
        (int)$meta['expires_at']
    );
}

ftruncate($fh, 0);
rewind($fh);
fwrite($fh, json_encode($meta));
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);
@chmod($metaPath, 0600);

$uploaded = array();
$chunkCount = (int)$meta['chunk_count'];

for ($i = 0; $i < $chunkCount; $i++) {
    $path = sz_chunk_path($id, $i);
    if (!is_file($path)) {
        continue;
    }

    $plainSize = min(
        (int)$meta['chunk_size'],
        (int)$meta['file_size'] - ($i * (int)$meta['chunk_size'])
    );

    if ((int)@filesize($path) === $plainSize + 36) {
        $uploaded[] = $i;
    }
}

sz_json(array(
    'ok' => true,
    'id' => $id,
    'file_size' => (int)$meta['file_size'],
    'chunk_size' => (int)$meta['chunk_size'],
    'chunk_count' => $chunkCount,
    'manifest_uploaded' => is_file(sz_manifest_path($id)),
    'uploaded_chunks' => $uploaded,
    'uploaded_count' => count($uploaded),
    'expires_at' => (int)$meta['expires_at'],
    'retention_ttl' => (int)$meta['retention_ttl'],
    'once' => !empty($meta['once'])
), 200);
