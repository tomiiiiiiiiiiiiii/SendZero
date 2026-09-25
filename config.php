<?php
/*
 * SendZero configuration — PHP 5.6+ compatible on 64-bit builds.
 *
 * DATA_DIR should be moved outside the public web root in production when possible.
 */

define('DATA_DIR', __DIR__ . '/data');
define('MAX_FILE_BYTES', 5368709120); // 5 GiB
define('CHUNK_BYTES', 8388608);       // 8 MiB plaintext chunks
define('MAX_CHUNK_UPLOAD_BYTES', CHUNK_BYTES + 128);
define('UPLOAD_SESSION_TTL', 21600);  // 6 hours to finish an upload
define('DOWNLOAD_SESSION_TTL', 3600); // 1 hour for a one-time transfer attempt

define('MAX_MANIFEST_BYTES', 65536);

$GLOBALS['SENDZERO_TTLS'] = array(
    3600,      // 1 hour
    86400,     // 24 hours
    604800     // 7 days
);

if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0700, true);
}
