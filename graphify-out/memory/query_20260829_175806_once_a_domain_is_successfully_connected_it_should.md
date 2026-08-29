---
type: "query"
date: "2026-08-29T17:58:06.128828+00:00"
question: "Once a domain is successfully connected it should automatically move on to the dashboard."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Home()", "Dashboard()", "SettingsView()"]
---

# Q: Once a domain is successfully connected it should automatically move on to the dashboard.

## Answer

Expanded the request through the project map using [dashboard, domain, domains, hosting, settings, view, home]. The connection flow in Home() now closes the hosting modal and switches the active View to Dashboard only when scanStatus is complete, while retaining the success notification and leaving incomplete scans open.

## Outcome

- Signal: useful

## Source Nodes

- Home()
- Dashboard()
- SettingsView()