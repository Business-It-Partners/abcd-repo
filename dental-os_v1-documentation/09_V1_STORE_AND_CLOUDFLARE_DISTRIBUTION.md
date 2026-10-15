# Dental OS — Store and Cloudflare Distribution

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Use a dedicated R2 release bucket separate from patient media/backups, and distribution routes in the existing Cloudflare backend. This is an extension to the SaaS platform, not a duplicate business service. No remote resources are provisioned by this documentation task.

## Control and delivery

The catalogue resolves approved app IDs, immutable releases, channels, platform/SDK/API compatibility, entitlements, withdrawn versions, and minimum-safe versions. Desktop checks metadata authenticity/freshness before selecting an install. Use signed metadata with expiry/sequence controls and a defined clock/error policy; HTTPS alone does not prevent replay of previously valid metadata.

Initial delivery policy: private R2 with backend-authorized short-lived downloads. Bucket credentials never enter desktop apps. Download URLs are scoped, redacted from diagnostics, and not credentials for arbitrary R2 paths. R2 S3 presigned URLs and custom-domain delivery have different behavior; do not assume they are interchangeable.

Immutable release objects are never overwritten. Downloads resume only when content identity remains the same. Enforce package size, storage reserve and concurrency limits. Catalogue outage must not silently delete working installations; known revocations/minimum versions and metadata expiry follow explicit fail-safe policy.

## Store UX

Show identity, company publisher, purpose, installed/available versions, capabilities, release notes, compatibility and operation status. Distinguish downloading, verifying, installing, ready, failed, update-ready and unavailable. Installation policy belongs to clinic/device administration; user business access still comes from Worker authorization. No third-party submission or app development portal exists.

## Backend environment and resource policy — 2026-10-15

Reuse the existing `fewa_demo` projects (`dental-saas` and `super-admin`) and their established GitHub repositories, environments, deployment workflows, Firebase identity, and Cloudflare account/resources where appropriate. Do not create a parallel business backend, identity system or independent infrastructure project.

**All Dental OS backend implementation and remote integration work in this roadmap is Cloudflare staging-only.** Production branches, deployments, secrets, databases, buckets, identity settings and traffic must remain unchanged. Production promotion requires a separate, explicit user-authorized task; completing a milestone does not authorize it.

Before any backend implementation/deployment, record and verify the actual repository, checkout/branch, GitHub deployment environment, workflow target, Cloudflare account, staging Worker, D1 bindings, R2 buckets/prefixes, Firebase project and API base URL. Do not infer staging from a name or assume a branch name; environment identity must agree across configuration and deployment. No production credential may be used for these tasks. If the mapping is absent or inconsistent, stop remote changes until it is resolved. Documentation records safe identifiers/references only, never secret values.

Reuse existing infrastructure where safe. App releases require a dedicated staging R2 release bucket, or an already dedicated release bucket verified as staging-only, separate from patient media/backups and production storage. Resource creation is planned work, not performed or authorized by this documentation amendment.

Changes must be additive and compatible with both existing Dental SaaS and Super Admin staging clients. Preserve their API behavior, authentication and deployment configuration; use isolated synthetic fixtures and regression checks to show no disruption. Do not rewrite existing shared workflows or apply destructive migrations to accommodate OS work. Stage any necessary shared configuration extension explicitly and verify the existing clients still operate.

## API namespace contract

New OS-specific routes use **`/v1/dental-os/...`** in the existing backend. Candidate contracts are:

| Candidate route | Purpose |
| --- | --- |
| `/v1/dental-os/catalogue` | approved first-party apps and compatible releases |
| `/v1/dental-os/releases` | release/version/channel metadata |
| `/v1/dental-os/download-intents` | authorized short-lived package downloads |

These names establish the namespace, not implemented endpoints or frozen HTTP methods/schemas. M07 freezes the detailed contracts; update metadata extends this namespace in M08. Publisher/control operations must have their own explicit authorization and cannot inherit clinic-user access automatically.

**Existing dental business and identity APIs keep their current routes and server authority.** Do not rename or duplicate them under `/v1/dental-os`. Desktop apps reuse them through the broker. A URL prefix organizes services; it does not isolate deployments, establish app identity, grant authorization, or protect production by itself.

This policy governs backend/distribution resources, not a claim that Windows/Linux installers can never be released. Local/staging release certification is allowed by its own implementation task; public/production publishing and production backend promotion remain separate decisions.
