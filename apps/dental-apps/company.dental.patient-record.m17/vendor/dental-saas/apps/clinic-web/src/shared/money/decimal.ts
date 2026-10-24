export function decimalInput(value: string, decimalPlaces: number): string {
  const normalized = value.replace(/[^\d.]/g, "");
  const [whole = "", ...fractionParts] = normalized.split(".");
  const fraction = fractionParts.join("").slice(0, decimalPlaces);
  const integer = whole.replace(/^0+(?=\d)/, "");
  if (!normalized.includes(".")) return integer;
  return `${integer || "0"}.${fraction}`;
}

export function decimalNumber(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundDecimal(value: number, decimalPlaces: number): number {
  const factor = 10 ** decimalPlaces;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export const roundMoney = (value: number): number => roundDecimal(value, 2);
export const roundQuantity = (value: number): number => roundDecimal(value, 3);
