---
type: "query"
date: "2026-09-07T05:05:05.845488+00:00"
question: "When you install wordpress what wordpress credentials are you using?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Safe Simulated WordPress and Template Actions", "Three-Step Launch Build Flow"]
---

# Q: When you install wordpress what wordpress credentials are you using?

## Answer

Expanded from original query via vocab: [wordpress, install, admin, credentials, cpanel, softaculous, template, password]. Fresh WordPress installs use WordPress username admin and password admin, with the signed-in owner email as the admin email (or admin@primary-domain fallback). Softaculous itself authenticates using the connected cPanel account username and stored cPanel password; the API token is used for cPanel domain and PHP operations, not Softaculous writes. Template clones inherit WordPress users and passwords from the selected template instead of creating admin/admin.

## Outcome

- Signal: useful

## Source Nodes

- Safe Simulated WordPress and Template Actions
- Three-Step Launch Build Flow