---
type: "query"
date: "2026-08-29T19:06:30.822500+00:00"
question: "Is there confusion in the allocation after the WordPress scan, with Needs Inspection before Available and template sites under Template Loaded?"
contributor: "graphify"
outcome: "corrected"
correction: "Treat cPanel domain presence and public WordPress inspection as separate facts. Use bounded concurrency for the public checks, classify confirmed no-WordPress domains as Available, unreachable domains as Needs Inspection, installed template-named sites as Template Loaded, and other installed sites as Busy Working."
source_nodes: ["domains", "DomainStatus", "columns", "Domain"]
---

# Q: Is there confusion in the allocation after the WordPress scan, with Needs Inspection before Available and template sites under Template Loaded?

## Answer

Expanded from original query via graph vocabulary: [columns, domain, domains, hosting, inventory, kanban, sites, status, template]. Live D1 showed only two installed rows because public domain checks were launched all at once and the shared host throttled them. The correction limits scan concurrency, follows redirects, marks reachable non-WordPress domains Available, leaves unreachable domains in Needs Inspection, places Needs Inspection before Available, and classifies an installed site as Template Loaded when either its domain or WordPress site name contains template. Other installed sites are Busy Working.

## Outcome

- Signal: corrected
- Correction: Treat cPanel domain presence and public WordPress inspection as separate facts. Use bounded concurrency for the public checks, classify confirmed no-WordPress domains as Available, unreachable domains as Needs Inspection, installed template-named sites as Template Loaded, and other installed sites as Busy Working.

## Source Nodes

- domains
- DomainStatus
- columns
- Domain