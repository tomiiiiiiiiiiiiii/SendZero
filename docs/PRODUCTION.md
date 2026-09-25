# SendZero production hardening

This document describes the protections that should be enabled before opening SendZero to anonymous public traffic.

## Default application limits

The current defaults are:

```text
new transfer allocations / client / hour : 30
allocated bytes / client / day            : 25 GiB
active uploads / client / child node      : 3
active downloads / transfer / child node  : 8
download egress allowance                 : 20x file size, min 5 GiB
disk warning                              : 90% used
stop NEW uploads                          : 95% used
absolute minimum free space               : 10 GiB
extra per-transfer disk reserve           : 2 GiB
```

All values can be overridden in `config.local.php`.

Example:

```php
return array(
    'rate_limit_enabled' => true,
    'rate_max_allocations_per_hour' => 30,
    'rate_max_bytes_per_day' => 25 * 1024 * 1024 * 1024,
    'max_active_uploads_per_client' => 3,
    'max_active_downloads_per_transfer' => 8,
    'download_egress_multiplier' => 20,
    'download_min_egress_bytes' => 5 * 1024 * 1024 * 1024,

    'warn_disk_used_percent' => 90,
    'max_disk_used_percent' => 95,
    'min_free_bytes' => 10 * 1024 * 1024 * 1024,
    'reserve_bytes' => 2 * 1024 * 1024 * 1024
);
```

## IP privacy and reverse proxies

SendZero's application rate limiter does **not** store raw client IP addresses.

The master derives a local HMAC client tag using a secret stored in:

```text
DATA_DIR/.rate-secret
```

Only the resulting anonymous bucket ID and counters are stored.

By default the application uses:

```text
REMOTE_ADDR
```

Do not trust `X-Forwarded-For` or similar public request headers automatically.

When SendZero is behind a trusted reverse proxy that overwrites a client-IP header, explicitly configure the corresponding PHP server variable.

For Cloudflare, for example:

```php
'client_ip_header' => 'HTTP_CF_CONNECTING_IP'
```

Only do this when requests cannot bypass the trusted proxy. Otherwise a client could forge the header and bypass per-IP limits.

## Rate-limit state

No database is used.

The master stores short local state files under:

```text
DATA_DIR/.ratelimit/
```

Child nodes store active-upload leases under:

```text
DATA_DIR/.active_uploads/
```

`cleanup.php` removes stale state.

The limiter deliberately counts each newly issued allocation. This is conservative: a rare retry after a child failure can consume another allocation/byte allowance, but clients cannot replay a request identifier to obtain unmetered transfers.

## Disk emergency stop

A child reports a disk warning at the configured warning threshold.

At the stop threshold the node automatically returns:

```text
accept_uploads = false
```

and `init.php` independently rejects new transfers.

Existing downloads are not disabled.

This provides two independent checks:

```text
master sees node status -> does not assign it
child init.php          -> refuses allocation anyway
```

Never depend on the master check alone.

## Apache security headers

The repository `.htaccess` already sets:

- Content-Security-Policy;
- Strict-Transport-Security;
- Referrer-Policy;
- X-Content-Type-Options;
- X-Frame-Options;
- Permissions-Policy.

The CSP permits browser connections to:

```text
'self'
https://*.sendzero.link
```

because encrypted chunks are transferred directly between the browser and child nodes.

If storage nodes are ever moved to another domain, update `connect-src` deliberately rather than replacing it with `*`.

## Nginx equivalent

If a server uses Nginx, `.htaccess` is ignored. Add equivalent headers in the HTTPS server block:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "no-referrer" always;
add_header X-Frame-Options "DENY" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), browsing-topics=()" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://*.sendzero.link; frame-src 'self'; worker-src 'self'; form-action 'self'" always;
```

Also keep the existing upload body limit above one encrypted chunk:

```nginx
client_max_body_size 11M;
```

## HSTS warning

The current HSTS policy contains:

```text
includeSubDomains
```

Therefore every SendZero web subdomain should support HTTPS before production traffic uses the parent domain.

Do not add `preload` until the complete domain policy has been deliberately reviewed.

## Large-file release test

Before public launch run the complete checklist:

```text
docs/TESTING.md
```

It covers:

- full 5 GiB upload;
- interrupted upload and resume;
- full download;
- interrupted download and resume;
- SHA-256 equality;
- one-time transfer deletion;
- rate-limit tests;
- disk emergency-stop tests;
- security-header verification.


## Sender revoke

Each new transfer has a dedicated delete token. The node stores only its SHA-256 hash.

The sender UI can call `api/delete.php` with the transfer ID and delete token to remove the encrypted transfer immediately. The delete token is separate from the recipient share URL and the AES decryption key.

## Download abuse protection

Ordinary downloads use short-lived session tokens created by `api/start.php`. This lets a node cap the number of simultaneous readers of one transfer without user accounts.

Encrypted chunk responses also contribute to a per-transfer egress counter stored beside that transfer. When the configured allowance is exhausted, additional chunk requests receive HTTP 429.

The defaults are deliberately generous for private sharing:

```text
8 simultaneous sessions
20 full-file equivalents
minimum 5 GiB allowance
```

Set `download_egress_multiplier` to `0` to disable the egress cap.

## Abuse administration

For multi-node abuse handling see `docs/ADMIN.md`. The master CLI can inspect and delete a transfer on a remote child node using signed HMAC requests.
