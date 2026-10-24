export type EncounterDraftScope = "work-entry" | "work-entry-case-update" | "new-case";

interface DraftStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const keyFor = (scope: EncounterDraftScope) => `sajilo-dental:v2:encounter:${scope}`;
const commandKeyFor = (scope: EncounterDraftScope) => `${keyFor(scope)}:command`;

function browserStorage(): DraftStorage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Keep one encounter id for the lifetime of a form draft, including across refreshes. If a save
 * commits but its response is lost, the refreshed form retries against the same immutable visit
 * gate instead of producing a second clinical and financial fan-out.
 */
export function encounterDraftId(
  scope: EncounterDraftScope,
  storage: DraftStorage | null = browserStorage(),
  createId: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const key = keyFor(scope);
  try {
    const existing = storage?.getItem(key)?.trim();
    if (existing) return existing;
    const created = createId();
    storage?.setItem(key, created);
    return created;
  } catch {
    return createId();
  }
}

/**
 * A trusted Worker command has its own retry key.  It is stored beside, but is
 * deliberately not equal to, the immutable visit id.  Keeping both values for
 * the life of a browser draft means a lost network response can safely retry
 * the same command after a refresh without creating another clinical record.
 */
export function encounterDraftCommandId(
  scope: EncounterDraftScope,
  storage: DraftStorage | null = browserStorage(),
  createId: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const key = commandKeyFor(scope);
  try {
    const existing = storage?.getItem(key)?.trim();
    if (existing) return existing;
    const created = `encounter_command_${createId().replace(/[^A-Za-z0-9_-]/g, "")}`;
    storage?.setItem(key, created);
    return created;
  } catch {
    return `encounter_command_${createId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  }
}

export function clearEncounterDraftId(
  scope: EncounterDraftScope,
  storage: DraftStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(keyFor(scope));
    storage?.removeItem(commandKeyFor(scope));
  } catch {
    // The transaction-level visit gate remains the source of safety when browser storage is
    // unavailable (for example, a locked-down private browsing policy).
  }
}
