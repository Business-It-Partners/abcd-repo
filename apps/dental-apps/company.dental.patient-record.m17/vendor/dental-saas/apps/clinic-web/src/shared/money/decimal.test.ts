import { describe, expect, it } from "vitest";
import { decimalInput, decimalNumber, roundMoney } from "./decimal";

describe("decimal input", () => {
  it("keeps one decimal point and the configured precision", () => {
    expect(decimalInput("0012.507", 2)).toBe("12.50");
    expect(decimalInput("0.1259", 3)).toBe("0.125");
    expect(decimalInput("12..5", 2)).toBe("12.5");
  });

  it("parses drafts and rounds calculated totals", () => {
    expect(decimalNumber("12.50")).toBe(12.5);
    expect(decimalNumber(".")).toBe(0);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});
