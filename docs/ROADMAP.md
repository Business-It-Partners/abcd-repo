# Dental OS Browser Edition — Roadmap

**Baseline:** 2026-10-27. This roadmap belongs to the browser edition in this worktree. It defines browser scope and execution; it does not copy or extend the Electron milestone plan.

## Authority and progress

- This document defines browser milestone order and exit gates.
- [Architecture baseline](ARCHITECTURE.md) records browser-specific decisions and open choices.
- [Status](STATUS.md) records current implementation and evidence.
- [Work checklist](WORK_CHECKLIST.md) records active tasks and their completion.
- Source is implementation reality; retained checks and evidence support verification. A planned capability is not an implemented claim.
- Work proceeds through one active browser milestone at a time. Close its exit gate before starting dependent work.

## Browser product contract

- The browser edition is a separate web codebase with browser-owned shell, app loading, identity integration, and security boundaries. It must not depend on Electron preload APIs, `window.desktop`, native broker IPC, or desktop-only build steps.
- Preserve the familiar Dental OS experience and role-based access. Use a static browser dock; Genie motion is out of scope. Show battery status only when the browser exposes a live reading, and omit it when unsupported.
- V1 targets Brave only. Defer other browser and mobile compatibility until all V1 milestones are complete.
- Use the existing Dental SaaS **staging** identity and business APIs. Firebase Auth establishes identity; the existing Cloudflare Worker remains the business API authority and enforces tenant and role access.
- Keep first-party company apps only. Apps need an explicit browser runtime and isolation policy, a single signed-in session, and safe update behavior.
- Keep business data on the existing backend. Do not add a local authoritative business database or hidden offline write queue.
- This edition has no Play Store, app installer, arbitrary sideloading, third-party publishing, or public extension platform.
- Browser work and documentation do not authorize production configuration, deployment, or data changes. Production readiness is a separate milestone and requires explicit approval.

## Recorded baseline decisions

B0 records the browser support policy, dedicated staging-hosting plan, single Firebase session with the existing Worker as authority, sandboxed first-party app runtime with host-mediated API access, synthetic-only staging writes, and browser-specific acceptance evidence in [Architecture baseline](ARCHITECTURE.md). Later milestones implement and verify these decisions before staging release; they do not imply that those capabilities already exist.

## Milestones

| ID | Milestone | Depends on | Exit gate |
| --- | --- | --- | --- |
| B0 | Browser product and architecture baseline | None | Browser-specific product scope, architecture baseline, staging boundary, and acceptance strategy are recorded. |
| B1 | Browser foundation and shell | B0 | An independently runnable web shell has the agreed visual foundation, routes, static dock, and responsive behavior, with no Electron runtime dependency. |
| B2 | Staging identity and role access | B1 | Firebase sign-in and session lifecycle work against staging; the Worker validates requests; clinic and role access are enforced; sign-out and denied access behave correctly. |
| B3 | First-party app catalog and isolated runtime | B2 | Trusted first-party apps are listed by role, launch in the approved browser isolation boundary, and follow the agreed update and failure behavior. |
| B4 | First end-to-end clinic app | B3 | One selected app completes an agreed real staging workflow through existing APIs, with authorized staging data, role enforcement, and clear failure handling. |
| B5 | App migration and experience parity | B4 | Prioritized apps work in the browser, and shell/app layouts match the agreed Dental OS experience within browser constraints and the listed exclusions. |
| B6 | Browser staging readiness | B5 | Brave V1 checks, security and recovery checks, staging hosting, and the browser acceptance checklist pass; no production resources are changed. |
| B7 | Production readiness and release decision | B6 | Production configuration, privacy/security review, operations, and release approval are completed under separate explicit authorization. |

## Milestone evidence

For each milestone, record the source revision, completed scope, relevant verification results, unresolved limitations, and acceptance state in [Status](STATUS.md). Do not claim a milestone is verified from planning documents, screenshots, or a successful local page load alone. Browser-specific implementation and acceptance must remain independent of the Electron test and release gates.
