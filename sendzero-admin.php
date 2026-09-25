<?php
require_once __DIR__ . '/api/common.php';

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

function sz_admin_usage() {
    echo "SendZero admin CLI\n\n";
    echo "Usage:\n";
    echo "  php sendzero-admin.php nodes\n";
    echo "  php sendzero-admin.php status\n";
    echo "  php sendzero-admin.php info NODE_ID TRANSFER_ID\n";
    echo "  php sendzero-admin.php delete NODE_ID TRANSFER_ID\n";
    exit(1);
}

function sz_admin_human_bytes($bytes) {
    $bytes = (float)$bytes;

    if ($bytes < 1024) {
        return number_format($bytes, 0) . ' B';
    }
    if ($bytes < 1048576) {
        return number_format($bytes / 1024, 1) . ' KiB';
    }
    if ($bytes < 1073741824) {
        return number_format($bytes / 1048576, 1) . ' MiB';
    }

    return number_format($bytes / 1073741824, 2) . ' GiB';
}

function sz_admin_node_is_local($nodeId, $node) {
    return
        sz_has_role('node') &&
        $nodeId === SENDZERO_NODE_ID &&
        sz_master_node_url($node) === '';
}

function sz_admin_remote_request($nodeId, $node, $action, $id) {
    $url = sz_master_node_url($node);
    $secret = sz_master_node_secret($node);

    if ($url === '' || $secret === '') {
        return array('ok' => false, 'error' => 'node_not_configured');
    }

    try {
        $nonce = sz_random_hex(16);
    } catch (Exception $e) {
        return array('ok' => false, 'error' => 'random_unavailable');
    }

    $timestamp = time();
    $auth = sz_admin_auth_header($secret, $action, $id, $timestamp, $nonce);

    $post = http_build_query(array(
        'action' => $action,
        'id' => $id
    ), '', '&');

    $target = $url . '/api/admin.php';
    $raw = false;
    $statusCode = 0;

    if (function_exists('curl_init')) {
        $ch = curl_init($target);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $post);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 3);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_HTTPHEADER, array(
            'Content-Type: application/x-www-form-urlencoded',
            'X-SendZero-Admin-Auth: ' . $auth
        ));

        $raw = curl_exec($ch);
        $statusCode = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    }

    if ($raw === false) {
        $context = stream_context_create(array(
            'http' => array(
                'method' => 'POST',
                'timeout' => 10,
                'ignore_errors' => true,
                'header' =>
                    "Content-Type: application/x-www-form-urlencoded\r\n" .
                    "X-SendZero-Admin-Auth: " . $auth . "\r\n",
                'content' => $post
            )
        ));

        $raw = @file_get_contents($target, false, $context);

        if (isset($http_response_header) && is_array($http_response_header)) {
            foreach ($http_response_header as $line) {
                if (preg_match('/^HTTP\/\S+\s+(\d+)/', $line, $m)) {
                    $statusCode = (int)$m[1];
                    break;
                }
            }
        }
    }

    if ($raw === false) {
        return array('ok' => false, 'error' => 'node_unreachable');
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        return array(
            'ok' => false,
            'error' => 'invalid_node_response',
            'http_status' => $statusCode
        );
    }

    if (empty($data['ok'])) {
        $data['http_status'] = $statusCode;
    }

    return $data;
}

function sz_admin_get_node_or_fail($nodeId) {
    $node = sz_master_find_node($nodeId);

    if ($node === false) {
        fwrite(STDERR, "Unknown node: " . $nodeId . PHP_EOL);
        exit(2);
    }

    return $node;
}

$argv = isset($_SERVER['argv']) ? $_SERVER['argv'] : array();
$command = isset($argv[1]) ? strtolower($argv[1]) : '';

if ($command === '') {
    sz_admin_usage();
}

if ($command === 'nodes') {
    foreach (sz_master_nodes() as $nodeId => $node) {
        $url = sz_master_node_url($node);
        $enabled = !empty($node['enabled']) ? 'yes' : 'no';
        $weight = isset($node['weight']) ? (int)$node['weight'] : 100;

        if ($url === '' && $nodeId === SENDZERO_NODE_ID) {
            $url = '(local)';
        }

        echo $nodeId .
            "\tenabled=" . $enabled .
            "\tweight=" . $weight .
            "\turl=" . $url .
            PHP_EOL;
    }

    exit(0);
}

if ($command === 'status') {
    $failed = 0;

    foreach (sz_master_nodes() as $nodeId => $node) {
        if (sz_admin_node_is_local($nodeId, $node)) {
            $status = sz_local_node_status();
        } else {
            $status = sz_master_probe_node($nodeId, $node);
        }

        if ($status === false) {
            echo $nodeId . "\tDOWN" . PHP_EOL;
            $failed++;
            continue;
        }

        echo $nodeId .
            "\t" . (!empty($status['accept_uploads']) ? 'ACCEPTING' : 'READ-ONLY') .
            "\tfree=" . sz_admin_human_bytes(isset($status['free_bytes']) ? $status['free_bytes'] : 0) .
            "\tused=" . (isset($status['disk_used_percent']) ? $status['disk_used_percent'] : '?') . "%" .
            "\tload=" . (isset($status['load_1m']) ? $status['load_1m'] : '?') .
            PHP_EOL;
    }

    exit($failed > 0 ? 3 : 0);
}

if ($command !== 'info' && $command !== 'delete') {
    sz_admin_usage();
}

$nodeId = isset($argv[2]) ? $argv[2] : '';
$id = isset($argv[3]) ? strtolower($argv[3]) : '';

if (!sz_valid_node_id($nodeId) || !sz_valid_id($id)) {
    sz_admin_usage();
}

$node = sz_admin_get_node_or_fail($nodeId);

if (sz_admin_node_is_local($nodeId, $node)) {
    $info = sz_admin_transfer_info($id);

    if ($info === false) {
        fwrite(STDERR, "Transfer not found.\n");
        exit(4);
    }

    if ($command === 'info') {
        echo json_encode($info, JSON_PRETTY_PRINT) . PHP_EOL;
        exit(0);
    }

    sz_delete_transfer($id);
    echo "Deleted " . $id . " from " . $nodeId . PHP_EOL;
    exit(0);
}

$result = sz_admin_remote_request($nodeId, $node, $command, $id);

if (empty($result['ok'])) {
    fwrite(
        STDERR,
        "Admin request failed: " .
        (isset($result['error']) ? $result['error'] : 'unknown_error') .
        (isset($result['http_status']) ? ' (HTTP ' . $result['http_status'] . ')' : '') .
        PHP_EOL
    );
    exit(5);
}

if ($command === 'info') {
    echo json_encode($result['transfer'], JSON_PRETTY_PRINT) . PHP_EOL;
    exit(0);
}

echo "Deleted " . $id . " from " . $nodeId . PHP_EOL;
