# Security Policy

## Reporting a vulnerability

Please report suspected security vulnerabilities privately through GitHub's **Security** tab using **Report a vulnerability**.

Do **not** open a public issue for an unpatched vulnerability.

A useful report includes:

- the affected component or endpoint;
- clear reproduction steps;
- the security impact you believe is possible;
- a minimal proof of concept when appropriate;
- browser, PHP and deployment details when they matter.

Do not include real users' private files, decryption keys, credentials or other personal data in a report.

## Safe testing

Please avoid testing that could disrupt the public SendZero service or other users. In particular, do not perform denial-of-service testing, intentionally exhaust storage or bandwidth, access transfers that are not yours, or attempt social engineering.

Use your own transfers and test data.

## Scope

Security-sensitive areas include, among others:

- client-side encryption and key handling;
- transfer authentication and resume capabilities;
- one-time download behavior;
- sender revoke/delete capabilities;
- master-to-node allocation authentication;
- node and admin authentication;
- path handling and storage isolation;
- abuse/rate-limit bypasses;
- browser security headers and origin controls.

## Supported code

Security fixes are made against the current `main` branch. The public deployment at `sendzero.link` may be updated independently as fixes are validated and deployed.

## Disclosure

Please allow time for a reported issue to be investigated and, when necessary, fixed and deployed before publishing technical details.

This project has not undergone an independent security audit.
