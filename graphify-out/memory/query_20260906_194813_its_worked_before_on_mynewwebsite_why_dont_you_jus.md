---
type: "query"
date: "2026-09-06T19:48:13.952415+00:00"
question: "Its worked before on mynewwebsite why dont you just duplicate that process?"
contributor: "graphify"
outcome: "corrected"
correction: "Use the proven My New Websites Softaculous sequence: direct saved cPanel username/password first, cpsess only after a definite authentication rejection, and never a cPanel API token for Softaculous writes."
source_nodes: ["HostingProvider", "User-Owned Hosting", "Barry Template-Based WordPress Builds"]
---

# Q: Its worked before on mynewwebsite why dont you just duplicate that process?

## Answer

Expanded from original query via graph vocab: [wordpress, cpanel, credential, authentication, install, hosting]. The prior session-bootstrap and API-token fallback was wrong for this host. The live database confirmed both cPanel connections store verified cpanel_basic operational credentials, while the failed DEV4 audit showed the erroneous cpanel_token fallback received HTTP 403. Version 56 restores the last known working My New Websites sequence: send the Softaculous action directly with the saved cPanel username/password, create a cpsess session only after a definite authentication rejection, never use an API token for a Softaculous write, keep softdirectory empty for root installation, and never repeat an ambiguous response. Four targeted tests, regressions, lint, TypeScript, full build, exact-source packaging, and production deployment passed. No further user retry was requested.

## Outcome

- Signal: corrected
- Correction: Use the proven My New Websites Softaculous sequence: direct saved cPanel username/password first, cpsess only after a definite authentication rejection, and never a cPanel API token for Softaculous writes.

## Source Nodes

- HostingProvider
- User-Owned Hosting
- Barry Template-Based WordPress Builds