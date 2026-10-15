# Dental OS Git and Windows CI setup

User-authorized repository: https://github.com/Business-It-Partners/dental-os (private).

The existing Flutter root history and former remote are retained. Local caches/builds/installers remain excluded and are not deleted. Existing source, documentation, synthetic prototype artifacts and tracked archive source are preserved. A local pre-setup branch and index backup preserve the initial reference point.

Branches: main for the integrated snapshot; codex/milestone-01 for a reconstructed pre-M02 comparison checkpoint; codex/milestone-02 for current M02 work. M01 was not committed when originally authored: its checkpoint is reconstructed by removing M02 runtime changes, not asserted to reproduce an originally verified historical tree. Future M03–M11 branches are created when implementation starts, not prematurely marked implemented.

Windows CI runs sequential unit/filesystem, build and hosted-runner boot/state/recovery checks. No cloud deploy or secrets required. Physical Windows checks (real desktop activation/minimize/restore, ACL/runtime interactions, visual review and supported-device behavior) remain deferred until after M11 and before final product release. Exact CI run and snapshot IDs will be recorded after publication. No acceptance tag is issued for a pending gate.
