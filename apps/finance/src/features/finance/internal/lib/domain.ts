export { formatDateShort, todayISO } from "@/shared/dates/nepaliDate";

export function formatNpr(amount: number | null | undefined): string {
  if (amount == null || Number.isNaN(amount)) return "Rs 0";
  return `Rs ${amount.toLocaleString("en-IN")}`;
}
