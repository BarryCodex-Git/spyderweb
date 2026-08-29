---
type: "query"
date: "2026-08-29T14:49:41.148555+00:00"
question: "Read-only cPanel access must be easy to reverse because full write access will be needed soon after connection and scanning."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SettingsView()", "Human Approval for Consequential Actions", "domains"]
---

# Q: Read-only cPanel access must be easy to reverse because full write access will be needed soon after connection and scanning.

## Answer

Expanded via graph vocabulary: hosting, settings, actions, approval, safe, domain, domains, provider, server. SettingsView and the human approval nodes showed that access mode belongs on each saved hosting connection. Implemented a reversible read_only / managed_write switch backed by the existing hosting_connections.mode and write_actions_enabled fields, while destructive_actions_enabled remains false and mode changes are audit logged.

## Outcome

- Signal: useful

## Source Nodes

- SettingsView()
- Human Approval for Consequential Actions
- domains