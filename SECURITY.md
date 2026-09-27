# Security

## What Fluvy does, and does not do

Fluvy runs inside your Home Assistant: a Python integration that serves its own files and a module the browser
loads from your instance. It makes no network requests of its own — no telemetry, no update checks, no calls to
any server outside your Home Assistant. Its settings are stored in Home Assistant's own frontend data; the
integration stores nothing but its config entry. The files it serves are cacheable and unauthenticated, as every
frontend resource of Home Assistant is, and contain no data of your home.

## Supported versions

The latest release. A fix ships as a new release through HACS.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through
[GitHub Security Advisories](https://github.com/acosta290/fluvy/security/advisories/new); you will get an answer
within seven days. Once a fix is released, the advisory is published with credit to the reporter, at the latest
ninety days after the report.
