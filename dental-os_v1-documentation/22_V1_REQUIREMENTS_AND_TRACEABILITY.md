# Dental OS — Requirements and Traceability

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

This matrix connects the constitution to acceptance gates and execution owners. Each milestone's requirement coverage must bind these rows to actual implementation and successful evidence before verification.

| Requirement | Contract | Gate / milestone |
| --- | --- | --- |
| R01 Hosted Windows/Linux product, clear authority | 02,04,16; INV-01/03/05 | G01/G11; M01/M11 |
| R02 Company-only executable apps forever | 02,08,09,14,19; INV-02/06 | G06/G07; M06/M07 |
| R03 Independent web package lifecycle | 08..10; INV-04/06/12 | G06..G08; M06..M08 |
| R04 Shared desktop continuity and accessibility | 05..07; INV-05/09/14 | G03/G09/G10; M03/M09/M10 |
| R05 Isolated apps and bounded privileges | 07,11,14; INV-07 | G03/G04/G10; M03/M04/M10 |
| R06 Single login, protected secrets, session switching | 12; INV-08/11 | G05; M05 |
| R07 Existing API authority, safe writes/conflicts | 04,11,12; INV-03/10 | G04/G09; M04/M09 |
| R08 R2 catalogue/distribution, fewa_demo staging-only reuse and /v1/dental-os OS routes | 09,14; INV-02/06/12 | G07; M07 |
| R09 Safe activation, dirty work, rollback and revocation | 10; INV-09/12 | G08; M08 |
| R10 OS-only durability and online-dependent privacy | 13,14; INV-10/11 | G02/G10; M02/M10 |
| R11 App-contained failure and actionable recovery | 07,15; INV-10/12 | G03/G10; M03/M10 |
| R12 Bounded operational diagnostics/resource management | 15; INV-11/13 | G10; M10 |
| R13 No direct app-to-app system | 11,19; INV-05/07 | G04/G09; M04/M09 |
| R14 Platform release/update and supported-host proof | 10,16,18; INV-12/13 | G11; M11 |
| R15 Honest baseline, decisions and acceptance evidence | 20,21; INV-10/13 | G01 and every milestone |

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

R07 retains existing business routes and SaaS authority. R08 includes the canonical [staging/resource/namespace policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). M04/M05 bind transport/identity to verified staging resources; M07 records catalogue/resource mapping; M08 covers update metadata; M09 verifies existing Dental SaaS/Super Admin clients remain compatible. G11 does not authorize production promotion. These are planned acceptance requirements, not executed backend proof.
