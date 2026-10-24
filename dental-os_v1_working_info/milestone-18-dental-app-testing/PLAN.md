# M18 — First-party Dental App Staging Testing

**Status:** IMPLEMENTING — direct, lead-only staging testing in the existing M15 worktree. The primary Work Entry workflow passed against signed 1.0.5 on staging, including a saved-plan readback. Work Entry 1.0.6 has since been published at sequence 98 with radiograph read/upload grants and public package readback; a private staging-profile read-only run passed the signed Store install, Start Work and case/context reads (27 checks, 11 GET-only events, zero business writes). Radiograph upload/preview/withdraw and full clinical workflows remain untested. Finance has core workflow passes for the six selected modules; the rest of the app roster and remaining Finance/Work Entry edge-state cases remain open. The user stopped parallel setup; worker histories are retained and their worktrees were removed after evidence integration.
**Coordination root:** /home/master-x/.codex/worktrees/platform-closeout/fewa_business_os, branch codex/milestone-15.
**Scope owner:** M18 testing supplies app-level staging workflow evidence for the existing M17/G17 and later G14 acceptance. It does not change M15, M17, G14, G15, or G17 status by itself.

## Purpose

Test the currently signed first-party Dental app packages through the Dental OS connected to the Dental SaaS staging backend. For each top-level app, verify staging API reachability and expected brokered calls, then complete its user-facing workflows against synthetic staging records. Record reproducible steps, expected and actual outcomes, traces, screenshots, and issue classifications.

Production is reported working. Production is explicitly outside M18: do not sign into a production clinic, call a production endpoint, read production data, or perform production writes unless the user separately asks for production testing. Every M18 app run is staging-only.

M18 app testing is in progress. On 2026-10-24, Finance 1.7.7 was installed from the signed staging Store at feed sequence 91 in a private profile; the Transaction Record and six user-selected modules completed their core create/read flows. Product, Supplier and Purchase were created in one run; Supplier payment, Salary payment and General expense were created in a second run using the same synthetic namespace and safely reusing the first three records. General Expenses passed required-category and missing-reason guards; correction (201), void (200), and separate read-only verification that the voided synthetic expense no longer appears in the active list were evidenced. Its immediate post-void refresh had a transport error; a later fresh staging read returned 200. This single refresh failure is recorded as a transient TEST/ENVIRONMENT result, with no confirmed backend or app defect. The redacted traces and case results are in [M18.7](M18.7_FINANCE_TEST_PLAN.md) and the [evidence ledger](VERIFICATION_EVIDENCE.md). Patient Payments was never opened. A transient Purchases read timeout on an earlier run also did not recur. Calendar has a signed-feed/package preflight and prior launch attempt in the [worker report](worker-reports/M18.10_CALENDAR_2026-10-24.md), but no Calendar workflow passed. Work Entry 1.0.3 at signed sequence 91 reproduced “Request capacity reached” on Start Work; the grouped-read fix was published as signed 1.0.4 at sequence 92 and removed that failure. A separate app-side idempotency-key collision in 1.0.4 prevented dispatch of the clinical commit; this was fixed in 1.0.5. With the user’s specific approval, signed Work Entry 1.0.5 was published at staging sequence 93; the package readback is in [M18.4](M18.4_WORK_ENTRY_TEST_PLAN.md). The user later specifically requested the Work Entry app update be released; signed 1.0.6 was published at sequence 98 with `clinic.media.read` and `clinic.media.upload`, and public package readback passed. A later private staging-profile Store install/open on 1.0.6 passed Start Work and all eight expected case/context GETs (27 checks, 11 GET-only events, zero business writes); radiograph upload/preview/withdraw and full clinical workflows remain untested. The existing designated case `M18-WE-20261024-628B2FE0` was reused: case-doctor PUT returned 200, clinical commit POST returned 201, and a fresh case GET returned 200 with one saved protocol. A corrected read-only verification passed 27 checks with only 11 GET API events; the earlier “Chart & plan” selector failure targeted the wrong continuation view and was a test-harness issue. No backend defect was observed and no backend code/data was changed. Do not create another case for this flow. The other app workflows remain untested; broader Finance edge/state cases and Work Entry chart, prescription/lab/follow-up, payment/close, guard/conflict and recovery scenarios remain open. The private API tracing hook and runner are test instrumentation only. Staging app workflows may create uniquely named synthetic records through normal app UI only; do not edit backend data directly, run database scripts, or make backend code/data changes as an app fix. Retain non-deletable synthetic records in the run report for the backend owner to review.

## Roster source and package boundary

The roster is the intersection of current top-level M17 package directories and the active signed staging feed. On 2026-10-24, the latest public readback for Patient Record 1.0.10 confirmed signed catalogue/update-policy readback at sequence 86 and verified ten current M17 app identities/packages. The readback report is [M17 Patient Record 1.0.10 public readback](../../artifacts/m17-patient-record-1.0.10-public-readback-2026-10-24.json), with the [ten-package identity/readback checks](../../artifacts/m17-staging-packages-readonly-2026-10-24T05-00-17.198Z.json); its package-set verification is recorded in [M17.2 staging evidence](../milestone-17-dental-app-delivery/evidence/M17.2_PATIENT_RECORD_1.0.10_STAGING_2026-10-24.json). The current app/package identity source is each listed package directory's app.json and app.manifest.json, alongside [M17 status](../milestone-17-dental-app-delivery/STATUS.md).

The sequence-86 feed is the original roster baseline, not a guarantee it will still be current. Re-read the signed staging feed before each run; record its sequence, app ID, version, package SHA-256 and installed package receipt. If an app’s current staging version differs from this table, update that app’s run header and verify the exact installed version before testing. Catalogue/package publication is outside M18 unless the user specifically authorizes a named staging release. The user specifically authorized Work Entry 1.0.6 at sequence 98 after the earlier 1.0.5 release; no further publication is implied.

| Submilestone | Top-level app | Staging app/package ID | Current version at feed sequence 86 | Latest release sequence | Test plan |
| --- | --- | --- | --- | --- | --- |
| [M18.1](M18.1_FOLLOWUPS_TEST_PLAN.md) | Follow-ups | company.dental.followups.m17 | 1.0.3 | 61 | [Plan](M18.1_FOLLOWUPS_TEST_PLAN.md) |
| [M18.2](M18.2_PATIENT_RECORD_TEST_PLAN.md) | Patient Record | company.dental.patient-record.m17 | 1.0.10 | 86 | [Plan](M18.2_PATIENT_RECORD_TEST_PLAN.md) |
| [M18.3](M18.3_APPOINTMENTS_TEST_PLAN.md) | Appointments | company.dental.appointments.m17 | 1.0.5 | 62 | [Plan](M18.3_APPOINTMENTS_TEST_PLAN.md) |
| [M18.4](M18.4_WORK_ENTRY_TEST_PLAN.md) | Work Entry | company.dental.work-entry.m17 | 1.0.6 | 98 | [Plan](M18.4_WORK_ENTRY_TEST_PLAN.md) |
| [M18.5](M18.5_TREATMENT_PROGRESS_TEST_PLAN.md) | Treatment Progress | company.dental.treatment-progress.m17 | 1.0.6 | 65 | [Plan](M18.5_TREATMENT_PROGRESS_TEST_PLAN.md) |
| [M18.6](M18.6_LAB_TRACKER_TEST_PLAN.md) | Lab Tracker | company.dental.lab-tracker.m17 | 1.0.3 | 75 | [Plan](M18.6_LAB_TRACKER_TEST_PLAN.md) |
| [M18.7](M18.7_FINANCE_TEST_PLAN.md) | Finance | company.dental.finance.m17 | 1.7.7 | 85 | [Plan](M18.7_FINANCE_TEST_PLAN.md) |
| [M18.8](M18.8_STAFF_TEST_PLAN.md) | Staff | company.dental.staff.m17 | 1.0.3 | 76 | [Plan](M18.8_STAFF_TEST_PLAN.md) |
| [M18.9](M18.9_TREATMENT_PROTOCOLS_TEST_PLAN.md) | Treatment Protocols | company.dental.m17.treatment-protocols | 1.0.6 | 66 | [Plan](M18.9_TREATMENT_PROTOCOLS_TEST_PLAN.md) |
| [M18.10](M18.10_CALENDAR_TEST_PLAN.md) | Calendar | company.dental.calendar.m17 | 1.0.4 | 67 | [Plan](M18.10_CALENDAR_TEST_PLAN.md) |

Each row represents one first-party top-level package. Finance is one app and one package with eight internal modules; M18.7 tests all eight inside that one submilestone. There is no separate Patient Payments app submilestone: that work is Finance's Patient payments module. Historical M13 preview package directories, removed sample catalogue entries, and other IDs absent from the sequence-86 M17 staging feed are not M18 app identities.

Package manifest references: [Follow-ups](../../apps/dental-apps/company.dental.followups.m17/app.json), [Patient Record](../../apps/dental-apps/company.dental.patient-record.m17/app.json), [Appointments](../../apps/dental-apps/company.dental.appointments.m17/app.json), [Work Entry](../../apps/dental-apps/company.dental.work-entry.m17/app.json), [Treatment Progress](../../apps/dental-apps/company.dental.treatment-progress.m17/app.json), [Lab Tracker](../../apps/dental-apps/company.dental.lab-tracker.m17/app.json), [Finance](../../apps/dental-apps/company.dental.finance.m17/app.json), [Staff](../../apps/dental-apps/company.dental.staff.m17/app.json), [Treatment Protocols](../../apps/dental-apps/company.dental.m17.treatment-protocols/app.json), and [Calendar](../../apps/dental-apps/company.dental.calendar.m17/app.json).

## Staging environment and access

- Use a Dental OS build configured for the Cloudflare staging app feed and the Dental SaaS staging Worker. Verify the environment labels and staging host/resource mapping before any sign-in or API request. Do not select production or infer environment from an app name alone.
- Install or update the app through the authenticated staging Store. Record the feed sequence, app ID, installed version, package digest, desktop build/commit, date, staging clinic/test identity, role/capabilities, and synthetic fixture namespace in the run record.
- All app business calls must flow through the package's approved Dental OS SDK and host broker. Do not use app-owned fetch, browser address-bar requests, curl, Postman, or direct Worker/database access to perform business operations.
- Use test-only staging records with a unique run prefix and isolated identifiers. These are persisted by the real staging API through the Dental OS app UI; they are not mock responses or local-only fixtures. Never use real patient/staff information. Before testing, verify that the staging clinic and selected identities are designated for test data.
- The test login below is authorized for staging only. The account's actual role/capabilities must be read from the authenticated clinic session; do not assume a role. Never include these values in screenshots, test reports, worker prompts, issue reports, request traces, or other M18 files.

**Authorized staging login**

- Email: sugam-dental-clinic@sphirontech.com
- Password: 123456789

Role, clinic identity and available test data are not assumed by this plan. Role-specific and cross-tenant cases require separately authorized staging identities. If those identities or a safe failure-injection fixture are unavailable, mark the case BLOCKED and list the missing prerequisite rather than weakening the case or marking it passed.

## Preconditions and safety

1. Confirm the actual checkout is the M15 coordination root at the path and branch shown above. Do not move coordination to /home/master-x/Desktop/fewa_business_os or create another root worktree.
2. Confirm the signed staging feed and update policy verify; note the current sequence and exact package identity/version/hash. Check the desktop is pointed at staging before using the login.
3. Confirm the current M15 host, app family grants, route allowlists and M17 package source/version match the run baseline. Do not bypass host capability, session, signature or tenant checks to force a workflow through.
4. Confirm synthetic-only patients, staff, appointments, financial entries, lab orders and calendar tasks are available or can be created in the staging UI. Use test data with a unique run prefix; do not mutate shared clinic records.
5. Confirm staging role accounts for the required positive and denial cases and read-only access to a staging API request trace or Worker request IDs. Record requests without credentials or full sensitive payloads.
6. Agree on how non-deletable test records will be identified and retained. Cleanup only through a normal app workflow if that action is explicitly supported and safe. Do not run direct backend cleanup.

If a precondition fails, record TEST/ENVIRONMENT and stop only the affected case. Do not substitute production.

## Test execution and coordination

### Current coordination mode

On 2026-10-24, the user stopped the two-worker setup as inefficient and directed testing to proceed directly in this chat. Continue from this M15 worktree only; do not create replacement worker chats or worktrees unless the user asks. The two stopped chats remain archived with their history. Their worktrees were removed only after their preflight reports and evidence were copied into this M18 folder. Those reports are preparation evidence, not app workflow passes.

The lead owns the shared run ledger, staging/environment preflight, package/version recheck, app-case execution, issue triage, and review/integration of any accepted OS/app-side fixes. Keep app-specific fixes in their app packages. Coordinate shared host/SDK fixes through M15. Record backend-owned issues for the user's backend team; do not change backend code or data. Production, unrelated catalogue publication, signing changes, and account settings remain outside M18. The Work Entry 1.0.5 staging publication was specifically authorized to unblock that fix’s staging verification. Do not push or merge to `main`.

## Per-app procedure

For each app submilestone:

1. Freeze the installed package identity, signed staging version/digest, app manifest, desktop commit, feed sequence, session role and synthetic fixture IDs.
2. Launch the app through the Dental OS Store/window lifecycle. Record launch, app ready/health, renderer errors and expected startup reads; startup must not issue business writes unless its documented workflow specifically requires one.
3. Capture API reachability from the approved staging trace: SDK operation, method, route/query, response status, request/correlation ID and relevant redacted outcome. Compare every call with the per-app expected-call list and current M17 route contract. Report unexpected, missing, duplicate or direct-network calls.
4. Execute each listed scenario in the app UI using synthetic records only. Record exact preconditions, numbered steps, expected result, actual result, evidence path, tester and timestamp. Mark cases PASS, FAIL, BLOCKED or NOT RUN.
5. Check refresh/reopen state against the Worker response; check role/session/tenant behavior and conflict/unknown-write recovery where the app supports writes.
6. Classify each discrepancy using the taxonomy below. Fix only app/OS code when evidence shows that ownership; route backend-owned behavior to a sanitized handoff report.
7. Review results in the lead worktree. Acceptance is per exact package version and staging environment; a later package update requires retesting affected scenarios.

## Issue classification

Use one primary classification and optional contributing classification:

| Classification | Use when | Examples |
| --- | --- | --- |
| OS/platform fixture | The host, signed package lifecycle, session, SDK broker, capability gate, route allowlist, media broker, managed window, or shared OS fixture prevents a correct app contract. | Valid app call is rejected before dispatch by incorrect host policy; session is not cleared after sign-out; package cannot launch with a valid receipt. |
| App implementation | The package UI, state transition, query/payload, route selection, idempotency identity, response handling, or accessibility/workflow behavior differs from its reviewed app contract. | Wrong query date; duplicate UI submit; persisted server result not refreshed; wrong role-specific module is shown despite correct session metadata. |
| Backend | The staging Worker/SaaS route, authorization, validation, tenant scope, persistence, row-version/idempotency behavior, response contract or audit record violates its documented contract after a correct app request reaches it. | Correct authorized request receives wrong projection; cross-clinic data leaks; duplicate command changes data twice; route returns malformed or contradictory persisted state. |
| Test/environment | The test target, signed package, clinic seed, role account, network, service availability, trace capture, or test fixture is wrong/unavailable. | Desktop is configured for production; stale package is installed; staging outage; missing test role; no safe response-drop fixture. |

Do not classify by the visible symptom alone. First establish the desktop environment, package digest, session role, broker dispatch outcome and staging request ID. If the boundary cannot be determined, record UNKNOWN and gather evidence before assigning an owner.

### Backend-owned issue handoff

For each backend issue, attach a separate sanitized issue record using [the shared case and issue template](TEST_CASE_TEMPLATE.md). Include:

- App/submilestone ID, app/package ID/version/digest, M15 desktop commit, staging feed sequence, staging environment and date/time with timezone.
- Synthetic clinic/test namespace and pseudonymous object IDs only; user role/capabilities; exact prerequisite state.
- Numbered reproduction steps; expected versus actual result; repeat count and whether the result is deterministic.
- SDK operation and exact HTTP method/path/query with sensitive query fields redacted; HTTP status, response body with tokens/PII/secrets removed, and request/correlation ID if safe to share.
- Whether the request reached the Worker, whether it used the expected row version and idempotency operation identity, and the post-refresh state. Redact or hash operation identifiers if they could be replayed.
- Screenshot/log references with patient names, phone numbers, staff personal data, access tokens, cookies, passwords, signed URLs and raw file bytes removed.

Keep the raw evidence in the restricted staging workspace when necessary; put only redacted excerpts in the handoff. Record backend owner as “user backend team”; M18 does not edit backend code, database rows, Worker configuration or production. The lead reviews the handoff packet and gives it to the user for their backend team through the user's approved channel; do not transmit it automatically from this plan.

## Acceptance and exit

Each app submilestone is accepted only for a named signed staging package version/digest and desktop source commit when:

- The package launches from the staging Store in the expected isolated Dental OS window and reports healthy readiness.
- Every required route for the exercised workflow is reachable through the approved broker, returns the expected status/shape, and remains within the correct clinic/role scope.
- All app-specific core workflows and important loading, empty, validation, error, conflict, session and dirty-state outcomes in that plan have reproducible results and evidence.
- Writes reconcile to canonical staging state after refresh; uncertain writes reuse the original operation identity; no duplicate or unintended business effect is observed.
- No unresolved high-severity issue remains in the accepted app scope. Backend and environment blockers remain open with explicit owner and impact; they are not silently counted as passes.
- The app plan, run ledger, issue records and evidence index are reviewed by the lead.

M18 completion is not production acceptance, a production deployment, an app publication, a backend fix, or automatic closure of G17, G14, G15, M15, or M17. It supplies staging workflow evidence to the existing milestone owners. The [status](STATUS.md), [implementation notes](IMPLEMENTATION_NOTES.md), [shared test-case template](TEST_CASE_TEMPLATE.md), and [evidence ledger](VERIFICATION_EVIDENCE.md) track progress.

## Related records

- [M15 platform closeout status](../milestone-15-platform-closeout-and-integration/STATUS.md)
- [M17 app delivery status](../milestone-17-dental-app-delivery/STATUS.md)
- [Current global V1 status](../00_V1_STATUS.md)
- [Master roadmap](../00_V1_MASTER_ROADMAP.md)
- [Acceptance gates](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md)
