# Dental OS V1 — Architecture Documentation

**Baseline:** 2026-10-15. User-authorized product constitution and engineering documentation; not a production implementation claim.

## Authority and reading order

This directory defines **what Dental OS is**. [The master roadmap](../dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md) defines execution order; [global status](../dental-os_v1_working_info/00_V1_STATUS.md) records current progress. Source code is implementation reality; retained verification evidence is proof. [WORK_CHECKLIST.md](../WORK_CHECKLIST.md) remains the active working contract and detailed prototype history; it must stay consistent with this architecture and milestone status.

Start with [Product Vision and V1 Contract](01_WHY_DENTAL_OS.md) for the complete product explanation. Then read invariants, architecture and current baseline; focused technical documents define enforcement rather than repeating the product story. Then use the topic index below. Only company-approved first-party apps are supported, permanently. Windows and Linux are the target hosts; existing Dental SaaS remains business authority.

## Repository organization

The [canonical repository structure](../dental-os_v1_working_info/00_REPOSITORY_STRUCTURE.md) defines the target physical tree, module ownership, dependency boundaries and incremental source migration. It is authoritative for placement; this architecture remains authoritative for behavior. Current `src/` and `electron/` have not been migrated.

## Documents

- [Product Vision and V1 Contract — start here](01_WHY_DENTAL_OS.md)
- [V1 Product Definition — compatibility pointer](02_V1_PRODUCT_DEFINITION.md)
- [Principles and Invariants](03_V1_PRINCIPLES_AND_INVARIANTS.md)
- [System Architecture](04_V1_SYSTEM_ARCHITECTURE.md)
- [M16 Files and local file acquisition — scoped architecture](../dental-os_v1_working_info/milestone-16-file-acquisition/ARCHITECTURE.md)
- [Boot and Workspace Lifecycle](05_V1_BOOT_AND_WORKSPACE_LIFECYCLE.md)
- [Shell and Desktop](06_V1_SHELL_AND_DESKTOP.md)
- [App Runtime and Isolation](07_V1_APP_RUNTIME_AND_ISOLATION.md)
- [App Package and Local Registry](08_V1_APP_PACKAGE_AND_LOCAL_REGISTRY.md)
- [Store and Cloudflare Distribution](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md)
- [Install, Update and Uninstall](10_V1_INSTALL_UPDATE_AND_UNINSTALL.md)
- [SDK and API Broker](11_V1_SDK_AND_API_BROKER.md)
- [Identity, Session and Authorization](12_V1_IDENTITY_SESSION_AND_AUTHORIZATION.md)
- [Local State and Offline Policy](13_V1_LOCAL_STATE_AND_OFFLINE_POLICY.md)
- [Security and Trust](14_V1_SECURITY_AND_TRUST.md)
- [Failure Recovery and Diagnostics](15_V1_FAILURE_RECOVERY_AND_DIAGNOSTICS.md)
- [Technology and Host Platforms](16_V1_TECHNOLOGY_AND_HOST_PLATFORMS.md)
- [Build Phases](17_V1_BUILD_PHASES.md)
- [Acceptance Gates](18_V1_ACCEPTANCE_GATES.md)
- [Non-Goals and Permanent Exclusions](19_V1_NON_GOALS.md)
- [Architecture Decision Register](20_V1_ADR_REGISTER.md)
- [Current Baseline and Gaps](21_V1_CURRENT_BASELINE_AND_GAPS.md)
- [Requirements and Traceability](22_V1_REQUIREMENTS_AND_TRACEABILITY.md)
- [Exact dentalpkg/1 format and local transaction contract](23_V1_PACKAGE_FORMAT.md)

## Documentation conventions

Requirements use must/must not; recommendations and candidate mechanisms are labeled. Accepted product direction does not mean implemented. Exact package wire formats, renderer composition and platform installers have explicit decision gates. No business-module feature scope is silently added here.

Architecture changes update affected documents, the ADR register, requirement traceability and milestone plans together. Do not copy archived Flutter instructions or acceptance claims into this active contract. This layout follows the newer Flutter documentation pattern while retaining Dental OS decisions.

## Backend amendment

[Distribution and backend policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md) requires reuse of `fewa_demo` resources, Cloudflare staging-only backend work, and `/v1/dental-os/...` for new OS services. Existing business APIs remain unchanged. No backend edits, resources or deployment are authorized by this documentation amendment.
