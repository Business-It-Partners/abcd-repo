# Follow-ups M17 package verification

Package: company.dental.followups.m17 1.0.0
Source: retained M17 Follow-ups implementation, with a distinct package identity.

This sibling package reuses the existing SDK-backed follow-up workflows. The prior package at company.dental.followups 1.1.0 and its package bytes remain unchanged. The new ID is registered in the host's app capability and route policy. Clinic business calls continue through the Dental OS SDK.

Package-local typecheck, contract tests, build, private Linux workflow, root build and root unit suite are recorded in the M17 evidence ledger. The locally prepared 1.0.0 package and signed metadata are M17 staging artifacts only. They have not been uploaded, published, activated, installed through Store or deployed. Live authenticated staging acceptance and Store installation remain separate gates.
