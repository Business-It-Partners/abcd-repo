# P09 — Final Source and Verification Manifest

**Prepared:** 2026-10-22. **State:** lead candidate source checks pass; independent review and external acceptance gates remain open. This manifest binds the lead test evidence to the reviewed source commit; it does not close G15.

## Source identity and test environment

- Branch: `codex/milestone-15` in `/home/master-x/.codex/worktrees/platform-closeout/fewa_business_os`.
- Runtime/source commit: `11cb1bc8ae8331271eddf3a1dafdf4be2071c1cf` (`feat(m15): integrate closeout platform candidates`).
- Source commit tree: `2a7925aaf87249156071b12227f335e774805206`.
- The P03 checkpoint `125fa25bcc27d6ff198148259695d76cf895b0eb` is an ancestor; M15.1's accepted launch-feedback/frame-handoff checkpoint `ad3fa6a10437bf58606631325d93f6b3cc0369b5` is retained in the branch history.
- Environment: Ubuntu 22.04.5 LTS, x86_64, Node 22.13.1, npm 10.9.2. UI tests used the repository's private headless GNOME/Wayland runner. The user's Brave session, live Dental OS session and profile were not inspected or controlled.
- No runtime source changed after `11cb1bc8`; follow-on source-tree changes are this evidence/record update and generated test outputs only. All UI runs below use the private runner; no test opened or focused the user's desktop.

## Required and focused checks

| Check | Result | Evidence |
| --- | --- | --- |
| `npm run build` | PASS after the source commit: typecheck, Vite renderer build and Electron TypeScript build | Build command output in the lead task; generated `dist/` and `dist-electron/` are temporary and are removed after verification. |
| `npm test -- --maxWorkers=1 --no-file-parallelism --testTimeout=15000` | PASS after the source commit: 19 files, 310/310 tests | Full serial unit run; includes `tests/apiAuthority.test.ts`, `tests/updatePolicyV2.test.ts`, update/fallback/race and package-bound cases. |
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

M14 must supply or resolve, in its dependency record, before integrated app acceptance:

- Per-app route/method/role mapping and live Worker compatibility for each requested operation.
- Stable operation-key and outcome metadata propagation through the app adapter, including the commit-with-dropped-response case.
- Host-mediated media upload/read semantics, checksum and tenant binding, interruption cleanup, and reconciliation of the existing 10 MiB Worker upload vs 8 MiB broker blob-read bounds. The host upload adapter is currently absent; no media pass is claimed.
- Real app payload/package sizes, module/session lifecycle wrappers and print/export inventory. A typed SDK intent is not treated as a delivered host feature.
- Any bounded cross-app OS navigation need through its documented ADR/design gate; no navigation authority is inferred here.

The only synthetic host API examples currently supported are `appointments.list` and `appointments.setStatus`; this is not a complete M14 route inventory or app-compatibility claim. Dental SaaS remains the business authority.

## Remaining owners and gates

- **P07 / M14:** Complete the route/role, operation-key, media, payload, module and print/export contracts above, then supply sanitized synthetic fixtures. Live Worker acceptance must use an explicitly designated synthetic clinic/data set and approved staging scope.
- **P08 / release operations:** Name the staging metadata-renewal operator and independent reviewer; review a metadata-only preparation path; then perform the bounded higher-sequence renewal and expiry-recovery drill. Local synthetic expiry/renewal tests prove verifier behavior only. No individual is inferred from Abhishek's scope/G21 review role.
- **M12/G12:** M12 owner and Abhishek retain required M12.6 integration and user visual acceptance; private automation does not close the user review.
- **M13/G13:** M13 owner retains the current Follow-ups health receipt and Finance/Lab Tracker 1.0.1 installation/module review.
- **M14/G14:** App implementation and functional acceptance stay with the separate M14 track and depend on this verified platform baseline.
- **M20/G20 and G21:** Production installers/updater, production signing and host/support matrix remain M20/G20. Physical Windows/device and final user/product acceptance remain mandatory at G21 after M20.
- **P09/G15:** The lead source candidate is ready for independent source/evidence review. G15 stays open while G12/G13, P07/P08 and any applicable host checks remain unresolved; no checklist completion is claimed.
