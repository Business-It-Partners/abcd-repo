# M06 Verification Evidence — Verified packages and local lifecycle

**Milestone verification:** Linux checks pass; Windows CI pending. G06 / R02 / R03 / R15. User visual acceptance pending; no production release claim.

## Source and environment

Baseline main `b24e3591586aa1d950d8367ba193c4ea09cd7dfb`; branch codex/milestone-06. [Source hashes](evidence/tested-source-sha256.json) identify the exact tested runtime/tool/fixture/test tree before checkpoint commit. [Linux metadata](evidence/linux-run.json) records host/Node/npm and bounded private-profile policy. No real account, patient data, production key or backend was used. Original Flutter reference remains local-only.

## Linux executed checks — 2026-10-16

Each job ran sequentially with resource preflight, nice 10 and timeout; Vitest had one worker. All final commands exited 0.

| Command | Result | Retained proof |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=default --reporter=json --outputFile=artifacts/m06-unit.json` | 142 tests, 9 files pass | [log](evidence/unit-linux.log), [JSON](evidence/m06-unit.json) |
| `npm run build` | typecheck, Vite and Electron compile pass | [log](evidence/build-linux.log) |
| `node tests/packages-crash.mjs` | 8 abrupt process-exit/restart checkpoints pass | [report](evidence/linux-packages-crash.json), [log](evidence/crash-linux.log) |
| `node tools/run-ui-test.mjs tests/packages.mjs` | 8 installed-package runtime cases pass | [report](evidence/packages-verification.json), [log](evidence/packages-ui-linux.log) |
| `node tools/run-ui-test.mjs tests/runtime.mjs` | existing native composition/isolation/crash/Genie/cleanup cases pass | [report](evidence/runtime-verification.json), [log](evidence/runtime-linux.log) |
| `node tools/run-ui-test.mjs tests/sdk.mjs` | existing sender/grant/SDK/API fixture cases pass | [report](evidence/sdk-verification.json), [log](evidence/sdk-linux.log) |
| `node tools/run-ui-test.mjs tests/identity.mjs` | existing identity/session/privacy cases pass | [report](evidence/identity-verification.json), [log](evidence/identity-linux.log) |

## Gate bindings

R02/G06: known-key signature and publisher/app allowlist; unsigned/modified metadata and payload/assets, unknown IDs/keys/publisher, schema/SDK/API mismatch, capability escalation and identity mismatch negatives. R03/G06: portable path/device/ADS/traversal negatives, no links/special types, count/file/total/wire limits; disk capacity refusal and ENOSPC extraction fault; monotonic versions/retention limits; live/concurrent owner refusal; corrupt registry/journal; installed tamper/missing/extra/hardlink/junction and cleanup containment. First install and update logical interruption matrix plus real process exits prove dead-owner recovery at journal, asset-write, extraction, publish/commit and uninstall phases. Active pointer determines recovery; no app executes before launch revalidation. Installed fixtures bind actual broker identity/grants; runtime tampering blocks only the affected launch. Pinned lease blocks uninstall; uninstall preserves another app and unrelated fixture marker (no SaaS operation exists).

R15: exact source hashes, commands and structured outcomes retained. Superseded failures remain: [first typecheck](evidence/build-first-failed.log), [first crash-recovery case](evidence/crash-first-failed.log), [first UI harness attempt](evidence/packages-ui-first-failed.log). Corrections and limits are recorded in [implementation notes](IMPLEMENTATION_NOTES.md). Earlier passing format tests are [retained](evidence/unit-first.log), superseded by the full final suite.

## Windows and acceptance limits

Required Windows Actions source/run/artifacts will be recorded before VERIFIED/main integration. Physical Windows/device visuals remain deferred until after M11 and before final release. No real filesystem fill, sudden power cut, physical ACL/antivirus behavior, production signing/distribution or full Store/update-policy acceptance is claimed. ENOSPC fault injection is not a claim that the host disk was exhausted. Runtime samples are private fixtures; normal policy remains empty/fail-closed. Remote freshness/delivery and full update/revocation/rollback remain M07/M08.
