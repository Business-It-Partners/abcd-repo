import { describe, expect, it } from "vitest";
import {
  pendingChartSuggestions,
  resolveSuggestionCart,
  suggestedProtocolId,
  suggestedStarterTemplateCode,
} from "./treatmentProtocolSuggestions";

describe("treatment protocol suggestions", () => {
  it("preserves the staging condition-to-template mapping", () => {
    expect(suggestedStarterTemplateCode("decayed")).toBe("composite-filling");
    expect(suggestedStarterTemplateCode("root-treated")).toBe("root-canal-crown");
    expect(suggestedStarterTemplateCode("impacted")).toBe("surgical-wisdom-extraction");
    expect(suggestedStarterTemplateCode("missing")).toBe("single-implant");
    expect(suggestedStarterTemplateCode("mobility")).toBe("mobility");
    expect(suggestedStarterTemplateCode("crown")).toBe("composite-filling");
  });

  it("returns the current clinic UUID, not a legacy protocol id", () => {
    const protocols = [
      { id: "b677e60e-3fa7-40e2-9b43-82b8e400a108", starterTemplateCode: "composite-filling" },
      { id: "4a943e68-0cd0-4fcf-ac71-2a500a81e694", starterTemplateCode: "root-canal-crown" },
    ];

    expect(suggestedProtocolId("root-treated", protocols)).toBe("4a943e68-0cd0-4fcf-ac71-2a500a81e694");
  });

  it("keeps the reference fallback when a clinic no longer has the mapped template", () => {
    expect(suggestedProtocolId("impacted", [{ id: "custom-protocol" }])).toBe("custom-protocol");
  });

  it("keeps every unplanned charted tooth in one suggestion cart", () => {
    const marks = {
      "14": { value: "root-treated" as const },
      "11": { value: "crown" as const },
      "26": { value: "decayed" as const },
    };

    expect(pendingChartSuggestions(marks, ["26"])).toEqual([
      ["11", marks["11"]],
      ["14", marks["14"]],
    ]);
  });

  it("resolves all suggestion choices for one batch add", () => {
    const protocols = [
      { id: "filling", starterTemplateCode: "composite-filling" },
      { id: "rct", starterTemplateCode: "root-canal-crown" },
      { id: "implant", starterTemplateCode: "single-implant" },
    ];
    const suggestions = [
      ["14", { value: "root-treated" as const }],
      ["11", { value: "crown" as const }],
    ] as Array<[string, { value: "root-treated" | "crown" }]>;

    expect(resolveSuggestionCart(suggestions, { "11": "implant" }, protocols)).toEqual([
      { tooth: "14", protocolId: "rct" },
      { tooth: "11", protocolId: "implant" },
    ]);
  });
});
