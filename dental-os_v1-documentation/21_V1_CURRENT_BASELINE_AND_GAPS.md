# Dental OS — Current Baseline and Gaps

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

**Inspection date:** 2026-10-15. This is a source/document inspection, not a fresh execution of runtime tests.

| Area | Current reality | Production gap / milestone |
| --- | --- | --- |
| Host | electron/main.ts and preload.ts; narrow controls/capture; single-instance/native-transition code | authenticated startup, OS state journal/recovery, adapters: M02/M05 |
| Shell | src/windowManager.tsx, ManagedWindow.tsx, dock/motion/overview | isolated runtime composition/privacy/dirty-state contract: M03/M09 |
| Apps | src/*App.tsx; synthetic in-memory workflows/placeholders | independent packages, SDK/API integration: M04/M06/M09; module contents separate |
| Store | src/StoreApp.tsx, src/storeArrival.ts; session simulated install/update/uninstall | signed packages, real R2/catalogue, durable registry and updates: M06..M08 |
| Local state | app/session data mostly memory-only; current quit resets demo data | bounded OS-only durability, migrations, privacy verification: M02/M10 |
| SaaS | separate existing project has Firebase/Worker/API contracts | no production desktop integration established here: M04/M05/M09 |
| Evidence | WORK_CHECKLIST.md and artifacts/ contain prototype records | revalidate applicable behavior at exact milestone source; no automatic acceptance |

The local refrence/ Flutter tree is older than the advanced Git branch. Pattern reference: origin/codex/m08-pharmacy-engine at 314bebd5f45591e966eee2482c7f4a994e2a7564, especially fewa-os_v1-documentation/ and fewa-os_v1_working_info/. Its M08 evidence is pharmacy-engine evidence, not Dental OS evidence. Inspect remote objects without switching the active checkout.

Dental SaaS reference inspected at /home/master-x/Desktop/fewa_demo/dental-saas: docs/architecture/authentication-and-authorization.md, clinicAuth.service.ts and shared API client. It remains a separate project; this documentation task does not edit/deploy it.

Historical prototype refinements continue to be recorded in WORK_CHECKLIST.md. Its 'implemented' status applies to its stated demo scope only. New production milestones have their own evidence requirements.

## Staging-policy amendment

The user confirmed that `fewa_demo` Dental SaaS/Super Admin already have repositories, GitHub environments/deployment workflows and Cloudflare staging/production resources. Reuse that setup; all Dental OS backend work is staging-only. This confirmation does not establish exact current branch names, resource bindings or credentials: verify and record them before implementation.

New OS-specific services use `/v1/dental-os/...`, while existing business APIs remain unchanged. No resource inventory, backend edit, provisioning or deployment was performed for this amendment. See [backend policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

## M02 implementation reconciliation — 2026-10-15

The table above records the starting snapshot. M02 now implements strict OS-only preference persistence under userData/state, atomic pending-journal reconciliation, v0 migration, capacity/path protection, boot recovery presentation and bounded restore settling. The overview-shortcut preference is read on shell launch; business/demo records remain memory-only. No full installation registry, authenticated lock/session or production package runtime is implied. [M02 status and Windows verification gap](../dental-os_v1_working_info/milestone-02-host-and-os-state/STATUS.md) govern the current scope.


## M03 implementation reconciliation — 2026-10-15

Two fixed sample apps now use separate sandboxed renderers, origins and memory partitions through `electron/runtime/` and `src/RuntimeFixtures.tsx`, gated to private Linux tests/Windows CI. Foreground native content and inactive snapshots integrate with existing shared frames/dock/overview/Genie. Linux and hosted Windows G03 checks pass; physical-device testing is deferred. Ordinary demo apps remain unchanged outside the fixture mode. This is not installed production package execution, auth, SDK/API integration or store delivery. [M03 status](../dental-os_v1_working_info/milestone-03-isolated-runtime-and-shell/STATUS.md) governs the exact scope.


## M04/M05 reconciliation — 2026-10-16

M04 now implements a versioned bounded SDK/API broker with fixed staging binding, sender/frame/generation/capability enforcement, named appointment contract fixtures and preserved idempotency/revision semantics. M05 implements trusted Firebase/Worker clinic sign-in, renewal, protected optional refresh persistence, explicit session-only fallback and generation-fenced lock/logout/switch. Both pass applicable Linux/Windows automation; M05 also passed approved actual staging identity and private desktop sign-in checks. See their milestone evidence for controlled negatives and physical-provider limits. Normal launches now require staging sign-in; existing app workflows remain synthetic and installed package/runtime delivery is later work. No backend changes/deployment or production identity certification.

## M06 reconciliation — 2026-10-16

M06 introduces a real local verified package registry and transaction primitives, replacing direct fixture-source loading in the isolated sample runtime. Platform-bound signatures, safe extraction, immutable versions, launch-time disk revalidation, pinned memory assets, restart reconciliation and uninstall containment are implemented; exact acceptance is governed by [M06 evidence](../dental-os_v1_working_info/milestone-06-verified-packages/VERIFICATION_EVIDENCE.md). Production trust intentionally has no release keys/apps yet; signed samples are private-test-only. Store presentation remains synthetic, remote catalogue/R2 is M07 and complete update/rollback/revocation integration is M08. No cloud resources changed.
