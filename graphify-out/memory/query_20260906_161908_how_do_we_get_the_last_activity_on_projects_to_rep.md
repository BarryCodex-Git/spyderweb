---
type: "query"
date: "2026-09-06T16:19:08.430865+00:00"
question: "How do we get the last activity on projects to report accurately, maybe the last WordPress login? Get the activity monitor working."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Project", "page.tsx", "Domain"]
---

# Q: How do we get the last activity on projects to report accurately, maybe the last WordPress login? Get the activity monitor working.

## Answer

Expanded via graph vocab: [activity, project, domain, page]. WordPress core does not expose a reliable last-login timestamp. Implemented a five-minute throttled activity monitor that queries public WordPress content types and records the latest modified timestamp, including Elementor page saves. Project cards now distinguish WordPress changed from Project updated, show an exact timestamp tooltip, and include a manual Refresh activity control. Existing timestamps are preserved when REST is unavailable.

## Outcome

- Signal: useful

## Source Nodes

- Project
- page.tsx
- Domain