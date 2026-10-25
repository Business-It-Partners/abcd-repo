import type { StoreApp } from '../electron/distribution/contracts';

/** Shared definition of an actionable Store update offer. */
export function hasAvailableStoreUpdate(app: StoreApp): boolean {
  return !!app.activeVersion
    && app.available
    && !app.reason
    && !app.pendingVersion
    && !app.trialVersion
    && app.version !== app.activeVersion;
}
