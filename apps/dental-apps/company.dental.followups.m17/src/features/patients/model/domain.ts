// Selected pure declarations imported from Dental SaaS f0d059d36540b4b6907cace089085ce0df62d454.
import { formatBSShort, bsToAD, isValidADISO, todayNepalISO } from "@/shared/dates/nepaliDate";

export type FollowUpStatus = "overdue" | "due-today" | "upcoming";

export interface FollowUp {
  id: string;
  rowVersion: number;
  patient: string;
  patientId: string;
  phone: string;
  reason: string;
  lastVisit: string;
  dueLabel: string;
  // ISO "YYYY-MM-DD" the recall is due — what the date buckets (Today / week / month) run against.
  dueDate: string;
  time?: string;
  status: FollowUpStatus;
  doctor: string;
  // Attempt markers. Neither removes the row nor moves its date bucket — they are "what we did",
  // logged so tomorrow's desk knows it already tried. `noAnswer` is the "un-response" flag.
  called: boolean;
  noAnswer: boolean;
  // A caught recall is NOT hidden — the page is a record, not a hiding to-do list. It stays visible,
  // greyed and read-only, so filtering a date never shows an empty list when the data is really there.
  // `active` (outcome pending) is what the tile COUNTS use — the workload, "still to act on".
  active: boolean;
  caught: boolean;
}

function toLocalISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const DISPLAY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function todayISO(): string {
  return todayNepalISO();
}

export function formatDateShort(iso: string): string {
  if (!iso) return "";
  if (ISO_RE.test(iso)) return formatBSShort(iso);
  const legacy = DISPLAY_RE.exec(iso.trim());
  if (!legacy || Number(legacy[3]) >= 2070) return iso;
  const legacyISO = `${legacy[3]}-${legacy[2]}-${legacy[1]}`;
  const bs = formatBSShort(legacyISO);
  return bs === legacyISO ? iso : bs;
}

export function todayLabel(): string {
  const weekday = new Date().toLocaleDateString("en-GB", { weekday: "long", timeZone: "Asia/Kathmandu" });
  return `${weekday}, ${formatDateShort(todayISO())}`;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day); // local midnight; never `new Date(iso)`, which is UTC
}

export function addDaysISO(iso: string, days: number): string {
  const d = isoToLocalDate(iso);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

export function dueLabelFor(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "1 day overdue";
  return days < 0 ? `${-days} days overdue` : `In ${days} days`;
}

export function formatTime12(hhmm?: string): string {
  if (!hhmm) return "";
  const trimmed = hhmm.trim();
  const match = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (!match) return trimmed;
  const h24 = Number(match[1]);
  const m = Number(match[2]);
  if (h24 > 23 || m > 59) return trimmed;
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const minStr = String(m).padStart(2, "0");
  return `${h12}:${minStr} ${period}`;
}
