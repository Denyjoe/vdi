# Security Policy

## Reporting a Vulnerability

If you find a security vulnerability in this project, please **do not open a public issue**.

Instead, report it privately:

- Open a [GitHub Security Advisory](https://github.com/Denyjoe/vdi/security/advisories/new) on this repository, or
- Contact the maintainer directly via GitHub: [@Denyjoe](https://github.com/Denyjoe)

Please include:

- A description of the vulnerability and its potential impact
- Steps to reproduce it (as concrete as possible)
- Any relevant logs, screenshots, or proof-of-concept code

## What to expect

This is an actively maintained solo/academic project, not a company with a formal SLA. That said, real reports are taken seriously. Expect an acknowledgment within a few days, and a fix or mitigation plan communicated back to you once the issue is understood. You're welcome to ask for credit (or anonymity) once a fix ships.

## Scope

This covers the application code in this repository: the Django backend, the React frontend, and the VM/session-provisioning logic. It does not cover the security of a third party's own infrastructure (Proxmox, Guacamole, AzamPay, Firebase) beyond how this project integrates with them.
