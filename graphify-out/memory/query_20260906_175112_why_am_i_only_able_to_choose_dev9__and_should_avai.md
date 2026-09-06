---
type: "query"
date: "2026-09-06T17:51:12.754592+00:00"
question: "Why am I only able to choose DEV9, and should Available or Template Loaded domains be usable for a new project?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "DomainStatus", "Three-Step Launch Build Flow"]
---

# Q: Why am I only able to choose DEV9, and should Available or Template Loaded domains be usable for a new project?

## Answer

Expanded from original query via graph vocab: Domain, DomainStatus, Three-Step Launch Build Flow. The New Project selector must use the same workflow status as the Dashboard across all connected cPanel accounts. Available domains and Template Loaded project destinations are eligible; registered master-template source domains are excluded. When a Template Loaded destination is selected, SpyderWeb shows the detected WordPress site/template name and asks whether to keep it unchanged or replace it. Keeping it creates and assigns the project without deleting or cloning WordPress; replacing it retains the destructive-action confirmation and clone workflow.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- DomainStatus
- Three-Step Launch Build Flow