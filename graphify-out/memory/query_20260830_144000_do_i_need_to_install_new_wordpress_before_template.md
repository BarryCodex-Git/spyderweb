---
type: "query"
date: "2026-08-30T14:40:00.145305+00:00"
question: "Do I need to install new WordPress before template migration, and must both Load Template and Install Clean WordPress delete and verify any existing installation first?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "HostingProvider", "Human Approval for Consequential Actions", "Operational Source of Truth"]
---

# Q: Do I need to install new WordPress before template migration, and must both Load Template and Install Clean WordPress delete and verify any existing installation first?

## Answer

Expanded from original query via graph vocab: [actions, approval, domain, domains, hosting, operational, template]. Both Install clean WordPress and Load default template use a strict clean-slate workflow: re-check live Softaculous inventory; if an installation exists, require unlock and explicit replacement confirmation naming the detected site; remove files, data directory, database, and database user; verify absence; then install clean WordPress or clone the template directly. Template loading needs no intermediate blank WordPress installation.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- HostingProvider
- Human Approval for Consequential Actions
- Operational Source of Truth