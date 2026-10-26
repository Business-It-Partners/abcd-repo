# Clinic JSON contract 1 — SDK 1.7

The first-party `clinic.api.request` entry point is usable only when the exact installed package identity receives that operation in signed update-policy format 2. Package declaration, app ID and app-family access remain ceilings. They cannot substitute for the signed grant. A newly approved company app ID can select one already-supported clinic app family through its signed package capabilities; the host does not keep a separate route-policy entry for each ID. An unknown app family has no generic JSON contract.

The host resolves each path/method selection against [the compiled route catalogue](../electron/sdk/clinicRoutes.ts), keyed by the package's single supported family capability. There are no caller-defined routes or remotely supplied route manifests. Absolute URLs, dot/encoded path traversal, extra/duplicate query keys, invalid dates, wrong methods and other app families are refused. The host checks the exact signed release grant, trusted session app access and each additional Worker capability before credential acquisition, then repeats authorization after mediation. The Worker independently derives tenant/user/role and validates business payloads and writes. Apps receive no credential, header, tenant selector or unrestricted authenticated transport.

New IDs still require a fresh signed catalogue and update-policy entry, a company-signed package, an exact release grant, and an already-shipped company trust ceiling. This removes per-ID host registrations. A new app family, route, payload schema, API operation, or native capability still needs a platform compatibility review and host implementation.

The review inputs are M14 dependency register at `a8caea6e` and existing Dental SaaS routes at `a3b116c64df826cbb5b66bc09305f81bf06cd463`. No Worker route or business schema is added by this contract. The exact per-method/query catalogue in source is authoritative; the table below describes its boundaries.

| First-party app | Declared JSON scope | Additional restrictions |
| --- | --- | --- |
| Follow-ups | Worklist/date, create, toggle/schedule; staff references; patient lookup | Patient lookup requires nonempty `q` and `limit=8`; no patient directory or unrelated clinical writes |
| Appointments | Date/bucket worklist, summary, create/edit/status; staff/patient lookup | Exact query combinations and existing appointment capability |
| Patient Record | Directory/intake/profile, documented histories, notes/prescriptions, charts, ledger/payments, documented work-entry/lab references | Billing, collection, work-entry, lab and finance reference requests require their corresponding session capabilities |
| Work Entry | Case/commit/protocol actions, charts, patient core/lookup, staff/lab references, media metadata | Lab supplier lookup requires `scope=lab` and `lab_tracker.access`; no general supplier or finance access |
| Treatment Progress | Worklist, patient lookup/core, protocol references | No clinical mutations |
| Lab Tracker | Order worklist/assignment/status and lab supplier records | Supplier statements require `scope=lab`; Worker independently rejects monetary or non-lab changes without finance authority |
| Finance | Declared expense/product/purchase/payroll/supplier/transaction and patient billing operations | Finance app excludes reception; monetary modules require `finance.manage`; staff-list read additionally requires `staff.manage` |
| Patient Payments | Reception payment report, selected patient ledger/core and collection | App excludes admin/doctor; ledger and collection require their independent Worker capabilities |
| Staff | Directory/profile, clinical-work report and document metadata/withdrawal; salary-history read | `staff.manage` app access; salary-history read additionally requires `finance.manage` |
| Treatment Protocols | Protocol list/create/versioned edit | Existing app and reference capabilities |
| Calendar | Date-range list, create/edit/archive and appointment/staff references | Valid ordered date queries; appointment/reference capabilities remain independent |
| User Management | List, create, edit/disable and change passwords for clinic login accounts | Admin-only `clinic.app.user-management`; all four routes require `clinic_users.manage` in the current session |

JSON body, request envelope and response bounds remain 12,000 characters and 12,000 UTF-8 bytes as enforced by the existing body validator, 16 KiB and 256 KiB respectively. Deadlines, concurrency, cancellation, stable write keys, unknown outcomes and session fencing remain enforced by the broker. Credential/upload-handle inspection fails closed beyond its maximum nesting depth. This contract does not allow binary content, upload intents/finalisation, private download URLs or app-to-app navigation. Those need separate host contracts.

SDK major 1 clients detect granted operations through connection capabilities. SDK minor 7 adds the User Management app family and its four fixed route entries; older hosts cannot consume its signed grant and must be updated before installing that app. The sequence-22 P08 renewal kept the existing format-1 feed and authority unchanged: it did not enable API grants remotely. A grant migration is a separately reviewed policy publication, with exact package/retained-release identities and compatibility checks.
