# M13 Implementation Notes — Windows/Linux release and operations

## Starting baseline

M13 follows M11's generic first-party app/update work and M12's Dental OS shell/workspace UI work. Earlier prototype installer experiments are historical inputs only; they do not choose the production installer or certify Windows.

## Implementation record

No M13 implementation has started. No supported-host matrix, signed production installer, platform updater or final release is claimed.

## Ownership and boundaries

Platform packaging/update belongs to the trusted Electron/native host and its release tooling. App-package updates stay in the independent M11 channel. Existing Dental SaaS remains business authority. Backend staging work, production promotion and Cloudflare resource changes are not authorized by this milestone plan alone.

## Change log / deviations

None. Record installer/updater ADR decisions, key custody, artifact hashes, host permissions, recovery design and compatibility deviations as implementation begins. G14 physical Windows/user acceptance remains a separate post-M13 product-release gate.
