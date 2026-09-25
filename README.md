# SendZero

**Private, zero-access file sharing with client-side encryption, resumable transfers and database-free multi-server storage.**

**Live demo:** [https://sendzero.link/](https://sendzero.link/)

SendZero encrypts files in the browser before upload. The server stores encrypted manifests and encrypted chunks, while the decryption key remains in the URL fragment after `#` and is not sent to PHP.

The core transfer path is **production-tested on the deployed HTTPS instance at [sendzero.link](https://sendzero.link/)**. Validation includes a full **5 GiB end-to-end transfer with matching SHA-256**, interrupted upload and download resume, one-time deletion, sender revoke, Recent transfers recovery, cleanup/expiry, abuse and egress limits, disk emergency-stop behavior, admin CLI operations, security headers, and a long-running download session. The full Git history is also checked automatically for accidentally committed credentials and private runtime/configuration files. The source repository is public and remains under active development. This validation is operational testing and automated release hygiene, not an independent security audit.

## Highlights

- client-side **AES-256-GCM** encryption via Web Crypto;
- encrypted filename, MIME type and file metadata;
- **8 MiB chunked transfers** with bounded browser memory usage;
- maximum logical file size: **5 GiB**;
- resumable uploads;
- resumable large downloads in compatible Chromium-based browsers;
- one-time downloads;
- sender-controlled early revoke/delete;
- local **Recent transfers** manager without accounts;
- English, German and Polish interface;
- anonymous, database-free rate limiting and abuse protection;
- multi-server storage without MySQL, Redis or shared filesystems;
- direct browser-to-node upload and download;
- multi-node administration CLI;
- multilingual FAQ, Terms of Use, Privacy Policy and dedicated abuse contact;
- production preflight checker;
- responsible vulnerability reporting policy;
- full-history credential/configuration audit in CI;
- GitHub Actions syntax checks for **PHP 5.6, PHP 8.2 and JavaScript**.

## Security model

For every new transfer:

1. the browser generates a random 256-bit AES key;
2. filename, MIME type and file metadata are placed in an encrypted manifest;
3. the file is split into 8 MiB plaintext chunks;
4. every chunk is encrypted independently with AES-256-GCM and a fresh random IV;
5. the chunk index is authenticated as AES-GCM additional authenticated data;
6. PHP stores only encrypted data;
7. the recipient link contains the decryption key only in the URL fragment:

```text
https://sendzero.link/download.html?n=s1&id=TRANSFER_ID#k=DECRYPTION_KEY
```

Browsers do not send the fragment after `#` in HTTP requests, so the SendZero backend does not receive the decryption key during normal operation.

Swapping or reordering encrypted chunks causes authentication/decryption to fail.

### What the server can still see

Zero-access encryption does not mean zero metadata.

The service still needs technical information such as:

- transfer ID;
- encrypted payload size;
- chunk count;
- creation and expiry timestamps;
- selected storage node;
- transfer state;
- request/network metadata normally visible to the web server or hosting infrastructure.

See [privacy.html](privacy.html) for the public privacy policy.

## Transfer limits

Default application limits:

| Setting | Default |
| --- | ---: |
| Maximum file size | 5 GiB |
| Plaintext chunk size | 8 MiB |
| Retention | 1 h / 24 h / 7 d |
| New allocations per client | 30 / hour |
| Allocated upload size per client | 25 GiB / day |
| Active uploads per client / node | 3 |
| Active downloads per transfer / node | 8 |
| Download egress allowance | 20× file size |
| Minimum egress allowance | 5 GiB |
| Disk warning | 90% used |
| Stop new uploads | 95% used |

The abuse limits are configurable in `config.local.php`.

The application rate limiter does **not** store raw client IP addresses. The master derives a local HMAC-based client tag and stores short-lived counters.

When SendZero is deployed behind a trusted reverse proxy, configure `client_ip_header` explicitly. Otherwise `REMOTE_ADDR` is used.

## Resumable uploads

Interrupted uploads can continue without starting again from zero.

The browser stores a small local resume record containing:

- transfer ID;
- upload token;
- encryption key;
- file identity/fingerprint;
- node ID and API location;
- chunk parameters.

When the same file is selected again, SendZero:

1. authenticates to `api/resume.php`;
2. asks which encrypted chunks are already present;
3. reuses the original AES key;
4. skips completed chunks;
5. uploads only the missing chunks.

The plaintext file itself is never stored by SendZero.

Incomplete upload sessions expire automatically.

## Resumable downloads

Large downloads can be resumed when the browser supports the **File System Access API**.

SendZero stores only local resume metadata in IndexedDB, including:

- transfer ID;
- local file handle;
- next verified chunk;
- verified byte offset;
- key fingerprint;
- download session token.

Before resuming, the local partial file is truncated to the last verified offset so an unconfirmed tail cannot silently corrupt the result.

### Download fallback order

SendZero tries:

1. **File System Access API** — direct sequential writes and true resume;
2. **Service Worker streaming** — avoids building a huge Blob, but cannot resume after browser/page restart;
3. **Blob fallback** — available for files up to 512 MiB.

HTTPS is required in production for Web Crypto, Service Workers and secure browser APIs.

## One-time downloads

A transfer can be marked as **one-time**.

The first successful completed download removes the encrypted server copy.

The active browser download session is authenticated so an interrupted one-time download can resume instead of losing access immediately.

## Sender revoke and Recent transfers

Every new transfer receives a separate random **delete capability**.

The server stores only a SHA-256 hash of that delete token.

After upload, the sender can use **Delete transfer now** to remove the encrypted server copy before expiry.

The delete token is **not** included in the recipient share URL.

For convenience, the sender browser stores recent revoke capabilities locally until the related transfer expires. This powers the **Recent transfers** panel after a page reload.

That list:

- is local to that browser;
- requires no account;
- is never uploaded as a transfer list to SendZero;
- is automatically cleaned when entries expire.

Clearing browser storage removes local resume/revoke capabilities.

## Database-free multi-server mode

SendZero can scale across independent storage nodes without:

- MySQL;
- Redis;
- a shared filesystem;
- file migration between nodes.

Architecture:

```text
                       sendzero.link
                            |
                      MASTER / UI
                allocation + node routing
                            |
             +--------------+--------------+
             |              |              |
      s1.sendzero.link s2.sendzero.link s3.sendzero.link
        local storage     local storage     local storage
```

For a new upload:

1. the browser asks the master for an allocation;
2. the master checks configured nodes;
3. the master selects a node with sufficient capacity;
4. the master returns a short-lived HMAC-signed allocation token;
5. the browser uploads encrypted chunks **directly** to that node.

The large file never passes through the master.

Download links remember the storage node:

```text
download.html?n=s2&id=TRANSFER_ID#k=DECRYPTION_KEY
```

The master resolves `s2` to its public URL, then the browser downloads encrypted chunks directly from `s2`.

A node can be disabled for new allocations while its existing files remain downloadable:

```php
's2' => array(
    'url' => 'https://s2.sendzero.link',
    'secret' => 'PRIVATE_NODE_SECRET',
    'enabled' => false,
    'weight' => 100
)
```

See [docs/MULTI_SERVER.md](docs/MULTI_SERVER.md) for deployment and expansion examples.

## Abuse protection

SendZero includes several layers intended for anonymous public operation:

- hourly transfer-allocation limit;
- daily allocated-byte limit;
- per-client active-upload limit;
- per-transfer active-download limit;
- per-transfer egress accounting;
- automatic disk emergency stop;
- one-use allocation nonces;
- signed master-to-node allocation tokens;
- signed admin requests with timestamp + nonce replay protection.

The default limits are intentionally configurable rather than hard-wired to one deployment.

See [docs/PRODUCTION.md](docs/PRODUCTION.md).

## Abuse administration

The master includes a CLI for inspecting and deleting transfers across nodes:

```bash
php sendzero-admin.php nodes
php sendzero-admin.php status
php sendzero-admin.php info s2 TRANSFER_ID
php sendzero-admin.php delete s2 TRANSFER_ID
```

Remote node operations are authenticated with the existing per-node HMAC secret.

The CLI does not require the recipient decryption key.

See [docs/ADMIN.md](docs/ADMIN.md).

Public abuse reports can be sent to:

```text
abuse@sendzero.link
```

## FAQ, terms and privacy

The public interface includes:

- [FAQ](faq.html) for common sender/recipient questions;
- [Terms of Use / Acceptable Use Policy](terms.html);
- [Privacy Policy](privacy.html);
- abuse contact: `abuse@sendzero.link`.

These public information pages support:

- English;
- German;
- Polish.

The FAQ uses native HTML `<details>` sections and does not require an additional JavaScript library.

## Requirements

### Backend

- PHP **5.6+**;
- **64-bit PHP** for correct 5 GiB integer handling;
- writable storage directory;
- secure random source;
- HTTPS for production;
- cURL or `allow_url_fopen` when the master talks to remote nodes.

### Suggested PHP limits

SendZero uploads one encrypted chunk per request, so PHP does not need a 5 GiB request limit.

Suggested values:

```ini
upload_max_filesize = 10M
post_max_size = 11M
max_execution_time = 120
```

For Nginx:

```nginx
client_max_body_size 11M;
```

## Quick start

### 1. Create local configuration

```bash
cp config.local.example.php config.local.php
```

Adjust at least:

```php
return array(
    'role' => 'both',
    'node_id' => 's1',
    'data_dir' => '/srv/sendzero-data'
);
```

### 2. Create storage outside the public web root

```bash
mkdir -p /srv/sendzero-data
chown -R www-data:www-data /srv/sendzero-data
chmod 700 /srv/sendzero-data
```

Keeping `DATA_DIR` outside the application directory is strongly preferred for production.

### 3. Configure the web server

For Apache, the repository includes `.htaccess` rules for:

- directory listing protection;
- sensitive PHP/config file blocking;
- Content Security Policy;
- HSTS;
- no-referrer policy;
- anti-framing;
- MIME sniffing protection;
- Permissions Policy.

For Nginx equivalents, see [docs/PRODUCTION.md](docs/PRODUCTION.md).

### 4. Schedule cleanup

Run on every storage node:

```cron
*/10 * * * * /usr/bin/php /path/to/SendZero/cleanup.php >/dev/null 2>&1
```

Cleanup removes expired transfers and stale internal state.

### 5. Run preflight

```bash
php sendzero-preflight.php https://sendzero.link
```

The checker validates:

- PHP version;
- 64-bit integer support;
- secure randomness;
- `DATA_DIR`;
- disk capacity and emergency thresholds;
- master/node configuration;
- node secrets;
- remote-node HTTP capability;
- required HTTPS response headers.

A hard configuration error returns a non-zero exit code.

## Deployment validation

The current deployed HTTPS instance at `sendzero.link` has completed the application and operational checks in the production test plan, including:

- normal upload and download;
- full 5 GiB upload and download;
- SHA-256 equality between the original and downloaded 5 GiB file;
- interrupted upload + resume;
- interrupted download + resume;
- one-time deletion;
- sender revoke;
- Recent transfers revoke after page reload;
- upload abuse limits;
- download concurrency and egress limits;
- disk emergency stop for new uploads;
- expiry cleanup and scheduled cleanup execution;
- admin CLI status, info and deletion operations;
- required security headers via the deployment preflight;
- long-running download behavior beyond the normal session TTL boundary.

The reproducible test procedure remains in [docs/TESTING.md](docs/TESTING.md).

A completed transfer with a different SHA-256 hash is a release blocker.

## Security reporting and release hygiene

Security issues should be reported privately according to [SECURITY.md](SECURITY.md). Do not open a public issue for an unpatched vulnerability.

Before public release, the complete Git history was reviewed for sensitive repository content. The repository also includes an automated history audit that scans every reachable Git blob for:

- private keys;
- common GitHub, AWS, Google, Slack, GitLab and Stripe credential formats;
- suspicious hard-coded credential assignments;
- local/private files such as `config.local.php`, `nodes.php`, `.env`, private key files and runtime transfer data.

The audit runs from:

```text
.github/workflows/history-audit.yml
```

using:

```text
tools/audit-history.py
```

The full-history audit has passed on the repository history prior to public release.

This automated check reduces accidental secret exposure risk, but it is not a substitute for an independent security audit.

## CI

GitHub Actions runs on pushes and pull requests.

Syntax checks cover:

- PHP 5.6;
- PHP 8.2;
- JavaScript.

A separate release-hygiene workflow checks the complete Git history for recognized credential patterns and forbidden private/runtime files.

Workflows:

```text
.github/workflows/syntax.yml
.github/workflows/history-audit.yml
```

## Interface languages

The web interface supports:

- English — default;
- German;
- Polish.

Language choice is stored locally in the browser.

## Project layout

```text
SendZero/
├── .github/workflows/
│   ├── syntax.yml
│   └── history-audit.yml
├── index.html
├── download.html
├── terms.html
├── privacy.html
├── faq.html
├── favicon.svg
├── sw.js
├── config.php
├── config.local.example.php
├── nodes.example.php
├── cleanup.php
├── sendzero-admin.php
├── sendzero-preflight.php
├── SECURITY.md
├── api/
│   ├── admin.php
│   ├── allocate.php
│   ├── node.php
│   ├── node_status.php
│   ├── init.php
│   ├── resume.php
│   ├── manifest_upload.php
│   ├── chunk.php
│   ├── complete.php
│   ├── info.php
│   ├── manifest.php
│   ├── start.php
│   ├── chunk_get.php
│   ├── finish.php
│   ├── abort.php
│   └── delete.php
├── assets/
│   ├── app.js
│   ├── download.js
│   ├── i18n.js
│   └── style.css
├── docs/
│   ├── ADMIN.md
│   ├── MULTI_SERVER.md
│   ├── PRODUCTION.md
│   └── TESTING.md
├── tools/
│   ├── audit-history.py
│   ├── make-large-test-file.sh
│   └── verify-large-test-file.sh
└── data/
    └── .htaccess
```

Production storage should normally use a configured `DATA_DIR` outside this repository.

## Documentation

- [Security policy](SECURITY.md)
- [Multi-server deployment](docs/MULTI_SERVER.md)
- [Production hardening](docs/PRODUCTION.md)
- [Production test checklist](docs/TESTING.md)
- [Abuse administration](docs/ADMIN.md)
- [FAQ](faq.html)
- [Terms of Use](terms.html)
- [Privacy Policy](privacy.html)

## Current status

SendZero is under active development, but its core transfer and operational paths have been validated on the deployed HTTPS instance at `sendzero.link`.

Implemented:

- client-side AES-256-GCM encryption;
- 5 GiB chunked transfer path;
- upload/download resume;
- multi-node routing;
- abuse and egress protection;
- sender revoke and Recent transfers;
- expiry cleanup;
- disk emergency-stop behavior;
- admin tooling;
- deployment preflight;
- multilingual public/legal UI;
- automated syntax CI.

Verified on the deployed HTTPS instance:

- normal upload/download;
- 5 GiB end-to-end transfer with matching SHA-256;
- upload and download resume;
- one-time deletion;
- sender revoke;
- Recent transfers after reload;
- cleanup and expiry behavior;
- upload abuse limits;
- download concurrency and egress limits;
- disk emergency stop;
- admin CLI operations;
- deployment security headers;
- long-running download session behavior.

The deployed core has been validated, the repository history audit passes, and the source code is publicly available under AGPL-3.0-only. Further work is primarily ongoing hardening, documentation and normal project maintenance rather than unverified core transfer functionality.

## License

SendZero is licensed under the **GNU Affero General Public License v3.0 only (AGPL-3.0-only)**.

You may use, study, modify and redistribute SendZero under the terms of the AGPLv3.

If you modify SendZero and make that modified version available to users over a network, you must offer those users access to the corresponding source code as required by the license.

See [LICENSE](LICENSE) for the full license text.
