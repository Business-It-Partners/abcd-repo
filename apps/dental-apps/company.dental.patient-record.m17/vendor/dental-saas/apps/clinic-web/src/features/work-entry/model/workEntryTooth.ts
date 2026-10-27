interface StageToothSource {
  group?: string;
  tooth: string;
}

interface CaseToothSource {
  stages: readonly StageToothSource[];
}

/**
 * A treatment-plan group represents one procedure at one tooth. The trailing
 * FDI tooth in a group title is the durable source for a newly added stage;
 * the unrelated new-plan tooth picker can otherwise still hold its default.
 */
export function toothFromPlanGroup(groupName: string): string | undefined {
  const match = groupName.match(/(?:·|\s)((?:[1-4][1-8]|[5-8][1-5]))\s*(?:\([^)]*\))?\s*$/);
  return match?.[1];
}

export function toothForExtraStage(openCase: CaseToothSource | undefined, groupName: string, fallback: string): string {
  const titledTooth = toothFromPlanGroup(groupName);
  if (titledTooth) return titledTooth;
  const groupTeeth = openCase
    ? Array.from(new Set(openCase.stages.filter((stage) => stage.group?.trim() === groupName).map((stage) => stage.tooth).filter((tooth) => /^(?:[1-4][1-8]|[5-8][1-5])$/.test(tooth))))
    : [];
  return groupTeeth.length === 1 ? groupTeeth[0] : fallback;
}

/**
 * Correct only the historic default-tooth defect in titled, single-tooth
 * groups. Untitled and multi-tooth plans are left exactly as stored.
 */
export function repairTitledGroupTeeth<T extends StageToothSource>(stages: T[]): T[] {
  let changed = false;
  const repaired = stages.map((stage) => {
    const titledTooth = toothFromPlanGroup(stage.group?.trim() ?? "");
    if (!titledTooth || stage.tooth === titledTooth) return stage;
    changed = true;
    return { ...stage, tooth: titledTooth };
  });
  return changed ? repaired : stages;
}
