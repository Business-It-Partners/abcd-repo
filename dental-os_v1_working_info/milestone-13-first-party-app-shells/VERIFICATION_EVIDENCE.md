# M13 Verification Evidence — First-party app shells

**Milestone verification:** IN PROGRESS. All eleven version 1.0.0 shells are published. On 2026-10-20, the user reported installing and running all eleven in Dental OS. The current Follow-ups launch-health receipt has not been independently re-read, and installation/review of the Finance and Lab Tracker 1.0.1 updates and module switching remain unconfirmed.

## M13.1 — Follow-ups

- Package: `company.dental.followups` 1.0.0.
- Environment: Cloudflare staging, signed catalogue sequence 16.
- Profile: existing staging user profile.
- Verified: authenticated distribution install completed; registry active version and nested package entry exist.
- At the time of this evidence capture, not verified: first OS managed-window launch, visible dock/window acceptance, and healthy-launch acknowledgement.
- Evidence: [followups-staging-install-verification.json](../../artifacts/followups-staging-install-verification.json).

The user directed M13.1 to be marked complete for the staging shell release/install scope. On 2026-10-20, the user subsequently reported installing and running all eleven app shells in Dental OS, including Follow-ups. This records user-reported app-window use. The retained JSON above is a pre-launch snapshot, so it does not show the later automatic known-good health receipt; that receipt has not been independently re-read from the current profile for G13 closeout.

## M13.2–M13.4 — Appointments, Work Entry, Patient Record

- Environment: Cloudflare staging; signed catalogue and update policy sequence 17.
- Packages: `company.dental.appointments`, `company.dental.work-entry`, and `company.dental.patient-record`, each version 1.0.0 with an empty SDK capability list.
- Verified: app-local checks pass (4/4, 5/5, 4/4); root `npm run build` passes; the live signed catalogue and update policy verify; each R2 package matches the signed SHA-256 and byte count; package signature, metadata, icon, entry and centered app label verify.
- Preserved: all four releases and all four update rules from sequence 16, including Follow-ups 1.0.0.
- User acceptance: on 2026-10-20, the user reported downloading and installing all three apps and confirmed they open and work as expected (see the user-provided screenshot in the conversation).
- Evidence: [sequence 17 report](evidence/m13-batch-sequence-17.json).

The three submilestones are marked complete for the requested shell release/install scope. No G13 closeout is implied.

## M13.5–M13.7 — Treatment Progress, Lab Tracker, Finance

- Work began on 2026-10-20 in three separate managed worktree chats, with the lead coordinating integration and staging release.
- Treatment Progress is a single-module name-only app shell.
- Lab Tracker includes the module labels "Lab Tracker" and "Lab supplier record".
- Finance includes the eight documented module labels from the M13 plan.
- For now, every module tile reuses the existing main-app thumbnail. Lab Tracker and Finance retain one main icon in their package metadata, which the shared App Explorer displays for each module.
- Lab Tracker and Finance shell windows expose their active module label and the shared App Explorer entry point; app functionality remains deferred to M14.
- Release and package evidence are recorded in the sequence-18 section below.

## M13.5–M13.7 staging release

- Environment: Cloudflare staging, signed catalogue and update-policy sequence 18.
- Verified: Treatment Progress, Lab Tracker and Finance are signed version 1.0.0 packages with no SDK capabilities; exact module lists, main thumbnails, app assets, and the Lab/Finance App Explorer hooks are present in the packages.
- Local checks: Treatment Progress 5/5, Lab Tracker 4/4, Finance 5/5; root Electron build passes.
- Live verification: public catalogue, policy, and all three R2 package objects were fetched and verified against current pinned staging trust. The signed catalogue contains ten releases; all seven prior release and policy entries remain unchanged.
- Publication: temporary staging publisher passed conditional-write checks, rejected anonymous access and replay, and was removed after publication.
- At initial publication, user-profile Store installation, managed-window launch, and module-selection review were pending. The user later reported installing and running all eleven shells in Dental OS; module-selection review is not explicitly confirmed.
- Evidence: [sequence 18 report](evidence/m13-batch-sequence-18.json).

## Finance and Lab Tracker — shared multi-module window contract update

- Cause: the Dental OS supplies one shared managed-window frame, while each isolated app bundle had separately authored its inner HTML/CSS. Finance placed More Apps on the opposite side from the active module and put its staging badge on another row; Lab Tracker grouped its module and More Apps but used a different toolbar layout.
- Contract: keep the main app name in the OS titlebar; place the active module and four-dot More Apps control together at the leading edge of one in-app toolbar; place the staging badge at its trailing edge; center the selected module below. Selecting a sub-app changes the current app window; it does not open another window.
- Environment: Cloudflare staging, signed catalogue and update-policy sequence 21. Finance and Lab Tracker are updated from 1.0.0 to 1.0.1; catalogue still contains fourteen releases.
- Verified: package preparation and publication validation pass; live catalogue/update-policy signatures verify; the two public R2 packages match reviewed byte counts and SHA-256 values; package signatures and trusted module metadata verify. The other twelve release entries and all app access-policy entries are unchanged. Temporary publisher conditional writes passed, anonymous and replay requests were denied, and the publisher was removed.
- Not verified at publication: the 1.0.1 app-local suites were not rerun. The user later reported installing and running the app shells, but did not explicitly confirm installing this 1.0.1 update or reviewing module switching. No production resources changed.
- Evidence: [sequence 21 report](evidence/m13-multimodule-ui-sequence-21.json).

## M13.8–M13.10 — Patient Payments, Staff, Treatment Protocols

- Implemented in three separate app worktree chats, then integrated by the lead. Each package is a static, centered-name 1.0.0 staging preview with no SDK capabilities, business workflows, API calls, patient data, credentials, or local business storage.
- Patient Payments follows the current first-party catalog policy: Reception-only, `patient_payments.outstanding.read`, and the existing Finance main thumbnail. Staff uses `staff.manage` and the Staff thumbnail. Treatment Protocols uses `treatment_protocols.manage` and the Protocols thumbnail.
- Each app-local suite passed 5/5 checks. The shared metadata parser accepts Patient Payments under the Reception role; Staff and Treatment Protocols are validated under admin.
- Environment: Cloudflare staging, signed catalogue and update-policy sequence 19.
- Live verification: public signed catalogue and policy verify at sequence 19 with thirteen releases. All ten prior release and update-policy entries remain unchanged. Each new R2 package object matches the reviewed bytes, SHA-256 and size; all three package signatures and trusted app metadata verify.
- Publication: temporary staging publisher passed conditional-write checks, rejected anonymous requests and replay, and was removed after publication.
- At initial publication, normal-profile Store installation and managed-window launch review were pending. The user later reported installing and running all eleven shells in Dental OS.
- Evidence: [sequence 19 report](evidence/m13-batch-sequence-19.json).

## M13.11 — Calendar

- Implemented in its own app worktree chat and integrated by the lead. Calendar is a static centered-name 1.0.0 preview with no SDK capabilities, workflow, API call, credential, or business data; it reuses the existing Calendar thumbnail and `calendar.access` visibility metadata.
- The app-local suite passed 5/5 checks.
- Environment: Cloudflare staging, signed catalogue and update-policy sequence 20.
- Live verification: public signed catalogue and policy verify at sequence 20 with fourteen releases. All thirteen prior release and update-policy entries remain unchanged. The Calendar R2 package object matches the reviewed bytes, SHA-256 and size; its signature and trusted app metadata verify.
- Publication: temporary staging publisher passed conditional-write checks, rejected anonymous requests and replay, and was removed after publication.
- At initial publication, normal-profile Store installation and managed-window launch review were pending. The user later reported installing and running all eleven shells in Dental OS.
- Evidence: [sequence 20 report](evidence/m13-batch-sequence-20.json).

## User-reported install and run review — 2026-10-20

The user reports installing and running all eleven M13 app shells in Dental OS. This updates the earlier pending install/open notes for the 1.0.0 packages and records user-reported visible app use. The report does not explicitly confirm that Finance and Lab Tracker were updated to their 1.0.1 packages at sequence 21 or that their module switching was reviewed. The Follow-ups JSON remains the original pre-launch snapshot; the current registry's automatic known-good receipt has not been independently re-read.

## Remaining submilestones

- [x] M13.2–M13.4 version 1.0.0 packages published to staging and user-accepted after normal-profile installation and app-window use.
- [x] M13.5–M13.7 version 1.0.0 staging packages published and signed package bytes verified.
- [x] User reports installing and running M13.5–M13.7 version 1.0.0 shells in Dental OS.
- [ ] Finance and Lab Tracker 1.0.1 updates installed from Store and module switching reviewed.
- [x] M13.8–M13.11 version 1.0.0 staging packages published and signed package bytes verified.
- [x] User reports installing and running M13.8–M13.11 version 1.0.0 shells in Dental OS.
- [ ] Current Follow-ups known-good runtime health receipt re-read from the user profile.
- [ ] Exact centered app/module labels and module switching reviewed for the multi-module shells.
- [x] Signed package, catalogue sequence, capabilities and staging-only evidence recorded for M13.1–M13.11.
- [ ] G13 closeout after all eleven app submilestones pass.

The user's report establishes installation and app-run acceptance for all eleven shells. G13 remains open for the current Follow-ups health receipt and the specific Finance/Lab Tracker 1.0.1 and module-switch checks. M12.6/G12 remains open under the user's sequencing direction. No production publication was performed.
