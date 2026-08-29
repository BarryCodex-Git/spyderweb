---
type: "query"
date: "2026-08-29T15:02:45.359434+00:00"
question: "Add bottom-right progress and confirmation messages for long-running actions and make cPanel scan all development subdomains when DomainInfo/list_domains fails."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SettingsView()", "AgentActivity()", "domains"]
---

# Q: Add bottom-right progress and confirmation messages for long-running actions and make cPanel scan all development subdomains when DomainInfo/list_domains fails.

## Answer

Expanded via graph vocabulary: hosting, settings, actions, activity, status, domain, domains, provider, server, dashboard, safe. The graph connected SettingsView, AgentActivity, and domains as the shared interaction path. Implemented a reusable progress/success/error toast stack for cPanel connect, sync, and access-mode actions. Updated domain discovery to try DomainInfo/list_domains, DomainInfo/domains_data with list format, and WebVhosts/list_domains, merging domain and subdomain records instead of failing on the first unavailable method.

## Outcome

- Signal: useful

## Source Nodes

- SettingsView()
- AgentActivity()
- domains