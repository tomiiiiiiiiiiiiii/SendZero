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


## How to add a second child node (s2)

This is the practical checklist for adding a new storage node when the first server is already running as **MASTER + s1**.

No existing files need to be migrated. No database is required.

### 1. Prepare DNS and HTTPS

Create a DNS record:

```text
s2.sendzero.link -> IP address of the new server
```

Use HTTPS on the child node.

The browser will upload and download encrypted chunks directly to:

```text
https://s2.sendzero.link
```

### 2. Deploy SendZero on s2

Install the same SendZero codebase on the second server.

Recommended PHP limits:

```ini
upload_max_filesize = 10M
post_max_size = 11M
max_execution_time = 120
```

For Nginx:

```nginx
client_max_body_size 11M;
```

### 3. Create the local storage directory on s2

Example:

```bash
mkdir -p /srv/sendzero-data
chown -R www-data:www-data /srv/sendzero-data
chmod 700 /srv/sendzero-data
```

### 4. Generate a private secret for s2

Run on s2:

```bash
openssl rand -hex 32
```

Example result:

```text
e8f91b0d4f7a...long-random-secret...
```

Keep this secret private.

The exact same secret will later be added to `nodes.php` on the master.

### 5. Create config.local.php on s2

Example:

```php
<?php

return array(
    'role' => 'node',

    'node_id' => 's2',

    'node_public_url' => 'https://s2.sendzero.link',

    'master_origin' => 'https://sendzero.link',

    'node_secret' => 'PUT_THE_RANDOM_S2_SECRET_HERE',

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

Important:

```text
node_id = s2
```

must match the node name used on the master.

### 6. Add s2 to nodes.php on the master

On the main server `sendzero.link`, create or update:

```text
nodes.php
```

Example when the current machine is still MASTER + s1:

```php
<?php

return array(

    's1' => array(
        'url' => '',
        'secret' => '@local',
        'enabled' => true,
        'weight' => 100
    ),

    's2' => array(
        'url' => 'https://s2.sendzero.link',
        'secret' => 'PUT_THE_EXACT_SAME_S2_SECRET_HERE',
        'enabled' => true,
        'weight' => 100
    )

);
```

The secret configured for `s2` in `nodes.php` must be exactly the same as:

```php
'node_secret' => '...'
```

on the s2 server.

### 7. Add cleanup cron on s2

Run cleanup independently on every child node.

Example:

```bash
*/10 * * * * /usr/bin/php /path/to/SendZero/cleanup.php >/dev/null 2>&1
```

### 8. What happens after s2 is enabled

For a new upload the master checks the available nodes:

```text
s1 -> free space / status
s2 -> free space / status
```

The master selects a child node and returns a signed allocation token.

If s2 is selected:

```text
browser --------------------> s2.sendzero.link
          encrypted upload
```

The 5 GiB file does not pass through the master.

The resulting share link contains the node ID:

```text
https://sendzero.link/download.html?n=s2&id=<transfer-id>#k=<key>
```

During download the browser resolves `s2` through the master and then downloads encrypted chunks directly from s2.

### 9. When s1 is full or its network is overloaded

Do not migrate old files.

On the master change s1 to:

```php
's1' => array(
    'url' => '',
    'secret' => '@local',
    'enabled' => false,
    'weight' => 100
)
```

This means:

```text
s1:
new uploads     -> NO
existing files  -> YES
existing downloads -> YES
```

New transfers will be assigned to other enabled nodes such as s2.

If s1 is only partially overloaded, keep it enabled and reduce its weight instead:

```php
'weight' => 30
```

while faster or larger nodes can keep:

```php
'weight' => 100
```

or more.

### 10. Adding s3, s4 and later nodes

Repeat exactly the same process:

```text
deploy code
create local data directory
generate unique node secret
create config.local.php
add DNS + HTTPS
add node to nodes.php on master
add cleanup cron
```

Example:

```php
's3' => array(
    'url' => 'https://s3.sendzero.link',
    'secret' => 'SECRET_FOR_S3',
    'enabled' => true,
    'weight' => 100
)
```

Each node keeps only its own transfers.

There is no shared filesystem and no synchronization between nodes.
