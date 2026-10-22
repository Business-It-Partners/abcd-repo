# P09 — Final Source and Verification Manifest

**Prepared:** 2026-10-22. **State:** lead candidate source checks pass; independent review and external acceptance gates remain open. This manifest binds the lead test evidence to the reviewed source commit; it does not close G15.

## Source identity and test environment

- Branch: `codex/milestone-15` in `/home/master-x/.codex/worktrees/platform-closeout/fewa_business_os`.
- Runtime commit: `11cb1bc8ae8331271eddf3a1dafdf4be2071c1cf` (`feat(m15): integrate closeout platform candidates`). Test-only package-boundary checkpoint: `e3d82f0c`.
- Source commit tree: `2a7925aaf87249156071b12227f335e774805206`.
- The P03 checkpoint `125fa25bcc27d6ff198148259695d76cf895b0eb` is an ancestor; M15.1's accepted launch-feedback/frame-handoff checkpoint `ad3fa6a10437bf58606631325d93f6b3cc0369b5` is retained in the branch history.
- Environment: Ubuntu 22.04.5 LTS, x86_64, Node 22.13.1, npm 10.9.2. UI tests used the repository's private headless GNOME/Wayland runner. The user's Brave session, live Dental OS session and profile were not inspected or controlled.
- No runtime source changed after `11cb1bc8`. Test-only checkpoint `e3d82f0c` adds the exact package asset/expanded-bound regression; no production source changed. Follow-on changes are documentation/evidence and generated test outputs only. All UI runs below use the private runner; no test opened or focused the user's desktop.

## Required and focused checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` | PASS after the source commit: typecheck, Vite renderer build and Electron TypeScript build | Build command output in the lead task; generated `dist/` and `dist-electron/` are temporary and are removed after verification. |
| `npm test -- --maxWorkers=1 --no-file-parallelism --testTimeout=15000` | PASS on the exact test source committed as `e3d82f0c`: 19 files, 311/311 tests | Full serial unit run; includes `tests/apiAuthority.test.ts`, `tests/updatePolicyV2.test.ts`, update/fallback/race, and exact 2 MiB asset / 8 MiB expanded package bounds. |
| `npm test -- tests/packages.test.ts --maxWorkers=1 --no-file-parallelism --testTimeout=30000` | PASS on the exact test source committed as `e3d82f0c`: 68/68 tests | Signed synthetic 8 MiB expanded package accepted at exact bounds; builder and verifier reject +1-byte individual and expanded totals. |
| `npm test -- tests/updates.test.ts tests/updatePolicyV2.test.ts --maxWorkers=1 --no-file-parallelism --testTimeout=15000` | PASS on documentation-only checkout `7237173d`: 77/77 tests | Focused local synthetic expiry/recovery rerun. Runtime/test source is unchanged from `11cb1bc8`; the user will name actual staging operators later. Details in [M15 verification evidence](../VERIFICATION_EVIDENCE.md). |
| `npm run test:sdk` | PASS after the source commit: 15 private UI assertions | [SDK report](../../../artifacts/sdk-verification.json). |
| `npm run test:updates` | PASS after the source commit: 17 private UI assertions | [Update report](../../../artifacts/updates-verification.json). |
| `npm run test:store-arrival` | PASS after the source commit: 25 private UI assertions | [Store-arrival report](../../../artifacts/delivery-arrival-verification.json). |
| `node tools/run-ui-test.mjs tests/m12-usability.mjs` | PASS after the source commit: 10 private UI assertions | [Usability report](../../../artifacts/m12-usability-verification.json). |
| `npm run test:overview` | PASS after the source commit: 30 private UI assertions, including 4/7/10 managed-window layouts | [Overview report](../../../artifacts/overview-verification.json). |
| `npm run test:scaling` | PASS after the source commit: 5 private UI assertions at DPR 2 | [Scaling report](../../../artifacts/scaling-verification.json). |
| `npm run test:app-launch-feedback` | PASS after the source commit: 132 private UI assertions across current shells and a future app fixture | [JSON report](../../../artifacts/app-launch-feedback-2026-10-22T00-00-13-548Z.json), [splash capture](../../../artifacts/app-launch-feedback-2026-10-22T00-00-13-548Z.png), [native handoff capture](../../../artifacts/app-launch-feedback-handoff-2026-10-22T00-00-13-548Z.png). |
| `python3 tools/check-dental-docs.py` and `git diff --check` | PASS after the closeout record update; zero documentation errors | Checker covers 24 architecture documents, 16 milestones, 64 required milestone files, 15 requirements, 17 gates and 14 invariants. Final output is rerun after committing this evidence record. |

The following integrated synthetic suites ran on the same runtime/test source content that was committed as `11cb1bc8`; no runtime or test source edits followed these runs. They preceded the commit while the candidate tree was dirty, so they are identified separately from the post-commit reruns above:

- `npm run test:integration`: PASS, 26 synthetic read/write, unknown-outcome/original-key replay, conflict, dirty-close, staged-update, session-isolation and uninstall checks. The earlier format-1 fixture failure is retained as [failed attempt](../../../artifacts/integration-verification-failed-2026-10-22-read-timeout.json); the publisher fixture was corrected to sign exact format-2 grants and the [rerun passed](../../../artifacts/integration-verification.json).
- `npm run test:hardening`: PASS, 22 assertions; included [resource](../../../artifacts/resources-verification.json) 5/5 and [recovery](../../../artifacts/recovery-verification.json) 3/3.
- `npm run test:runtime`: PASS, 46 assertions plus DPR 2 capture; [runtime report](../../../artifacts/runtime-verification.json).
- `npm run test:packages`: PASS, 8 assertions; [package report](../../../artifacts/packages-verification.json).
- `npm run test:workspace`: PASS, 18 navigation and 6 delivery-state assertions; [navigation report](../../../artifacts/workspace-navigation-verification.json) and [delivery-state report](../../../artifacts/delivery-states-verification.json).
- `npm run test:identity`: PASS, 44 assertions; [identity report](../../../artifacts/identity-verification.json).
- `npm run test:onboarding`: PASS, 23 assertions; [onboarding report](../../../artifacts/app-onboarding-verification.json).
- `npm run test:distribution`: PASS, 10 assertions; [distribution report](../../../artifacts/distribution-verification.json).

The reports have not been represented as live-service proof. No real Worker/Store request, staging publication, production operation, main merge, deployment, user app restart, physical Windows/device acceptance or new Windows CI run occurred in this lead closeout session. Historical Windows evidence remains attached to its recorded earlier source and scope.

## M14 platform handoff

M15 hands M14 the exact signed company catalogue/update-policy authority implemented by ADR-026: a release-scoped format-2 grant binds app ID, version, package wire hash, payload digest and typed API operation IDs under the existing company trust ceiling. API grants are checked before credentials/transport; format-1 policy grants no API authority. No third-party publisher, local business database, offline write queue or general app-to-app messaging/intent path was added.

The lead read the current M14 [`PLATFORM_DEPENDENCIES.md`](https://github.com/Business-It-Partners/dental-os/blob/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality/PLATFORM_DEPENDENCIES.md) on 2026-10-22. Its immutable file blob SHA is `c9a267b66c4726e3b74b9da78d3a2cb66eaf5ddc`; the earlier M15 audit snapshot at `48c18401cada192bfa0bea02a4afdd0cb10e45ca` remains historical evidence. M14 has now submitted several concrete app requests; these are requirements to reconcile and test, not grants already enabled by M15:

- **P01 route and API compatibility:** the register contains Follow-ups routes, Appointments list/write needs, Work Entry's route families, Treatment Progress, Lab Tracker and Finance requests. These are only partially mapped: host grant/method/query/role/tenant compatibility still needs per-app negative and positive broker proof. In particular, Work Entry requests `/v1/clinic/suppliers` and `/v1/patient-media`, which the current host prefix policy excludes; Finance requests `GET /v1/clinic/staff`, also absent from its current host prefix. Do not broaden prefixes without least-privilege review.
- **P02/P09/P11 media and payloads:** the app register reports a 10 MiB Worker upload against the host's 8 MiB blob-read cap and no host-mediated upload. MIME/checksum/tenant/error-cleanup, full-size read and interruption behavior remain open. Patient Record's test-signed CI package was measured at 4,416,622 B wire / 2,478,802 B expanded / 32 assets on Ubuntu 24.04 and 4,428,174 B / 2,484,988 B / 34 assets on Windows Server 2022. This is useful size evidence for that package only; it is not signed Store, live runtime or other-app payload acceptance. Other app payloads still need sanitized measurement.
- **P03 operation identity:** the host preserves `outcome`, `requestId` and `operationId`, and explicitly supplied idempotency keys pass through. M14 reports that current call sites may create a new UUID per write attempt and has listed partial-success/reconciliation cases. Stable-key reuse and commit-with-dropped-response handling must be proved across the actual app adapter and staging Worker before live writes.
- **P05/P06 app needs:** print/export inventory and managed lifecycle proof remain open. App UI wrappers provide some dirty/modal state, but safe close/update/trial/relaunch behavior and Finance/Lab dirty supplier/payment edits are not proven in the managed runtime.
- **P10 navigation:** cross-app app links remain behind the documented OS navigation design/ADR gate; no generic intents, direct URL handoff or navigation authority is inferred.

The only synthetic typed host API operations currently enabled and tested by this platform source are `appointments.list` and `appointments.setStatus`; this is not a complete M14 route inventory or app-compatibility claim. Dental SaaS remains the business authority.

## Remaining owners and gates

- **P07 / M14:** Complete the route/role, operation-key, media, payload, module and print/export contracts above, then supply sanitized synthetic fixtures. Live Worker acceptance must use an explicitly designated synthetic clinic/data set and approved staging scope.
- **P08 / release operations:** Verified for actual signed staging-feed continuity at `d5504845`: metadata-only sequence 21→22 renewal, expiry/core-registry recovery, all 14 immutable package comparisons, unchanged registry pointers and zero temporary publishers. See [operation report](P08_METADATA_RENEWAL_2026-10-22.json). Authenticated Store/native UI and clinical proof remain separately tracked under P07.
- **M12/G12:** M12 owner and Abhishek retain required M12.6 integration and user visual acceptance; private automation does not close the user review.
- **M13/G13:** M13 owner retains the current Follow-ups health receipt and Finance/Lab Tracker 1.0.1 installation/module review.
- **M14/G14:** App implementation and functional acceptance stay with the separate M14 track and depend on this verified platform baseline.
- **Windows host regression:** the current M14 dependency register reports its unchanged Windows isolated-runtime workflow `39648602457` failed with `alpha` remaining visible after dock-edge handoff at app-source commit `f7be34d20236d81e95a5d63abb228d8f3636fc8d`. A separate Patient Record app package/startup workflow `39648602409` passed but does not clear that platform failure. This M15 session ran no Windows CI; the failure remains an explicit P09/P08 reliability item for platform owner review.
- **M20/G20 and G21:** Production installers/updater, production signing and host/support matrix remain M20/G20. Physical Windows/device and final user/product acceptance remain mandatory at G21 after M20.
- **P09/G15:** The lead source candidate is ready for independent source/evidence review. G15 stays open while G12/G13, P07/P08 and any applicable host checks remain unresolved; no checklist completion is claimed.


## Subsequent operations tooling and P08 closure — 2026-10-22

Operational tooling source checkpoint `d5504845` adds `electron/distribution/renewal.ts`, metadata-only preparation/publication scripts and a disposable public-feed/core-registry drill. Normal shell/runtime UI source is unchanged from `11cb1bc8`. Build passes; the new full serial unit suite passes 324/324 in 21 files (13 new focused renewal/publication regressions). The actual signed staging controls advanced 21→22; all 14 immutable package identities and disposable registry pointers stayed unchanged. Anonymous/replay checks, temporary Worker removal and existing staging client reachability passed. [Source-bound report](P08_METADATA_RENEWAL_2026-10-22.json). This supersedes the earlier P08 people/tool/drill open item for this technical scope; authenticated Store/native UI/clinical integration remains P07. The user directs remaining work and source review in the lead chat and manual acceptance afterward; the separate sidebar review automation is paused. G15 remains open while the other technical dependencies are unfinished.


## Subsequent API candidate and build correction — 2026-10-22

ADR-027/SDK 1.2 adds the signed `clinic.api.request` contract with explicit app/method/path/query and trusted-session capability checks before credentials and at dispatch. The clinic-route suite passes 43 cases and build passes; full unit/private checks are pending at this source checkpoint. The earlier statement that only two host API operations exist describes `11cb1bc8`, not this candidate. No signed staging API grant was published by the sequence-22 renewal.

The earlier P08 build label applied to a preliminary build before the last test import. A subsequent exact build found TS7016 for that JavaScript test-module import; the new `.d.mts` declaration fixes it and the full build passes. The operation report retains the qualification. No staging behavior changed or repeated publication occurred.
