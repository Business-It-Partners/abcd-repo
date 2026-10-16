# M06 Requirement and gate coverage

Acceptance authority: G06 / R02, R03, R15. [Executed outcomes](VERIFICATION_EVIDENCE.md) and exact retained source/CI identities govern these cases; test names alone are not proof of execution.

| Requirement | Implemented control | Evidence cases |
| --- | --- | --- |
| R02 company authority | Platform allowlisted publisher, ID, Ed25519 public key and maximum grants; normal policy excludes test keys | Package unit signature/payload/release/unsigned/unknown-key/app/publisher negatives; incompatible schema, SDK/API, capability and identity mismatch cases |
| R02 executable identity | Registry app/digest selection; launch revalidation; actual sender/frame bound to verified ID/version/grants | Package unit corrupt/forged registry and installed tamper negatives; eight installed-runtime cases; existing fifteen SDK UI and twenty-one broker unit cases |
| R03 portable safe package | Canonical bytes, strict schema/inventory, uncompressed regular-file-only representation, path/size/count limits | Fourteen adversarial portable paths; signed link/extra/missing/duplicate/inventory/limit negatives; outer byte/canonical/base64 cases; CLI deterministic build/verifier smoke |
| R03 crash-safe install | Separate staging/immutable versions, fsync/atomic active pointer, journal + single-owner operation lock, capacity preflight | First-install and update failure matrix; eight actual abrupt-process exit/restart checkpoints; capacity refusal and injected ENOSPC; concurrent live-owner refusal |
| R03 independent lifecycle | Monotonic local installs, three-version bound, pinned running bytes, lease-protected uninstall and cleanup retry | Retained-version/current/new-lease cases, downgrade/equal replacement refusal; interrupted uninstall phases; junction/hardlink/tamper negatives; other-app/unrelated marker preservation |
| R15 honest acceptance | Exact source hashes, Linux/Windows reports, superseded failure logs and limits | Milestone evidence and status; original tests retained; physical Windows, power loss, remote freshness and production signing remain explicitly unclaimed |

No production third-party publisher, generic filesystem/IPC proxy, clinical data store, backend change or deployment exists in this milestone. No test disables a real account or modifies SaaS records. M07/M08 own remaining remote distribution/Store/update policy; M11/final device acceptance owns physical Windows release approval.
