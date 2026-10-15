# Dental OS — Local State and Offline Policy

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

| State | Initial policy |
| --- | --- |
| Verified packages/registry/journal | durable device-local OS storage |
| Window geometry/preferences | bounded durable presentation state |
| Remembered login | protected host storage only |
| Patient/API responses and previews | memory-only, session-scoped by default |
| Patient media | no persistent cache by default |
| Unsubmitted forms | in-memory continuity while runtime remains alive |
| Offline business writes | no queue or local authoritative commit |

Online-dependent means business requests require the existing SaaS. Shell and installed assets can open offline, but authentication validation and business readiness must remain explicit. DNS/reachability signals are advisory, not proof the Worker operation can succeed.

Read-only stale memory data must be labeled and protected on lock/logout. Disable submission when it cannot be completed safely; reconnect requires freshness/revision checks. Never claim an offline payment was saved. Preserve original request identities for ambiguous network outcomes.

No local clinical DB, sync/conflict engine, background business outbox or automatic persistent patient cache. Persistent draft recovery is a future explicit product/privacy decision, not implied by normal window continuity.

Deny or disable unintended renderer persistence, HTTP/disk caches, service-worker caches, autofill and diagnostic capture according to the runtime policy. Verify actual disk behavior with canary data: an in-memory React store alone does not prove privacy. Downloads/exports are explicit user operations with declared file lifetime, not hidden cache.
