---
type: "query"
date: "2026-09-06T18:09:57.934711+00:00"
question: "Why did PHP settings fail on the new testwebsitebuild.com domain?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "SettingsView"]
---

# Q: Why did PHP settings fail on the new testwebsitebuild.com domain?

## Answer

Expanded from graph vocabulary: Domain, SettingsView, PHP profile, public_html. The failure occurred before cPanel was called because the WordPress action route and memory helper permanently rejected main domains and public_html. That rule came from an earlier subdomain-only maintenance scope and was not appropriate for an explicitly selected primary domain. The guard was removed. The PHP action now targets the selected vhost; if WordPress is absent it verifies cPanel PHP limits and reports that wp-config.php was skipped, while installed WordPress still receives WP_MEMORY_LIMIT and WP_MAX_MEMORY_LIMIT updates.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- SettingsView