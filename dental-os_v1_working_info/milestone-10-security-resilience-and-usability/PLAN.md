# M10 Plan — Security, resilience and usability

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M09](../milestone-09-integrated-os-and-saas/PLAN.md)
**Requirements:** R05, R10, R11, R12, R15
**Exit gates:** G10
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Close production risks across trust, privacy, failure recovery, accessibility and resource use.

## Deliverables and scope

- Threat-model review, key lifecycle procedures, redacted bounded diagnostics and support export policy.
- Disk/cache/snapshot privacy controls, corrupt-state repair and runtime failure recovery.
- Accessibility/keyboard/reduced-motion/compact layout assessment and bounded resource/soak profile.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [ ] Run package/IPC/network escape negatives and disk canary checks across login/logout/cache/crash paths.
- [ ] Test app hangs/crash loops, backend outages, uncertain writes, corrupt journal, sleep/resume and low capacity.
- [ ] Verify keyboard/focus/screen-reader semantics, contrast, scaling, motion fallback and many-app resource behavior against stated budgets.

## Scope exclusions

No claim that signing/sandboxing defeats a compromised host administrator; no silent patient telemetry or reset-to-green data deletion.

## Baseline to reconcile

Define measurable resource budgets and supported assistive configurations before verification; sampled contrast is not full accessibility acceptance.

## Ownership and integration rules

Platform changes stay in trusted Electron/SDK/runtime boundaries and shared shell ownership. Backend work belongs in the separate existing SaaS project with its own instructions and explicit change record. Do not perform remote provisioning, production mutations, commits/pushes or deployment through this plan alone.

Use synthetic or approved staging fixtures. UI automation must run through the private runner; never restart/focus the live OS for verification. Run relevant build/unit checks for code changes and only necessary focused UI suites. Documentation-only changes use link/structure/traceability validation; runtime checks cannot certify prose or unimplemented services.

## Evidence requirements

Record command, source/tree identity, build/dependencies, host/display/profile, actual outcome and redacted retained artifacts. Missing platform evidence remains explicit. Proposed commands and previous Flutter/prototype results are not milestone verification. Technical completion and user acceptance are separate.

## Mandatory backend/staging boundary

Reuse existing `fewa_demo` Dental SaaS/Super Admin repositories, GitHub environments/workflows and Cloudflare resources under the [canonical backend policy](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). Any backend change or remote integration must target verified **Cloudflare staging-only** resources. Record the exact branch, GitHub environment/workflow, API base, Firebase project, Worker/D1/R2 bindings before that work; do not guess names or use production credentials/fallbacks.

New OS-specific services use `/v1/dental-os/...`; existing dental business and identity routes are reused unchanged. Changes must be additive, preserve existing Dental SaaS/Super Admin behavior, and include existing-client regression evidence when shared backend/configuration changes. Production changes/promotion require separate explicit authorization. This plan and documentation amendment authorize no backend edits, provisioning or deployments by themselves.

## Windows verification scope

Use the [approved deferred-device policy](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md): Linux checks plus applicable Windows GitHub Actions evidence during milestones; physical Windows interaction/visual checks after M11, before final release. Record remaining device scenarios separately; CI success is not physical-device certification.

## Detailed M10 execution contract — 2026-10-16

Start from verified M09 main bd0cea01 on codex/milestone-10. No new cloud deployment or business API change is planned. Work is authorized through M10; M11/final physical acceptance remain separate.

1. Threat review maps package/signature/IPC/caller/network/identity/write controls to actual tests and explicit residual risks. Strengthen signed JSON byte canonicality; reject malformed UTF-8 rather than accepting replacement decoding. Keep no arbitrary apps, native channel or authenticated fetch.
2. Add fixed-schema bounded OS diagnostics only: fixed event codes, target enum and time; no messages, exception text, URLs, account IDs, operation IDs, API payload, screenshots or drafts. Ring <=256 records, each file <=32 KiB plus one atomic temporary; private modes and symlink/corruption refusal. Diagnostic failure must not block workspace or destroy suspect bytes. Explicit support preview and native save action, no network upload.
3. Bound restart loops at three failures in 60 seconds per sample. Never auto restart. Clear failed runtime image/preview, fence late capture completion; keep another app and shell usable. Clear zero-count executable leases. Ordinary host close/quit must refuse pending/unknown writes before disposing identity/runtime. Explicit lock/logout still prioritize privacy; forced process termination cannot guarantee draft/outcome survival.
4. Preserve corrupt OS/package/journal evidence, expose safe recovery guidance/support export and exact local-folder discovery. No silent reset, registry repair guesses or clinical deletion. Test corrupt-state preservation and repair by restoring a known-good OS-only fixture after clean shutdown. Existing journal recovery/low-capacity unit/process-exit matrices remain regression gates.
5. Make package capabilities readable in Store, preserve quiet styling; verify semantic labels, keyboard dialog focus trap/escape, 200% zoom at 1366x768, 1024x768 compact host, reduced motion and scoped failures. This is automated semantic/geometry assessment; named physical Windows and actual assistive-device evaluation remain post-M11 acceptance, no blanket WCAG certification.
6. Freeze resource proof before execution: two simultaneously installed/native sample apps plus shared shell, ten bounded app open/close cycles and a 60-second idle/foreground-switch sample. <=2 native app views; no leaked views after closes/lock; <=2 GiB aggregate working set, <=160 MiB growth from warmed baseline to last sample, <=12 OS processes. Report actual peaks and CPU samples rather than imposing brittle hardware-independent CPU timing. No claim that this proves arbitrary app count or long clinic-day soak. Multi-hour device soak remains named physical/release follow-up.
7. Controlled full unit/build, affected private hardening + integrated/runtime/identity checks and applicable Windows CI. Retain failures and exact source/metrics/redacted artifacts. Close G10 only for declared V1 platform envelope, checkpoint/normal main merge with matching source. Stop after M10; no M11 release work without its authorization.
