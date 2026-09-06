---
type: "query"
date: "2026-09-06T18:54:12.355999+00:00"
question: "Was SpyderWeb creating the subdomain and then returning an error, and how should document-root uniformity be maintained?"
contributor: "graphify"
outcome: "corrected"
correction: "The earlier DNS-conflict diagnosis was wrong. The real defect was success-status parsing combined with an unsafe second compatibility write; the correct fix is single-write creation plus inventory reconciliation and a uniform full-hostname document root."
source_nodes: ["Domain", "HostingProvider", "DomainsView"]
---

# Q: Was SpyderWeb creating the subdomain and then returning an error, and how should document-root uniformity be maintained?

## Answer

Expanded from original query via graph vocabulary: [cpanel, subdomain, domain, create, hosting]. Yes. The cPanel host can serialize success status as string 1, while SpyderWeb previously accepted only numeric 1. It therefore treated a successful first write as failure and issued a second compatibility create, which correctly reported that DNS already existed. The creator now accepts numeric, string, or boolean success, issues exactly one UAPI SubDomain/addsubdomain write, reconciles the result against authoritative cPanel inventory, and uses the uniform account-home document root full-hostname (for example /dev4.testwebsitebuild.com). Version 51 deployed successfully; DEV4 and DEV5 remain for the user to create manually as the clean live test.

## Outcome

- Signal: corrected
- Correction: The earlier DNS-conflict diagnosis was wrong. The real defect was success-status parsing combined with an unsafe second compatibility write; the correct fix is single-write creation plus inventory reconciliation and a uniform full-hostname document root.

## Source Nodes

- Domain
- HostingProvider
- DomainsView