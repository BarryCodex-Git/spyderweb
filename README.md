# SpyderWeb

SpyderWeb is the management and reporting platform for website projects assigned to Barry and Clive.

The hosted application manages development domains, client intake, asset uploads, project assignment, build stages, approvals, and progress reporting. Website production remains inside Codex: Barry handles approved template-based WordPress builds, while Clive handles custom builds.

## Current preview

The first clickable GUI is running and includes:

- A simple domain kanban board.
- A three-step **Launch Build** flow.
- Assignment to Barry for template builds or Clive for custom builds.
- Development-domain selection, client notes, and an asset-upload placeholder.
- A successful cPanel connection immediately activates domain inventory and PHP controls using the encrypted API token. Softaculous WordPress controls are activated once from the saved account in Settings with the cPanel account password, because this host does not accept cPanel API tokens for Softaculous. Activation performs only a read-only installation-list check before encrypting the password. Live WordPress installation, removal, backup and template cloning remain protected by per-domain soft locks and clear confirmations. Clean installation and template loading re-check the live inventory, fully remove and verify any existing Softaculous installation, generate a new unique database, and only then create the replacement.

The interface uses mid blue, dark blue, and dark purple accents with a custom SpyderWeb logo.

## Run locally

```text
pnpm install
pnpm run dev
```

Open `http://localhost:3000` in the Codex browser.

## Working principles

- SpyderWeb is the operational source of truth for projects and build status.
- Barry and Clive remain separate local Codex projects with separate instructions and responsibilities.
- Codex reads assigned work from SpyderWeb and reports progress back through a secure HTTPS integration.
- Human approval is required for consequential actions such as launch, migration, destructive resets, and deletion.
- The application will be designed for an initial managed deployment and later migration to infrastructure owned by the user.

See [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md) for the agreed product outline.
