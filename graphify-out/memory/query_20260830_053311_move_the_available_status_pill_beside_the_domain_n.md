---
type: "query"
date: "2026-08-30T05:33:11.293822+00:00"
question: "Move the Available status pill beside the domain name so the popup shortcut buttons align neatly."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "Dashboard()", "page.tsx"]
---

# Q: Move the Available status pill beside the domain name so the popup shortcut buttons align neatly.

## Answer

Expanded from original query via vocab: [domain, status, layout, control, page, dashboard, website]. The domain popup header is rendered in app/page.tsx. Place the status pill inside a flex title row beside the domain h2, leaving modal-header-tools to contain only the website shortcuts; adjust responsive alignment in app/globals.css.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- Dashboard()
- page.tsx