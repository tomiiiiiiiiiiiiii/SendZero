# SendZero abuse administration

SendZero includes a CLI for inspecting and deleting transfers across local and remote storage nodes without a database.

Run it on the master server:

```bash
php sendzero-admin.php nodes
php sendzero-admin.php status
php sendzero-admin.php info s2 TRANSFER_ID
php sendzero-admin.php delete s2 TRANSFER_ID
```

## Finding the node and transfer ID

A normal share URL contains both values:

```text
https://sendzero.link/download.html?n=s2&id=0123456789abcdef0123456789abcdef#k=...
```

For administration:

```text
node        = s2
transfer ID = 0123456789abcdef0123456789abcdef
```

The decryption key after `#k=` is not required to inspect or delete the encrypted server copy.

## List configured nodes

```bash
php sendzero-admin.php nodes
```

Example:

```text
s1  enabled=yes  weight=100  url=(local)
s2  enabled=yes  weight=100  url=https://s2.sendzero.link
```

Node secrets are never printed.

## Node status

```bash
php sendzero-admin.php status
```

The command shows whether each node accepts uploads, available disk space, disk usage and system load.

## Inspect a transfer

```bash
php sendzero-admin.php info s2 0123456789abcdef0123456789abcdef
```

The output contains technical metadata such as:

- transfer state;
- logical file size;
- encrypted storage bytes;
- chunk count;
- creation/completion/expiry timestamps;
- one-time flag.

It does not reveal the encrypted filename or file contents.

## Delete an abusive transfer

After validating an abuse report:

```bash
php sendzero-admin.php delete s2 0123456789abcdef0123456789abcdef
```

The encrypted manifest, chunks, download sessions and local transfer state are removed from that node.

## Remote-node authentication

For a remote node, the master calls:

```text
https://s2.sendzero.link/api/admin.php
```

The request is authenticated with the private node secret already configured in `nodes.php`.

Authentication includes:

- action;
- transfer ID;
- timestamp;
- random nonce;
- HMAC-SHA256 signature.

The node accepts only a short clock window and each admin nonce can be used once.

No separate database or admin password file is required.

## Security notes

- Keep `nodes.php` and node secrets private.
- Run `sendzero-admin.php` from CLI only.
- The repository `.htaccess` blocks direct HTTP access to the CLI file on Apache.
- Keep clocks synchronized on master and child nodes; signed admin requests allow only a short timestamp skew.
- Deleting a transfer is intentionally immediate and irreversible.
