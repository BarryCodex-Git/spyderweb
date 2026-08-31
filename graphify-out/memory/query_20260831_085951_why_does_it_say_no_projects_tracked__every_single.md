---
type: "query"
date: "2026-08-31T08:59:51.369353+00:00"
question: "Why does it say no projects tracked? Every single domain needs to be a project, with manual stage selection and Busy Working to Final Stages drag."
contributor: "graphify"
outcome: "useful"
source_nodes: ["projects", "Dashboard()", "Domain", "Project"]
---

# Q: Why does it say no projects tracked? Every single domain needs to be a project, with manual stage selection and Busy Working to Final Stages drag.

## Answer

Expanded from original query via graph vocabulary: [domain, project, projects, stage, stages, dashboard, status, columns, card, manual, flow, records]. The hosting inventory and project pipeline were separate, so cPanel domains did not create project rows. The implementation now auto-creates one stable project record per active hosting domain on the signed-in project read, updates dashboard workflow status directly from the project stage, adds clickable manual red/orange/green stage controls in the project popup, and permits only Busy Working cards to be dragged into Final Stages. The live private Site was built, linted, and published as version 38. Final signed-in data-count verification could not run because every available in-app Site tab was at the Sign in required gate.

## Outcome

- Signal: useful

## Source Nodes

- projects
- Dashboard()
- Domain
- Project