---
type: "query"
date: "2026-08-30T05:26:59.031708+00:00"
question: "Which components render domain and project popup modals, and where should shared Open Website and WP Admin actions be added?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Dashboard()", "Domain", "Project", "page.tsx"]
---

# Q: Which components render domain and project popup modals, and where should shared Open Website and WP Admin actions be added?

## Answer

Expanded from original query via vocab: [domain, project, dashboard, view, open, website, control, actions, page, template]. Dashboard and Domains both open the selectedDomain modal in app/page.tsx; Projects opens the selectedProject modal in the same file. A shared SiteQuickLinks component should therefore be rendered in both modal headers so every relevant tab gets consistent Open Website and WP Admin actions.

## Outcome

- Signal: useful

## Source Nodes

- Dashboard()
- Domain
- Project
- page.tsx