# Changelog

All notable changes to SendZero are documented here.

The project follows semantic versioning from `v1.0.0` onward.

## [1.0.0] - 2026-09-26

First public 1.0 release of SendZero.

### Core transfer and encryption

- Client-side AES-256-GCM encryption using the Web Crypto API.
- Random 256-bit key generated in the browser for each transfer.
- Decryption key kept in the URL fragment and not sent to the SendZero backend during normal operation.
- Encrypted filename, MIME type and file metadata.
- Independent 8 MiB encrypted chunks with authenticated chunk indexes.
- Maximum logical file size of 5 GiB.
- Bounded browser memory use for large transfers.

### Reliability

- Resumable uploads that skip already stored encrypted chunks.
- Resumable large downloads in browsers supporting the File System Access API.
- Service Worker streaming fallback.
- Blob fallback for smaller files.
- One-time downloads with resumable authenticated download sessions.
- Sender-controlled early revoke/delete.
- Local Recent transfers list storing revoke capabilities only in the sender browser.
- Automatic transfer expiry and cleanup.

### Deployment and scaling

- Database-free operation without MySQL or Redis.
- Multi-server storage architecture with direct browser-to-node upload and download.
- HMAC-signed master-to-node allocation tokens.
- Nodes can be disabled for new allocations while existing transfers remain downloadable.
- Multi-node administration CLI.
- Production preflight checker.
- Apache security configuration and documented Nginx equivalents.

### Abuse and operational controls

- Allocation rate limits.
- Daily allocated-byte limits.
- Per-client active-upload limits.
- Per-transfer active-download limits.
- Download egress accounting and limits.
- Disk warning and emergency stop thresholds.
- One-use allocation nonces.
- Signed administration requests with replay protection.
- Dedicated abuse reporting path.

### User experience

- English, German and Polish interface.
- 1 hour, 24 hour and 7 day retention options.
- No account required.
- FAQ, Terms of Use and Privacy Policy.
- Responsive dark interface and SendZero branding.

### Security and release hygiene

- Security reporting policy.
- CI syntax checks for PHP 5.6, PHP 8.2 and JavaScript.
- Full Git history audit for accidentally committed credentials and private runtime/configuration files.
- Production test plan covering large transfers, resume behavior, one-time deletion, sender revoke, abuse limits, disk emergency stop, admin operations and security headers.

### Validation completed for this release

The deployed HTTPS instance at `sendzero.link` has completed the documented core production validation, including:

- full 5 GiB upload and download;
- matching SHA-256 for the original and downloaded 5 GiB file;
- interrupted upload and download resume;
- one-time deletion;
- sender revoke and Recent transfers recovery;
- cleanup and expiry;
- abuse and egress limits;
- disk emergency-stop behavior;
- administration CLI checks;
- required security headers;
- a long-running download session.

This validation is operational testing and automated release hygiene, not an independent security audit.

[1.0.0]: https://github.com/tomiiiiiiiiiiiiii/SendZero/releases/tag/v1.0.0
