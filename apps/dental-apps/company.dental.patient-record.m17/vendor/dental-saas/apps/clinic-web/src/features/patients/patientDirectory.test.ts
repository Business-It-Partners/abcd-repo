import { describe, expect, it } from "vitest";
import { patientDirectoryCounts, patientDirectoryMonthRange, patientDirectoryRequest, patientDirectorySearchParams } from "./patientDirectory";

describe("patient directory paging", () => {
  it("serializes bounded server-side directory filters", () => {
    expect(patientDirectorySearchParams({
      query: "NAMO-10",
      cursor: "NAMO-0025",
      limit: 10,
      cohort: "regular",
      monthStart: "2026-09-17",
      monthEnd: "2026-10-17",
    }).toString()).toBe("q=NAMO-10&cursor=NAMO-0025&limit=10&cohort=regular&monthStart=2026-09-17&monthEnd=2026-10-17");
  });

  it("converts the selected BS month into a valid AD query range", () => {
    const range = patientDirectoryMonthRange("2083-06");
    expect(range).not.toBeNull();
    expect(range?.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range?.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range && range.start < range.end).toBe(true);
  });

  it("searches the complete directory regardless of saved month or cohort filters", () => {
    expect(patientDirectoryRequest(
      { query: " NAMO-10 ", cohort: "regular", limit: 10 },
      { start: "2026-09-17", end: "2026-10-17" },
    )).toEqual({ query: "NAMO-10", cohort: "all", limit: 10, monthStart: undefined, monthEnd: undefined });
  });

  it("restores month and cohort filters when directory search is clear", () => {
    expect(patientDirectoryRequest(
      { query: "", cohort: "regular", limit: 10 },
      { start: "2026-09-17", end: "2026-10-17" },
    )).toEqual({ query: "", cohort: "regular", limit: 10, monthStart: "2026-09-17", monthEnd: "2026-10-17" });
  });

  it("keeps the selected directory cohort renderable when an older Worker omits counts", () => {
    expect(patientDirectoryCounts(undefined, 1840, "all")).toEqual({ all: 1840, new: 0, regular: 0 });
    expect(patientDirectoryCounts(undefined, 17, "new")).toEqual({ all: 0, new: 17, regular: 0 });
  });

  it("preserves complete directory counts from a matching Worker release", () => {
    const counts = { all: 1840, new: 40, regular: 12 };
    expect(patientDirectoryCounts(counts, 1840, "all")).toBe(counts);
  });
});
