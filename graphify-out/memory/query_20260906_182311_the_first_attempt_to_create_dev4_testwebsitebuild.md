---
type: "query"
date: "2026-09-06T18:23:11.844400+00:00"
question: "The first attempt to create dev4.testwebsitebuild.com failed saying its DNS entry already exists, even though there has never been a dev4 subdomain."
contributor: "graphify"
outcome: "useful"
source_nodes: ["User-Owned", "Hosting", "HostingProvider"]
---

# Q: The first attempt to create dev4.testwebsitebuild.com failed saying its DNS entry already exists, even though there has never been a dev4 subdomain.

## Answer

Expanded from graph vocabulary: createCpanelSubdomain, hosting audit, cPanel DNS. The production audit contains exactly one SpyderWeb creation attempt, so SpyderWeb did not create the conflict earlier. The shared inventory contains no dev4.testwebsitebuild.com domain, but a public DNS lookup returns a specific A record for dev4.testwebsitebuild.com pointing to 102.130.114.178; a random unused hostname under the same parent does not resolve, ruling out a wildcard. Therefore this is a DNS-only record without a cPanel web-domain/vhost entry. The raw cPanel message is technically correct at the DNS layer but misleading in the UI. Safe recovery requires explicit confirmation before removing only that DNS record and retrying subdomain creation.

## Outcome

- Signal: useful

## Source Nodes

- User-Owned
- Hosting
- HostingProvider