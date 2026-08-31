---
type: "query"
date: "2026-08-31T07:39:14.723350+00:00"
question: "the check and fix php button is not working, i tried it on DEV5. Please, dont tell me we need another verification, again :("
contributor: "graphify"
outcome: "corrected"
correction: "Route PHP maintenance through the cPanel JSON UAPI gateway already proven by domain discovery; remove the redundant session login, require read-back verification, and persist the verified profile in the UI."
source_nodes: ["Domain", "SettingsView()", "Operational Source of Truth"]
---

# Q: the check and fix php button is not working, i tried it on DEV5. Please, dont tell me we need another verification, again :(

## Answer

The live cPanel host redirects direct /execute UAPI calls and rejects repeated HTTP Basic/session preflight logins, even though the saved API connection is valid. Use the shared-host /json-api/cpanel gateway with cpanel_jsonapi_apiversion=3 for LangPHP and Fileman, verify all six saved values, persist php_profile_status=recommended_applied, and refresh the selected domain so the overview shows 768 MB · Optimized. Do not create a new cPanel session before every PHP check.

## Outcome

- Signal: corrected
- Correction: Route PHP maintenance through the cPanel JSON UAPI gateway already proven by domain discovery; remove the redundant session login, require read-back verification, and persist the verified profile in the UI.

## Source Nodes

- Domain
- SettingsView()
- Operational Source of Truth