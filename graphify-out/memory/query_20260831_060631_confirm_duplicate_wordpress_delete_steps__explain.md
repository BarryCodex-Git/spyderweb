---
type: "query"
date: "2026-08-31T06:06:31.599121+00:00"
question: "Confirm duplicate WordPress delete steps, explain optional backup storage, and assess requested PHP settings before changes."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Safe Simulated WordPress and Template Actions", "Domain", "Human Approval for Consequential Actions"]
---

# Q: Confirm duplicate WordPress delete steps, explain optional backup storage, and assess requested PHP settings before changes.

## Answer

Expanded via graph vocabulary: [actions, domain, template, press, management, check, safe, operational, config]. Current behavior: both Install New WordPress and Load Default Template call the same clean-destination routine. If Softaculous finds an existing installation, the domain must be unlocked and replacement confirmed; SpyderWeb removes the installation files, database, database user and data directory, verifies it is gone, and only then either installs clean WordPress or clones the default template directly. A standalone Delete button is only needed to leave a domain empty. Optional backup invokes a Softaculous full installation backup of files, data directory and database; SpyderWeb stores only the backup timestamp, while Softaculous stores the archive in the hosting account default backup destination. The PHP button currently writes fixed directives rather than first comparing them. Requested future profile: memory 769M, post/upload 512M, execution/input 900 seconds, input vars 5000. No code changes were made.

## Outcome

- Signal: useful

## Source Nodes

- Safe Simulated WordPress and Template Actions
- Domain
- Human Approval for Consequential Actions