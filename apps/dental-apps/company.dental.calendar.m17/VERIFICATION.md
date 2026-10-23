# Calendar M17 verification record

## Source and contract

- SaaS reference: `Business-It-Partners/dental-saas` commit `fd2cc5439694ce844362c9dec8a6267378d11381`, recorded in `SOURCE_IMPORT.json`.
- Uses the clinic's AD ISO task dates and Dental OS shared BS conversion functions.
- Reads `GET /v1/calendar-tasks?from=...&to=...`; creates with `POST /v1/calendar-tasks`; changes open/completed status with `PATCH /v1/calendar-tasks/:id`; archives with `POST /v1/calendar-tasks/:id/archive`.
- No task-edit route exists in the pinned SaaS contract.
- Mutations use row versions and SDK-generated idempotency identities. All clinic requests use `ClinicClient` and the host broker.
- Calendar app access requires `calendar.access`; host route authority is restricted to the Calendar task routes and bounded reads.

## Checks

Calendar typecheck, package tests, app bundle build, root build, 463 root unit tests, and 16 private synthetic UI workflow checks passed. Version `1.0.0` was published to Cloudflare staging at sequence `28` under package SHA-256 `0d45934d0ae43d0b79b3f1a60d188a865b3da0f509756d6a4a1642eed57d929d`, signed by `company-staging-m17-20261022` (public-key SHA-256 `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`). The public package verifier passed signature, bytes, grant, local install/launch, and cleanup checks. An authenticated private-profile Store run installed Calendar, opened its Dental OS-managed renderer, and recorded health for the exact payload. Startup reads used staging; no business writes were made. Detailed release and UI evidence is in [M17 verification evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md) and [Calendar release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_CALENDAR_STAGING_RELEASE_2026-10-23.json). Full live role/tenant/workflow acceptance and trust-pin deployment to the user's running desktop remain pending.
