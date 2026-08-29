---
type: "query"
date: "2026-08-29T19:33:34.030685+00:00"
question: "Why did the dashboard suddenly flash and rescan, and how should domain controls, project reporting, soft locks, and developer assignment work in the dashboard?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["domains", "DomainStatus", "Dashboard", "Developer", "Domain", "Project"]
---

# Q: Why did the dashboard suddenly flash and rescan, and how should domain controls, project reporting, soft locks, and developer assignment work in the dashboard?

## Answer

Expanded from original query via graph vocabulary: [actions, assignment, dashboar, developer, domain, domains, hosting, inventory, kanban, project, status, user]. The visible flash came from a full cPanel and WordPress sync effect that ran when connections loaded and every five minutes, after the first inventory render. The correction removes automatic full scans from page load and keeps only silent inventory polling; manual scans remain in Settings. All dashboard domain cards now open one centered WordPress-control modal. Template sites show readiness and assignment, Busy Working and Final Stages show a compact live-domain project report, detailed workflow remains in Projects, soft lock and assignment are persisted in D1 and audited, and dashboard counts derive from live domains instead of dummy project rows.

## Outcome

- Signal: useful

## Source Nodes

- domains
- DomainStatus
- Dashboard
- Developer
- Domain
- Project