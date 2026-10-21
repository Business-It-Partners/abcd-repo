# Dental OS V1 — Global Status

**Updated:** 2026-10-21.

**Platform reconciliation tracking:** [Central checklist](PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) prepared with nine work areas. P01/P02 source/evidence audits are complete. The user authorized P03: M15/G15 is now the formal platform closeout scope; its four milestone records, roadmap and traceability are established and P03 documentation validation passes. P03 is documentation/planning only; no runtime capability or acceptance gate is verified by it. M14 remains the separate parallel app track.

**Active scope:** M01–M11 VERIFIED for their documented scope; M12 is IMPLEMENTING with M12.1–M12.5 implemented for tested Linux/private-display scope, M12.6 planned and G12 open; M13 is IMPLEMENTING with all eleven 1.0.0 app shells published and user-reported installed/run acceptance. M13.12 piloted an OS-owned launch surface on Patient Record; M13.13 generalizes that lifecycle to installed managed packages regardless of app ID and passes a future-package regression on a private display. Review in the user's installed Dental OS still awaits a full user-controlled relaunch. The Follow-ups health receipt and Finance/Lab Tracker 1.0.1 update/module review remain unconfirmed; M14 app planning/handoff is IMPLEMENTING on the separately published branch; M20 Windows/Linux release/operations is PLANNED. No final production/device certification is claimed.
**Current platform execution:** M15 planning/P03 is complete, with separate sidebar worker chats/worktrees; P04–P09 runtime work remains pending. M14 app implementation stays parallel. M15.1 will review/checkpoint the separately preserved original M13 runtime delta.
**Prior milestone authorization context:** M11 app-onboarding/update work and staging acceptance were separately requested and are complete for their documented scope. M12 UI work remains user-directed; production remains excluded.
**Latest verified milestone:** M11 — flexible first-party app onboarding and independent updates — passed staging acceptance and Windows CI, then was normally merged into `main` at `b6a4045f`. Physical Windows-device testing is G21 after M20 and before final product release.
**User acceptance:** the user reports completing the staging app update to 1.3.0. Broader final product/device acceptance remains G21 after M20.

**M11 scope:** [Flexible first-party app onboarding and independent updates](APP_ONBOARDING_AND_UPDATE_CHECKLIST.md) proves that a new company app can install and update without per-app shell registration or a Dental OS rebuild. Generic Linux runtime/Store tests, staging sequences 12–15, authenticated Store install/update service acceptance, private live-feed install/update/restart, the local failure/recovery matrix, user-reported manual 1.3.0 desktop update, and final-source Windows CI pass for their recorded scope. The 16 synthetic app profile peaked at 2.09 GiB aggregate working set across 20 processes and returned to 487 MiB across four processes after closing the apps; it enforces no memory ceiling and does not represent clinical apps or low-memory hardware. M07/M08 original status and evidence remain unchanged. See [final M11 report](milestone-11-flexible-first-party-app-updates/VERIFICATION_EVIDENCE.md).

## Product contract clarification — 2026-10-21

[Product Vision and V1 Contract](../dental-os_v1-documentation/01_WHY_DENTAL_OS.md) is the single starting explanation of product motivation and V1 boundaries; technical contracts remain separate. ADR-025 supersedes ADR-024: Store Update stages verified bytes without disturbing the running app; next full launch trials the candidate with eligible known-good recovery. The [install/update contract](../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) owns the detailed rules. Store/runtime alignment and focused acceptance are now assigned to M15.3 (previously an M13 platform follow-up); this documentation change closes no gate and does not reorder milestones or erase the separately recorded M14 worktree planning exception. Current app-specific API-route policy coupling remains a design review item, not approval for a new permission format.

## Milestones

| Milestone | Status | Evidence |
| --- | --- | --- |
| [M01 — Architecture and baseline](milestone-01-architecture-baseline/STATUS.md) | VERIFIED — documentation scope only | [Evidence](milestone-01-architecture-baseline/VERIFICATION_EVIDENCE.md) |
| [M02 — Trusted host and OS state](milestone-02-host-and-os-state/STATUS.md) | VERIFIED — automated Linux/Windows; device testing deferred | [Evidence](milestone-02-host-and-os-state/VERIFICATION_EVIDENCE.md) |
| [M03 — Isolated runtime and shared shell](milestone-03-isolated-runtime-and-shell/STATUS.md) | VERIFIED — automated Linux/Windows; device testing deferred | [Evidence](milestone-03-isolated-runtime-and-shell/VERIFICATION_EVIDENCE.md) |
| [M04 — Internal SDK and API boundary](milestone-04-sdk-and-api-broker/STATUS.md) | VERIFIED — automated Linux/Windows fixture scope | [Evidence](milestone-04-sdk-and-api-broker/VERIFICATION_EVIDENCE.md) |
| [M05 — Single login and protected sessions](milestone-05-identity-and-session/STATUS.md) | VERIFIED — automated Linux/Windows and live staging identity | [Evidence](milestone-05-identity-and-session/VERIFICATION_EVIDENCE.md) |
| [M06 — Verified packages and local lifecycle](milestone-06-verified-packages/STATUS.md) | VERIFIED — automated Linux/Windows local packages | [Evidence](milestone-06-verified-packages/VERIFICATION_EVIDENCE.md) |
| [M07 — First-party store and Cloudflare delivery](milestone-07-store-and-distribution/STATUS.md) | VERIFIED — Linux/Windows CI and actual staging delivery | [Evidence](milestone-07-store-and-distribution/VERIFICATION_EVIDENCE.md) |
| [M08 — Safe independent application updates](milestone-08-safe-app-updates/STATUS.md) | VERIFIED — Linux/Windows and actual staging updates | [Evidence](milestone-08-safe-app-updates/VERIFICATION_EVIDENCE.md) |
| [M09 — Integrated OS and SaaS contract proof](milestone-09-integrated-os-and-saas/STATUS.md) | VERIFIED — Linux/Windows and actual staging integration | [Evidence](milestone-09-integrated-os-and-saas/VERIFICATION_EVIDENCE.md) |
| [M10 — Security, resilience and usability](milestone-10-security-resilience-and-usability/STATUS.md) | VERIFIED — automated Linux/Windows hardening and bounded resource scope | [Evidence](milestone-10-security-resilience-and-usability/VERIFICATION_EVIDENCE.md) |
| [M11 — Flexible first-party app onboarding and updates](milestone-11-flexible-first-party-app-updates/STATUS.md) | VERIFIED and integrated — automated/staging scope | [Evidence](milestone-11-flexible-first-party-app-updates/VERIFICATION_EVIDENCE.md) |
| [M12 — Dental OS workspace and shell experience](milestone-12-os-ui-experience/STATUS.md) | IMPLEMENTING — M12.1–M12.5 implemented for recorded Linux scope; package-driven M12.3 extension awaits focused private UI review; M12.6 planned, G12 open | [Evidence](milestone-12-os-ui-experience/VERIFICATION_EVIDENCE.md) |
| [M13 — First-party app shells](milestone-13-first-party-app-shells/STATUS.md) | IMPLEMENTING — eleven shells published and user-reported installed/run; generic OS-managed launch lifecycle passes private Linux checks; review in the installed OS, Follow-ups health receipt, and Finance/Lab Tracker 1.0.1 update/module review remain pending | [Evidence](milestone-13-first-party-app-shells/VERIFICATION_EVIDENCE.md) |
| [M14 — Functional Dental OS apps](milestone-14-dental-app-functionality/STATUS.md) | IMPLEMENTING — separate published app handoff; functional acceptance pending | [Overview](milestone-14-dental-app-functionality/PLAN.md) |
| [M15 — Platform Closeout and Integration](milestone-15-platform-closeout-and-integration/STATUS.md) | IMPLEMENTING — P03 scope/records verified as documentation; runtime work and G15 acceptance pending; existing G12/G13 residuals retained | [Evidence](milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md) |
| [M20 — Windows/Linux release and operations](milestone-20-windows-linux-release/STATUS.md) | PLANNED | [Evidence](milestone-20-windows-linux-release/VERIFICATION_EVIDENCE.md) |

## Starting reality

The existing Electron shell, synthetic apps and session-only store are prototype foundations. No real package manager, isolated installed-app runtime, production desktop login/API broker, R2 distribution or production update system is claimed here. See the [gap map](../dental-os_v1-documentation/21_V1_CURRENT_BASELINE_AND_GAPS.md).

No Flutter/Rust milestone status transfers to Dental OS. Architecture decisions include candidates requiring proof. No source, backend, runtime or deployment behavior is changed by documentation creation.

## Staging/resource policy amendment

Documentation now requires reuse of `fewa_demo` resources, Cloudflare staging-only backend execution, and `/v1/dental-os/...` for new OS services. Existing business routes and production resources remain unchanged. The original documentation amendment itself changed no backend. Subsequent user-authorized M05/M07–M09 work verified the mapping, provisioned dedicated public sample delivery, deployed additive staging OS services and proved real SaaS integration; see those milestone records for exact resources/evidence. Production remains unchanged and full dental application completion is a separate delivery.

## Separate Windows preview packaging experiment — 2026-10-15

The user authorized an unsigned Windows x64 installer for the current prototype so it can be transferred to a Windows device. Work and evidence are tracked in [WORK_CHECKLIST.md](../WORK_CHECKLIST.md) and [preview instructions](../tools/desktop-release/WINDOWS_PREVIEW.md). This is an out-of-sequence packaging experiment, not the start or completion of M20, a production installer decision, or backend deployment authorization. That was the preview-time state. Current milestone/Windows CI progress is recorded in the table above; physical Windows acceptance remains pending under G21.

## Approved verification revision

Windows GitHub Actions provide automated milestone evidence during M02–M20. Under the 2026-10-20 milestone re-sequencing, physical Windows tests are deferred until after M20 and before final product release. Earlier “after M11” and “after M13” wording is historical and superseded; CI success must not be presented as physical certification.

## Published M14 parallel app handoff — 2026-10-21

The user authorized a separate web-chat app track while this checkout continues platform reconciliation. Dental OS `codex/milestone-14` is published at `3ace826ef4800abbcd7ff2c5bc37601de248e63a`; SaaS `codex/den-0003-dental-os-module-bundles` at `12ac3aed66979e7c924b416f5a70aa2733e366a8`. [Start here](https://github.com/Business-It-Partners/dental-os/blob/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality/WEB_CHAT_START_HERE.md) owns the app handoff, source pins, eleven-app matrix and app/platform dependency boundary. M14 is IMPLEMENTING for planning/handoff; no functional app acceptance is claimed. M12/G12, M13/G13 and final G14 dependencies remain open. The app branch excludes this checkout's uncommitted runtime changes. Frontend SaaS typecheck/lint/56 existing unit tests and OS handoff documentation checks passed; static OS package build, live API/Store and private runtime app acceptance remain pending. No environment/main merge, deployment, signed publication or live-app restart occurred.

## M15 planning checkpoint — 2026-10-21

P03 formalizes the previously proposed M15.1–M15.6 closeout slices without changing M01–M11 historical outcomes. M12/G12 and M13/G13 retain their open obligations, coordinated under M15.4. M14 UI/feature work stays in the separate app branch; final G14 acceptance requires verified G15. M20/G20 owns release installers/platform updater/signing/host certification, and G21 remains mandatory physical/device/user acceptance after M20. No runtime tests or new acceptance claims follow from this planning task.
