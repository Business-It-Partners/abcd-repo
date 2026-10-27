import { describe, expect, it } from "vitest";
import { advancePageLoadingPhase } from "./ClinicLoadingOverlay";

describe("advancePageLoadingPhase", () => {
  it("shows opening feedback only for the initial page fetch", () => {
    let phase = { area: "Follow-ups", sawBusy: false, initialLoadComplete: false };

    let result = advancePageLoadingPhase(phase, "Follow-ups", true);
    expect(result.showOpening).toBe(true);
    phase = result.phase;

    result = advancePageLoadingPhase(phase, "Follow-ups", false);
    expect(result.showOpening).toBe(false);
    phase = result.phase;

    result = advancePageLoadingPhase(phase, "Follow-ups", true);
    expect(result.showOpening).toBe(false);
  });

  it("starts a new opening phase when the owning page changes", () => {
    const completed = { area: "Follow-ups", sawBusy: true, initialLoadComplete: true };
    const result = advancePageLoadingPhase(completed, "Appointments", true);

    expect(result.showOpening).toBe(true);
    expect(result.phase).toEqual({ area: "Appointments", sawBusy: true, initialLoadComplete: false });
  });

  it("waits for a real fetch before considering the initial load complete", () => {
    let phase = { area: "Follow-ups", sawBusy: false, initialLoadComplete: false };
    let result = advancePageLoadingPhase(phase, "Follow-ups", false);
    expect(result.phase.initialLoadComplete).toBe(false);

    phase = result.phase;
    result = advancePageLoadingPhase(phase, "Follow-ups", true);
    expect(result.showOpening).toBe(true);
  });
});
