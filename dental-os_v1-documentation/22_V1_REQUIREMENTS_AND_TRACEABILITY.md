# Dental OS — Requirements and Traceability

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

This matrix connects the constitution to acceptance gates and execution owners. Each milestone's requirement coverage must bind these rows to actual implementation and successful evidence before verification.

| Requirement | Contract | Gate / milestone |
| --- | --- | --- |
| R01 Hosted Windows/Linux product, clear authority | 02,04,16; INV-01/03/05 | G01/G15 (app-ready test-environment inventory only)/G20/G21; M01/M15/M20 |
| R02 Company-only executable apps forever | 02,08,09,14,19,23; INV-02/06 | G06/G07/G11/G13/G14/G15/G17 (company-controlled API-enabled app proof only); M06/M07/M11/M13/M14/M15/M17 |
| R03 Independent web package lifecycle | 08..10,23; INV-04/06/12 | G06..G08/G11/G13/G14/G15/G17 (ADR-025 app-update behavior); M06..M08/M11/M13/M14/M15/M17 |
| R04 Shared desktop continuity and accessibility | 05..07; INV-05/09/14 | G03/G09/G10/G12/G14/G15 (M12 residual closeout)/G17/G21; M03/M09/M10/M12/M14/M15/M17/M20 |
| R05 Isolated apps and bounded privileges | 07,11,14; INV-07 | G03/G04/G10/G11/G12/G13/G14/G15/G17 (approved bounded authority and host contracts); M03/M04/M10..M15/M17 |
| R06 Single login, protected secrets, session switching | 12; INV-08/11 | G05/G15/G17 (affected final-source session transitions); M05/M15/M17 |
| R07 Existing API authority, safe writes/conflicts | 04,11,12; INV-03/10 | G04/G09/G15/G17 (independent authority evolution and app outcome proof); M04/M09/M15/M17 |
| R08 R2 catalogue/distribution, fewa_demo staging-only reuse and /v1/dental-os OS routes | 09,14; INV-02/06/12 | G07/G11/G13/G14/G15/G17 (staging app releases and renewal operations); M07/M11/M13/M14/M15/M17 |
| R09 Safe activation, dirty work, rollback and revocation | 10; INV-09/12 | G08/G11/G14/G15/G17 (ADR-025 next-full-launch trial/recovery); M08/M11/M14/M15/M17 |
| R10 OS-only durability and online-dependent privacy | 13,14; INV-10/11 | G02/G10/G14/G15/G17 (affected final-source OS-only durability and session privacy)/G21; M02/M10/M14/M15/M17/M20 |
| R11 App-contained failure and actionable recovery | 07,15; INV-10/12 | G03/G10/G12/G14/G15/G17 (integrated runtime/update failure recovery); M03/M10/M12/M14/M15/M17 |
| R12 Bounded operational diagnostics/resource management | 15; INV-11/13 | G10/G11/G12/G13/G14/G15/G17 (representative workload and renewal operations)/G20; M10..M15/M17/M20 |
| R13 No direct app-to-app system | 11,19; INV-05/07 | G04/G09/G15 (bounded OS-navigation design assessment only; no messaging implementation); M04/M09/M15 |
| R14 Platform release/update and supported-host proof | 10,16,18; INV-12/13 | G20/G21; M20 |
| R15 Honest baseline, decisions and acceptance evidence | 20,21; INV-10/13 | G01/G11/G12/G13/G14/G15/G17/G20/G21 and every milestone |

G15 closes only the app-ready platform portions shown above. Its R13 work assesses any M14 cross-app navigation need as a bounded OS-owned design; no arbitrary app-grant format, direct app messaging bus, or general cross-app intent capability is approved by this matrix. Any such navigation implementation requires a later explicit contract/ADR. G12/G13 retain their own residual evidence and gate status. R14 installer, platform-update, supported-host and final-release proof remains under G20/G21.

## Research references and interpretation

The recommendations were informed by official documentation, not an assertion that every mechanism already exists:

- [Electron security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Electron sandboxing](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view)
- [safeStorage and host-provider limitations](https://www.electronjs.org/docs/latest/api/safe-storage)
- [Electron autoUpdater and platform differences](https://www.electronjs.org/docs/latest/api/auto-updater/)
- [Cloudflare R2 presigned delivery](https://developers.cloudflare.com/r2/api/s3/presigned-urls/)
- [Firebase session management](https://firebase.google.com/docs/auth/admin/manage-sessions)

Links were consulted during the preceding architecture discussion. Recheck version-specific APIs when implementing against the repository's actual Electron version. These links support mechanism selection; our defaults for privacy, publishing, update timing and first-party-only scope are product decisions.

## Staging amendment coverage

R07 retains existing business routes and SaaS authority. R08 includes the canonical [staging/resource/namespace policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). M04/M05 record transport/identity mapping; M07 records catalogue/resource mapping; M08 covers safe update metadata; M09 verifies existing Dental SaaS/Super Admin client compatibility. M11 proves generic first-party app onboarding/update; M12 owns shell UI; M13 owns app shells; M14 is preserved app source/evidence input; M15 owns app-ready platform integration; M17 owns current functional app implementation and staging delivery; M20 owns platform installers/host operations and R14 evidence; G21 is final physical/user acceptance. G15 supplies no production host/release proof. Each milestone's documented verification remains authoritative. No gate authorizes production promotion.

### M11 flexible first-party app onboarding/update — evidence status

The scoped `company.sample.preview` implementation contributes evidence to R02, R03, R05, R08, R09, R12 and R15. See the [working checklist](../dental-os_v1_working_info/APP_ONBOARDING_AND_UPDATE_CHECKLIST.md), [live signed staging report](../artifacts/staging-onboarding-verification.json), [authenticated service report](../artifacts/staging-onboarding-auth-verification.json), [private Linux onboarding UI report](../artifacts/app-onboarding-verification.json), and [M11 evidence](../dental-os_v1_working_info/milestone-11-flexible-first-party-app-updates/VERIFICATION_EVIDENCE.md). Live metadata/package signatures and clinic install authorization have been verified for the recorded scope. The user reports completing the manual 1.3.0 desktop update. Final-source Windows CI passed at `e14cd125` (see [run 39363492330](https://github.com/Business-It-Partners/dental-os/actions/runs/39363492330)); the 16 synthetic app profile peaked at 2.09 GiB aggregate working set and returned to 487 MiB after app views closed. This is a working-set characterization, not a memory ceiling or clinical/low-memory-device acceptance. G11 is closed for the documented M11 scope; this evidence does not close M13/G13, M14/G14 or M20/G20/G21.
