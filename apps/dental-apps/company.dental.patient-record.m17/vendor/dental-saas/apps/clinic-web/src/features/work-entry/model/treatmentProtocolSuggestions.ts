import type { ToothStateValue } from "./chartData";

type SuggestibleTreatmentProtocol = {
  id: string;
  starterTemplateCode?: string | null;
};

type SuggestionMark = {
  value: ToothStateValue;
};

/**
 * Mirrors the staging charting behaviour exactly. Some recorded states are not
 * diagnoses needing a new treatment, but staging intentionally falls back to
 * Composite Filling for them and still lets the clinician override the choice.
 */
export function suggestedStarterTemplateCode(value: ToothStateValue): string {
  switch (value) {
    case "impacted":
      return "surgical-wisdom-extraction";
    case "extracted":
    case "shed":
    case "missing":
      return "single-implant";
    case "root-treated":
      return "root-canal-crown";
    case "mobility":
      return "mobility";
    case "decayed":
    default:
      return "composite-filling";
  }
}

/**
 * Starter protocol ids are different in every tenant. Resolve the staging
 * recommendation through its durable starter-template code, then return the
 * current clinic's UUID for plan creation. The legacy id fallback keeps the
 * old in-memory protocol catalogue working in legacy screens.
 */
export function suggestedProtocolId(
  value: ToothStateValue,
  protocols: SuggestibleTreatmentProtocol[],
): string {
  const code = suggestedStarterTemplateCode(value);
  const byStarterCode = protocols.find((protocol) => protocol.starterTemplateCode === code);
  if (byStarterCode) return byStarterCode.id;

  const legacyIdByStarterCode: Record<string, string> = {
    "surgical-wisdom-extraction": "PROTO-WISDOM",
    "single-implant": "PROTO-IMPLANT",
    "root-canal-crown": "PROTO-RCT",
    mobility: "PROTO-MOBILITY",
    "composite-filling": "PROTO-FILLING",
  };
  const byLegacyId = protocols.find((protocol) => protocol.id === legacyIdByStarterCode[code]);
  return byLegacyId?.id ?? protocols[0]?.id ?? "";
}

/**
 * Every charted tooth stays in the suggestion cart until it is either planned or dismissed.
 * Selecting another tooth must not replace the earlier suggestion.
 */
export function pendingChartSuggestions<TMark extends SuggestionMark>(
  marks: Record<string, TMark>,
  plannedToothCodes: Iterable<string>,
): Array<[string, TMark]> {
  const planned = new Set(plannedToothCodes);
  return Object.entries(marks).filter(([tooth]) => !planned.has(tooth));
}

/** Resolve the cart's explicit overrides and recommendation defaults for one batch add. */
export function resolveSuggestionCart<TMark extends SuggestionMark>(
  suggestions: Array<[string, TMark]>,
  selections: Record<string, string>,
  protocols: SuggestibleTreatmentProtocol[],
): Array<{ tooth: string; protocolId: string }> {
  return suggestions
    .map(([tooth, mark]) => ({
      tooth,
      protocolId: selections[tooth] ?? suggestedProtocolId(mark.value, protocols),
    }))
    .filter(({ protocolId }) => protocols.some((protocol) => protocol.id === protocolId));
}
