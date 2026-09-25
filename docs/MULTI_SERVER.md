# SendZero multi-server mode

SendZero scales without MySQL, Redis, a shared filesystem, or proxying file data through the main server.

## Architecture

```text
                         sendzero.link
                              |
                         MASTER / UI
                     allocation + routing
                              |
              +---------------+---------------+
              |               |               |
       s1.sendzero.link s2.sendzero.link s3.sendzero.link
          CHILD NODE       CHILD NODE       CHILD NODE
          local /data      local /data      local /data
```

The browser uploads encrypted chunks directly to the selected child node. Downloads also come directly from that same child node.

The master transfers only small JSON responses and allocation tokens. It never proxies the file.

## Transfer links

A generated link contains the storage node ID:

```text
https://sendzero.link/download.html?n=s2&id=<transfer-id>#k=<key>
```

The master resolves `s2` to its current public URL. The decryption key remains after `#` and is never sent to the master or child node.

## First server: master + s1

The default installation uses role `both`, so the first machine can serve the UI and store files at the same time.

For production create `config.local.php`:

```php
<?php
return array(
    'role' => 'both',
    'node_id' => 's1',
    'node_public_url' => '',
    'master_origin' => 'https://sendzero.link',
    'data_dir' => '/srv/sendzero-data',
    'accept_uploads' => true,
    'allowed_origins' => array(
        'https://sendzero.link'
    )
);
```

If `node_secret` is empty in this local `both` mode, SendZero creates a private secret in:

```text
/srv/sendzero-data/.node-secret
```

## Splitting the master from storage

When the project grows, the main server can become master-only:

```php
<?php
return array(
    'role' => 'master'
);
```

Then create `nodes.php` on the master:

```php
<?php
return array(
    's1' => array(
        'url' => 'https://s1.sendzero.link',
        'secret' => 'LONG_RANDOM_SECRET_FOR_S1',
        'enabled' => true,
        'weight' => 100
    ),
    's2' => array(
        'url' => 'https://s2.sendzero.link',
        'secret' => 'LONG_RANDOM_SECRET_FOR_S2',
        'enabled' => true,
        'weight' => 100
    )
);
```

`nodes.php` is ignored by Git.

## Child-node configuration

Example `config.local.php` for s2:

```php
<?php
return array(
    'role' => 'node',
    'node_id' => 's2',
    'node_public_url' => 'https://s2.sendzero.link',
    'master_origin' => 'https://sendzero.link',

    'node_secret' => 'LONG_RANDOM_SECRET_FOR_S2',

    'data_dir' => '/srv/sendzero-data',

    'accept_uploads' => true,
    'min_free_bytes' => 10 * 1024 * 1024 * 1024,
    'reserve_bytes' => 2 * 1024 * 1024 * 1024,

    'require_allocation' => true,

    'allowed_origins' => array(
        'https://sendzero.link'
    )
);
```

The value of `node_secret` must match the secret for s2 in the master's `nodes.php`.

## Adding another server

Adding s3 requires no migration and no database.

1. Deploy SendZero to s3.
2. Configure s3 as role `node`.
3. Give it a unique node ID and secret.
4. Add the matching entry to the master's `nodes.php`.
5. New transfers may immediately be assigned to s3.

Existing transfers remain on their original nodes.

## Full disk or saturated network link

To stop sending new files to a node while preserving old downloads:

```php
's1' => array(
    'url' => 'https://s1.sendzero.link',
    'secret' => '...',
    'enabled' => false,
    'weight' => 100
)
```

The node still resolves for downloads. It simply receives no new allocations.

You can also keep it enabled but lower its `weight` if you only want to reduce new traffic.

On the child itself:

```php
'accept_uploads' => false
```

also prevents new uploads.

## Node selection

Before a new upload, the master requests the authenticated status of every enabled node.

A node reports:

- free disk bytes;
- total disk bytes;
- whether it accepts uploads;
- one-minute system load.

The master rejects nodes that:

- do not respond;
- reject uploads;
- do not have enough free space for the requested file plus the reserve;
- are disabled in `nodes.php`.

Among the remaining nodes, free space and configured `weight` determine preference.

## Security

The master creates a short-lived HMAC-signed allocation token containing:

- node ID;
- exact file size;
- retention period;
- one-time flag;
- expiry time;
- random nonce.

The child verifies the token with its private node secret. Each allocation nonce can be consumed only once.

This prevents clients from bypassing the dispatcher and arbitrarily uploading to a child node.

The node-status endpoint is also authenticated with HMAC.

## No shared database

Each child keeps the same local structure SendZero already uses:

```text
/srv/sendzero-data/
  <transfer-id>/
    meta.json
    manifest.bin
    chunk_000000.bin
    ...
```

Nothing is synchronized between child nodes.

Consequently, if s2 is offline, transfers physically stored on s2 are unavailable until s2 returns. This is the deliberate trade-off for a simple database-free architecture.

## Web-server requirements for every child

Each child should have HTTPS and permit requests slightly above the 8 MiB chunk size.

PHP:

```ini
upload_max_filesize = 10M
post_max_size = 11M
max_execution_time = 120
```

Nginx:

```nginx
client_max_body_size 11M;
```

Run cleanup on every child:

```bash
*/10 * * * * /usr/bin/php /path/to/sendzero/cleanup.php >/dev/null 2>&1
```
