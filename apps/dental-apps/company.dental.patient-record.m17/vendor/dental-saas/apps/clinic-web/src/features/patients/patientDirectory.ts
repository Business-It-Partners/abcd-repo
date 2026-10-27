import type { PatientDirectoryCohort, PatientDirectoryCounts, PatientDirectoryRequest } from "./types";
import { bsMonthToADRange } from "../../shared/dates/bikramSambat";

const EMPTY_COUNTS: PatientDirectoryCounts = { all: 0, new: 0, regular: 0 };

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Keep the directory renderable during a rolling frontend/Worker deployment.
 * Older Workers did not return cohort counts, so preserve the selected result
 * total until the matching Worker release is live instead of crashing the page.
 */
export function patientDirectoryCounts(
  counts: PatientDirectoryCounts | null | undefined,
  total: number,
  cohort: PatientDirectoryCohort,
): PatientDirectoryCounts {
  if (counts && isCount(counts.all) && isCount(counts.new) && isCount(counts.regular)) return counts;
  return { ...EMPTY_COUNTS, [cohort]: isCount(total) ? total : 0 };
}

export function patientDirectorySearchParams(input: PatientDirectoryRequest = {}): URLSearchParams {
  const params = new URLSearchParams();
  if (input.query) params.set("q", input.query);
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.limit) params.set("limit", String(input.limit));
  if (input.cohort && input.cohort !== "all") params.set("cohort", input.cohort);
  if (input.monthStart) params.set("monthStart", input.monthStart);
  if (input.monthEnd) params.set("monthEnd", input.monthEnd);
  return params;
}

export function patientDirectoryMonthRange(month: string): { start: string; end: string } | null {
  const [year, monthNumber] = month.split("-").map(Number);
  return bsMonthToADRange(year, monthNumber);
}

/** A typed search is directory-wide; saved month/cohort choices resume when it is cleared. */
export function patientDirectoryRequest(
  input: PatientDirectoryRequest,
  range: { start: string; end: string } | null,
): PatientDirectoryRequest {
  if (input.query?.trim()) return { ...input, query: input.query.trim(), cohort: "all", monthStart: undefined, monthEnd: undefined };
  return { ...input, monthStart: range?.start, monthEnd: range?.end };
}
