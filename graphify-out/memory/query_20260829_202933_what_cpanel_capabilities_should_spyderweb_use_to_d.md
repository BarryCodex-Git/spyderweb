---
type: "query"
date: "2026-08-29T20:29:33.362536+00:00"
question: "What cPanel capabilities should SpyderWeb use to delete or install WordPress, configure PHP, and clone the default template domain?"
contributor: "graphify"
outcome: "useful"
source_nodes: ["Safe Simulated WordPress and Template Actions", "Development-Domain Inventory", "Domain"]
---

# Q: What cPanel capabilities should SpyderWeb use to delete or install WordPress, configure PHP, and clone the default template domain?

## Answer

Expanded from original query via graph vocab: [actions, check, config, domain, hosting, integration, inventory, management, plugins, safe, template, website]. The current code provides domain and WordPress inventory plus simulated protected actions; it has no live delete, install, PHP-write, or clone endpoint. The clean target architecture is cPanel for domain and PHP controls, Softaculous for WordPress install, removal, clone and task progress, and server-side soft-lock, backup, confirmation, audit and post-flight checks around every write.

## Outcome

- Signal: useful

## Source Nodes

- Safe Simulated WordPress and Template Actions
- Development-Domain Inventory
- Domain