# M11 Implementation Notes — Flexible first-party app onboarding and updates

## Starting baseline

The verified M07/M08 path delivered and updated the configured sample apps. The remaining gap was generic onboarding: a new approved company app ID still needed platform-side registrations in several places. M11 adds a bounded generic first-party path and proves it with the synthetic `company.sample.preview` app.

## Current code ownership

| Concern | Current location |
| --- | --- |
| Signed feed refresh and update authorization | `electron/distribution/service.ts`, `electron/distribution/updatePolicy.ts` |
| Package parsing, registry and version activation | `electron/packages/format.ts`, `electron/packages/registry.ts` |
| Generic app identity and runtime lifecycle | `electron/runtime/contracts.ts`, `electron/runtime/manager.ts` |
| Store update controls and delivery presentation | `src/StoreApp.tsx`, `src/DeliveryStore.tsx` |
| Shared shell window, dock and arrival behavior | `src/windowManager.tsx`, `src/ManagedWindow.tsx`, `src/dockArtwork.ts`, `src/StoreArtwork.tsx` |
| Synthetic release contents and signed package fixtures | `fixtures/runtime-apps/onboarding/`, `fixtures/packages/` |
| Staging preparation and verification | `tools/app-packages/prepare-onboarding-release.mjs`, `tools/verify-staging-onboarding*.mjs` |

This table describes current repository ownership, not a requirement to keep all future code in these exact files. M12 may improve the shell's presentation while M11 remains the authority for trust, package and update behavior.

## Decisions and boundaries

- Publisher trust roots and the capability ceiling stay platform-pinned; a package cannot add a publisher, origin, preload, native code or privilege.
- Only approved company apps are supported. No third-party marketplace, arbitrary sideloading or general plugin interface is created.
- The existing Dental SaaS remains business authority; synthetic acceptance packages do not store patient records.
- App releases update independently of Electron/platform releases. A new capability beyond the shipped ceiling still requires a trusted platform change.
- M12 is UI/workspace scope; M13/M14 are first-party app release scope; M20 is host installer/release operations. Do not move update authorization into renderer UI.

2026-10-20 roadmap amendment: M13 now owns minimal first-party app-shell releases, M14 owns functional app packages, and M20 owns host installer/release operations. This changes future assignment only; the prior M11 verification scope and evidence are preserved. Final physical acceptance is G21 after M20.

## Current implementation/evidence record

The app onboarding/update implementation and evidence were locally committed as `fbcd156f` on `codex/milestone-11`. Build, full serial unit and focused private Linux UI checks passed on the source worktree before the commit; live staging/authenticated evidence is in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). Hosted Windows CI passed at `2a943385`; the 1.3.0 manual Store click-through, full negative/interruption matrix and 16-app resource gate remain open.

## Change log / deviations

The 2026-10-19 roadmap amendment moves flexible first-party app onboarding/update to M11, OS shell/workspace UI to M12, and Windows/Linux release/operations to M13. M01–M10 history is preserved. Record later changes with exact source and evidence; retain superseded results rather than rewriting test outcomes.
