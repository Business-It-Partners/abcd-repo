# User Management API contract

User Management uses Dental OS `ClinicClient` for host-held authentication and the existing Dental SaaS clinic account API. It does not access Firebase tokens in the renderer or persist account/password data to disk. Password form values and the immutable retry command remain in renderer memory only while needed to submit or reconcile a write; no local user database is created.

The host accepts these routes only for `clinic.app.user-management`, and checks `clinic_users.manage` before obtaining credentials and before dispatch:

| Method | Path | Use |
| --- | --- | --- |
| `GET` | `/v1/clinic/users` | List clinic login accounts |
| `POST` | `/v1/clinic/users` | Create a doctor or reception login |
| `PATCH` | `/v1/clinic/users/{clinicUserId}` | Edit role/name or enable/disable an account |
| `POST` | `/v1/clinic/users/{clinicUserId}/password` | Change an account password |

All writes use the SDK's stable idempotency key. If a write result is uncertain, the UI offers to repeat the same immutable request rather than creating a new command. The Worker remains responsible for role authorization, tenant isolation, account storage, Firebase identity changes, and audit/idempotency records.
