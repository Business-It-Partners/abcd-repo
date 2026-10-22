# Platform contract for first-party apps — M15

This inventory describes the current integration baseline. It is not a production release or acceptance of M14 app features. The central checklist and M15 verification record own completion. Apps must use the supported contracts below; a package cannot grant itself additional native or business authority.

## Supported integration contracts

| Capability | Contract and boundary | Evidence |
| --- | --- | --- |
| Company-only app delivery | Verified immutable packages, company trust ceilings, signed/fresh/monotonic catalogue and update policy. No third-party publishing or arbitrary sideloading. | Package/distribution/onboarding suites; real staging feed continuity drill. |
| Independent API evolution | Format-2 exact-release grant binds app ID/version, package SHA-256, payload digest and supported operation IDs. Format 1 grants no API authority. New compatible signed releases can use existing operations on an unchanged desktop. | `tests/apiAuthority.test.ts`, `tests/updatePolicyV2.test.ts`; private company-signed live staging probes. |
| Clinic API JSON | SDK 1.2 `clinic.api.request`: platform-owned method/path/query/capability rules, not caller-selected URLs or arbitrary prefixes. Worker remains authoritative for records, roles and tenant mapping. Host holds credentials. | `docs/CLINIC_JSON_API_CONTRACT.md`, 43 route tests, live staging role/revocation/write proof. |
| Writes and unknown outcomes | Stable caller operation key and matching payload; explicit same-key reconciliation. No new-key automatic retries, local authoritative business DB or offline write queue. Close/update safety protects unresolved writes. | 26 private integrated checks, 25 live staging checks; canonical-schema two-database backend proof. |
| Independent updates | Download/verify while current work/version remain pinned; candidate trials on next full app launch after normal close; bounded health and eligible known-good recovery under current policy. | ADR-025, 70 unit cases, 17 private update checks and 12 real process-exit cases. |
| Managed app lifecycle | Sandboxed isolated renderer, narrow preload, app-local storage/session, dirty/modal/unknown-write close gates, crash/hang containment and session invalidation. Shared OS window/dock/Genie lifecycle. | Runtime, integration, identity, package and shell suites. |
| App/module discovery | Host catalogue/explorer selects declared modules in the same app; independent windows, focus, overview, minimize/restore and keyboard/reduced-motion/scaling support. | Private shell/overview/usability and launch suites. |
| Bounded private media reads | SDK 1.3 `clinic.media.read`: exact signed app-family authority, fresh metadata, fixed routes, size/MIME/SHA-256 verification; 10 MiB patient / 25 MiB Staff; 1/app and 2 total, 30 s deadline. | ADR-028 and 29 unit and 2 native boundary checks. Live positive object read is not claimed from the local fixture. |
| Declared package budgets | 2 MiB per asset, 8 MiB expanded package. Keep the existing request/JSON transport bounds. Larger packages or new schemas need reviewed/versioned platform changes. | Exact-boundary/next-byte package regression. |
| Staging operations | Existing signed-feed metadata-only renewal/expiry recovery and support procedure; keep production release obligations separate. | P08 sequence 21→22 operation report and renewal runbook. |

## Explicitly unavailable capabilities

- **Media uploads:** user deferred on 2026-10-22. Experimental SDK 1.4 implementation and reports remain preserved, but real host sessions always deny upload authority even if a release requests it. Actual transfer/recovery/support acceptance must precede re-enablement. No public upload grant was published.
- **General app-to-app communication or intents:** excluded by R13. No app can directly call or message another app. Patient/case deep links have no current approved OS contract; a future bounded OS navigation proposal must pass its ADR/design gate. Existing same-app explorer/module selection is the supported navigation boundary.
- **Native print/export:** the existing `native.intent` returns `UNAVAILABLE`; it is not an implemented printer, PDF, file-save or arbitrary filesystem adapter. App developers must not rely on it or bypass the broker. A concrete output format/destination, permission, privacy/lifecycle policy and adapter acceptance are required before adding a versioned capability. This inventory records the existing unsupported boundary; it does not approve a new native power.

## App responsibilities

Build and sign a company-approved package against this SDK/API inventory. Preserve operation keys across explicit retries; handle conflicts/unknown outcomes truthfully; report app-owned dirty/modal work; respect bounded payloads. Apps implement their workflows against the existing Dental SaaS APIs. The platform does not implement or certify the app's clinical workflow. New server routes, larger budgets and unavailable capabilities require explicit compatibility review.

## Remaining acceptance boundaries

M14 owns functional app acceptance. User visual/manual review follows platform technical verification. M20 owns production host/support matrix, installers, executable signing, desktop updater and release support; G21 retains physical/device acceptance. Hosted Windows/Linux runners describe test environments, not certified customer-device support. The final source/Windows/review gates remain open until their results are recorded in the central checklist.
