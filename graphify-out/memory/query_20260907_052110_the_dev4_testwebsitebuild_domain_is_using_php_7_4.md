---
type: "query"
date: "2026-09-07T05:21:10.233205+00:00"
question: "The Dev4 testwebsitebuild domain is using PHP 7.4; Check and fix PHP settings should also ensure a good recommended PHP version is loaded."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Development-Domain Inventory", "User-Owned Hosting"]
---

# Q: The Dev4 testwebsitebuild domain is using PHP 7.4; Check and fix PHP settings should also ensure a good recommended PHP version is loaded.

## Answer

Expanded from original query via vocab: [domain, domains, hosting, settings, version]. SpyderWeb now treats PHP runtime selection as part of the complete domain profile: it discovers installed cPanel runtimes and the system default, selects a supported PHP 8.3 or 8.4 target, applies it to the vhost, reads it back, then verifies PHP directives and WordPress memory. Existing WordPress domains with PHP 7.x or an unknown version are queued for automatic remediation. The graph supplied the domain inventory and hosting UI context; the missing runtime write path was confirmed and implemented from source and official cPanel API documentation.

## Outcome

- Signal: useful

## Source Nodes

- Development-Domain Inventory
- User-Owned Hosting