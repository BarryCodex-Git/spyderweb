---
type: "query"
date: "2026-09-06T16:41:17.649181+00:00"
question: "Fix SpyderWeb so every scanned cPanel subdomain appears in all relevant areas after import."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "Dashboard()", "Project", "Development-Domain Inventory"]
---

# Q: Fix SpyderWeb so every scanned cPanel subdomain appears in all relevant areas after import.

## Answer

Expanded from graph vocabulary: domain subdomain dashboard project inventory display. The live database contained the primary domain and all three testwebsitebuild.com subdomains. The frontend connection flow immediately re-read D1 and could replace the fresh POST scan response with an older snapshot. The fix returns stable persisted domain IDs, renders the complete scan response immediately, merges it by connection into Dashboard, Domains, Projects and New Project state, and rejects older background inventory responses. Build and focused tests passed; Sites version 45 was deployed successfully and the live D1 inventory still contains all four active testwebsitebuild.com records.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- Dashboard()
- Project
- Development-Domain Inventory