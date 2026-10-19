# Dental OS — Active Electron Product Direction

As approved on 2026-10-15, `/home/master-x/Desktop/fewa_business_os` is the canonical home for Electron OS. The active implementation is Electron + React + TypeScript: `electron/` provides the sandboxed native host and narrow preload IPC, while `src/` provides desktop windows, dock, overview, motion, and clinic app demonstrations.

The complete former Flutter/Rust project is archived in `refrence/`. Its pharmacy V1 architecture and sprint documents remain historical references, not active requirements for this Electron implementation. Use proven dock, window, and Genie ideas from that archive without treating Flutter/Rust as runtime dependencies.

Preserve the shared window lifecycle, app-scoped dialogs, single-session continuity, stable motion fallback, and softer readable visual design. App records are currently synthetic and memory-only. Do not imply production data persistence, finance integration, authentication, or backend services that have not been implemented.

The active work contract and prototype acceptance history remain in WORK_CHECKLIST.md. The production architecture and milestone records below govern new platform scope. See DEVELOPMENT.md and HOW_TO_RUN.md for current commands. No mobile support, deployment, or production migration is implied by this folder relocation.

## Dental OS production contract — 2026-10-15

The canonical product/architecture contract is [Dental OS V1](dental-os_v1-documentation/00_V1_README.md). The [master roadmap](dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md) defines execution order; [global status](dental-os_v1_working_info/00_V1_STATUS.md) records actual progress. [WORK_CHECKLIST.md](WORK_CHECKLIST.md) stays the active work contract and detailed prototype history; new entries name their production milestone and stay consistent with these authorities.

Dental OS is an Electron/React/TypeScript environment above Windows and Linux. It supports only company-controlled first-party apps for its entire lifetime: no third-party apps, external publishing, arbitrary sideloading or public plugin platform. Apps are independently delivered verified web packages; the existing Dental SaaS backend remains business authority. Cloudflare R2/catalogue delivery, mediated single login, SDK/API broker, isolated runtimes and safe app updates are target capabilities, not implemented claims.

Current source includes synthetic apps and a memory-only Store demo. Documentation creation does not implement production authentication, package management, distribution, API integration or cross-platform certification. The archived Flutter/Rust roadmap never becomes this product's contract.

## Backend execution boundary

Reuse existing `fewa_demo` Dental SaaS/Super Admin resources and GitHub deployment setup. All Dental OS backend work in the current roadmap is Cloudflare staging-only, with verified branch/environment/resource mapping and unchanged existing client behavior. New OS services use `/v1/dental-os/...`; existing business APIs keep their routes. See [the canonical resource/namespace policy](dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). Production promotion requires separate explicit authorization; documentation updates authorize no backend changes or deployment.

## Dedicated Git repository and Windows evidence

Dental OS uses https://github.com/Business-It-Partners/dental-os with main and started codex/milestone-NN branches. The prior Flutter remote/history remain preserved. During milestones, applicable Windows GitHub Actions gates supplement Linux evidence. Physical Windows-device acceptance is deferred until after M13 and before final product release under G14; see the architecture acceptance policy. No backend deployment is performed by desktop CI.
