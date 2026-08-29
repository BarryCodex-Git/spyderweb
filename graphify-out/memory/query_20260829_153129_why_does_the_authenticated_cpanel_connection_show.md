---
type: "query"
date: "2026-08-29T15:31:29.733965+00:00"
question: "Why does the authenticated cPanel connection show no domains, and how should SpyderWeb represent it?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["SettingsView()", "domains"]
---

# Q: Why does the authenticated cPanel connection show no domains, and how should SpyderWeb represent it?

## Answer

Expanded from the original query via graph vocabulary: [domain, domains, hosting, inventory, server, settings, sites]. The graph confirmed that SettingsView() owns hosting connection controls and that domains feed the dashboard. The fix separates verified cPanel authentication from live inventory import, keeps a valid encrypted connection retryable, adds current UAPI and shared-host compatibility inventory sources, and never uses screenshot contents as domain data.

## Outcome

- Signal: useful

## Source Nodes

- SettingsView()
- domains