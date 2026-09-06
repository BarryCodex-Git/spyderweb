---
type: "query"
date: "2026-09-06T19:38:21.186434+00:00"
question: "what is the criteria for a domain that says needs inspection and why is there scan pending what is the criteria for that?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "DomainStatus", "DomainCard()"]
---

# Q: what is the criteria for a domain that says needs inspection and why is there scan pending what is the criteria for that?

## Answer

Expanded from original query via graph vocab: [domain, wordpress, status, inspection, scan]. Needs Inspection is true when the domain has an explicit Needs Inspection workflow override, its WordPress status is neither installed nor not_installed, or its PHP profile status contains failed, error, attention, or pending. Scan pending is displayed when wordpress_status is not_checked. A scan becomes conclusive when WordPress is found, or when Softaculous inventory, readable WordPress files, or a reachable public check conclusively confirms no installation. If none of those checks can decide, the status remains not_checked. Newly created subdomains begin as not_checked, so DEV4 can show Setup, Needs Inspection, and Scan pending together. The wording Scan pending is misleading because it denotes an inconclusive stored result, not necessarily an actively running scan.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- DomainStatus
- DomainCard()