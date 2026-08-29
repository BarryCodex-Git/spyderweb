---
type: "query"
date: "2026-08-29T18:19:45.737637+00:00"
question: "Scan the WordPress installations and allocate the correct data to each domain based on the WP install. Template names should become Template Loaded, client names should become Busy Working, and Available can be set manually."
contributor: "graphify"
outcome: "useful"
source_nodes: ["domains", "DomainStatus", "Domain", "HostingProvider", "Dashboard()", "SettingsView()"]
---

# Q: Scan the WordPress installations and allocate the correct data to each domain based on the WP install. Template names should become Template Loaded, client names should become Busy Working, and Available can be set manually.

## Answer

Expanded from the project graph via [domain, domains, hosting, inventory, status, template, website, dashboard, settings, server, management]. The cPanel synchronisation now combines supported WordPress inventory calls, Softaculous when token-authenticated, cPanel document-root inspection, and public WordPress site metadata. It stores installation/version/site-name data per hosting domain, classifies template-like titles as Template Loaded and other installed sites as Busy Working, keeps project reporting separate, and provides an audited SpyderWeb-only manual Available override.

## Outcome

- Signal: useful

## Source Nodes

- domains
- DomainStatus
- Domain
- HostingProvider
- Dashboard()
- SettingsView()