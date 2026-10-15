# Dental OS — System Architecture

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

```text
Windows / Linux
  -> Electron trusted host
       -> package manager / registry / verifier
       -> session manager / API broker / native adapters
       -> bounded storage / diagnostics / recovery
       -> React shell: desktop, shared windows, dock, overview
       -> isolated installed app webContents
            -> platform-owned preload + typed SDK
            -> API broker -> existing Dental SaaS Worker -> existing D1/R2

Company release pipeline -> signed metadata + immutable R2 packages
Existing Cloudflare backend -> approved release catalogue -> package manager
```

| Owner | Owns | Must not own |
| --- | --- | --- |
| Host OS | hardware, drivers, system accounts, native facilities | Dental OS workflow policy |
| Trusted Electron platform | verified installation, caller binding, sessions, controlled API/native access | competing business rules or data authority |
| React shell | windows, focus, navigation, lifecycle/status presentation | refresh secrets, package self-approval |
| App runtime | app-local UI execution and lifecycle | other app storage or shell privileges |
| App | content, forms, requests via SDK | raw IPC, arbitrary native code, server authorization |
| SaaS Worker | business authorization, clinic resolution, transactions and business audit | desktop window presentation |
| Distribution control plane | approved releases, channels, compatibility/revocation metadata | replacing clinic authorization |

Physical paths and dependency rules are defined once in the [canonical repository structure](../dental-os_v1_working_info/00_REPOSITORY_STRUCTURE.md); that target layout is not yet migrated.

These are logical boundaries, not a requirement for one process per service. Keep privileged handlers small; move heavy verification/extraction off the event loop when necessary. Architecture-level source locations are proposals until implementation records map them to actual files.

The API broker is a local transport/security boundary, not another network backend. CORS is not authorization; desktop transport must not weaken Worker checks.

## Existing infrastructure and deployment boundary

The backend/distribution control plane extends the existing `fewa_demo` Dental SaaS/Super Admin infrastructure. All backend development and integration in this roadmap target verified Cloudflare staging only. Confirm branch, GitHub environment, workflow and actual bound resources before remote changes; do not infer environment safety from a route prefix. Production remains untouched.

New OS services live under `/v1/dental-os/...`. Existing business/identity routes remain unchanged and are reused through the API broker. Additive changes must preserve both existing staging web applications. [Resource/deployment policy and mapping requirements](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md) are authoritative.
