# SendZero

A zero-access file-transfer MVP built with **PHP + JavaScript + HTML/CSS**.

## What changed in the 5 GiB version

SendZero no longer loads the entire file into browser memory. A file is split into **8 MiB plaintext chunks**. Every chunk is encrypted independently with **AES-256-GCM** and a fresh random IV, then uploaded immediately.

That means a 5 GiB transfer needs only a small, bounded amount of browser memory instead of several gigabytes.

## Security model

1. The browser generates a random 256-bit AES key.
2. Filename, MIME type and file metadata are put in a separately encrypted manifest.
3. Each file chunk is encrypted locally with AES-256-GCM.
4. PHP stores only encrypted manifest/chunks.
5. The share URL looks like:

   `download.html?id=TRANSFER_ID#k=DECRYPTION_KEY`

The fragment after `#` is not sent to PHP in HTTP requests, so the server does not receive the decryption key.

Each encrypted chunk authenticates its chunk index as AES-GCM additional authenticated data, so swapping/reordering chunks causes decryption to fail.

## Limits

- Maximum logical file size: **5 GiB**
- Chunk size: **8 MiB**
- Retention: 1 hour / 24 hours / 7 days
- Optional one-time transfer

PHP only receives one chunk per request, so `upload_max_filesize` and `post_max_size` do **not** need to be 5 GiB.

Suggested PHP settings:

```ini
upload_max_filesize = 10M
post_max_size = 11M
max_execution_time = 120
```

The PHP build must be **64-bit** for correct 5 GiB integer handling. PHP 5.6+ is supported by the backend code.

## Large-file download

SendZero decrypts files chunk by chunk as well.

It tries, in order:

1. File System Access API — direct sequential writes to a chosen local file.
2. A same-origin Service Worker streaming download (`sw.js`) — decrypted chunks are streamed into a browser download without assembling a huge Blob.
3. Blob fallback for files up to 512 MiB.

Large-file behavior still depends on browser support. HTTPS is required in production for Web Crypto and Service Workers.

## Server layout

```text
SendZero/
├── index.html
├── download.html
├── sw.js
├── config.php
├── cleanup.php
├── api/
│   ├── common.php
│   ├── init.php
│   ├── manifest_upload.php
│   ├── chunk.php
│   ├── complete.php
│   ├── info.php
│   ├── manifest.php
│   ├── start.php
│   ├── chunk_get.php
│   ├── finish.php
│   └── abort.php
├── assets/
│   ├── app.js
│   ├── download.js
│   └── style.css
└── data/
```

Each transfer gets its own directory:

```text
data/<transfer-id>/
├── meta.json
├── manifest.bin
├── chunk_000000.bin
├── chunk_000001.bin
└── ...
```

## Cleanup

Run periodically:

```bash
*/10 * * * * /usr/bin/php /path/to/sendzero/cleanup.php >/dev/null 2>&1
```

Incomplete uploads automatically expire after 6 hours.

## Production notes

- Move `DATA_DIR` outside the public web root if possible.
- Use HTTPS only.
- Add rate limiting and per-IP / per-transfer quotas before public launch.
- Consider free-space checks before accepting a transfer.
- Set web-server request/body limits above the 8 MiB chunk size.
- Consider resumable upload UI as the next feature: the server-side chunk design already makes it possible.
