---
type: "query"
date: "2026-09-04T20:20:02.935635+00:00"
question: "Adjust SpyderWeb PHP memory settings so cPanel limits and WordPress wp-config.php limits are both handled safely."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Domain", "SettingsView()", "Operational Source of Truth"]
---

# Q: Adjust SpyderWeb PHP memory settings so cPanel limits and WordPress wp-config.php limits are both handled safely.

## Answer

The PHP maintenance action now verifies the cPanel profile and, for installed WordPress subdomains, raises WP_MEMORY_LIMIT to at least 512M and WP_MAX_MEMORY_LIMIT to at least 768M without lowering higher values. It creates and verifies a dated wp-config.php rollback copy before changes, verifies the saved file, automatically restores on failed verification, excludes the main public_html installation, and updates the modal overview only after both layers verify.

## Outcome

- Signal: useful

## Source Nodes

- Domain
- SettingsView()
- Operational Source of Truth