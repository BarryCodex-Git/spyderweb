---
type: "query"
date: "2026-08-31T08:22:42.984546+00:00"
question: "Move Projects below Dashboard and Domains above Settings, then design a non-interfering communication layer between SpyderWeb, Barry and Clive for project status reporting only."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Project Records and Developer Assignment", "AgentActivity()", "Project", "Configurable Build-Stage Pipeline", "Human Approval Gates"]
---

# Q: Move Projects below Dashboard and Domains above Settings, then design a non-interfering communication layer between SpyderWeb, Barry and Clive for project status reporting only.

## Answer

Expanded from original query via graph vocab: [agent, activity, reporting, project, status, stage, developer, dashboard, assignment, flow, isolated, records]. The existing Projects API, project_events audit trail, manual workflow controls, and developer assignment model are the correct source of truth. Reorder navigation to Dashboard, Projects, Agent Activity, Domains, Settings. Build a separate reporting-only bridge: agent-scoped write-only credentials submit structured checkpoint events to a new report endpoint; the server validates project assignment and allowed stage transitions, records every event, and updates ordinary progress. It must never send prompts, instructions, skills, SOP changes, or commands into Barry or Clive. Manual owner/developer updates remain available; human-only approval stages cannot be completed by agent reports. A local read-only observer may later translate completed Codex task summaries into the same endpoint without messaging the agents.

## Outcome

- Signal: useful

## Source Nodes

- Project Records and Developer Assignment
- AgentActivity()
- Project
- Configurable Build-Stage Pipeline
- Human Approval Gates