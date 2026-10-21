# API and app-update platform gaps — lead audit

**Date:** 2026-10-21. **Source:** M13 `963633620d9fa620979bd33fc292949ab1a6c2e6` plus the local inputs identified in [SOURCE_BASELINE.json](SOURCE_BASELINE.json).
**Method:** source/contract inspection only. No tests, live API calls, signing or runtime changes were performed for this report.

## Independent permission evolution

The existing broker is a substantial foundation. `electron/sdk/broker.ts` binds caller/frame/origin, connection and session generation; obtains credentials in the host; bounds requests/responses; denies redirects and forbidden returned credential/upload-handle fields; and tracks in-flight/unknown writes and original idempotency keys. M04/M05/M09/M10 evidence remains relevant for those recorded contracts.

`electron/sdk/appPolicy.ts` still contains the eleven named clinic app IDs, family capability mapping and API path grants. Most app grants are route-prefix families, without per-route method restrictions. Follow-ups has a narrower special handler with method/query rules. `allowedClinicApiPath` and `appOperation` are consulted by the broker, so signing a new package does not independently teach the unchanged desktop a new clinic API app identity or route contract.

This does not contradict M11's generic installation proof: M11 permits generic package onboarding/runtime identity, while this clinic API policy remains separately compiled. The two capabilities need separate acceptance labels.

| Required decision / proof | Current constraint | Proposed closeout acceptance |
| --- | --- | --- |
| Trusted app/API permission contract | Signed package capabilities alone do not define independently evolving clinic routes; current policy is host source | Choose a versioned, bounded first-party approval mechanism, with explicit host enforcement and Worker authority. Record who may approve/change a grant and its compatibility rules. No arbitrary app self-authorization. |
| Precise route/method authority | Most app families use prefixes; Follow-ups is special-cased | Prove exact approved route/method/parameter behavior, plus undeclared, encoded/traversal, role/session and compatibility negatives. Preserve credential secrecy. |
| Actual independence | New generic installable app IDs can still lack compiled clinic API policy | A genuinely new approved signed API-enabled sample and a compatible API extension must run on the same unchanged desktop source. An existing pre-registered sample alone is insufficient. New native powers may still legitimately require a platform update. |
| Material write outcome propagation | Broker preserves outcome/key metadata; external app adapters are unfinished | Demonstrate the SDK contract and representative adapter preserve original operation identity and pending/unknown outcomes across timeout, close, lock and update transitions. App coordinator owns app adapter fixes. |

No route-list manifest format or remote permission-control design is selected by this audit. Those require a concrete architecture decision before implementation.

## Accepted app-update contract versus current implementation

[The canonical lifecycle](../../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) and ADR-025 require staging without disturbing running code, then trial activation at the next full launch and bounded eligible known-good recovery.

| Behavior | Source evidence | Disposition |
| --- | --- | --- |
| Separate staged immutable versions and pinned leases | `electron/packages/registry.ts`: `install(..., stageUpdate)`, `launch`, `releaseLease`, pending/trial/knownGood state, journal and retention | Existing M08/M11 foundation. Reuse; test affected behavior on final source. |
| Next-launch selection | Registry `launch` can promote pending to trial with no lease and an eligible state | Foundation exists. Verify through the normal shell Open/Close path, including cold start, healthy predecessor requirements and policy changes. |
| Current immediate apply route | `src/DeliveryStore.tsx` shows Download update and Use update now; `electron/main.ts` routes `update-now`; distribution delegates to runtime `updateNow`, which closes and immediately creates a successor | Align default Store behavior/UI and route semantics with ADR-025. Routine Update must not require app closure, discard dialogue or automatic successor launch. |
| Health and recovery | Runtime bounded startup readiness/bridge probes call `markHealthy`; failures call registry recovery machinery; registry guards fallback | Recheck the full failure matrix. Startup health is executable readiness, not a required successful business read or proof of clinical correctness. |
| Tampered staged candidate | Registry revalidates pending before committing activation; errors can reach runtime's package-verification failure path | Inspect and prove that a bad pending candidate preserves/selects an eligible previous version and is not retried forever. The source inspection alone does not establish this full contract. |
| Unresolved write protection | Broker `hasUnsafeWrites` and runtime close/update gates exist | Prove gating across normal next-launch activation, session/process interruption and original-key reconciliation. Closing/restarting does not prove a server rejection. |
| Interruption/concurrency | Registry journals/locks and distribution global mutation guard exist | Reuse foundations, then prove Update/Open/Close/uninstall races, cancellation before/after pending commit, interrupted trial and safe three-version retention. |

The accepted contract permits recovery guidance and user reopening without automatic restart loops. A fallback must remain intact, authorized and compatible under current controls; a revoked version must not be launched to make a rollback test pass.

## New app-track inputs for platform scope

The external M14 dependency register at `48c18401cada192bfa0bea02a4afdd0cb10e45ca` identifies actual integration needs beyond a read-only demo:

- Private patient/staff media: host-mediated upload/download, MIME/size/checksum validation, tenant/access checks and interrupted-transfer cleanup. Current JSON request body and bounded blob read cannot be treated as a binary upload adapter.
- Authorized cross-app patient/case navigation: source dirty/modal safety, independently authorized destination, missing/denied app behavior and bounded identifiers without sensitive URL state. Preserve existing same-family module switching; this is a separate inter-app contract.
- Payload budgets: `contracts.ts` limits generic JSON body to 12,000 characters with bounded JSON validation, request envelope to 16 KiB, response to 256 KiB and blob read to 8 MiB. Measure synthetic representative cases before choosing pagination/chunking or a versioned host limit change. Do not silently widen limits.
- Print/export: native intents currently have an unavailable adapter path; require a concrete V1 app requirement and explicit disposition instead of inventing a browser/native escape.

These items belong in the reviewed platform scope where required for the agreed integrated-app baseline. Their full clinical UI and workflows remain M14 responsibilities. No remote backend resource, production operation or new general-purpose app platform is introduced by listing them.

## Metadata continuity prerequisite

`docs/SECURITY_AND_RECOVERY.md` explicitly requires authorized operators to renew metadata before its 24-hour expiry and states that no scheduled renewal service is installed. Catalogue/update-policy verification enforces that bound. Existing release-preparation tools advance sequences while issuing metadata; no dedicated metadata-only renewal tool was found in the inspected tool directory. This is a bounded source finding, not a live-feed availability test.

Do not confuse tested expiry/revocation controls with demonstrated ongoing renewal operations. The proposed app-ready closeout should name a responsible operator and prove a repeatable metadata-only renewal and expired-feed recovery procedure without forcing an app rebuild or weakening freshness checks. Whether to automate it is an explicit operations decision. Production platform signing/updater work remains separately scoped.
