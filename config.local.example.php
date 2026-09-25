<?php
/*
 * Copy to config.local.php and adjust per machine.
 * config.local.php is ignored by Git.
 */

return array(
    // 'master', 'node', or 'both'
    'role' => 'both',

    // Child-node identity. Must match its key in nodes.php on the master.
    'node_id' => 's1',

    // Public URL used by browsers to talk directly to this child node.
    // Leave empty when master and node are the same origin.
    'node_public_url' => '',

    // On child nodes set this to the public master origin, e.g.
    // https://sendzero.link
    'master_origin' => '',

    // Same secret must be configured for this node in nodes.php on the master.
    // Use a long random value. If left empty on a local "both" installation,
    // SendZero creates data/.node-secret automatically.
    'node_secret' => '',

    // Child-node storage.
    'data_dir' => __DIR__ . '/data',

    // Stop assigning NEW uploads to this node without affecting old downloads.
    'accept_uploads' => true,

    // A node refuses new allocations below this free-space threshold.
    'min_free_bytes' => 10 * 1024 * 1024 * 1024,

    // Extra safety margin checked by the master for every new transfer.
    'reserve_bytes' => 2 * 1024 * 1024 * 1024,

    // Emergency disk thresholds. At 90% the node reports a warning;
    // at 95% it automatically refuses NEW uploads.
    'warn_disk_used_percent' => 90,
    'max_disk_used_percent' => 95,

    'require_allocation' => true,

    /*
     * File-based anti-abuse limits. Raw IP addresses are not stored:
     * the master keeps only a local HMAC-derived client tag and counters.
     */
    'rate_limit_enabled' => true,
    'rate_max_allocations_per_hour' => 30,
    'rate_max_bytes_per_day' => 25 * 1024 * 1024 * 1024,

    // Enforced independently by each child node.
    'max_active_uploads_per_client' => 3,

    /*
     * Leave empty when PHP sees the real client in REMOTE_ADDR.
     * When behind a TRUSTED reverse proxy which overwrites the header,
     * set e.g. 'HTTP_CF_CONNECTING_IP'. Never enable a spoofable header
     * directly from the public Internet.
     */
    'client_ip_header' => '',

    // Cross-origin browser access from the master UI.
    'allowed_origins' => array(
        // 'https://sendzero.link'
    )
);
