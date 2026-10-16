# M09 Implementation Notes — Integrated OS and SaaS contract proof

## Implemented boundaries

- `electron/main.ts` selects real staging transport for the normal host; synthetic transport and one-shot response-loss injection require private trusted test mode.
- Runtime/broker project pending/unknown write state independently of app reports. Both ordinary shell close and native layout removal refuse unresolved writes; update-now also refuses. Original operation identity remains in app memory until explicit reconciliation.
- Session reset closes views, invalidates connections, rotates in-memory partitions and erases former storage/cache asynchronously. No prior account partition is reused.
- Delivered sample alpha has named appointment read/write operations, beta read-only. Date/record selection, server revision, explicit same-key reconciliation and conflict handling demonstrate existing APIs. No patient DB, offline queue or app-to-app channel.
- Host/app spellchecking and session dictionary languages are disabled to prevent unnecessary Chromium dictionary download/cache. An initial strict raw-password disk canary matched static dictionary bytes; retained failure/investigation precedes the fix, with no ignored canary exception.
- Backend SYS-0007 operator helper uses existing clinic staff and appointment APIs, unique synthetic ownership and crash-safe external journals. Only owned fixture cancellation/inactivation is allowed; audit and command receipts remain. No deployed Worker/business/schema change.

## Verification and deviations

See verification evidence for local, actual staging and Windows outcomes. Initial operator XDG authentication isolation and incorrect staff route were fixed before business mutation. Published release bytes are immutable; interrupted acceptance resumes original operation keys and verifies the unchanged base catalogue, or uses higher sequences/new versions. Physical Windows acceptance stays after M11/before release. Complete dental application UI remains a separate delivery.

Electron session spellchecker controls: [official API](https://www.electronjs.org/docs/latest/api/session). Runtime verification showed the window preference alone did not stop dictionary download; disabling session languages as well removed the static dictionary/cache matches without excluding any file from the privacy scan.
