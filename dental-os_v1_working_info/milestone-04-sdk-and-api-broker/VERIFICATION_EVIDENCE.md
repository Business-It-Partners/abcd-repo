# M04 Verification Evidence — Internal SDK and API boundary

**Verification:** VERIFIED — automated Linux/Windows fixture scope. User acceptance pending.

## Source and environment

Branch codex/milestone-04 from main `f904aa9f`. [Tested-source manifest](evidence/tested-source-sha256.json) identifies the final host, SDK, preload, samples and test inputs. Node/Electron/Playwright/Vitest remain locked by the existing package lock. Linux x64, private headless GNOME/Wayland/software rendering and disposable profiles; no live desktop focus/restart.

## Executed commands and outcomes

- `nice -n 10 timeout 90s node node_modules/vitest/vitest.mjs run --maxWorkers=1`: 64 tests / seven files pass; [unit log](evidence/unit.log). SDK boundary/transport tests include actual ephemeral loopback HTTP fixtures, not a live SaaS call.
- `nice -n 10 timeout 120s npm run build`: typecheck/build pass; [build log](evidence/build.log).
- `nice -n 10 timeout 240s node tools/run-ui-test.mjs tests/sdk.mjs tests/runtime.mjs tests/runtime-dpr.mjs`: sequential private SDK and M03 interaction/crash/hang/DPR regressions pass; [private log](evidence/private-runtime.log).
- A final SDK-only private run corrects the capture presentation; its log/screenshot are retained with the final evidence.

G04/R05/R07/R13: forged sender/frame/origin/connection and stale generations rejected; compatible/incompatible handshake; strict schemas, oversize/unknown URL/header/channel/operation denial; differing sample capabilities; unchanged staging appointment routes/method/body/idempotency headers; 401/403/409/422/503; redirects refused without second request; malformed/oversized/streaming responses; deadline/cancellation, global/per-app limits, single credential acquisition; unknown dispatched write outcomes; original-key replay with one synthetic server mutation; changed-body key reuse and duplicate pending writes refused; close/reopen revocation and old-session result suppression; no credential getter/raw IPC/fetch in app bridge. Error messages do not echo server bodies or exception details. Unit tests project away unknown response fields.

[SDK integration](evidence/sdk-verification.json) and [M03 runtime regression](evidence/runtime-verification.json) record exact cases/platform. [DPR report](evidence/runtime-dpr.json) supplements capture. Native-aware SDK screenshot is inspected before closeout. Scoped lifecycle and preferences are exercised; native print/export explicitly unavailable, notification is a caller-presented receipt.

## Staging boundary

[Implementation mapping](IMPLEMENTATION_NOTES.md) records source-verified staging branch/GitHub environment/Worker/Firebase/D1/R2/workflow. Broker rejects all differing/mixed/production/unconfigured distribution bindings. Trusted local HTTP adapter asserts the original staging destination before forwarding synthetic traffic to ephemeral 127.0.0.1; no fixture contacts staging/production. No backend edits/deployments or existing-client changes; web-client regression execution is unnecessary because backend/shared web configuration was untouched. Source mapping is not authenticated/live-resource acceptance.

## Failed runs, resources and remaining gates

[Initial unit collection failure](evidence/unit-initial-failure.log) and [typecheck failure](evidence/build-initial-failure.log) retain the unsupported test helper diagnosis; final passing runs supersede them. No failed production request/data was used.

Resource preflight found adequate memory and no stale task-owned job. All heavy work sequential, bounded, low priority and one test worker. Private app/compositor/servers closed; no unrelated process terminated. No live OS reload.

Windows CI passed; G04 is closed for the declared fixture scope. Physical Windows interaction remains deferred under the approved policy; real Firebase login/token protection is M05, real SaaS operations M09. No third-party apps or production package trust is claimed.


## Windows and integration closeout

[Windows run 38842666568](https://github.com/Business-It-Partners/dental-os/actions/runs/38842666568) passed at `672a81180336b535d90ee9c2d92917354dc1c6e5` (`checkpoint/m04-ci`). [Metadata](evidence/windows-ci/run.json), [unit results](evidence/windows-ci/windows-unit.json), [build](evidence/windows-ci/windows-build.log), [SDK integration](evidence/windows-ci/windows-sdk.json), [runtime regressions](evidence/windows-ci/windows-runtime.json) and [host recovery](evidence/windows-ci/windows-host-ci.json) are retained. Windows: 63 tests passed, one POSIX-specific skip, zero failures; all hosted SDK/runtime/host checks pass. Documentation/source-only closeout preserves the tested runtime file hashes. Normal merge into main retains milestone branch/checkpoint; no deployment or physical-device certification. User authorized continuing directly to M05 after this integration.
