---
type: "query"
date: "2026-08-31T06:38:31.211474+00:00"
question: "the check and fix php button is not working, i tried it on DEV5. Please, dont tell me we need another verification, again :("
contributor: "graphify"
outcome: "corrected"
correction: "Treat a host-disabled PHP read function as a capability limitation, not an authentication failure. Reuse the existing cPanel token and apply the settings through the available write function."
source_nodes: ["Domain", "Safe Simulated WordPress and Template Actions", "Operational Source of Truth"]
---

# Q: the check and fix php button is not working, i tried it on DEV5. Please, dont tell me we need another verification, again :(

## Answer

Expanded from original query via graph vocabulary: [check, domain, hosting, management, operational, settings, actions, press]. The saved cPanel connection is valid. The host disables LangPHP/php_ini_get_user_basic_directives, so the PHP action must fall back to php_ini_get_user_content and, when no readable PHP endpoint exists, apply the full six-setting profile through the existing write function without requesting new credentials.

## Outcome

- Signal: corrected
- Correction: Treat a host-disabled PHP read function as a capability limitation, not an authentication failure. Reuse the existing cPanel token and apply the settings through the available write function.

## Source Nodes

- Domain
- Safe Simulated WordPress and Template Actions
- Operational Source of Truth