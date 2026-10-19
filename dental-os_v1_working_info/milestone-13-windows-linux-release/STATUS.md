# M13 Status — Windows/Linux release and operations

**Status:** PLANNED
**User acceptance:** not started.
**Branch:** not created; create `codex/milestone-13` only when M13 implementation starts.

## Current position

M13 is the former M11 release/operations scope, moved after M11 app flexibility and M12 shell UI so final platform packaging certifies the intended app/update and workspace experience. No supported-host matrix, production installer decision or release certification is complete by this planning record.

## Remaining work

- Freeze the supported Windows/Linux matrix and resolve installer/platform-updater ADRs.
- Implement and verify signed platform artifacts, permissions, upgrade, interruption, recovery and uninstall behavior.
- Prove compatibility with M11 independently released apps and M12 shell state.
- Pass applicable Linux and Windows CI/host checks; bind each to exact source and artifact evidence.
- Complete G13, then perform the separate physical Windows/user acceptance G14 before any final release decision.

## Status rules

G13 VERIFIED applies only to the explicitly tested host/artifact scope. It is not physical-device certification or final product release approval. Keep production promotion and backend deployment outside this plan unless separately authorized.
