---
type: "query"
date: "2026-08-30T18:53:31.547243+00:00"
question: "Expalin the exact path taken for all of these 5 buttons please"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Safe Simulated WordPress and Template Actions", "Domain", "Human Approval for Consequential Actions"]
---

# Q: Expalin the exact path taken for all of these 5 buttons please

## Answer

Expanded via graph vocabulary: [actions, domain, template, press, management, approval, safe, operational]. The five controls all POST one authenticated domain action. Replace with clean WordPress removes the existing Softaculous installation including files, database, database user and data directory, verifies removal, installs WordPress at the domain root with a fresh generated database, then marks it Available. Overwrite with default template performs the same removal and verification, then clones the configured template installation directly to the empty destination using a fresh database; it does not install blank WordPress first, and marks the result Template Loaded. Optional backup asks Softaculous to back up files, data directory and database. Delete removes the Softaculous installation and marks the domain Available after verification. PHP limits uses cPanel UAPI to apply 512M memory/post/upload, 300-second execution/input times and 5000 input variables without changing PHP version.

## Outcome

- Signal: useful

## Source Nodes

- Safe Simulated WordPress and Template Actions
- Domain
- Human Approval for Consequential Actions