---
type: "query"
date: "2026-08-29T14:42:41.108172+00:00"
question: "Check logs for cPanel connection errors and fix the failing cPanel connection."
contributor: "graphify"
outcome: "useful"
source_nodes: ["SettingsView()", "domains", "@openai/sites-vite-plugin"]
---

# Q: Check logs for cPanel connection errors and fix the failing cPanel connection.

## Answer

Expanded from the original request via graph vocabulary: hosting, server, settings, domain, domains, provider, sites, actions, website. The graph identified SettingsView, domains, and Sites hosting integration as the affected area. Live worker logs showed two POST /api/hosting/cpanel requests returning HTTP 400 in 4 ms. Direct source inspection found lib/cpanel.ts used fetch redirect:error, which the Cloudflare edge runtime rejects. The correction changes it to redirect:manual and explicitly rejects 3xx responses with a direct cPanel URL message.

## Outcome

- Signal: useful

## Source Nodes

- SettingsView()
- domains
- @openai/sites-vite-plugin