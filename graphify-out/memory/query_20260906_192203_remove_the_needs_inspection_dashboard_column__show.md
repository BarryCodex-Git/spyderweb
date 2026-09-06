---
type: "query"
date: "2026-09-06T19:22:03.323882+00:00"
question: "Remove the Needs Inspection dashboard column, show affected domains at the bottom of Available with a red Needs Inspection bubble beside the stage bubble, and use four columns."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Dashboard()", "DomainCard()", "columns", "DomainStatus"]
---

# Q: Remove the Needs Inspection dashboard column, show affected domains at the bottom of Available with a red Needs Inspection bubble beside the stage bubble, and use four columns.

## Answer

Expanded from graph vocabulary: [dashboard, domain, status, available, inspection, columns]. The dashboard now renders four columns: Available, Template Loaded, Busy Working, and Final Stages. Needs Inspection remains the underlying safety status so affected domains are not accidentally selectable for launch, but the dashboard groups them under Available, sorts them after healthy available domains, and adds a red Needs Inspection badge beside the purple project-stage badge. The responsive board uses four desktop columns, two tablet columns, and one mobile column without horizontal board scrolling. TypeScript, focused lint, diff validation, production build, source push, and Sites version 53 deployment succeeded.

## Outcome

- Signal: useful

## Source Nodes

- Dashboard()
- DomainCard()
- columns
- DomainStatus