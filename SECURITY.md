# Security Policy

## Scope

This repository covers the Drenyra AI runtime: mission protocol, receipts, candidates, gates, ledger, recovery, and the CLI/MCP surfaces. It processes **fiscal operations** — treat confidentiality, integrity, and auditability as product safety requirements.

## Reporting a vulnerability

Use **GitHub Private Vulnerability Reporting**: open the **Security** tab of this repository → **Report a vulnerability**. Do not open a public issue for security defects.

When reporting, include:

- Affected version/commit and component (`receipts`, `ledger`, `gates`, `recovery`, …)
- A minimal, safe reproduction (no real company data, no RUCs, no credentials)
- Expected vs. actual behavior
- Impact assessment (integrity? confidentiality? audit-trail break?)

## Out of scope

- Production credentials, tokens, or customer data — never attach these
- Vulnerabilities in Drenyra, Drenyra Pi, or Drenyra Engram (report in their own repos)
- Brute-force or spam abuse of public endpoints

## Handling

Reports are acknowledged within 5 business days. A fix, workaround, or risk acceptance is communicated before public disclosure. Pre-alpha project: fixes land as patch releases on `main` with an advisory note in the release.

## Responsible use

This software is proprietary and confidential (see [LICENSE](LICENSE)). Reporting a vulnerability does not grant any right to copy, modify, or distribute the software.
