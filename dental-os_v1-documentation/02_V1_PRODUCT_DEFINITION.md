# Dental OS — V1 Product Definition

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Dental OS is a production desktop operating environment built with Electron, React, and TypeScript for Windows and Linux. It hosts only company-controlled dental applications, independently installed and updated through a controlled catalogue.

## User promise

Sign in once; open permitted installed apps; switch without unexpected loss; understand loading, failure, and uncertain results; install and update safely.

## Included platform scope

- Shared shell, windows, dock, overview, scoped dialogs, accessibility, preferences, and session continuity.
- Isolated web-app runtimes, a versioned internal SDK, and controlled host/API brokers.
- Verified web packages, local installation registry, Cloudflare release catalogue and R2 distribution, independent updates and uninstall.
- Existing Firebase identity and Dental SaaS Worker authorization; protected credential handling.
- Bounded local OS state, online-dependent business access, diagnostics, recovery, Windows/Linux distribution and release evidence.

## Permanent first-party boundary

Only our company may develop/control, approve, and publish executable apps into Dental OS. Third-party publishing, public extensions, arbitrary sideloading, and a public developer marketplace are excluded for the lifetime of this product, not deferred to a future version. Reviewed libraries and deliberately integrated external services are allowed under company responsibility.

## Business authority

Reuse the existing Dental SaaS APIs and backend. Add required desktop/distribution APIs inside that backend under a separately scoped implementation change. No competing local business authority is introduced. Installed app availability is not permission to access business data.

Brand/display names may evolve; the repository path is not a required product name.

## Backend development boundary

Reuse `fewa_demo/dental-saas` and `fewa_demo/super-admin` infrastructure and existing GitHub/Cloudflare setup. All roadmap backend work targets verified Cloudflare staging only, preserves existing SaaS/Super Admin behavior, and excludes production changes. New OS services use `/v1/dental-os/...`; existing business APIs retain their routes. See the [canonical staging/resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).
