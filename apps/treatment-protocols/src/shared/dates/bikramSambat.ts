// Bikram Sambat (BS) date utilities.
//
// Every date in the system is STORED as an AD ISO string ("2026-08-18"). This module provides the
// display-layer conversion to/from Nepali Bikram Sambat dates. All other files import from HERE,
// never from the underlying library — so swapping the library or extending the conversion table
// is a one-file change.
//
// The library's conversion table reaches BS 2099 in one direction, but its AD converter stops at
// AD 2040. Keeping the picker inside BS 2070–2096 gives us a complete round-trip range: every date
// a user can pick can also be converted back and displayed as BS. Dates outside that range fall
// back to the stored value rather than crashing.

import { adToBs, bsToAd } from "@sbmdkl/nepali-date-converter";

// --- constants -------------------------------------------------------------------

const BS_MONTHS_LONG = [
  "Baisakh", "Jestha", "Ashadh",
  "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush",
  "Magh", "Falgun", "Chaitra",
] as const;

const BS_MONTHS_SHORT = [
  "Bai", "Jes", "Ash",
  "Shr", "Bhd", "Asw",
  "Kar", "Man", "Pou",
  "Mag", "Fal", "Cha",
] as const;

export { BS_MONTHS_LONG, BS_MONTHS_SHORT };

// The library's supported BS year range. The DatePicker year selector and the MonthPicker both
// clamp to this so a user can't navigate into a range that would throw.
export const BS_YEAR_MIN = 2070; // ~2013 AD — well before any clinic data
export const BS_YEAR_MAX = 2096; // last full BS year supported by both conversion directions

// --- core conversions ------------------------------------------------------------

export interface BSDate {
  year: number;
  month: number; // 1–12
  day: number;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad = (n: number) => String(n).padStart(2, "0");

export function isValidADISO(iso: string): boolean {
  if (!ISO_RE.test(iso)) return false;
  const [year, month, day] = iso.split("-").map(Number);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12 || day < 1) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day <= daysInMonth;
}

/**
 * Convert an AD ISO date to BS components. Returns null if the date is outside the library's range.
 */
export function adToBS(iso: string): BSDate | null {
  if (!iso || !isValidADISO(iso)) return null;
  try {
    const bs = adToBs(iso); // "2083-05-02"
    if (!ISO_RE.test(bs)) return null;
    const [y, m, d] = bs.split("-").map(Number);
    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d) || m < 1 || m > 12 || d < 1 || d > 32) return null;
    return { year: y, month: m, day: d };
  } catch {
    return null;
  }
}

/**
 * Convert BS components back to an AD ISO string. Returns null on out-of-range.
 */
export function bsToAD(year: number, month: number, day: number): string | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 32) return null;
  try {
    const iso = bsToAd(`${year}-${pad(month)}-${pad(day)}`);
    return isValidADISO(iso) ? iso : null;
  } catch {
    return null;
  }
}

// --- display formatters ----------------------------------------------------------

/**
 * "2026-08-18" → "2 Bhadra 2083"
 *
 * The primary display format. Falls back to the raw ISO string if conversion fails.
 */
export function formatBS(iso: string): string {
  const bs = adToBS(iso);
  if (!bs) return iso;
  return `${bs.day} ${BS_MONTHS_LONG[bs.month - 1]} ${bs.year}`;
}

/**
 * "2026-08-18" → "03/05/2083"  (DD/MM/YYYY in BS)
 *
 * Numeric short format, same shape as the old Gregorian display.
 */
export function formatBSShort(iso: string): string {
  const bs = adToBS(iso);
  if (!bs) return iso;
  return `${pad(bs.day)}/${pad(bs.month)}/${bs.year}`;
}

/**
 * Today's date in BS.
 */
export function todayBS(): BSDate | null {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const iso = `${now.getFullYear()}-${month}-${day}`;
  return adToBS(iso);
}

// --- month helpers ---------------------------------------------------------------

/**
 * Full month name for a 1-indexed BS month number.
 */
export function bsMonthName(month: number): string {
  return BS_MONTHS_LONG[(month - 1) % 12] ?? "";
}

/**
 * Short month label for a 1-indexed BS month number.
 */
export function bsMonthShort(month: number): string {
  return BS_MONTHS_SHORT[(month - 1) % 12] ?? "";
}

/**
 * "Shrawan 2083" — for MonthPicker labels and headers.
 */
export function formatBSMonthYear(year: number, month: number): string {
  return `${BS_MONTHS_LONG[(month - 1) % 12]} ${year}`;
}

/**
 * Number of days in a given BS month. Probes the converter so the final table month is handled
 * even when the next BS year's first day is outside the library range. Returns 30 as a safe
 * fallback on out-of-range.
 */
export function daysInBSMonth(bsYear: number, bsMonth: number): number {
  // Probe the converter directly instead of diffing against the next month's first day. The
  // converter can represent BS 2099-12, but not BS 2100-01, so the old next-month approach
  // silently rendered the final supported month as a 30-day month.
  if (!Number.isInteger(bsYear) || !Number.isInteger(bsMonth) || bsMonth < 1 || bsMonth > 12) return 30;
  if (!bsToAD(bsYear, bsMonth, 1)) return 30;
  for (let day = 2; day <= 32; day += 1) {
    if (!bsToAD(bsYear, bsMonth, day)) return day - 1;
  }
  return 30;
}

// --- MonthPicker integration -----------------------------------------------------

/**
 * The AD date range that a BS month covers.
 *
 * "Shrawan 2083" spans roughly 2026-07-17 to 2026-08-16 — this returns both endpoints as ISO
 * strings so a filter can check `start <= record.date <= end`.
 */
export function bsMonthToADRange(bsYear: number, bsMonth: number): { start: string; end: string } | null {
  const start = bsToAD(bsYear, bsMonth, 1);
  const days = daysInBSMonth(bsYear, bsMonth);
  const end = bsToAD(bsYear, bsMonth, days);
  if (!start || !end) return null;
  return { start, end };
}

/**
 * Check if an AD ISO date falls within a BS month value ("2083-04" format).
 *
 * This is the core filter helper that replaces `date.slice(0, 7) === month` everywhere.
 */
export function isInBSMonth(adISO: string, bsMonthValue: string): boolean {
  if (!adISO || !bsMonthValue) return false;
  if (bsMonthValue === "all") return true;
  const bs = adToBS(adISO);
  if (!bs) return false;
  const [y, m] = bsMonthValue.split("-").map(Number);
  return bs.year === y && bs.month === m;
}

/**
 * Today's BS month as a "YYYY-MM" string, for initializing MonthPicker values.
 */
export function todayBSMonth(): string {
  const bs = todayBS();
  if (!bs) {
    // Fallback: use AD month (should never happen in practice for 2026)
    const now = new Date();
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  }
  return `${bs.year}-${pad(bs.month)}`;
}

/**
 * Convert an AD "YYYY-MM" to the equivalent BS month "YYYY-MM" by converting the final day of
 * that AD month. Used to translate `max` props from AD to BS.
 */
export function adMonthToBSMonth(adYYYYMM: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(adYYYYMM);
  if (!match) return adYYYYMM;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return adYYYYMM;
  // A month-level max must include the BS month containing the LAST AD day. Using day 15 made
  // August 2026 (which ends in BS 2083-05) cap the picker at BS 2083-04.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const bs = adToBS(`${adYYYYMM}-${pad(lastDay)}`);
  if (!bs) return adYYYYMM;
  return `${bs.year}-${pad(bs.month)}`;
}

/**
 * Label for a BS month value: "2083-04" → "Shrawan 2083". Handles "all" gracefully.
 */
export function bsMonthLabel(value: string, allLabel = "All months"): string {
  if (value === "all") return allLabel;
  const [y, m] = value.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return allLabel;
  return `${BS_MONTHS_LONG[m - 1]} ${y}`;
}
