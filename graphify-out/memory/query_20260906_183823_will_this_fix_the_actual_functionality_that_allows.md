---
type: "query"
date: "2026-09-06T18:38:23.824841+00:00"
question: "Will this fix the actual functionality that allows us to create new subdomains correctly in future?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["User-Owned Hosting", "HostingProvider", "DomainsView"]
---

# Q: Will this fix the actual functionality that allows us to create new subdomains correctly in future?

## Answer

Expanded from original query via graph vocabulary: [hosting, domain, route, create, cpanel]. The general creation path now preflights the selected parent DNS zone, detects exact A/AAAA/CNAME conflicts that are not real cPanel websites, requires explicit confirmation, removes only those exact line-indexed records using the current zone serial, verifies removal, creates and verifies the cPanel subdomain, then saves it and refreshes all SpyderWeb views. The focused DNS parser test, launch safeguards, lint, production build, source push, version save, and production deployment all passed. The signed-in live click-through was not executed because the local UI-control helper failed to start.

## Outcome

- Signal: useful

## Source Nodes

- User-Owned Hosting
- HostingProvider
- DomainsView