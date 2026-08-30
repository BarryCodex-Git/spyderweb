---
type: "query"
date: "2026-08-30T14:12:00.899493+00:00"
question: "Has the live WordPress management backend been built, and why are the DEV5 controls still blocked by Read Only?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Safe Simulated WordPress and Template Actions", "Domain", "Human Approval for Consequential Actions", "HostingProvider"]
---

# Q: Has the live WordPress management backend been built, and why are the DEV5 controls still blocked by Read Only?

## Answer

Expanded from original query via graph vocabulary: [domain, hosting, operational, actions, template, management, safe, approval, provider, website]. The codebase already contained live WordPress action routes and a Softaculous client, but the UI required both managed_write mode and a separately verified operational credential, leaving DEV5 disabled. The production change makes cPanel inventory and PHP control available through the API token, makes Softaculous credential verification automatically activate operations, keeps pause/resume plus per-domain soft locks, corrects Softaculous install/clone/remove parameters, and rechecks live Softaculous inventory after actions.

## Outcome

- Signal: useful

## Source Nodes

- Safe Simulated WordPress and Template Actions
- Domain
- Human Approval for Consequential Actions
- HostingProvider