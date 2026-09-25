<?php
require_once __DIR__ . '/api/common.php';

if (php_sapi_name() !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}

$removed = 0;
$items = @scandir(DATA_DIR);
if (!is_array($items)) {
    exit("Removed: 0\n");
}

foreach ($items as $id) {
    if ($id === '.' || $id === '..' || !sz_valid_id($id)) {
        continue;
    }

    $meta = sz_load_meta($id);
    if ($meta === false || sz_is_expired($meta)) {
        sz_delete_transfer($id);
        $removed++;
    }
}

$allocationRemoved = 0;
$allocationDir = DATA_DIR . '/.allocations';

if (is_dir($allocationDir)) {
    $allocationFiles = @scandir($allocationDir);

    if (is_array($allocationFiles)) {
        foreach ($allocationFiles as $name) {
            if ($name === '.' || $name === '..' || !preg_match('/^[a-f0-9]{32}$/', $name)) {
                continue;
            }

            $path = $allocationDir . '/' . $name;
            $expiresAt = (int)@file_get_contents($path);

            if ($expiresAt <= time()) {
                @unlink($path);
                $allocationRemoved++;
            }
        }
    }
}

$rateLimitRemoved = 0;
$rateLimitDir = DATA_DIR . '/.ratelimit';

if (is_dir($rateLimitDir)) {
    $rateFiles = @scandir($rateLimitDir);

    if (is_array($rateFiles)) {
        foreach ($rateFiles as $name) {
            if ($name === '.' || $name === '..' || !preg_match('/^[a-f0-9]{32}\.json$/', $name)) {
                continue;
            }

            $path = $rateLimitDir . '/' . $name;
            $mtime = @filemtime($path);

            /*
             * Hour/day counters no longer matter after two full days.
             * Removing them also prevents the anonymous HMAC buckets from
             * accumulating indefinitely.
             */
            if ($mtime !== false && $mtime < time() - 172800) {
                @unlink($path);
                $rateLimitRemoved++;
            }
        }
    }
}

$activeStateCleaned = 0;
$activeDir = DATA_DIR . '/.active_uploads';

if (is_dir($activeDir)) {
    $activeFiles = @scandir($activeDir);

    if (is_array($activeFiles)) {
        foreach ($activeFiles as $name) {
            if ($name === '.' || $name === '..' || !preg_match('/^[a-f0-9]{32}\.json$/', $name)) {
                continue;
            }

            $path = $activeDir . '/' . $name;
            $fh = @fopen($path, 'c+');
            if (!$fh || !@flock($fh, LOCK_EX)) {
                if ($fh) {
                    fclose($fh);
                }
                continue;
            }

            rewind($fh);
            $state = json_decode(stream_get_contents($fh), true);
            if (!is_array($state)) {
                $state = array();
            }

            $changed = false;
            foreach ($state as $transferId => $expiry) {
                if (!sz_valid_id($transferId) || (int)$expiry <= time()) {
                    unset($state[$transferId]);
                    $changed = true;
                }
            }

            if (count($state) === 0) {
                @flock($fh, LOCK_UN);
                fclose($fh);
                @unlink($path);
                $activeStateCleaned++;
                continue;
            }

            if ($changed) {
                ftruncate($fh, 0);
                rewind($fh);
                fwrite($fh, json_encode($state));
                fflush($fh);
                @chmod($path, 0600);
                $activeStateCleaned++;
            }

            @flock($fh, LOCK_UN);
            fclose($fh);
        }
    }
}

echo 'Removed transfers: ' . $removed .
    '; allocation tokens: ' . $allocationRemoved .
    '; rate-limit buckets: ' . $rateLimitRemoved .
    '; active-upload states cleaned: ' . $activeStateCleaned . PHP_EOL;
