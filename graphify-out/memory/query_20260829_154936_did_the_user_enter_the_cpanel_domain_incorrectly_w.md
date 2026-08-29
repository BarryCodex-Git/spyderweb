---
type: "query"
date: "2026-08-29T15:49:36.770928+00:00"
question: "Did the user enter the cPanel domain incorrectly when Variables/get_user_information failed?"
contributor: "graphify"
outcome: "corrected"
correction: "Do not require Variables/get_user_information as a universal cPanel authentication test. Distinguish HTTP authentication rejection from a host-disabled UAPI function, and use the domain inventory calls themselves."
source_nodes: ["SettingsView()", "domains"]
---

# Q: Did the user enter the cPanel domain incorrectly when Variables/get_user_information failed?

## Answer

Expanded from the original query via graph vocabulary: [domain, domains, hosting, inventory, server, settings]. No. The primary development-domain field is not used by Variables/get_user_information, and the response showed that SpyderWeb reached the cPanel UAPI. The connector's mandatory Variables endpoint was incompatible with this host. Authentication must instead be inferred from the actual inventory calls: HTTP 401/403 means rejected credentials, while a cPanel UAPI response with a function-level error still proves the authenticated endpoint was reached.

## Outcome

- Signal: corrected
- Correction: Do not require Variables/get_user_information as a universal cPanel authentication test. Distinguish HTTP authentication rejection from a host-disabled UAPI function, and use the domain inventory calls themselves.

## Source Nodes

- SettingsView()
- domains