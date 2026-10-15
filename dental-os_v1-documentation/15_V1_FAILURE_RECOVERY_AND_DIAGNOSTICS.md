# Dental OS — Failure Recovery and Diagnostics

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

| Failure | Required response |
| --- | --- |
| App crash/hang | app-scoped failure, bounded restart option; do not lose shell authority |
| Package invalid/incompatible | reject activation/launch; retain evidence and working compatible version |
| Install/update interrupted | journal-based deterministic reconcile; no half-ready registration |
| Backend unreachable | show unavailable state; retain supported in-memory drafts |
| Write response lost | unknown outcome, reconcile original operation identity |
| Session expired/revoked | safe refresh or reauthentication; block unauthorized calls |
| Disk full/local state corrupt | stop unsafe operation, preserve evidence; no silent registry reset |
| Platform update required | clear explanation, dirty-work handling and controlled restart |

Local state schemas need tested migrations and failure handling. Never delete suspect state merely to make startup green. Retained-version rollback and registry repair require bounded disk and compatibility rules.

Logs are rotated, size-limited, redacted and correlated with platform/app versions and operation IDs. Default logs exclude tokens, passwords, download signatures, patient payloads, screenshots and clinical notes. Export of support diagnostics is an explicit action with safe preview/policy. Operational telemetry requires a defined minimum-data policy, not an automatic requirement for patient-data collection.

Supervise actual runtime health; a painted window is not proof an app is operational. Bound crash loops, handles, listeners, GPU snapshots and background requests. User-facing recovery must be actionable and distinguish a local runtime failure from a server outage.
