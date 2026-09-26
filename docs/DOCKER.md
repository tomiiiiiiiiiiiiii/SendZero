# Docker Compose deployment

SendZero includes a single-node Docker Compose setup intended to make self-hosting and local evaluation straightforward.

## Quick start

Requirements:

- Docker Engine;
- Docker Compose v2 (`docker compose`).

Run:

```bash
git clone https://github.com/tomiiiiiiiiiiiiii/SendZero.git
cd SendZero
docker compose up -d --build
```

Open:

```text
http://localhost:8080
```

`localhost` is suitable for local testing. For a public deployment, terminate HTTPS in front of the container and use the public HTTPS origin.

To use a different local port:

```bash
SENDZERO_PORT=9090 docker compose up -d --build
```

## What Compose starts

The default stack contains two services:

- `sendzero` — Apache + PHP 8.2 serving the UI and API;
- `cleanup` — runs `cleanup.php` every 10 minutes against the same persistent storage.

Both services share the named volume:

```text
sendzero-data
```

The volume is mounted at:

```text
/srv/sendzero-data
```

which keeps transfer data outside the public web root.

On first start the container creates a minimal Docker-specific `config.local.php` for a one-machine `role=both` deployment. SendZero creates its local node secret inside the persistent data directory as needed.

## Useful commands

Status:

```bash
docker compose ps
```

Logs:

```bash
docker compose logs -f sendzero
docker compose logs -f cleanup
```

Run cleanup manually:

```bash
docker compose exec sendzero php cleanup.php
```

Stop the stack while preserving encrypted transfer data:

```bash
docker compose down
```

Remove the stack **and permanently delete the named storage volume**:

```bash
docker compose down -v
```

Do not use `down -v` unless deleting the stored encrypted transfers is intentional.

## Production HTTPS

Web Crypto and the browser APIs used by SendZero require a secure context for real deployments. Put the container behind an HTTPS reverse proxy such as Apache, Nginx, Caddy, Traefik or a trusted CDN/proxy.

The default Compose port is plain HTTP:

```text
host:8080 -> container:80
```

For production, expose that port only to the trusted reverse proxy or firewall it from direct public access.

After HTTPS is configured, run the normal preflight check against the public origin:

```bash
docker compose exec sendzero php sendzero-preflight.php https://files.example.com
```

Review every warning and fix every failure before exposing an anonymous public service.

## Reverse proxy client IPs

By default SendZero rate limiting uses PHP `REMOTE_ADDR`. Behind a reverse proxy this may be the proxy address.

Only configure `client_ip_header` when the proxy is trusted and overwrites the header so clients cannot spoof it. See [PRODUCTION.md](PRODUCTION.md).

## Custom configuration

For a basic single-node deployment no local configuration file is required.

For custom limits, a reverse proxy or multi-node mode, create your own:

```bash
cp config.local.example.php config.local.php
```

Then add the same read-only bind mount to both Compose services:

```yaml
volumes:
  - ./config.local.php:/var/www/html/config.local.php:ro
  - sendzero-data:/srv/sendzero-data
```

If the master uses a custom `nodes.php`, bind-mount that file into the `sendzero` service as well:

```yaml
  - ./nodes.php:/var/www/html/nodes.php:ro
```

For a real multi-host deployment, each storage node should have its own persistent data volume and node configuration. See [MULTI_SERVER.md](MULTI_SERVER.md).

## Updating

Pull the new code and rebuild:

```bash
git pull
docker compose up -d --build
```

The named storage volume is preserved across image rebuilds and ordinary `docker compose down` / `up` cycles.

## Backups

The named Docker volume contains encrypted transfer state plus local operational secrets used by the anonymous rate limiter and node authentication.

If you back it up, treat the backup as operationally sensitive even though user file payloads are encrypted.

## Security notes

- The Docker image uses PHP 8.2 with Apache.
- PHP cURL support is installed for master-to-node HTTP communication.
- Apache honors the repository `.htaccess`, including sensitive-file blocking and security headers.
- The image sets the documented 10 MiB / 11 MiB per-request upload limits rather than allowing whole-file uploads.
- Transfer storage is outside `/var/www/html`.
- Docker support does not change the SendZero security model and is not a substitute for TLS, host hardening or an independent security audit.
