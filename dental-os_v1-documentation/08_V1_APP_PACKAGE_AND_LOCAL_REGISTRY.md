# Dental OS — App Package and Local Registry

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

A package is a versioned self-contained React/TypeScript web build: manifest, HTML entry point, JS/CSS and assets. Dependencies are bundled initially. No install scripts or app-supplied native runtime.

## Required logical metadata

Package-format version; stable app ID/company publisher; app version; relative entry path; SDK compatibility; backend contract compatibility; requested capabilities; asset inventory/integrity binding. Signed release metadata binds identity, version and package SHA-256 digest using a defined canonical serialization. M06 freezes the exact [dentalpkg/1 schema, Ed25519 signature and uncompressed archive](23_V1_PACKAGE_FORMAT.md). Its local implementation/evidence is tracked in M06; remote distribution remains M07.

The verifier uses platform-owned trust roots, rejects unknown schemas/identities and mismatched hashes, and validates paths, symlinks, entry points, expanded size/count and extraction limits. App metadata cannot grant itself capabilities. Validate installed content at launch under a documented integrity policy, not only during download.

## Registry

Store installed versions, selected active version, verified digest, release/channel metadata, operation journal, retained rollback versions and safe failure state in an OS-owned root outside source code. Define schema/migrations and atomic writes. Never allow packages to choose arbitrary disk destinations.

Use separate staging and immutable version directories. Activation changes an atomic registry pointer only after complete verification. Do not modify running-version files. Concurrent install/update/uninstall for the same app is serialized. Startup reconciles incomplete operations and failed activation.

Company development fixtures are restricted to isolated development/test profiles; no production sideloading route. Local same-user tampering remains a threat requiring revalidation, not a claim that ordinary writable files are tamper-proof.
