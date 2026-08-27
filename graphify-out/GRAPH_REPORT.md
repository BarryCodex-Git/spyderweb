# Graph Report - SpyderWeb  (2026-08-27)

## Corpus Check
- 10 files · ~45,274 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 164 nodes · 154 edges · 17 communities (12 shown, 5 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ccd070db`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App Dependencies
- Multi-View Dashboard
- TypeScript Compiler
- Product Operations
- Launch Workflow
- Project Scripts
- TypeScript Inputs
- Runtime Dependencies
- App Shell Metadata
- Build Approval
- SpyderWeb Branding
- Worker Types
- Favicon Assets
- Hosting Runtime
- Deployment Portability
- Lint Configuration
- Next Configuration

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 17 edges
2. `SpyderWeb Hosted Control Center` - 8 edges
3. `include` - 7 edges
4. `Home()` - 5 edges
5. `scripts` - 5 edges
6. `SpyderWeb` - 5 edges
7. `lib` - 4 edges
8. `Three-Step Launch Build Flow` - 4 edges
9. `PNPM Workspace Build Configuration` - 4 edges
10. `types` - 3 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Allowed Build Dependencies** — pnpm_workspace_esbuild, pnpm_workspace_sharp, pnpm_workspace_unrs_resolver, pnpm_workspace_workerd [EXTRACTED 1.00]
- **Portable Deployment Strategy** — docs_project_overview_spyderweb, docs_project_overview_github, docs_project_overview_portable_exports, docs_project_overview_user_owned_hosting [EXTRACTED 1.00]
- **SpyderWeb Build Assignment** — readme_launch_build_flow, readme_barry_template_builds, readme_clive_custom_builds [EXTRACTED 1.00]
- **Website Production Coordination** — docs_project_overview_spyderweb, docs_project_overview_barry, docs_project_overview_clive, docs_project_overview_codex [EXTRACTED 1.00]

## Communities (17 total, 5 thin omitted)

### Community 0 - "App Dependencies"
Cohesion: 0.06
Nodes (35): @cloudflare/vite-plugin, @cloudflare/workers-types, eslint, eslint-config-next, @openai/sites-vite-plugin, devDependencies, @cloudflare/vite-plugin, @cloudflare/workers-types (+27 more)

### Community 1 - "Multi-View Dashboard"
Cohesion: 0.10
Nodes (13): activities, buildStages, columns, Developer, Domain, domains, DomainStatus, HostingProvider (+5 more)

### Community 2 - "TypeScript Compiler"
Cohesion: 0.09
Nodes (22): @cloudflare/workers-types, dom, dom.iterable, esnext, node, compilerOptions, allowJs, esModuleInterop (+14 more)

### Community 3 - "Product Operations"
Cohesion: 0.17
Nodes (13): Barry, Client Intake and Uploaded Assets, Clive, Codex, Configurable Build-Stage Pipeline, Development-Domain Inventory, GitHub, Human Approval Gates (+5 more)

### Community 4 - "Launch Workflow"
Cohesion: 0.17
Nodes (13): Barry Template-Based WordPress Builds, Build Assignment Model, Clive Custom Builds, Development Domain Kanban Board, Human Approval for Consequential Actions, Three-Step Launch Build Flow, Managed Deployment Followed by User-Owned Infrastructure, Website Project Management and Reporting Platform (+5 more)

### Community 5 - "Project Scripts"
Cohesion: 0.17
Nodes (11): engines, node, name, private, scripts, build, dev, lint (+3 more)

### Community 6 - "TypeScript Inputs"
Cohesion: 0.20
Nodes (9): **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules, **/*.ts, **/*.tsx, exclude (+1 more)

### Community 7 - "Runtime Dependencies"
Cohesion: 0.29
Nodes (7): next, dependencies, next, react, react-dom, react, react-dom

### Community 8 - "App Shell Metadata"
Cohesion: 0.40
Nodes (3): geistMono, geistSans, metadata

### Community 9 - "Build Approval"
Cohesion: 0.40
Nodes (5): PNPM Workspace Build Configuration, esbuild, sharp, unrs-resolver, workerd

### Community 10 - "SpyderWeb Branding"
Cohesion: 0.50
Nodes (5): Blue-to-Purple Gradient, Graph Nodes and Edges Motif, SpyderWeb Logo, Network-Shaped Spider Web, Stylized Spider

### Community 12 - "Favicon Assets"
Cohesion: 0.67
Nodes (3): Blue Four-Tile Favicon, Multi-Tone Blue Palette, Rounded Square Tile Layout

## Knowledge Gaps
- **94 isolated node(s):** `geistSans`, `geistMono`, `metadata`, `View`, `Developer` (+89 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `App Dependencies` to `Project Scripts`?**
  _High betweenness centrality (0.090) - this node is a cross-community bridge._
- **Why does `compilerOptions` connect `TypeScript Compiler` to `TypeScript Inputs`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Runtime Dependencies` to `Project Scripts`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `geistSans`, `geistMono`, `metadata` to the rest of the system?**
  _94 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._
- **Should `Multi-View Dashboard` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `TypeScript Compiler` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._