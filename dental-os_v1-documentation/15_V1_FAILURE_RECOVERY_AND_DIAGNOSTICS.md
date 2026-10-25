# Dental OS — Failure Recovery and Diagnostics

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

| Failure | Required response |
| --- | --- |
| App or Store crash/hang | Contain failure to the guest surface; keep shell controls and session authority available; offer a bounded restart/reopen path and stop repeated crash loops |
| Shell renderer crash/hang | Detect and recover the shell renderer or recreate its surface while keeping trusted main-process session authority; show a usable recovery state if automatic recovery fails |
| Guest resource pressure | Reclaim managed Store/app renderer resources in a measured order, escalating to release all guest surfaces when needed; keep the shell, login/session services, and recovery surface available |
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

Under measured resource pressure, the platform may suspend or close Store/app guest renderers, including active guest surfaces when necessary to keep the platform shell healthy. Released Store/app content can be reopened. Keep shell controls, login/session authority, and recovery available. Explain when an app surface is released; do not promise restoration of unsaved business work unless that app provides and verifies its own recovery behavior. Resource thresholds and eviction order require source-bound measurement and pressure testing; documentation alone is not proof of implementation.

M10 concrete implementation and limits: [security/support/recovery procedure](../docs/SECURITY_AND_RECOVERY.md). Fixed-schema diagnostic events and explicit native export exclude arbitrary error payloads. Failed snapshots are cleared and late captures fenced; manual restart is bounded. Physical/multi-hour/assistive release evidence remains distinct.

**M15.8 Linux evidence:** the audit worktree now implements and privately verifies shell renderer crash/hang recovery, managed app crash/hang containment, Store/window content boundaries, and bounded app restart recovery. Resource-pressure eviction, exact-source Windows verification and broader M15 acceptance remain separate. See the [M15.8 evidence record](../dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md#m158-linux-shell-and-app-failure-containment).
