# M15 Media Staging Acceptance — 2026-10-22

**M15 media-platform exit status: INCOMPLETE.** The requested scenario outcomes passed in the retained staging evidence, but the upload-failure verifier exited `1`. Its cleanup guard was corrected afterward; a clean acceptance run remains unverified because the protected Clinic A staging credential file required by the corrected runner is not available in active local configuration.

This consolidation reviews the existing [active-file clinic-isolation evidence](P07_MEDIA_ACTIVE_TENANT_ISOLATION_STAGING_2026-10-22.json) and [upload-failure evidence](P07_MEDIA_UPLOAD_FAILURES_STAGING_2026-10-22.json). It records no new staging activity. Both records identify source `94c74ac2f13ed1211c5b2cfa38545f95c002da58` with local worktree changes present.

## Passed scenario outcomes

| Scenario | Retained result |
| --- | --- |
| Clinic B signed-app access to Clinic A active files | The isolation verifier passed **19/19** checks. Clinic B's signed Patient Record and Staff apps received broker `ACCESS_DENIED`; each metadata request returned HTTP 404, no binary request was dispatched, and zero bytes were returned. Clinic A confirmed each exact synthetic asset remained active across the denial. SaaS withdrawal then returned HTTP 204 for both assets. |
| Wrong MIME and checksum | Four synthetic Patient Record/Staff cases returned Worker HTTP 422. No finalise request was dispatched; SaaS abort returned HTTP 204 and each transfer was absent from active lists. The broker outcome was recorded as `UNKNOWN_OUTCOME`. |
| Session revocation during content upload | The real Worker content PUT returned HTTP 204 while the broker response was held. Session invalidation then produced broker `STALE_SESSION` with unknown outcome and prevented finalisation. After same-clinic sign-in, SaaS abort returned HTTP 204 and the transfer was absent from the active list. |
| Real server receipt race | Two concurrent same-key finalise requests reached the staging Worker/D1/R2 path and returned HTTP 200 and HTTP 409 (`patient_media_conflict`). Same-key replay returned HTTP 200 matching the successful response. The asset had one active row at row version 2 before SaaS withdrawal returned HTTP 204. |

## Failure and unverified items

- **Verifier process failed:** the upload-failure run exited `1` after recording 31 passing checks. Its teardown repeated SaaS abort after the race asset had already been successfully withdrawn and was absent from the active list. The duplicate abort correctly returned HTTP 409; the verifier incorrectly treated that second cleanup attempt as a failure. The cleanup guard was corrected after the run.
- **Corrected clean run is unverified:** the acceptance matrix was not rerun after the guard correction. A separate same-clinic read-only check returned HTTP 200 for both active lists and found zero run-scoped patient or Staff files; this confirms cleanup state, not a clean verifier exit. The required pinned signer exists as a mode-0600 file at `/home/master-x/.local/share/dental-os-release-keys/m08-staging-ed25519.pem`, and the existing synthetic Clinic A seed journal exists as a mode-0600 file at `/tmp/dental-os-m15-active-media-isolation-20261022/journal.json`. The protected Clinic A login file was not found in active local configuration or the active M15 worktrees. Clinic B's credential cannot substitute for Clinic A's tenant login. No replacement credential was created and no staging request was sent during this availability check.
- **Stored-file lifecycle is not an OS acceptance item:** no physical R2 deletion or external bucket-lifecycle check was performed. Dental SaaS owns stored-file status and retention; Dental OS adds no withdrawal or deletion behavior.
- **Separate M15 gates remain:** current-source Windows verification and independent review are still open. They are separate from the media scenario results. M15 overall remains `IMPLEMENTING`; this record does not close G12/G13/G15 or M14/M20/G21 release gates.

## Exit disposition

| Scope | Status |
| --- | --- |
| Active-file clinic isolation scenario | **PASS** — 19/19 checks |
| Requested MIME/checksum, session-revocation, and receipt-race scenarios | **PASS at scenario level** in the retained run |
| Upload-failure verifier command | **FAIL** — exit code `1` from the duplicate-cleanup false negative |
| Corrected upload-failure verifier | **UNVERIFIED** — guard fixed, but rerun could not start without the protected Clinic A staging credential |
| M15 media-platform staging exit | **INCOMPLETE** — scenario evidence passes, but no clean corrected verifier result is recorded |
| M15 overall | **IMPLEMENTING** — current-source Windows verification and independent review remain separate gates |

No public app grant was published. The local build task performed no staging probe, backend change, production operation, push, or GitHub Actions run.
