# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Odin CMS, please report it
responsibly. **Do NOT open a public GitHub issue.**

### How to Report

1. Email **security@astconsulting.in** with a description of the vulnerability.
2. Include steps to reproduce, if possible.
3. We will acknowledge receipt within **48 hours**.
4. We aim to provide a fix or mitigation within **7 days** for critical issues.

### What to Expect

- A confirmation email acknowledging your report.
- Regular updates on the progress of the fix.
- Credit in the release notes (unless you prefer to remain anonymous).

## Security Best Practices for Deployers

- **Never commit `.env` files** — use `.env.example` as a template.
- Rotate JWT secrets and API keys regularly.
- Use HTTPS in production.
- Keep dependencies up to date (`npm audit`).
- Restrict MongoDB and Redis access to trusted networks only.
