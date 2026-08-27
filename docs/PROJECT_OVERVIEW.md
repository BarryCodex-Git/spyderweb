# SpyderWeb Project Overview

## Purpose

SpyderWeb is a hosted graphical control center for managing the production of client websites. It coordinates domains, project intake, assignments, milestones, reviews, and reporting. The actual website-building work is performed by Barry or Clive inside Codex.

## Responsibility boundaries

### SpyderWeb

- Maintain the development-domain inventory and operational status.
- Prepare authorised WordPress installations and load the approved template when supported by hosting APIs.
- Capture client intake information and uploaded assets.
- Create project records and allocate work to Barry or Clive.
- Track build stages, approvals, blockers, notes, and activity.
- Expose a secure HTTPS interface through which Codex can retrieve assignments and report progress.

### Barry

- Work locally in the Barry project under Barry's own instructions and procedures.
- Build approved template-based WordPress websites.
- Create the correct client folder and run the required preflight process.
- Report build progress and review requests to SpyderWeb.

### Clive

- Work locally in the Clive project under Clive's own instructions and procedures.
- Build custom websites and custom functionality.
- Create the correct client folder and run the required preflight process.
- Report build progress and review requests to SpyderWeb.

## Initial project flow

1. Select an available development domain.
2. Choose Barry or Clive as the developer.
3. Complete the client intake and upload assets.
4. Create the project in SpyderWeb and mark it Assigned to Developer.
5. Open the appropriate Codex project.
6. The assigned agent retrieves the project, creates its local client folder, and runs preflight.
7. The agent performs the website work in Codex and reports progress to SpyderWeb.
8. SpyderWeb presents review and approval stages to the user.
9. Approved work proceeds through launch preparation, migration, retention, and eventual development-site cleanup.

## Candidate build stages

- Setup
- Build Home Page
- Review Home Page
- Set Up Service Page Template
- Build First Service Page
- Build All Service Pages
- Build Service Page Hub
- Create Location Pages and Location Hub (optional)
- Review Full Build
- Launch Preparation
- Migrated to Live Site
- Live Retention Period
- Ready to Delete

The pipeline is configurable. Agents may update ordinary progress automatically, while homepage approval, full-build approval, migration, and deletion require human action.

## Deployment direction

The first version may be deployed as a managed hosted application for live testing. The source remains versioned in GitHub and the application will include portable exports so it can later migrate to user-owned hosting.

Barry and Clive remain local. The hosted platform communicates with Codex; it does not host or run the website-building agents.

