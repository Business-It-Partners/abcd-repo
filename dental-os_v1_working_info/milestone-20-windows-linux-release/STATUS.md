# M20 Status — Windows/Linux release and operations

**Status:** PLANNED
**User acceptance:** not started.
**Branch:** not created; create `codex/milestone-20` only when M20 implementation starts.

## Current position

M20 is the former M13 Windows/Linux release-and-operations scope, moved after the newly planned M13 app shells and M14 functional apps. It certifies the intended app/update and workspace experience on supported hosts. No supported-host matrix, production installer decision or release certification is complete by this planning record.

## Remaining work

- Freeze the supported Windows/Linux matrix and resolve installer/platform-updater ADRs.
- Implement and verify signed platform artifacts, permissions, upgrade, interruption, recovery and uninstall behavior.
- Prove compatibility with M13/M14 app packages and M12 shell state.
- Pass applicable Linux and Windows CI/host checks; bind each to exact source and artifact evidence.
- Complete G20, then perform the separate physical Windows/user acceptance G21 before any final release decision.

## Status rules

G20 VERIFIED applies only to the explicitly tested host/artifact scope. It is not physical-device certification or final product release approval. Keep production promotion and backend deployment outside this plan unless separately authorized.
