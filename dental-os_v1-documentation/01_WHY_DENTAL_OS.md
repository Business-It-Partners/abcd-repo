# Dental OS — Product Vision and V1 Contract

**Updated:** 2026-10-21. **Authority:** canonical product purpose, commitments and V1 boundaries. This is a target contract, not a claim of production readiness. Implementation and acceptance remain in the [global status](../dental-os_v1_working_info/00_V1_STATUS.md) and source-bound milestone evidence.

## Why this product exists

Dental OS gives dental clinics and professionals one dependable workspace for their clinical and business work: finding tools, recording and tracking work, moving between tasks, and receiving improvements through a controlled Store. Sign in once, open permitted installed apps, switch without unexpected loss, understand loading or uncertain results, and recover clearly from failures.

The central motivation is independent application improvement. Clinics give feedback about individual modules; the developer must be able to improve and release that app without rebuilding or reinstalling the desktop whenever its platform contracts remain compatible. A clinic finds the release in the Store, updates that app, and uses the new version on its next launch. Other applications and the desktop do not need to be replaced for that app release.

Dental OS is Abhishek's independent product. The separate Flutter/Rust FEWA OS work supplies engineering references, motivation and proven ideas; its company product contract, compiled-app model, local pharmacy engine and offline-first architecture are not Dental OS dependencies or requirements.

## What Dental OS V1 is

Dental OS is a hosted desktop operating environment built with Electron, React and TypeScript for Windows and Linux. The host OS continues to own the kernel, drivers, hardware, filesystem and native system facilities. Dental OS organizes first-party dental tools above it. Desktop appearance and motion support usability; resemblance to a general OS is not the acceptance criterion. Later platform versions may evolve in response to demonstrated needs and feedback; a replacement kernel is outside V1.

Only the product owner's organization may develop/control, approve and publish executable apps. Third-party publishing, arbitrary sideloading, public extensions and a public developer marketplace are permanently excluded. Reviewed libraries and explicitly integrated external services remain allowed under that organization's responsibility. “Company” in package metadata identifies this first-party publisher, not a separate external approval organization.

## Three responsibilities, one workspace

| Owner | Responsibility |
| --- | --- |
| Dental OS platform | Desktop, shared windows/dock/overview, isolated app execution, sign-in mediation, SDK/API broker, verified installation and updates, bounded OS state, diagnostics and recovery. |
| Dental apps | Independently built and delivered web packages containing feature UI, forms, app navigation and unfinished workflow state; requests use the approved SDK. |
| Existing Dental SaaS backend | Current user/clinic authorization, business validation, transactions, clinical/financial records, audit and private media through the existing Worker/D1/R2 infrastructure. |

The normal path is app → platform-owned preload/validated IPC → trusted API broker → existing Dental SaaS Worker → authorized clinic D1/private R2. The broker validates app access and mediates credentials and transport; the Worker independently authorizes each business request. Installed availability and UI visibility never grant business authority. Apps receive no unrestricted bearer-token access, direct database access or arbitrary host privileges.

Reuse the maintained SaaS feature implementation and assets through app-specific entries and an OS transport adapter. Avoid independently edited copies of the same feature for web and desktop. Each resulting package remains self-contained and independently versioned.

Business operation is online and API-dependent. There is no local authoritative business database, persistent patient cache or hidden offline write queue. Local executable packages, OS preferences, installation state and protected credentials are platform state, not a second clinical authority. Connectivity failures must distinguish an unavailable read from a write whose server outcome is unknown.

## Independent delivery and compatibility

Apps are approved, signed, self-contained web packages installed and updated through the controlled catalogue and Cloudflare delivery path. App packages cannot replace Electron, platform preloads or trusted host code. Platform installers and platform updates are separate from app updates.

Compatible feature changes should ship as app-only releases. New platform powers or unsupported SDK capabilities may require a platform release. Unsupported app releases must be refused clearly while preserving a usable installed version. A signature does not permit an app to grant itself privileges.

The exact manifest/capability rules belong to the [package contract](23_V1_PACKAGE_FORMAT.md), and request enforcement belongs to the [SDK/broker contract](11_V1_SDK_AND_API_BROKER.md). This consolidation does not add a route-list manifest field or approve remotely delivered API-route permissions. Current app-specific route-policy coupling needs an explicit design review against the independence promise; any revised mechanism requires its own decision and evidence.

## V1 app-update experience

Store Update downloads and verifies a separate candidate without closing, reloading or changing the running app. The Store reports Update ready — applies next time you open this app. After the user normally closes that app, its next full launch trials the candidate; a bounded startup-health check acknowledges success or recovers to an eligible known-good version. Focusing, minimizing or restoring an existing window is not a full launch. No automatic relaunch or live code injection is required.

The [install/update contract](10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) is the single authority for lifecycle states, dirty/pending-write safety, session transitions, compatibility, retention, recovery and acceptance. ADR-025 supersedes the earlier close-first target. M15 records the current Store/runtime implementation and source-bound checks; accepted documentation alone is not implementation evidence. App rollback never reverses server business transactions.

## Platform first, full app workflows next

Platform work and dental-app work are separate delivery tracks. M13's name-only shells establish installable app identities and shell integration; M14 owns the complete app pages, workflows and API wiring. Shell installation is not functional-app acceptance.

Before expanding full app implementation, establish a dependable platform contract using small representative apps. A simple real staging API page is a starting point; acceptance must also cover bounded requests, denied access, controlled writes and uncertain outcomes, session clearing, failed launches, safe updates and compatibility. Full clinical screens are not required to exercise these mechanisms. Recorded early M14 planning does not close M12/M13 gates or prove platform readiness; existing sequencing exceptions and work remain preserved in their owning milestone records.

## What success means

- A compatible app can be installed and improved through the Store without replacing the desktop or unrelated apps.
- App requests use the shared session without exposing credentials; the existing Worker retains business authority.
- Updates, failures, session changes and interruptions preserve truthful outcomes, privacy and recoverability.
- Platform readiness has exact source/build and supported-host evidence using representative apps; functional clinical correctness has separate app-level evidence.
- Production release names supported host/device scope, operational recovery and remaining limits. Hosted CI and staging success alone are not physical-device certification or final release approval.

## Execution boundary and detailed contracts

Reuse `fewa_demo/dental-saas` and `fewa_demo/super-admin` infrastructure. Roadmap backend execution remains verified Cloudflare staging-only; existing client behavior and business routes are preserved. New OS services use `/v1/dental-os/...`. Production changes/promotion require separate explicit authorization. [Canonical resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

Read [engineering invariants](03_V1_PRINCIPLES_AND_INVARIANTS.md), [system architecture](04_V1_SYSTEM_ARCHITECTURE.md), and the focused package, runtime, SDK, identity and update contracts for enforcement details. [The roadmap](../dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md) owns execution order; status/evidence own progress. This document owns the product explanation; the [legacy product-definition entry](02_V1_PRODUCT_DEFINITION.md) remains a compatibility pointer.
