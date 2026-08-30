---
type: "query"
date: "2026-08-30T15:08:25.914783+00:00"
question: "Should a successfully connected cPanel account require a second WordPress management credential activation?"
contributor: "graphify"
outcome: "corrected"
correction: "Use the saved encrypted cPanel API token as the single operational credential. Do not require a second management username/password activation step."
source_nodes: ["HostingProvider", "SettingsView()", "Operational Source of Truth"]
---

# Q: Should a successfully connected cPanel account require a second WordPress management credential activation?

## Answer

Expanded from original query via graph vocabulary: [hosting, management, operational, provider, settings]. No. In SpyderWeb, connecting cPanel is the confirmation: the encrypted API token becomes operational immediately, existing connected accounts auto-upgrade on inventory load, and the Settings password activation form is removed. Per-domain soft locks and clear destructive confirmations remain. WordPress actions use the connected token and return an exact provider capability error if the host refuses Softaculous token access.

## Outcome

- Signal: corrected
- Correction: Use the saved encrypted cPanel API token as the single operational credential. Do not require a second management username/password activation step.

## Source Nodes

- HostingProvider
- SettingsView()
- Operational Source of Truth