import { describe, expect, it } from "vitest";
import { unpersistedLabOrderDrafts } from "./labOrderReview";

describe("lab handoff review state", () => {
  it("excludes historical persisted handoffs from a new final commit", () => {
    const saved = {
      labOrderId: "lab-order-1",
      rowVersion: 1,
      procedure: "Zirconia crown",
      tooth: "16",
      shade: "A2",
      labId: "",
      labName: "",
      notes: "Check occlusion",
    };
    expect(unpersistedLabOrderDrafts([saved])).toEqual([]);
  });

  it("keeps a supplier-free reception handoff draft eligible for the final commit", () => {
    const draft = { procedure: "Denture repair", tooth: "", shade: "", labId: "", labName: "", notes: "" };
    expect(unpersistedLabOrderDrafts([draft])).toEqual([draft]);
  });
});
