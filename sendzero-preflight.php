<?php
require_once __DIR__ . '/api/common.php';

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

$failures = 0;
$warnings = 0;

function pf_line($level, $message) {
    global $failures, $warnings;

    if ($level === 'FAIL') {
        $failures++;
    } elseif ($level === 'WARN') {
        $warnings++;
    }

    echo '[' . $level . '] ' . $message . PHP_EOL;
}

function pf_pass($message) {
    pf_line('PASS', $message);
}

function pf_warn($message) {
    pf_line('WARN', $message);
}

function pf_fail($message) {
    pf_line('FAIL', $message);
}

function pf_path_inside($child, $parent) {
    $child = rtrim(str_replace('\\', '/', $child), '/');
    $parent = rtrim(str_replace('\\', '/', $parent), '/');

    return $child === $parent || strpos($child . '/', $parent . '/') === 0;
}

function pf_fetch_headers($url) {
    $headers = array();
    $status = 0;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_NOBODY, true);
        curl_setopt($ch, CURLOPT_HEADER, true);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, false);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);

        $raw = curl_exec($ch);
        $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($raw === false) {
            return false;
        }

        $lines = preg_split('/\r?\n/', $raw);
    } else {
        $context = stream_context_create(array(
            'http' => array(
                'method' => 'HEAD',
                'timeout' => 10,
                'ignore_errors' => true
            )
        ));

        $raw = @file_get_contents($url, false, $context);
        if ($raw === false && !isset($http_response_header)) {
            return false;
        }

        $lines = isset($http_response_header) ? $http_response_header : array();
    }

    foreach ($lines as $line) {
        if (preg_match('/^HTTP\/\S+\s+(\d+)/i', $line, $m)) {
            $status = (int)$m[1];
            continue;
        }

        $pos = strpos($line, ':');
        if ($pos === false) {
            continue;
        }

        $name = strtolower(trim(substr($line, 0, $pos)));
        $value = trim(substr($line, $pos + 1));

        if ($name !== '') {
            $headers[$name] = $value;
        }
    }

    return array(
        'status' => $status,
        'headers' => $headers
    );
}

echo "SendZero preflight\n";
echo "==================\n\n";

if (version_compare(PHP_VERSION, '5.6.0', '>=')) {
    pf_pass('PHP ' . PHP_VERSION . ' is supported.');
} else {
    pf_fail('PHP 5.6+ is required; found ' . PHP_VERSION . '.');
}

if (PHP_INT_SIZE >= 8) {
    pf_pass('PHP integer size is 64-bit.');
} else {
    pf_fail('64-bit PHP is required for 5 GiB transfers.');
}

if (function_exists('random_bytes') || function_exists('openssl_random_pseudo_bytes')) {
    pf_pass('Cryptographically secure random source is available.');
} else {
    pf_fail('No secure random source is available.');
}

if (in_array(SENDZERO_ROLE, array('master', 'node', 'both'), true)) {
    pf_pass('Role is configured as ' . SENDZERO_ROLE . '.');
} else {
    pf_fail('Invalid SENDZERO_ROLE: ' . SENDZERO_ROLE . '.');
}

if (is_dir(DATA_DIR)) {
    pf_pass('DATA_DIR exists: ' . DATA_DIR);
} else {
    pf_fail('DATA_DIR does not exist: ' . DATA_DIR);
}

if (is_writable(DATA_DIR)) {
    pf_pass('DATA_DIR is writable by the current user.');
} else {
    pf_fail('DATA_DIR is not writable: ' . DATA_DIR);
}

$dataReal = @realpath(DATA_DIR);
$projectReal = @realpath(__DIR__);

if ($dataReal !== false && $projectReal !== false) {
    if (pf_path_inside($dataReal, $projectReal)) {
        pf_warn('DATA_DIR is inside the application directory. Production should preferably use a path outside the public web root.');
    } else {
        pf_pass('DATA_DIR is outside the application directory.');
    }
}

$free = @disk_free_space(DATA_DIR);
$total = @disk_total_space(DATA_DIR);

if ($free !== false && $total !== false && $total > 0) {
    $usedPercent = (($total - $free) / $total) * 100.0;

    if ($usedPercent >= SENDZERO_NODE_MAX_DISK_USED_PERCENT) {
        pf_fail('Disk usage is ' . number_format($usedPercent, 2) . '%; new uploads are stopped.');
    } elseif ($usedPercent >= SENDZERO_NODE_WARN_DISK_USED_PERCENT) {
        pf_warn('Disk usage is ' . number_format($usedPercent, 2) . '%.');
    } else {
        pf_pass(
            'Disk usage is ' . number_format($usedPercent, 2) .
            '%; free bytes: ' . number_format($free, 0, '.', '') . '.'
        );
    }

    if ($free < SENDZERO_NODE_MIN_FREE_BYTES) {
        pf_fail('Free disk space is below SENDZERO_NODE_MIN_FREE_BYTES.');
    }
} else {
    pf_warn('Could not determine disk capacity for DATA_DIR.');
}

if (is_file(__DIR__ . '/config.local.php')) {
    pf_pass('config.local.php is present.');
} else {
    pf_warn('config.local.php is missing; built-in defaults are being used.');
}

if (sz_has_role('node')) {
    if (sz_valid_node_id(SENDZERO_NODE_ID)) {
        pf_pass('Local node ID is valid: ' . SENDZERO_NODE_ID . '.');
    } else {
        pf_fail('Invalid local node ID: ' . SENDZERO_NODE_ID . '.');
    }

    try {
        $nodeSecret = sz_local_node_secret();

        if (strlen($nodeSecret) >= 32) {
            pf_pass('Local node secret is available.');
        } else {
            pf_fail('Local node secret is too short.');
        }
    } catch (Exception $e) {
        pf_fail('Local node secret is unavailable: ' . $e->getMessage());
    }
}

$remoteNodes = 0;

if (sz_has_role('master')) {
    $nodes = sz_master_nodes();

    if (count($nodes) > 0) {
        pf_pass('Master has ' . count($nodes) . ' configured storage node(s).');
    } else {
        pf_fail('Master has no configured storage nodes.');
    }

    $enabledNodes = 0;

    foreach ($nodes as $nodeId => $node) {
        if (!sz_valid_node_id($nodeId)) {
            pf_fail('Invalid node ID in nodes.php: ' . $nodeId . '.');
            continue;
        }

        if (!empty($node['enabled'])) {
            $enabledNodes++;
        }

        $url = sz_master_node_url($node);
        $isLocal = sz_has_role('node') && $nodeId === SENDZERO_NODE_ID && $url === '';

        if ($isLocal) {
            pf_pass('Node ' . $nodeId . ' is local to this master.');
        } else {
            $remoteNodes++;

            if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL)) {
                pf_fail('Node ' . $nodeId . ' has an invalid public URL.');
            } else {
                $scheme = strtolower((string)parse_url($url, PHP_URL_SCHEME));

                if ($scheme === 'https') {
                    pf_pass('Node ' . $nodeId . ' uses HTTPS: ' . $url);
                } else {
                    pf_warn('Node ' . $nodeId . ' does not use HTTPS: ' . $url);
                }
            }

            $secret = sz_master_node_secret($node);
            if (
                $secret === '' ||
                $secret === '@local' ||
                strlen($secret) < 32 ||
                stripos($secret, 'REPLACE_') !== false
            ) {
                pf_fail('Node ' . $nodeId . ' has no valid private master/node secret.');
            } else {
                pf_pass('Node ' . $nodeId . ' has a configured private secret.');
            }
        }
    }

    if ($enabledNodes > 0) {
        pf_pass('At least one storage node accepts allocation configuration.');
    } else {
        pf_fail('No storage node is enabled for new allocations.');
    }
}

if ($remoteNodes > 0) {
    if (function_exists('curl_init') || ini_get('allow_url_fopen')) {
        pf_pass('Master can perform remote HTTP health/admin requests.');
    } else {
        pf_fail('Remote nodes are configured, but neither cURL nor allow_url_fopen is available.');
    }
}

$publicUrl = isset($_SERVER['argv'][1]) ? trim((string)$_SERVER['argv'][1]) : '';

if ($publicUrl !== '') {
    if (!filter_var($publicUrl, FILTER_VALIDATE_URL)) {
        pf_fail('Public URL argument is invalid: ' . $publicUrl);
    } else {
        $scheme = strtolower((string)parse_url($publicUrl, PHP_URL_SCHEME));

        if ($scheme !== 'https') {
            pf_fail('Public production URL must use HTTPS: ' . $publicUrl);
        } else {
            pf_pass('Public URL uses HTTPS: ' . $publicUrl);
        }

        $result = pf_fetch_headers($publicUrl);

        if ($result === false) {
            pf_fail('Could not reach public URL for header checks.');
        } else {
            if ($result['status'] >= 200 && $result['status'] < 400) {
                pf_pass('Public URL responded with HTTP ' . $result['status'] . '.');
            } else {
                pf_warn('Public URL responded with HTTP ' . $result['status'] . '.');
            }

            $requiredHeaders = array(
                'content-security-policy',
                'strict-transport-security',
                'referrer-policy',
                'x-content-type-options',
                'x-frame-options',
                'permissions-policy'
            );

            foreach ($requiredHeaders as $headerName) {
                if (isset($result['headers'][$headerName]) && $result['headers'][$headerName] !== '') {
                    pf_pass('Header present: ' . $headerName . '.');
                } else {
                    pf_fail('Missing security header: ' . $headerName . '.');
                }
            }
        }
    }
} else {
    pf_warn('Public HTTPS headers were not checked. Run: php sendzero-preflight.php https://sendzero.link');
}

pf_warn('Cron/systemd cleanup scheduling cannot be verified from the application. Confirm cleanup.php is scheduled on every child node.');

echo "\nSummary: ";
echo $failures . " failure(s), " . $warnings . " warning(s).\n";

if ($failures > 0) {
    echo "PRE-FLIGHT FAILED\n";
    exit(1);
}

echo "PRE-FLIGHT PASSED";
if ($warnings > 0) {
    echo " WITH WARNINGS";
}
echo "\n";
exit(0);
