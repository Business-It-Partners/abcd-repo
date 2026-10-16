# Dental OS V1 — Global Status

**Updated:** 2026-10-16.
**Active scope:** M01 documentation baseline complete; M02–M05 required automated gates passed, with M05 live staging identity acceptance; physical Windows acceptance deferred.
**Current implementation authorization:** user authorized M06 (next sprint), including detailed planning, implementation, controlled verification and verified main integration; stop after M06.
**Active milestone:** M06 implementing; M05 verified and integrated into main. Physical Windows-device testing remains after M11 and before final product release.
**User review/acceptance:** pending.

## Milestones

| Milestone | Status | Evidence |
| --- | --- | --- |
| [M01 — Architecture and baseline](milestone-01-architecture-baseline/STATUS.md) | VERIFIED — documentation scope only | [Evidence](milestone-01-architecture-baseline/VERIFICATION_EVIDENCE.md) |
| [M02 — Trusted host and OS state](milestone-02-host-and-os-state/STATUS.md) | VERIFIED — automated Linux/Windows; device testing deferred | [Evidence](milestone-02-host-and-os-state/VERIFICATION_EVIDENCE.md) |
| [M03 — Isolated runtime and shared shell](milestone-03-isolated-runtime-and-shell/STATUS.md) | VERIFIED — automated Linux/Windows; device testing deferred | [Evidence](milestone-03-isolated-runtime-and-shell/VERIFICATION_EVIDENCE.md) |
| [M04 — Internal SDK and API boundary](milestone-04-sdk-and-api-broker/STATUS.md) | VERIFIED — automated Linux/Windows fixture scope | [Evidence](milestone-04-sdk-and-api-broker/VERIFICATION_EVIDENCE.md) |
| [M05 — Single login and protected sessions](milestone-05-identity-and-session/STATUS.md) | VERIFIED — automated Linux/Windows and live staging identity | [Evidence](milestone-05-identity-and-session/VERIFICATION_EVIDENCE.md) |
| [M06 — Verified packages and local lifecycle](milestone-06-verified-packages/STATUS.md) | IMPLEMENTING | [Evidence](milestone-06-verified-packages/VERIFICATION_EVIDENCE.md) |
| [M07 — First-party store and Cloudflare delivery](milestone-07-store-and-distribution/STATUS.md) | PLANNED | [Evidence](milestone-07-store-and-distribution/VERIFICATION_EVIDENCE.md) |
| [M08 — Safe independent application updates](milestone-08-safe-app-updates/STATUS.md) | PLANNED | [Evidence](milestone-08-safe-app-updates/VERIFICATION_EVIDENCE.md) |
| [M09 — Integrated OS and SaaS contract proof](milestone-09-integrated-os-and-saas/STATUS.md) | PLANNED | [Evidence](milestone-09-integrated-os-and-saas/VERIFICATION_EVIDENCE.md) |
| [M10 — Security, resilience and usability](milestone-10-security-resilience-and-usability/STATUS.md) | PLANNED | [Evidence](milestone-10-security-resilience-and-usability/VERIFICATION_EVIDENCE.md) |
| [M11 — Windows/Linux release and operations](milestone-11-windows-linux-release/STATUS.md) | PLANNED | [Evidence](milestone-11-windows-linux-release/VERIFICATION_EVIDENCE.md) |

## Starting reality

The existing Electron shell, synthetic apps and session-only store are prototype foundations. No real package manager, isolated installed-app runtime, production desktop login/API broker, R2 distribution or production update system is claimed here. See the [gap map](../dental-os_v1-documentation/21_V1_CURRENT_BASELINE_AND_GAPS.md).

No Flutter/Rust milestone status transfers to Dental OS. Architecture decisions include candidates requiring proof. No source, backend, runtime or deployment behavior is changed by documentation creation.

## Staging/resource policy amendment

Documentation now requires reuse of `fewa_demo` resources, Cloudflare staging-only backend execution, and `/v1/dental-os/...` for new OS services. Existing business routes and production resources remain unchanged. Exact staging branch/resource mapping is not yet verified. No backend edits, cloud resource changes or deployments were made. Milestone statuses remain unchanged; dental application completion is a separate delivery.

## Separate Windows preview packaging experiment — 2026-10-15

The user authorized an unsigned Windows x64 installer for the current prototype so it can be transferred to a Windows device. Work and evidence are tracked in [WORK_CHECKLIST.md](../WORK_CHECKLIST.md) and [preview instructions](../tools/desktop-release/WINDOWS_PREVIEW.md). This is an out-of-sequence packaging experiment, not the start or completion of production M11, a production installer decision, or backend deployment authorization. M03 now has its own implementation status above; M04–M11 remain PLANNED. Windows runtime acceptance is pending.

## Approved verification revision

Windows GitHub Actions provide automated milestone evidence during M02–M11. Physical Windows tests are explicitly deferred until after M11, before final product release. Prior statements treating device evidence as an immediate progression blocker are superseded by this user decision; CI success must not be presented as physical certification.
