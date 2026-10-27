import { describe, expect, it } from "vitest";
import { startCaseStepForTab, tabForStartCaseStep } from "./workEntryRouteState";

describe("Open Case Today’s Work route", () => {
  it("sends both the current and legacy plan tabs to the combined chart and completion step", () => {
    expect(startCaseStepForTab("work")).toBe(2);
    expect(startCaseStepForTab("plan")).toBe(2);
  });

  it("writes the new work tab while keeping the remaining Open Case steps in order", () => {
    expect(tabForStartCaseStep(2)).toBe("work");
    expect(tabForStartCaseStep(3)).toBe("imaging");
    expect(tabForStartCaseStep(4)).toBeNull();
    expect(tabForStartCaseStep(5)).toBe("recall");
    expect(tabForStartCaseStep(6)).toBe("review");
  });
});
