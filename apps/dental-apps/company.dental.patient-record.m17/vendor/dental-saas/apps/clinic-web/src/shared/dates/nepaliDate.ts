/**
 * Global Bikram Sambat date boundary for the clinic UI.
 *
 * Data remains Gregorian ISO (`YYYY-MM-DD`) in APIs and storage. This module
 * provides the single presentation-layer import path for the Nepali calendar.
 */
import { formatBSShort } from "./bikramSambat";

export * from "./bikramSambat";

/** Returns today's canonical ISO date in the clinic's Nepal time zone. */
export function todayNepalISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (kind: string) => parts.find((part) => part.type === kind)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

/** Returns today's local calendar date in the API's canonical AD ISO form. */
export function todayISO(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Formats an AD ISO or legacy AD display date as a short Bikram Sambat date. */
export function formatDateShort(value: string): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return formatBSShort(value);
  const legacy = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!legacy || Number(legacy[3]) >= 2070) return value;
  const converted = formatBSShort(`${legacy[3]}-${legacy[2]}-${legacy[1]}`);
  return converted === `${legacy[3]}-${legacy[2]}-${legacy[1]}` ? value : converted;
}
