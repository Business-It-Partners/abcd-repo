import { describe, expect, it, vi } from "vitest";
import { invalidateLabOrdersAfterCommit } from "./labOrderInvalidation";

describe("Work Entry lab-order invalidation", () => {
  it("reloads the shared lab directory after a commit creates lab orders", async () => {
    const reload = vi.fn(async () => undefined);
    await invalidateLabOrdersAfterCommit(2, reload, () => undefined);
    expect(reload).toHaveBeenCalledOnce();
  });

  it("does not reload when the commit did not create a lab order", async () => {
    const reload = vi.fn(async () => undefined);
    await invalidateLabOrdersAfterCommit(0, reload, () => undefined);
    expect(reload).not.toHaveBeenCalled();
  });

  it("reports read-back failure without turning the successful commit into a rejected write", async () => {
    const failure = new Error("temporary list failure");
    const report = vi.fn();

    await expect(invalidateLabOrdersAfterCommit(1, async () => { throw failure; }, report)).resolves.toBeUndefined();
    expect(report).toHaveBeenCalledWith(failure);
  });
});
