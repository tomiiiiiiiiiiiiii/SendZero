<?php
require_once __DIR__ . '/common.php';

sz_require_role('node');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    sz_json(array('ok' => false, 'error' => 'method_not_allowed'), 405);
}

$id = strtolower((string)sz_read_request_value('id', ''));
$resumeToken = strtolower((string)sz_read_request_value('token', ''));

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

if (!isset($meta['state']) || $meta['state'] !== 'ready') {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'not_ready'), 409);
}

if (empty($meta['once'])) {
    flock($fh, LOCK_UN);
    fclose($fh);

    $session = sz_download_session_start($id, $resumeToken);
    if (empty($session['ok'])) {
        $status = isset($session['error']) && $session['error'] === 'too_many_active_downloads'
            ? 429
            : 503;

        sz_json(array(
            'ok' => false,
            'error' => isset($session['error']) ? $session['error'] : 'download_session_unavailable'
        ), $status);
    }

    sz_json(array(
        'ok' => true,
        'token' => $session['token'],
        'resumed' => !empty($session['resumed'])
    ), 200);
}

/*
 * A resumable one-time download may present the token previously issued to
 * this browser. Matching the stored token hash is enough to reclaim the
 * session, even if the short session lease expired in the meantime, provided
 * the transfer itself has not expired and another client has not claimed it.
 */
if (
    sz_valid_token($resumeToken) &&
    isset($meta['download_token_hash']) &&
    sz_safe_equals($meta['download_token_hash'], hash('sha256', $resumeToken))
) {
    $leaseUntil = time() + DOWNLOAD_SESSION_TTL;
    $meta['download_session_expires'] = $leaseUntil;
    if ((int)$meta['expires_at'] < $leaseUntil) {
        $meta['expires_at'] = $leaseUntil;
    }

    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($meta));
    fflush($fh);
    flock($fh, LOCK_UN);
    fclose($fh);
    @chmod($metaPath, 0600);

    sz_json(array(
        'ok' => true,
        'token' => $resumeToken,
        'resumed' => true
    ), 200);
}

if (
    isset($meta['download_session_expires']) &&
    (int)$meta['download_session_expires'] > time()
) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'one_time_in_progress'), 409);
}

try {
    $token = sz_random_hex(32);
} catch (Exception $e) {
    flock($fh, LOCK_UN);
    fclose($fh);
    sz_json(array('ok' => false, 'error' => 'server_random_unavailable'), 500);
}

$meta['download_token_hash'] = hash('sha256', $token);
$leaseUntil = time() + DOWNLOAD_SESSION_TTL;
$meta['download_session_expires'] = $leaseUntil;
if ((int)$meta['expires_at'] < $leaseUntil) {
    $meta['expires_at'] = $leaseUntil;
}

ftruncate($fh, 0);
rewind($fh);
fwrite($fh, json_encode($meta));
fflush($fh);
flock($fh, LOCK_UN);
fclose($fh);
@chmod($metaPath, 0600);

sz_json(array(
    'ok' => true,
    'token' => $token,
    'resumed' => false
), 200);
