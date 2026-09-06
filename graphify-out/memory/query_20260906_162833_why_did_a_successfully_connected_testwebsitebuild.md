---
type: "query"
date: "2026-09-06T16:28:33.124043+00:00"
question: "Why did a successfully connected testwebsitebuild.com cPanel not appear to import its blank subdomains?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "Development-Domain Inventory"]
---

# Q: Why did a successfully connected testwebsitebuild.com cPanel not appear to import its blank subdomains?

## Answer

Production evidence shows the scan did import four domains: testwebsitebuild.com plus dev1, dev2, and dev3.testwebsitebuild.com. The cPanel legacy subdomain inventory returned four records and all four were saved as active hosting domains and project records. Blank domains are intentionally classified as Available / Not installed. WordPress Management activation is unrelated to domain discovery. If the UI did not show them, the discrepancy is frontend visibility/refresh or the user expected additional subdomains that cPanel did not return at scan time.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- Development-Domain Inventory
