<?php
/*
 * SendZero configuration — PHP 5.6+ compatible on 64-bit builds.
 *
 * One codebase can run as:
 *   master - serves the UI and assigns new transfers to child nodes
 *   node   - stores encrypted manifests/chunks and serves upload/download APIs
 *   both   - master + child node on one machine (default / first-server mode)
 *
 * Put machine-specific values in config.local.php. That file is ignored by Git.
 */

$SENDZERO_LOCAL_CONFIG = array();
$localConfigFile = __DIR__ . '/config.local.php';
if (is_file($localConfigFile)) {
    $loaded = require $localConfigFile;
    if (is_array($loaded)) {
        $SENDZERO_LOCAL_CONFIG = $loaded;
    }
}

function sz_config_value($key, $default) {
    global $SENDZERO_LOCAL_CONFIG;
    return array_key_exists($key, $SENDZERO_LOCAL_CONFIG)
        ? $SENDZERO_LOCAL_CONFIG[$key]
        : $default;
}

define('DATA_DIR', sz_config_value('data_dir', __DIR__ . '/data'));
define('MAX_FILE_BYTES', 5368709120); // 5 GiB
define('CHUNK_BYTES', 8388608);       // 8 MiB plaintext chunks
define('MAX_CHUNK_UPLOAD_BYTES', CHUNK_BYTES + 128);
define('UPLOAD_SESSION_TTL', 21600);  // 6 hours to finish an upload
define('DOWNLOAD_SESSION_TTL', 3600); // 1 hour for a one-time transfer attempt
define('MAX_MANIFEST_BYTES', 65536);

define('SENDZERO_ROLE', sz_config_value('role', 'both'));
define('SENDZERO_NODE_ID', sz_config_value('node_id', 'local'));
define('SENDZERO_NODE_PUBLIC_URL', rtrim((string)sz_config_value('node_public_url', ''), '/'));
define('SENDZERO_MASTER_ORIGIN', rtrim((string)sz_config_value('master_origin', ''), '/'));
define('SENDZERO_NODE_SECRET', (string)sz_config_value('node_secret', ''));
define('SENDZERO_REQUIRE_ALLOCATION', sz_config_value('require_allocation', true) ? true : false);
define('SENDZERO_NODE_ACCEPT_UPLOADS', sz_config_value('accept_uploads', true) ? true : false);
define('SENDZERO_NODE_MIN_FREE_BYTES', (float)sz_config_value('min_free_bytes', 10737418240)); // 10 GiB
define('SENDZERO_NODE_RESERVE_BYTES', (float)sz_config_value('reserve_bytes', 2147483648));    // 2 GiB
define('SENDZERO_ALLOCATION_TTL', (int)sz_config_value('allocation_ttl', 300));
define('SENDZERO_NODE_STATUS_TIMEOUT', (float)sz_config_value('node_status_timeout', 2.0));

/* Public-service abuse protection. No database is required. */
define('SENDZERO_RATE_LIMIT_ENABLED', sz_config_value('rate_limit_enabled', true) ? true : false);
define('SENDZERO_RATE_MAX_ALLOCATIONS_PER_HOUR', (int)sz_config_value('rate_max_allocations_per_hour', 30));
define('SENDZERO_RATE_MAX_BYTES_PER_DAY', (float)sz_config_value('rate_max_bytes_per_day', 26843545600)); // 25 GiB
define('SENDZERO_NODE_MAX_ACTIVE_UPLOADS_PER_CLIENT', (int)sz_config_value('max_active_uploads_per_client', 3));

/*
 * Only use a forwarded-IP header when the web server is behind a trusted
 * reverse proxy that overwrites it. Example: HTTP_CF_CONNECTING_IP.
 * Empty by default so clients cannot spoof their address.
 */
define('SENDZERO_CLIENT_IP_HEADER', (string)sz_config_value('client_ip_header', ''));

/* Disk emergency-stop thresholds for NEW uploads. */
define('SENDZERO_NODE_WARN_DISK_USED_PERCENT', (float)sz_config_value('warn_disk_used_percent', 90.0));
define('SENDZERO_NODE_MAX_DISK_USED_PERCENT', (float)sz_config_value('max_disk_used_percent', 95.0));

$GLOBALS['SENDZERO_TTLS'] = array(
    3600,
    86400,
    604800
);

$GLOBALS['SENDZERO_ALLOWED_ORIGINS'] = sz_config_value(
    'allowed_origins',
    SENDZERO_MASTER_ORIGIN !== '' ? array(SENDZERO_MASTER_ORIGIN) : array()
);

/*
 * Master node registry.
 *
 * Production: create nodes.php (ignored by Git) from nodes.example.php.
 * The default registry points to the local node, so a one-server installation
 * keeps working while using the exact same dispatcher path as a cluster.
 */
$nodesFile = __DIR__ . '/nodes.php';
if (is_file($nodesFile)) {
    $nodes = require $nodesFile;
    $GLOBALS['SENDZERO_NODES'] = is_array($nodes) ? $nodes : array();
} else {
    $GLOBALS['SENDZERO_NODES'] = array(
        SENDZERO_NODE_ID => array(
            'url' => SENDZERO_NODE_PUBLIC_URL,
            'secret' => '@local',
            'enabled' => true,
            'weight' => 100
        )
    );
}

if (!is_dir(DATA_DIR)) {
    @mkdir(DATA_DIR, 0700, true);
}
