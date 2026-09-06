---
type: "query"
date: "2026-09-06T16:56:56.059127+00:00"
question: "Why must WordPress Management be activated separately, and activate it for the newly connected cPanel domain."
contributor: "graphify"
outcome: "useful"
source_nodes: ["Operational Source of Truth", "Three-Step Launch Build Flow", "Domain"]
---

# Q: Why must WordPress Management be activated separately, and activate it for the newly connected cPanel domain.

## Answer

Expanded from graph vocabulary: cpanel connection wordpress management operational credentials softaculous activation. The API token handles cPanel inventory and PHP, while this host requires the normal cPanel password for Softaculous. The user-facing separation was unnecessary. SpyderWeb now collects both credentials in the initial connection form, verifies Softaculous, stores both encrypted, imports domains and WordPress installations, and activates management in one submission. Existing legacy connections still require the previously unstored password once; New Project now displays those accounts and offers Activate here without navigating to Settings. No template is required merely to activate management; a template is auto-detected when available or can be selected later. Version 46 deployed successfully.

## Outcome

- Signal: useful

## Source Nodes

- Operational Source of Truth
- Three-Step Launch Build Flow
- Domain