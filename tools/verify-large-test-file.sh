#!/bin/sh
set -eu

ORIGINAL="${1:-sendzero-5g-test.bin}"
DOWNLOADED="${2:-sendzero-5g-test-downloaded.bin}"

if [ ! -f "$ORIGINAL" ]; then
    echo "Missing original file: $ORIGINAL" >&2
    exit 1
fi

if [ ! -f "$DOWNLOADED" ]; then
    echo "Missing downloaded file: $DOWNLOADED" >&2
    exit 1
fi

hash_file() {
    if command -v sha256sum >/dev/null 2>&1; then
        sha256sum "$1" | awk '{print $1}'
    elif command -v shasum >/dev/null 2>&1; then
        shasum -a 256 "$1" | awk '{print $1}'
    else
        echo "No SHA-256 command found." >&2
        exit 1
    fi
}

A="$(hash_file "$ORIGINAL")"
B="$(hash_file "$DOWNLOADED")"

echo "Original:   $A"
echo "Downloaded: $B"

if [ "$A" != "$B" ]; then
    echo "FAIL: hashes differ." >&2
    exit 2
fi

echo "PASS: files are byte-for-byte identical."
