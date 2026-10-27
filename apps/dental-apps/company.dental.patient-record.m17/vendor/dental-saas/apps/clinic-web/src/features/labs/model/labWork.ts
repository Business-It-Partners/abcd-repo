/** Standard work commonly fabricated by a dental laboratory. */
export const LAB_WORK_OPTIONS = [
  "Zirconia Crown",
  "PFM Crown",
  "E-max Crown",
  "Bridge (3-unit)",
  "Complete Denture",
  "Partial Denture",
  "Retainers",
  "Night Guard",
  "Sports Guard",
  "Post & Core",
] as const;

export const CUSTOM_LAB_WORK = "__custom__";

export function isStandardLabWork(value: string): boolean {
  return (LAB_WORK_OPTIONS as readonly string[]).includes(value);
}
