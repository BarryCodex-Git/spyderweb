---
type: "query"
date: "2026-08-30T18:01:04.017459+00:00"
question: "where are you building this in during the connection phase or after? And why call it Update cPanel connection, why not activate WordPress Management? Go ahead and build it in please. I assume it will sit under settings? Please include instructions via popup like the initial connection, if we have to add more APIs or anything else."
contributor: "graphify"
outcome: "corrected"
correction: "cPanel API-token access and Softaculous WordPress-management access are distinct on this host; activation belongs after connection in Settings."
source_nodes: ["HostingProvider", "SettingsView()", "Operational Source of Truth", "Barry Template-Based WordPress Builds"]
---

# Q: where are you building this in during the connection phase or after? And why call it Update cPanel connection, why not activate WordPress Management? Go ahead and build it in please. I assume it will sit under settings? Please include instructions via popup like the initial connection, if we have to add more APIs or anything else.

## Answer

Built the flow after the initial cPanel connection under each saved account in Settings. The action is named Activate WordPress Management and opens a guided popup. The existing API token remains responsible for domain inventory and PHP controls; the popup explains that this host requires the normal cPanel account password for Softaculous, performs a harmless installation-list verification, encrypts the password only after success, selects the default template domain, and then enables install, delete, backup and template clone controls. No new API token or authenticator is required.

## Outcome

- Signal: corrected
- Correction: cPanel API-token access and Softaculous WordPress-management access are distinct on this host; activation belongs after connection in Settings.

## Source Nodes

- HostingProvider
- SettingsView()
- Operational Source of Truth
- Barry Template-Based WordPress Builds