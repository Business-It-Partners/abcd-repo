# M05 Verification Evidence — Single login and protected sessions

**Verification:** Linux/local/live-staging passed; hosted Windows pending. User acceptance pending.

## Source/environment

Branch `codex/milestone-05` from main `4ad8e32f`. [Tested-source manifest](evidence/tested-source-sha256.json) binds final code/test inputs; [dependency/runtime versions](evidence/versions.json) are retained. Live checks ran against this uncommitted implementation based on that commit; old base SHA in live report is not an assertion of a clean tested base tree. Manifest identifies implementation bytes. Linux x64 private headless GNOME/Wayland/software rendering, disposable profiles and unavailable/basic_text key store; no user's live application was restarted/focused.

## Commands/outcomes

| Command | Result | Evidence |
| --- | --- | --- |
| `nice -n 10 timeout 90s node node_modules/vitest/vitest.mjs run --maxWorkers=1` | 77 tests/eight files passed | [unit log](evidence/unit.log) |
| `nice -n 10 timeout 120s npm run build` | final typecheck/build passed | [build log](evidence/build.log) |
| `nice -n 10 timeout 300s node tools/run-ui-test.mjs tests/identity.mjs tests/sdk.mjs tests/runtime.mjs tests/runtime-dpr.mjs tests/host-state.mjs tests/native-session.mjs` | all six focused suites pass sequentially | [private regressions](evidence/private-regressions.log) |
| final private identity-only rerun after clearing account form/adding Exit | passed | final log/screenshot retained below |
| `nice -n 10 timeout 90s node tools/verify-staging-identity.mjs --staging-identity-readonly` with approved temporary credential file | nine real staging identity checks pass | [live report](evidence/identity-staging.json), [safe log](evidence/live-staging.log) |
| `nice -n 10 timeout 120s node tools/run-ui-test.mjs tests/identity-staging.mjs` with explicit approved staging flags/file | actual private desktop login/lock/logout passes | [desktop report](evidence/identity-staging-desktop.json), [safe log](evidence/live-desktop.log) |

The live runner targets only mapped Firebase/Worker identity endpoints and a denied read-only Super Admin tenant endpoint; no business writes or global user revocation. Credentials never enter command arguments, tracked files or evidence. Temporary credential files and private profiles were deleted.

## G05/R06/R07 proof

- Real Firebase sign-in plus real Worker `/v1/me` establish readiness; refresh and fresh Worker resolution preserve clinic context. Invalid ID token and invalid refresh grant are refused. The approved clinic identity receives 403 for Super Admin tenants. Operation denial rechecks valid clinic access without granting platform authority. Local sign-out clears authority/credentials; signed-out generation cannot obtain a credential.
- Actual private desktop normal/staging mode starts gated, signs in against the real services, locks with cleared context/new generation and returns to sign-in on logout. No web login configuration or running browser session was modified.
- Controlled unit/private fixtures cover disabled/missing membership, unavailable provider/Worker, incompatible project/audience, malformed/oversized/redirect responses, stalled calls, concurrent sign-in, single-flight refresh and token rotation, revoked refresh/membership, old pending login after logout and stale in-flight write/account switch. Real user disabling/outage induction was deliberately not performed; these negatives are explicitly fixture evidence.
- [Private identity report](evidence/identity-verification.json) proves absent desktop/previews while signed out, disabled remember-me on inadequate storage, owner-only app SDK, lock destroying native contents, no stale draft/connection/capture crossing users and logout cleanup. [M03](evidence/runtime-verification.json), [SDK](evidence/sdk-verification.json), [DPR](evidence/runtime-dpr.json) and [native continuity](evidence/native-session-verification.json) regressions pass.
- Storage tests verify ciphertext-only refresh persistence, no password/ID-token record, rotation/clear, corrupt/symlink rejection and session-only behavior on unavailable/failing encryption. A bounded disposable-profile scan found no plaintext synthetic password/refresh markers. This is targeted credential privacy evidence, not a complete disk-forensics certification. Native secret-provider classification is recorded; Linux basic_text was rejected. Actual adequate native-provider roundtrip is probed where available in hosted Electron.

## Failures, resource control and remaining boundaries

[Initial typecheck failure](evidence/build-initial-failure.log) came from an always-true test helper condition; corrected. [Initial 76-test run](evidence/unit-initial.log) predates the added membership-recheck case; final 77-test run supersedes it. Intermediate and final successful logs remain distinct.

All heavy operations were sequential, low priority and bounded; one test worker. Preflight found adequate available memory/no owned stale loop. Private apps/compositors/HTTP fixtures completed and were cleaned; Brave and the live OS remained intact. No backend/cloud configuration or deployment.

Hosted Windows must pass before G05 closeout/merge. Physical Windows and positive GNOME/KWallet device behavior remain after M11/before release; no production certification. Broader UI/application privacy and real business integration remain later milestones. Stop after M05; M06 is not authorized.
