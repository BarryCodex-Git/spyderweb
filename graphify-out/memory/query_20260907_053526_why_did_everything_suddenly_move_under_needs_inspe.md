---
type: "query"
date: "2026-09-07T05:35:26.696363+00:00"
question: "Why did everything suddenly move under Needs Inspection and why did the dashboard blocks auto reshuffle after the PHP update?"
contributor: "graphify"
outcome: "corrected"
correction: "Maintenance diagnostics must never override manual project stages or trigger bulk cPanel writes. PHP repair is explicit per domain or part of a newly requested install; inspection is only a badge and Available-column sort detail."
source_nodes: ["Dashboard()", "Domain", "DomainCard()", "columns"]
---

# Q: Why did everything suddenly move under Needs Inspection and why did the dashboard blocks auto reshuffle after the PHP update?

## Answer

Expanded from original query via vocab: [dashboard, domain, domains, PHP, runtime, memory, status, columns, project, workflow]. Root cause: version 60 treated every installed site with an unknown stored PHP version as php_runtime_pending, the client automatically executed maintenance for all candidates, failed attempts set php_profile_status=failed, needsInspection consumed that flag, and projectAwareDomains incorrectly replaced the manual project workflow status with Needs Inspection. Correction: remove all automatic bulk PHP maintenance, undo only the rollout-created pending/failure statuses, preserve project workflow columns regardless of diagnostic badges, and keep Check and fix PHP settings as an explicit per-domain operation plus normal post-install processing.

## Outcome

- Signal: corrected
- Correction: Maintenance diagnostics must never override manual project stages or trigger bulk cPanel writes. PHP repair is explicit per domain or part of a newly requested install; inspection is only a badge and Available-column sort detail.

## Source Nodes

- Dashboard()
- Domain
- DomainCard()
- columns