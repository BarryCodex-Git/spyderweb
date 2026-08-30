---
type: "query"
date: "2026-08-30T05:15:31.481866+00:00"
question: "Simplify SpyderWeb WordPress protections: remove authenticator requirements, use temporary admin/admin credentials for fresh installs, let the soft lock block deletion and template overwrite, use simple confirmations, and move domains through Available, Template Loaded, and Busy Working at the correct moments."
contributor: "graphify"
outcome: "corrected"
correction: "The prior authenticator, exact-domain, and mandatory recent-backup gates were too cautious for this owner-managed workflow. Use a soft lock plus explicit delete/overwrite confirmations, and make status changes reflect the actual website lifecycle."
source_nodes: ["Dashboard()", "Domain", "Human Approval for Consequential Actions", "SettingsView()", "DomainStatus"]
---

# Q: Simplify SpyderWeb WordPress protections: remove authenticator requirements, use temporary admin/admin credentials for fresh installs, let the soft lock block deletion and template overwrite, use simple confirmations, and move domains through Available, Template Loaded, and Busy Working at the correct moments.

## Answer

Expanded from original query via graph vocab: [domain, status, available, template, build, agent, operational, actions, approval, dashboard, settings, word]. The operational flow now uses the domain soft lock as the primary destructive guard. Fresh WordPress installs run directly with temporary admin/admin credentials and immediately receive Available status. Loading a template onto an empty domain runs directly and immediately receives Template Loaded status; loading it over an existing installation requires a clear overwrite warning and an unlocked domain. Deletion requires an unlocked domain and a single Are you sure confirmation. Developer assignment no longer marks a build busy; the shared build-start action moves it to Busy Working when the home-page build begins.

## Outcome

- Signal: corrected
- Correction: The prior authenticator, exact-domain, and mandatory recent-backup gates were too cautious for this owner-managed workflow. Use a soft lock plus explicit delete/overwrite confirmations, and make status changes reflect the actual website lifecycle.

## Source Nodes

- Dashboard()
- Domain
- Human Approval for Consequential Actions
- SettingsView()
- DomainStatus