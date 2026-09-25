#!/usr/bin/env python3
"""
Scan every blob reachable from every Git ref for common secret patterns and
files that must never enter SendZero history.

This intentionally uses only Python's standard library and local Git data.
It is a release-hygiene check, not a replacement for a professional audit
or a dedicated secret-scanning service.
"""

import os
import re
import subprocess
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
os.chdir(ROOT)

FORBIDDEN_BASENAMES = {
    ".env",
    "config.local.php",
    "nodes.php",
    "id_rsa",
    "id_ed25519",
    "credentials",
    "credentials.json",
}

FORBIDDEN_EXTENSIONS = {".pem", ".p12", ".pfx", ".key"}

SECRET_PATTERNS = [
    ("private key", re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----")),
    ("GitHub token", re.compile(r"\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b")),
    ("AWS access key", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("Google API key", re.compile(r"\bAIza[0-9A-Za-z_-]{30,}\b")),
    ("Slack token", re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}\b")),
    ("GitLab token", re.compile(r"\bglpat-[A-Za-z0-9_-]{20,}\b")),
    ("Stripe live key", re.compile(r"\b(?:sk|rk)_live_[A-Za-z0-9]{16,}\b")),
]

ASSIGNMENT_RE = re.compile(
    r"""(?ix)
    \b(secret|api[_-]?key|access[_-]?token|auth[_-]?token|password|passwd)
    \s*(?:=>|=|:)
    \s*['"]([^'"\r\n]{12,})['"]
    """
)

PLACEHOLDER_WORDS = (
    "REPLACE",
    "EXAMPLE",
    "YOUR_",
    "CHANGEME",
    "DUMMY",
    "TEST",
    "PLACEHOLDER",
    "PRIVATE_NODE_SECRET",
    "SECRET_FROM",
)


def git(*args):
    return subprocess.check_output(["git", *args], text=True, errors="replace")


def is_forbidden_path(path):
    normalized = path.replace("\\", "/")
    base = normalized.rsplit("/", 1)[-1]
    lower = base.lower()

    if lower in FORBIDDEN_BASENAMES:
        return True

    if any(lower.endswith(ext) for ext in FORBIDDEN_EXTENSIONS):
        return True

    if normalized.startswith("data/") and normalized != "data/.htaccess":
        return True

    return False


def looks_like_placeholder(value):
    upper = value.upper()
    if any(word in upper for word in PLACEHOLDER_WORDS):
        return True

    # Example constants such as PRIVATE_NODE_SECRET are deliberately obvious.
    if re.fullmatch(r"[A-Z][A-Z0-9_]{11,}", value):
        return True

    return False


def scan_text(text):
    findings = []

    for label, pattern in SECRET_PATTERNS:
        if pattern.search(text):
            findings.append(label)

    for match in ASSIGNMENT_RE.finditer(text):
        value = match.group(2).strip()
        if not looks_like_placeholder(value):
            findings.append("hard-coded credential-like assignment")

    return sorted(set(findings))


def main():
    refs = [line.strip() for line in git("rev-list", "--all").splitlines() if line.strip()]
    if not refs:
        print("History audit: no commits found.")
        return 0

    blobs = {}
    forbidden = set()

    for commit in refs:
        tree = git("ls-tree", "-r", "--full-tree", commit)
        for line in tree.splitlines():
            try:
                meta, path = line.split("\t", 1)
                mode, obj_type, sha = meta.split()
            except ValueError:
                continue

            if obj_type != "blob":
                continue

            if is_forbidden_path(path):
                forbidden.add(path)

            blobs.setdefault(sha, path)

    findings = []

    for sha, path in blobs.items():
        try:
            raw = subprocess.check_output(["git", "cat-file", "-p", sha])
        except subprocess.CalledProcessError:
            continue

        if b"\x00" in raw:
            continue

        text = raw.decode("utf-8", errors="replace")
        for label in scan_text(text):
            findings.append((path, label))

    if forbidden or findings:
        print("History audit FAILED.")

        if forbidden:
            print("\nForbidden paths found somewhere in Git history:")
            for path in sorted(forbidden):
                print(" - " + path)

        if findings:
            print("\nCredential-like content found somewhere in Git history:")
            for path, label in sorted(set(findings)):
                print(" - %s: %s" % (path, label))

        print("\nDo not make the repository public until these findings are reviewed.")
        return 1

    print(
        "History audit passed: %d commits and %d unique blobs scanned; "
        "no forbidden runtime/config paths or recognized credential patterns found."
        % (len(refs), len(blobs))
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
