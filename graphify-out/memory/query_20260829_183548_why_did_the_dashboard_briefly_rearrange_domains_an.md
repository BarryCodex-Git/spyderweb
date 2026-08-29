---
type: "query"
date: "2026-08-29T18:35:48.164157+00:00"
question: "Why did the dashboard briefly rearrange domains and then snap back to WordPress scan pending, and how should it stay live?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Dashboard()", "domains", "DomainStatus"]
---

# Q: Why did the dashboard briefly rearrange domains and then snap back to WordPress scan pending, and how should it stay live?

## Answer

Expanded from original query via vocab: [dashboard, domain, domains, hosting, inventory, sites, status, template, website]. Production logs showed successful POST sync requests followed by successful inventory GETs. The apparent arranged state was the demo inventory displayed before the stored live inventory loaded. In lib/cpanel.ts collectDetails, recursively visiting the plain domain string overwrote the richer DomainInfo record and erased documentRoot, preventing the Fileman wp-config.php inspection and leaving WordPress status not_checked. Fix collectDetails to preserve and merge rich fields, add document-root path variants and per-domain fallback, and make Dashboard poll stored live inventory while visible with an explicit refresh indicator.

## Outcome

- Signal: useful

## Source Nodes

- Dashboard()
- domains
- DomainStatus