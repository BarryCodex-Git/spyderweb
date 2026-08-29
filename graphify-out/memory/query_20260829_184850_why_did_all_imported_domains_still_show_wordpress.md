---
type: "query"
date: "2026-08-29T18:48:50.039968+00:00"
question: "Why did all imported domains still show WordPress scan pending after the document-root merge fix?"
contributor: "graphify"
outcome: "corrected"
correction: "The document-root merge bug was real but not decisive on this host because DomainInfo and Fileman are blocked. Public per-domain WordPress endpoint inspection is the working inventory source; the frontend must never classify not_checked as Available or flash demo data."
source_nodes: ["Dashboard()", "DomainStatus", "domains"]
---

# Q: Why did all imported domains still show WordPress scan pending after the document-root merge fix?

## Answer

Expanded from original query via vocab: [dashboard, domain, domains, hosting, inventory, sites, status, template, website]. Live D1 audit rows proved the cPanel host returned 12 domains only through the legacy API2 SubDomain scan, while DomainInfo, WebVhosts, Fileman, WordPressInstanceManager, cPAddons and Softaculous token access were unavailable. The brief sorted state was demoDomains before the real D1 rows loaded. Direct read-only probes of the imported domains' public wp-json endpoints successfully returned nine live WordPress names. Persist those public results, classify installed client sites and the template, keep unresolved domains in Needs Inspection, and remove demoDomains from the connected account's initial render.

## Outcome

- Signal: corrected
- Correction: The document-root merge bug was real but not decisive on this host because DomainInfo and Fileman are blocked. Public per-domain WordPress endpoint inspection is the working inventory source; the frontend must never classify not_checked as Available or flash demo data.

## Source Nodes

- Dashboard()
- DomainStatus
- domains