# SendZero production test checklist

Run this after deploying the current code and before opening the service publicly.

## 1. Create a 5 GiB test file

From the repository:

```bash
chmod +x tools/make-large-test-file.sh tools/verify-large-test-file.sh
./tools/make-large-test-file.sh
```

This creates:

```text
sendzero-5g-test.bin
sendzero-5g-test.bin.sha256
```

`truncate` creates a sparse 5 GiB file quickly. The browser still reads the full logical 5 GiB during upload, so the SendZero transfer path is exercised at the real advertised size.

## 2. Full 5 GiB upload

1. Open SendZero in a current Chromium-based browser over HTTPS.
2. Select `sendzero-5g-test.bin`.
3. Upload the complete file.
4. Confirm that the progress reaches 100%.
5. Save the generated share URL.
6. Confirm that the selected storage node still has a healthy amount of free disk space.

Expected result: upload completes without the browser trying to hold the whole file in memory.

## 3. Interrupted upload + resume

Start another 5 GiB transfer.

1. Let it reach at least 20–30%.
2. Close the tab or disconnect the network.
3. Reopen SendZero.
4. Select the exact same local file.
5. SendZero should show that an interrupted upload was found.
6. Choose resume.
7. Confirm that already uploaded chunks are skipped and the upload continues instead of restarting from 0%.

Expected result: only missing encrypted chunks are uploaded.

## 4. Full download

Open the saved share URL.

1. Choose a destination file.
2. Let the download and decryption complete.
3. Rename/move the downloaded file if necessary to:
   `sendzero-5g-test-downloaded.bin`.
4. Compare hashes:

```bash
./tools/verify-large-test-file.sh \
  sendzero-5g-test.bin \
  sendzero-5g-test-downloaded.bin
```

Required result:

```text
PASS: files are byte-for-byte identical.
```

A completed transfer with a different SHA-256 hash is a release blocker.

## 5. Interrupted download + resume

Use Chromium/Edge because the true resume path uses the File System Access API.

1. Start downloading the 5 GiB transfer.
2. Let it reach at least 20–30%.
3. Close the tab/browser or disconnect the network.
4. Reopen the same SendZero share link.
5. Choose `Resume download`.
6. Give the browser permission to reopen the partial local file when requested.
7. Confirm that the download resumes from the last verified chunk.
8. After completion, run the SHA-256 comparison again.

Required result: hashes match.

## 6. One-time 5 GiB transfer

Repeat with **One-time download** enabled.

Verify:

1. interrupted/resumed download can reclaim its existing download session;
2. after a successful completed download the encrypted server copy is deleted;
3. opening the link after completion returns unavailable/not found.

## 7. Anti-abuse smoke tests

Use a non-production test configuration with temporarily small limits.

Example:

```php
'rate_max_allocations_per_hour' => 2,
'rate_max_bytes_per_day' => 100 * 1024 * 1024,
'max_active_uploads_per_client' => 1
```

Verify that:

- the third new allocation in the same hour returns HTTP 429;
- exceeding the daily byte allowance returns HTTP 429;
- opening a second simultaneous upload on the same node returns HTTP 429;
- normal downloads remain available when upload limits are hit.

Restore production limits after the test.

## 8. Disk emergency-stop test

On a test node, temporarily set:

```php
'warn_disk_used_percent' => 1,
'max_disk_used_percent' => 2
```

The node should report that it is not accepting uploads and `init.php` should reject a new transfer.

Do **not** fill a production disk to 95% merely to test this feature.

Restore:

```php
'warn_disk_used_percent' => 90,
'max_disk_used_percent' => 95
```

afterwards.

## 9. Security-header check

Run:

```bash
curl -sI https://sendzero.link/
```

Confirm the response contains at least:

```text
Content-Security-Policy
Strict-Transport-Security
Referrer-Policy: no-referrer
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy
```

Also test a child node endpoint when multi-server mode is enabled.

## Release rule

Do not call the 5 GiB path production-tested until all of these have passed on the deployed HTTPS instance:

- full upload;
- upload resume;
- full download;
- download resume;
- SHA-256 equality;
- one-time deletion;
- anti-abuse rejection;
- disk emergency stop;
- security headers.
