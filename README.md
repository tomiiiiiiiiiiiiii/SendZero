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

## Terms and acceptable use

The public interface includes `terms.html`, a basic Terms of Use / Acceptable Use Policy covering prohibited content and abusive use.

The upload page links to these rules directly below the upload button, and both upload and download pages link to them from the footer.

The terms are available in English, German and Polish through the same language selector as the rest of the interface.

## Interface languages

The web interface currently supports:

- English (default)
- German
- Polish

The selected language is stored locally in the browser and is shared between the upload and download pages. The interface uses one codebase and a shared translation layer in `assets/i18n.js`.

The expiry selector uses a custom dark three-option control instead of the browser's native select menu, so its appearance stays consistent across platforms.

## Resumable uploads

Interrupted uploads can be continued instead of restarting from zero.

The browser stores a small resume record in local storage containing the transfer ID, upload token, encryption key and file identity. The plaintext file itself is **never** stored by SendZero.

When the same file is selected again:

1. the browser authenticates to `api/resume.php` with the upload token;
2. the server returns which encrypted chunk numbers are already present;
3. SendZero reuses the original AES key;
4. already uploaded chunks are skipped;
5. only missing chunks are encrypted and uploaded.

The resume endpoint does not receive the decryption key or filename. A valid resume request extends the incomplete-upload lease by another 6 hours. Completed uploads remove the local resume record.

To avoid accidentally resuming a different file, the browser builds a local fingerprint from the filename, size, modification time and sampled file content.

## Resumable downloads

Large downloads can also be resumed instead of restarting from zero when the browser supports the **File System Access API** (for example current Chromium-based browsers).

For resumable downloads SendZero stores only local resume metadata in IndexedDB:

- the transfer ID;
- a handle to the user-selected local file;
- the next verified chunk number;
- the exact verified byte offset;
- the one-time download session token when applicable;
- a fingerprint of the decryption key, not the key itself.

After each decrypted chunk is written successfully, the browser checkpoints the next chunk number and byte offset. If the page or browser closes, reopening the same SendZero link can continue from that checkpoint.

Before resuming, SendZero truncates any unconfirmed tail after the last verified byte. If the partial local file is unexpectedly shorter than the recorded checkpoint, the resume state is rejected instead of silently creating a corrupted file.

For **one-time downloads**, the same authenticated download token can reclaim and extend its short server-side session. While an active one-time download is running, the browser refreshes the lease periodically so a slow multi-gigabyte transfer does not fail merely because the short download session expired.

### Fallback download modes

SendZero tries, in order:

1. File System Access API — direct sequential writes and true resumable downloads.
2. A same-origin Service Worker streaming download (`sw.js`) — decrypted chunks are streamed into a browser download without assembling a huge Blob, but that browser-managed download cannot be resumed by SendZero after a page/browser restart.
3. Blob fallback for files up to 512 MiB — not resumable.

HTTPS is required in production for Web Crypto, Service Workers and the secure browser APIs used by SendZero.

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
│   ├── resume.php
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

## Database-free multi-server mode

SendZero can scale to multiple storage servers without MySQL, Redis or a shared filesystem.

The main server acts as a dispatcher: before a new upload it checks configured child nodes, selects one with sufficient capacity, and returns a short-lived signed allocation token. The browser then uploads encrypted chunks **directly** to that child node.

Download links contain the node ID:

```text
download.html?n=s2&id=TRANSFER_ID#k=DECRYPTION_KEY
```

The master resolves the node ID to its current public URL, but file data never passes through the master.

A child can be removed from new allocations with `enabled => false` while all existing downloads stored on that child continue to work.

See [docs/MULTI_SERVER.md](docs/MULTI_SERVER.md) for deployment examples for:

- one server running as `master + s1`;
- a dedicated master;
- independent `s1`, `s2`, `s3` child nodes;
- adding capacity when disk space or network capacity becomes constrained.

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
- Resumable uploads and File System Access downloads are supported.
- Consider adding an explicit transfer manager UI for listing, cancelling and clearing interrupted transfers.
