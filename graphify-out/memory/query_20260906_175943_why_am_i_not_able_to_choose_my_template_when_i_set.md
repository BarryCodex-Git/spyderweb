---
type: "query"
date: "2026-09-06T17:59:43.342210+00:00"
question: "Why am I not able to choose my template when I set up a new subdomain for a new project?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Three-Step Launch Build Flow"]
---

# Q: Why am I not able to choose my template when I set up a new subdomain for a new project?

## Answer

Expanded from graph vocabulary: Three-Step Launch Build Flow, cPanel connection, compatible template. Live configuration confirms all three configured templates are hosted under My New Websites, while the selected destination account is Test Website Build. LaunchProjectView filters templates by the selected connection, and the launch API rejects a template whose connection differs from the destination. Both cPanel accounts have WordPress Management verified, so this is an account-local Softaculous clone limitation, not an activation or permissions failure. Supporting this requires a cross-cPanel template transfer or a synchronized local template mirror on each cPanel.

## Outcome

- Signal: useful

## Source Nodes

- Three-Step Launch Build Flow