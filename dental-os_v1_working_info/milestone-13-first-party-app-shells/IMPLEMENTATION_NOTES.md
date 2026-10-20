# M13 Implementation Notes — First-party app shells

M13 is the first app-release layer in Dental OS. It publishes minimal, installable app identities before the later functional-app milestone. Existing package trust, signing, Store, Cloudflare staging and isolated runtime mechanisms are reused.

The user designated the M13.1 Follow-ups staging 1.0.0 publish/install slice as complete. The retained report confirms the package is installed and its nested entry exists; it explicitly leaves managed-window runtime launch and health acknowledgement unverified. Keep that residual evidence visible for G13 closeout.

Do not treat the app catalog or Dental SaaS reference checkout as a milestone owner. App identity, placeholder package, staging release and OS install remain Dental OS deliverables.

## M13.2–M13.4 coordinated batch

The user requested worktree chats with a limit of three app submilestones in progress at once. Appointments, Work Entry and Patient Record were implemented in their own worktree chats, then integrated into the current Dental OS checkout. All three use the same centered-name placeholder layout, existing app artwork, 1.0.0 metadata and no SDK capabilities. Their app-specific checks pass (4, 5 and 4 checks respectively), and the current OS build passes.

The three packages were signed with the existing pinned staging signer and published together through the existing temporary staging publisher. Cloudflare staging catalogue/update-policy sequence 17 now contains all three packages. Public catalogue, policy and R2 package bytes were re-read and verified against the pinned signer, package hashes and app metadata. The prior four release entries and four update rules were preserved unchanged. See [batch evidence](evidence/m13-batch-sequence-17.json).

On 2026-10-20, the user reported downloading/installing all three packages and confirmed the app windows work as expected. M13.2–M13.4 are complete for their requested staging shell release/install scope; G13 remains open for the entire milestone. M12.6/G12 stays open.

## M13.5–M13.7 coordinated batch

The user authorized the next three app submilestones in parallel worktree chats: Treatment Progress, Lab Tracker and Finance. Treatment Progress is one centered-name shell. Lab Tracker and Finance must include their complete M13 module-label inventories and exercise the shared app explorer; each module tile temporarily reuses the main app thumbnail. As in M13.2–M13.4, workers edit their isolated package directories and the lead owns shared packaging, integration, testing, release evidence and staging publication. No M14 workflows or business API calls are in scope.

All three app directories were integrated into the current checkout. App-local tests passed (Treatment Progress 5/5, Lab Tracker 4/4, Finance 5/5), and the root Electron build passed. The existing M13 packager was extended to include an optional app-local script and validate the expected module label inventory for this batch. Packages were signed with the existing pinned M08 staging key and published together at sequence 18 to `dentmitra-dental-os-releases-cloudfare-staging`. Live signed catalogue/policy and all package objects were verified; the seven pre-existing releases and policy entries were unchanged. Conditional writes, anonymous denial and replay denial were verified; the temporary publisher was removed. See [sequence 18 evidence](evidence/m13-batch-sequence-18.json). The user still needs to install and review the three apps in their existing profile; this has not been marked as user acceptance.

## M13.8–M13.10 coordinated batch

The user resumed the remaining M13 shells using the same lead-and-worktree pattern: Patient Payments, Staff and Treatment Protocols were each implemented in their own app worktree chat. Each is a centered-name 1.0.0 staging preview and reuses its existing main-app thumbnail. Patient Payments preserves the Reception-only `patient_payments.outstanding.read` metadata policy; the other packages use their catalog capabilities. No M14 workflow, API, patient data, credentials, or local business storage was added.

All three app-local suites pass (5/5 each). The lead extended `prepare-m13-batch-release.mjs` to validate this batch under the appropriate clinic roles and exact module inventory. The packages were signed with the existing pinned M08 staging key and published together at sequence 19 to `dentmitra-dental-os-releases-cloudfare-staging`. The public signed catalogue, update policy and all three package objects were independently fetched and verified; all ten prior releases and policy entries remain byte-equivalent. The temporary publisher enforced conditional writes, rejected anonymous and replay requests, and was removed. See [sequence 19 evidence](evidence/m13-batch-sequence-19.json). User-profile Store install and app-window acceptance remain pending.

## M13.11 Calendar

Calendar was implemented in its own worktree chat as a centered-name 1.0.0 staging preview using the existing Calendar thumbnail and `calendar.access` visibility. Its app-local suite passes 5/5. The signed package was published separately at catalogue sequence 20. Live signed catalogue/policy and R2 package bytes verify; all thirteen prior releases and policy entries are unchanged. The temporary conditional staging publisher was removed after anonymous/replay denial checks. See [sequence 20 evidence](evidence/m13-batch-sequence-20.json). User-profile Store install and managed-window acceptance remain pending.

## Shared multi-module window contract correction

The user's side-by-side screenshot showed the same OS-managed outer window frame around Finance and Lab Tracker, but different app-owned inner chrome. Finance put its More Apps button on the opposite side of the active module and its staging badge on a separate row; Lab Tracker grouped the active module and More Apps at the left and put the badge at the right. These were independently authored package HTML/CSS files, not separate OS window implementations. The two visible windows are the Finance and Lab Tracker parent apps open at the same time; sub-app selection stays in the parent app's existing window.

The M13 contract now specifies one shared toolbar shape: main app name in the OS titlebar; active module and four-dot More Apps control together at the left of one in-app toolbar; staging badge at the right; selected sub-app label centered below. Finance and Lab Tracker now use the same markup structure and stylesheet for that shell. Their signed 1.0.1 packages were published to Cloudflare staging at sequence 21; the other twelve catalogue entries and all app access policies were preserved. Package preparation/validation, staging publisher guards, and public signed package/catalogue/policy verification passed. The app-local suites were not rerun for this patch, and normal-profile Store update plus managed-window/module-switch review remain pending. See [sequence 21 evidence](evidence/m13-multimodule-ui-sequence-21.json). Production was not changed.

## User-reported install and run review — 2026-10-20

The user reports installing and running all eleven M13 version 1.0.0 shells in Dental OS. This supersedes earlier pending install/open notes for those packages. The retained Follow-ups install artifact predates the reported launch and still shows its pre-launch state; the current package registry's automatic known-good health receipt has not been independently re-read. The user did not explicitly confirm installing Finance and Lab Tracker's sequence-21 version 1.0.1 updates or reviewing module switching, so those checks remain open.
