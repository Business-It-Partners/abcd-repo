# Dental OS — Store and Cloudflare Distribution

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Use a dedicated R2 release bucket separate from patient media/backups, and distribution routes in the existing Cloudflare backend. This is an extension to the SaaS platform, not a duplicate business service. No remote resources are provisioned by this documentation task.

## Control and delivery

The catalogue resolves approved app IDs, immutable releases, channels, platform/SDK/API compatibility, entitlements, withdrawn versions, and minimum-safe versions. Desktop checks metadata authenticity/freshness before selecting an install. Use signed metadata with expiry/sequence controls and a defined clock/error policy; HTTPS alone does not prevent replay of previously valid metadata.

User-directed initial platform milestone policy: a dedicated public staging R2 release bucket carries signed, non-sensitive company sample packages through M11. Catalogue and install policy remain authenticated; public bytes do not grant installation or business access. No patient media, credentials or private build inputs belong there. Private bucket/authorized short-lived download setup is deferred to the separate dental-application delivery. Bucket credentials never enter desktop apps. Download URLs are scoped, redacted from diagnostics, and not credentials for arbitrary R2 paths. R2 S3 presigned URLs and custom-domain delivery have different behavior; do not assume they are interchangeable.

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

## M07 wire contract and local implementation

New GET routes are `/v1/dental-os/catalogue` and `/v1/dental-os/install-policy`; no query parameters or publisher mutation endpoint. Both resolve the existing Firebase/Worker clinic actor; install-policy returns exactly `{environment:"cloudfare-staging",canInstall:boolean}` and only clinic `admin` gets true. Doctor/reception users may read catalogue and use installed apps within ordinary business authorization. Transport/download visibility never confers installation or business permission. The additive backend patch is staged in a separate fewa_demo worktree, not deployed by documentation or CI.

Catalogue v1 is canonical JSON `{catalogue,keyId,signature}` using the same canonical serialization as dentalpkg/1. Ed25519 signs canonical `{purpose:"dental-os-catalogue",keyId,catalogue}`. Catalogue fields are exactly format 1, environment `cloudfare-staging`, channel `staging`, strictly positive integer sequence, issuedAt/expiresAt epoch milliseconds and at most sixteen unique releases. Maximum body is 64 KiB; lifetime at most 24 hours; issue clock tolerance five minutes; expired metadata is rejected. Authenticated catalogue responses include x-dental-os-time epoch milliseconds from the live Worker; missing/invalid time or more than five minutes of device/server skew refuses selection. Verify expiry against the later server/local time, so rewinding the device clock cannot make an expired network catalogue fresh. Persist sequence, full-envelope SHA-256 and highest observed local time before enabling selection. Refuse lower sequence, changed bytes at the same sequence, and clock rollback beyond tolerance. Lost/corrupt watermark requires recovery; it is never silently reset. Metadata authenticity does not claim to defeat administrator deletion of all OS state.

Release fields are exactly id/title/description/version/notes/capabilities/platforms/sdkMajor/apiMajor/objectKey/packageSha256/packageBytes/payloadDigest/status/minimumVersion. Only platform-approved company IDs/key grants are accepted. SDK/API majors are 1, hosts Windows/Linux, versions follow dentalpkg/1, status approved/withdrawn; unsupported or withdrawn releases cannot install. Object key is exactly `releases/<id>/<version>/<wire-SHA256>.dentalpkg`. Signed catalogue binds full wire hash/size as well as dentalpkg payload digest; both are checked. No arbitrary URL, header, bearer token, disk path or script can be supplied by an app/renderer.

Main process pins a single separately configured HTTPS public origin (no path, credentials, query, fragment or custom port). It constructs the object URL from the signed key, omits all credentials, refuses redirects, limits bytes and total time and streams observable download progress. Catalogue and policy use only the fixed staging API and main-owned credential. Before registry activation, fetch fresh signed metadata and current admin policy again; refuse changed/withdrawn releases and stale session generations. One operation runs at a time; cancellation/session change stops before commit, no hidden resume/write queue. Ready follows registry success. Cache no patient facts or bearer tokens.

Normal Store uses trusted installed/catalogue state. Old Store simulation is retained only for private prototype regressions. M07 installs new apps; live update scheduling, full revocation/minimum-version launch enforcement, rollback and retention eviction remain M08. Running app lease blocks uninstall; user closes its shared window first. Catalogue failure never removes installations. Display installed fallback entries and safe status without provider URLs/tokens. At M07, the staging key authorized two company sample IDs and the public origin was not yet configured. The scoped M11 amendment in [ADR-023](20_V1_ADR_REGISTER.md#adr-023--signed-first-party-app-onboarding-within-the-shipped-company-trust-ceiling) permits new `company.*` IDs from fresh signed catalogue/update policy within the platform-shipped company capability ceiling; third-party publishing and arbitrary sideload remain prohibited. The existing Cloudflare staging origin is pinned and the `company.sample.preview` sequence 12–14 evidence is recorded in M11.

The operator prepares deterministic signed bundles outside the source tree with an external mode-0600 staging signing key, then validates release hashes before publication. Package object writes use atomic `If-None-Match: *`; matching existing bytes may be reused, collisions refuse. Catalogue replacement uses current ETag (`If-Match`) and a strictly increasing sequence; no blind pointer overwrite. No release private key is committed or shipped. Public staging downloads are non-sensitive sample code only. [Cloudflare public bucket policy](https://developers.cloudflare.com/r2/buckets/public-buckets/) limits r2.dev to non-production use; [conditional writes](https://developers.cloudflare.com/r2/api/s3/api/) provide atomic object creation/pointer guards. Staging signing key rotation requires a reviewed platform trust update, higher catalogue sequence and explicit operational authorization; unsupported keys fail closed.

Staging samples request platform-local capabilities only; appointment read/write grants are excluded until M09's actual SaaS integration proof. Their workflow UI stays explicitly synthetic. Private legacy SDK fixtures retain their controlled synthetic API behavior. No live business operation is exercised as part of M07 package delivery.
