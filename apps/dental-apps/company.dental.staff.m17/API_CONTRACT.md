# Staff API and access contract

This app uses the existing M15 host SDK and Dental SaaS business routes. App-family selection is `clinic.app.staff`; no app-ID-specific host policy or new backend route is added.

## Clinic API routes

| Method and route | Use in Staff | Required access |
| --- | --- | --- |
| `GET /v1/clinic/staff` | Directory | `staff.manage` |
| `GET /v1/clinic/staff/:staffId` | Profile refresh and conflict reload | `staff.manage` |
| `POST /v1/clinic/staff` | Add staff | `staff.manage`; SDK command supplies idempotency |
| `PATCH /v1/clinic/staff/:staffId` | Edit permitted profile fields | `staff.manage`; includes `expectedRowVersion` and SDK idempotency |
| `GET /v1/clinic/staff/:staffId/clinical-work` | Doctor work history; optional paired `startDate` and `endDate` filters | `staff.manage`; SDK validates supported dates and order |
| `GET /v1/clinic/salary-payouts` | Salary history; app filters returned records to the selected staff member | `finance.manage` in addition to the `clinic.app.staff` family |
| `GET /v1/clinic/staff/:staffId/documents` | Private document metadata list | `staff.manage` |
| `POST /v1/clinic/staff/:staffId/documents/:documentId/withdraw` | Withdraw an active document with reason | `staff.manage`; SDK command supplies idempotency |

Directory, profile, edits, work history, document list and withdrawal are denied without `staff.manage`. The Staff app itself requires this capability at host family admission and in its manifest. Current SaaS clinic roles grant `staff.manage` to admin; doctor and reception roles receive `staff.reference.read` and cannot use this app. The app does not expose salary history unless the session also grants `finance.manage`; the Worker independently denies the salary route without it. The current Worker map grants `finance.manage` to admin.

## Private document media

| SDK operation | Use | Gate |
| --- | --- | --- |
| `clinic.media.read` | Read and preview an active `staff_document` using `{ kind, recordId: staffId, assetId: staffDocumentId }` | Exact signed operation grant, Staff family, ready clinic session, and Worker tenant authorization |
| `clinic.media.upload` | Begin, chunk, commit, or cancel a `staff_document` host transfer for the selected `staffId` | Exact signed operation grant, Staff family, ready clinic session, and Worker tenant authorization |

The host mediates credentials and upload handles, checks fresh metadata and verified bytes, applies MIME/size/checksum constraints, and binds the media kind to the Staff family. App code never calls the Worker content endpoint, object storage, or a signed URL. The document workflow is unavailable for any missing exact media grant. Document withdrawal changes SaaS record state; file retention/deletion remains backend-owned.

For reference, M15 host transfer uses these existing Staff Worker routes internally: `POST /v1/clinic/staff/:staffId/documents` to create the intent, `PUT /v1/clinic/staff/:staffId/documents/:documentId/content` for bytes, `POST /v1/clinic/staff/:staffId/documents/:documentId/finalise` to activate it, and `POST /v1/clinic/staff/:staffId/documents/:documentId/download` to read bytes. These are host-owned calls and are not exposed to app code. The current Staff Worker route does **not** implement `POST /v1/clinic/staff/:staffId/documents/:documentId/abort`, which the host transfer cancellation path calls after it has begun the remote commit. Accordingly, the UI disables cancel once commit begins and only offers retry of the same transfer to resolve the outcome. Local cancellation before commit remains supported. Do not report remote cancellation success until the Worker adds and verifies that route.

## Role, tenant, and conflict behavior

- Clinic identity and tenant are host/Worker-owned. API requests use SDK family and capability checks; the Worker resolves the actor/tenant from its trusted session credential. Media record lookup is clinic-scoped. No caller-controlled tenant or local authoritative business store exists in this app.
- Staff updates submit the current `rowVersion`. A conflict preserves the user's draft, fetches the current profile, and requires an explicit choice to load the latest version. Unknown write outcomes retain the original idempotent command for retry; another write is blocked until the original resolves.
- Work history is requested for doctor profiles only. Other staff types receive the SaaS explanation and no clinical-work request.
- Salary history is fetched only with `finance.manage`; recorded and voided payout entries remain visible, while totals include recorded entries only.
- Salary payout `payPeriod` uses the Finance/Worker's zero-padded Gregorian `YYYY-MM` format (for example, `2026-09`).

These behaviors are implemented against the current M15 SDK and SaaS contract but have not been verified in M17.9 runtime/API acceptance. The package's exact signed media operation grants have not yet been issued.
