---
type: "query"
date: "2026-09-06T16:50:16.352338+00:00"
question: "Why are hardly any existing development domains available in New Project launch?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "Project", "Three-Step Launch Build Flow", "Operational Source of Truth"]
---

# Q: Why are hardly any existing development domains available in New Project launch?

## Answer

Expanded from graph vocabulary: launch project existing domain available operational connection template. The New Project screen filters to cPanel connections with managed_write mode and verified operational WordPress credentials, then to subdomains on the selected cPanel that are Available or Needs Inspection and are not template sources. My New Websites is verified but only dev9.mynewwebsite.co.za qualifies. Test Website Build has dev1, dev2 and dev3 available, but its operational credential status is not_configured, so the whole connection is excluded from the selector. This is hidden eligibility filtering, not missing domain inventory.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- Project
- Three-Step Launch Build Flow
- Operational Source of Truth