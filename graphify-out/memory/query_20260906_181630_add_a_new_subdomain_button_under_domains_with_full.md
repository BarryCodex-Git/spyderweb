---
type: "query"
date: "2026-09-06T18:16:30.420485+00:00"
question: "Add a New Subdomain button under Domains with full cPanel creation capability, and add the created domain across the whole app."
contributor: "graphify"
outcome: "useful"
source_nodes: ["DomainsView", "Development-Domain Inventory"]
---

# Q: Add a New Subdomain button under Domains with full cPanel creation capability, and add the created domain across the whole app.

## Answer

Expanded from graph vocabulary: DomainsView, Development-Domain Inventory, hosting_domains, project records. Added a Domains header action and modal that selects any connected cPanel account, one of its main or add-on parent domains, validates a subdomain label, previews the full hostname, creates it through cPanel, discovers it again for verification, and stores it as Available with a soft lock and audit event. After success the client reloads both hosting inventory and project data. Dashboard, Domains, New Project, Projects, and Agent Activity all consume those shared records, so the new domain appears in every relevant tab.

## Outcome

- Signal: useful

## Source Nodes

- DomainsView
- Development-Domain Inventory