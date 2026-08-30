---
type: "query"
date: "2026-08-30T17:21:17.181158+00:00"
question: "Ok but its exactly the same cPanel credentials as what you already have stored, you should be able to re-use it?"
contributor: "graphify"
outcome: "corrected"
correction: "The prior single-token operational assumption is invalid for this host. cPanel API token and cPanel account password are different secrets; only the token is currently stored, and Softaculous rejects it."
source_nodes: ["HostingProvider", "Operational Source of Truth", "SettingsView()"]
---

# Q: Ok but its exactly the same cPanel credentials as what you already have stored, you should be able to re-use it?

## Answer

Expanded from original query via graph vocabulary: [hosting, management, operational]. The live hosting connection stores the cPanel username and an encrypted API token, but it does not store the cPanel account password: encrypted_operational_secret is absent and operational_auth_type is cpanel_token. The username is reusable; the token is not interchangeable with the account password. This host accepts the token for cPanel UAPI but Softaculous requires separate supported authentication, so the password cannot be derived or reused from the token.

## Outcome

- Signal: corrected
- Correction: The prior single-token operational assumption is invalid for this host. cPanel API token and cPanel account password are different secrets; only the token is currently stored, and Softaculous rejects it.

## Source Nodes

- HostingProvider
- Operational Source of Truth
- SettingsView()