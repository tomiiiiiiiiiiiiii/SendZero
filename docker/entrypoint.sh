#!/bin/sh
set -eu

umask 027

data_dir=/srv/sendzero-data
config_file=/var/www/html/config.local.php

mkdir -p "$data_dir"
chown www-data:www-data "$data_dir"
chmod 700 "$data_dir"

if [ ! -e "$config_file" ]; then
    cat > "$config_file" <<'PHP'
<?php
/*
 * Docker single-node default.
 *
 * Bind-mount your own config.local.php to replace this file when you need
 * custom limits, reverse-proxy client IP handling or multi-node settings.
 */
return array(
    'role' => 'both',
    'node_id' => 's1',
    'data_dir' => '/srv/sendzero-data'
);
PHP
    chown root:www-data "$config_file"
    chmod 0640 "$config_file"
fi

exec docker-php-entrypoint "$@"
