# M18 Shared Test-Case and Issue Template

Use this template for each reproducible case and backend handoff. Duplicate it into the app's restricted run record at execution time. Do not copy the staging login from the main M18 plan into test records.

## Run header

| Field | Value |
| --- | --- |
| M18 submilestone / app | NOT SET |
| App/package ID | NOT SET |
| Signed version / package SHA-256 | NOT SET |
| Signed staging feed sequence | NOT SET |
| Dental OS source commit / desktop build | NOT SET |
| Environment and verified staging host | NOT SET |
| Run date/time and timezone | NOT SET |
| Clinic/test namespace | Synthetic only; NOT SET |
| Signed-in role/capabilities | NOT SET |
| Tester/chat/worktree/branch | NOT SET |
| Trace/evidence directory | NOT SET |

## Test case record

| Field | Record |
| --- | --- |
| Case ID and title | NOT SET |
| Status | NOT RUN |
| Preconditions and exact fixture IDs | NOT SET |
| Reproduction steps | Numbered steps; UI entry points and submitted synthetic values |
| Expected API calls | SDK operation, method, path/query, expected status/shape, and whether a write is expected |
| Observed API calls | Broker trace/request IDs; redact secrets and PII |
| Expected user-visible result | NOT SET |
| Actual result | NOT RUN |
| Post-refresh/reopen state | NOT RUN |
| Evidence | PENDING; screenshot, redacted trace and request IDs if available |
| Issue category / owner | NOT SET; OS/platform fixture, app implementation, backend, test/environment, or UNKNOWN |
| Repeatability | NOT RUN |
| Tester/date | NOT SET |

For an unmet prerequisite, use BLOCKED and name it. For a scenario not attempted, use NOT RUN. Do not use PASS if the required route or workflow was not actually exercised.

## Backend-owned issue handoff

| Field | Record |
| --- | --- |
| Issue title and severity | NOT SET |
| Primary classification | Backend |
| App/package/version/digest | NOT SET |
| Desktop commit and staging feed sequence | NOT SET |
| Staging Worker/environment | NOT SET |
| Synthetic clinic namespace and pseudonymous object IDs | NOT SET |
| Role/capabilities | NOT SET |
| Reproduction steps | Numbered, deterministic steps from the app UI |
| Expected result and source contract | NOT SET |
| Actual result | Include status, redacted response and post-refresh state |
| Request details | Method and path/query; redact sensitive values |
| Request/correlation ID | Include only if safe to share |
| Idempotency/row-version result | State whether original command was reused and whether one or multiple effects occurred; redact replayable identifiers |
| Evidence links | Sanitized screenshot/log/trace references only |
| Backend owner | User backend team |
| Fix/status | Handoff pending; no backend change made by M18 app fixes |

### Redaction checklist

Remove email/password, access/ID/refresh tokens, cookies, session secrets, authorization headers, patient or staff names/phone numbers, sensitive health/financial data, signed URLs, raw private media and any replayable idempotency secret. Preserve only the minimum synthetic fields needed to reproduce the issue. Keep raw restricted logs separate and do not attach them to a broadly shared chat.

## Acceptance result

| Criterion | Result |
| --- | --- |
| Exact package and staging environment recorded | NOT RUN |
| Expected API calls observed and reviewed | NOT RUN |
| Core workflow and important states reproduced | NOT RUN |
| Actual results and evidence complete | NOT RUN |
| Issues classified and owners assigned | NOT RUN |
| Lead review | NOT RUN |
| App submilestone decision | PLANNED |
