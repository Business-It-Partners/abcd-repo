# M01 Implementation Notes — Architecture and baseline

## Starting baseline

Current source and archived/remote documentation inspected; no claim of fresh production runtime verification.

## Implementation record

2026-10-15: created the numbered architecture set and eleven milestone plans using the newer Flutter documentation pattern. Root product/readme/work-contract pointers reconciled without discarding prototype history. Added tools/check-dental-docs.py for repeatable local links, structure and requirement/gate presence checks. This is documentation only.

## Decisions and boundaries

Resolve candidate choices through the architecture ADR register. Keep permanent first-party-only scope, existing SaaS business authority and live-desktop protection. Record actual file/module mapping when code is implemented; proposed architecture boundaries are not existing source paths.

## Change log / deviations

None recorded. Preserve superseded evidence with an explanation rather than silently rewriting outcomes.

## Verification closeout

2026-10-15: documentation checks and baseline build/25 unit tests pass. No application runtime source, archived project or separate SaaS source was changed; no GUI test or live session manipulation. Evidence and scope limitations are recorded separately.

## Staging/resource policy amendment — 2026-10-15

Added canonical resource/route policy, ADR-017/018, requirement/gate coverage, all-milestone staging restrictions and targeted M04/M05/M07/M08/M09/M11 evidence criteria. Root product/work-checklist pointers reconciled. Reuse fewa_demo; existing APIs unchanged; new OS APIs under `/v1/dental-os/...`; production excluded absent separate authorization. No backend repository or cloud resource changed. Exact staging target inventory remains pending implementation.

## Repository structure amendment — 2026-10-15

Expanded 00_REPOSITORY_STRUCTURE.md into the canonical physical layout and dependency guide. Root guidance and architecture link to it. Explicitly distinguishes current src/electron from planned apps/packages, preserves shared lifecycle, separates SaaS/backend and installed data, and defines incremental migration. Documentation-only; no source movement or new runtime package scaffolding. M02–M11 remain planned.
