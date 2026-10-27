import { describe, expect, it } from "vitest";
import { clearEncounterDraftId, encounterDraftCommandId } from "./encounterDraft";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("encounter draft command identities", () => {
  it("keeps existing-case updates separate from the final clinical commit", () => {
    const storage = memoryStorage();
    let sequence = 0;
    const createId = () => `draft-${++sequence}`;

    const updateKey = encounterDraftCommandId("work-entry-case-update", storage, createId);
    const commitKey = encounterDraftCommandId("work-entry", storage, createId);

    expect(updateKey).not.toBe(commitKey);
    expect(encounterDraftCommandId("work-entry-case-update", storage, createId)).toBe(updateKey);
    expect(encounterDraftCommandId("work-entry", storage, createId)).toBe(commitKey);

    clearEncounterDraftId("work-entry-case-update", storage);

    expect(encounterDraftCommandId("work-entry", storage, createId)).toBe(commitKey);
    expect(encounterDraftCommandId("work-entry-case-update", storage, createId)).not.toBe(updateKey);
  });
});
