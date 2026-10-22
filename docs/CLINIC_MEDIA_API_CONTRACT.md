# Clinic private media contract 1 — SDK 1.3

## Declared platform capability

`clinic.media.read` accepts exactly `{kind, recordId, assetId}`. Kinds are `patient_media` and `staff_document`; identifiers must be UUIDs. Patient Record and Work Entry may read patient media; Staff may read Staff documents. The exact package must declare this operation and receive its exact signed format-2 release grant. App-family access and current trusted session permissions remain ceilings. Worker authorization independently resolves tenant, role and clinical record access. No M14 UI or business workflow is implemented here.

The host fetches the authenticated record's current media/document metadata itself, requires one matching active asset with the same parent ID, then requests bytes through fixed Worker paths. It verifies the domain MIME allowlist, stored byte count and SHA-256 checksum. The app cannot supply a URL, path, headers, checksum, tenant or credentials. Returned data contains only `{status:200, contentType, body:Uint8Array}`. Storage keys, response headers, clinical metadata and credential/upload handles are not forwarded.

## Bounds and lifecycle

- Patient media: JPEG, PNG or WebP, at most 10 MiB.
- Staff documents: PDF, JPEG, PNG or WebP, at most 25 MiB.
- Metadata response: at most 256 KiB. Missing, duplicate, inactive, malformed or oversized metadata fails closed before binary allocation.
- Binary reads allocate only the validated expected size and reject both short and oversized streams, mismatched content length/MIME and corrupt bytes.
- One active media read per app registration and two across the broker; existing total request limits also apply. Deadline: 30 seconds, including credential mediation and metadata/binary reads.
- Authorization is checked before credentials, after mediation, around each transport and before returning bytes. Logout, frame close, permission/grant loss, cancellation and timeout discard results. Redirects and alternate origins are refused.

These are bounded transient buffers, not a local business database or offline queue. The legacy `clinic.api.blob.read` operation remains denied and its old 8 MiB bound remains unchanged. JSON/envelope bounds remain unchanged.

## Compatibility and remaining work

SDK 1.3 adds this explicit operation. Older hosts reject grants naming unsupported operations. Existing app grants/versions are unchanged; no public feed or policy publication is implied by the host implementation. P08 metadata-only renewal must never add media/API authority implicitly.

This contract defines reads only. Mediated uploads, cancellation/recovery orchestration, support cleanup for creators who never return, real staging D1/R2 proof and private runtime evidence remain M15 implementation/verification work. Backend cancellation/expiry/discovery source is checkpointed separately at `307a21b`. Local unit tests do not establish deployment or customer-device acceptance.
