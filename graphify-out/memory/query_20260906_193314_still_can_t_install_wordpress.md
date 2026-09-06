---
type: "query"
date: "2026-09-06T19:33:14.348205+00:00"
question: "Still can't install WordPress :("
contributor: "graphify"
outcome: "useful"
source_nodes: ["HostingProvider", "User-Owned Hosting", "Barry Template-Based WordPress Builds"]
---

# Q: Still can't install WordPress :(

## Answer

Expanded from original query via graph vocab: [wordpress, hosting, credential, install, cpanel]. The exact failure was a Softaculous management write being redirected to cPanel sign-in. Version 55 now performs a read-only Softaculous session bootstrap, forwards the returned session cookies into the install POST, retries once with the saved cPanel API token only after a definite authentication redirect, and never repeats an ambiguous install write. Three focused authentication/write-safety tests, the TypeScript check, lint, regression tests, and the production build passed, and version 55 deployed successfully. The protocol correction is live; an actual installation was intentionally not triggered because it creates WordPress on the user's server, so DEV4 still needs one user-initiated retry for end-to-end host confirmation. New audit diagnostics record phase, HTTP status, redirect path, and authentication mode if the host rejects it again.

## Outcome

- Signal: useful

## Source Nodes

- HostingProvider
- User-Owned Hosting
- Barry Template-Based WordPress Builds