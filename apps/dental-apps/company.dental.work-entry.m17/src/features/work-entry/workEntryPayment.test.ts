import { describe, expect, it } from "vitest";
import { parseWorkEntryPayment } from "./workEntryPayment";

describe("work-entry patient payments", () => {
  const base = { paymentDate: "2026-10-08", paymentMethod: "cash", outstandingDue: 1_000 };

  it("accepts payment and discount values with paisa precision", () => {
    expect(parseWorkEntryPayment({ ...base, paidToday: "125.50", discount: "0.25" }))
      .toMatchObject({ amount: 125.5, discountAmount: 0.25 });
  });

  it("rejects values with more than two decimal places", () => {
    expect(() => parseWorkEntryPayment({ ...base, paidToday: "12.555", discount: "0" }))
      .toThrow("two decimal places");
  });
});
