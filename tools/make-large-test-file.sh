#!/bin/sh
set -eu

FILE="${1:-sendzero-5g-test.bin}"
SIZE="${2:-5G}"

if command -v truncate >/dev/null 2>&1; then
    truncate -s "$SIZE" "$FILE"
else
    echo "truncate not found; creating a real zero-filled file with dd (this may take a while)." >&2
    case "$SIZE" in
        5G|5g)
            dd if=/dev/zero of="$FILE" bs=1M count=5120 status=progress
            ;;
        *)
            echo "Without truncate, only the default 5G size is supported by this helper." >&2
            exit 1
            ;;
    esac
fi

echo "Created: $FILE"
ls -lh "$FILE"

if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$FILE" | tee "$FILE.sha256"
elif command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$FILE" | tee "$FILE.sha256"
else
    echo "No SHA-256 command found. Install sha256sum/coreutils or use shasum -a 256." >&2
    exit 1
fi

echo
echo "Hash saved to: $FILE.sha256"
