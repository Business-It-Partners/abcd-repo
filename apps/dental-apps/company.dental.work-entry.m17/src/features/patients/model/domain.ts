// Domain types, standing dental vocabulary, and pure helpers.
//
// This file holds NO clinic records. Patients, staff, cases, lab orders and finance all start
// empty and are entered through the app. What lives here is either a type, a pure function, or
// a dental-practice value list that populates a dropdown. The catalogs at the bottom are
// starting vocabulary a clinic edits in Settings — not seeded data.

import { type CanalChartData } from "@/features/work-entry/model/canalData";
import { formatBSShort, bsToAD, isValidADISO } from "@/shared/dates/nepaliDate";

export type FollowUpStatus = "overdue" | "due-today" | "upcoming";

// One worklist row = one patient's CURRENT recall. See FOLLOWUP_RECALL_UPGRADE_PLAN.md.
//
// The current recall is the FIRST entry in `followUpHistory` (the table is newest-first). The
// worklist reads only that entry — one row per patient, no duplicates — and buckets it by its date.
// `called` / `noAnswer` are persisted attempt markers read straight off that entry, so a tick
// survives a refresh: it is in Firestore, not a React ref.
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

// The product's name. The CLINIC's name is a Firestore document — see ClinicProfile. Only the
// sign-in screen may use this, because before you sign in nobody knows which clinic you are.
export const APP_NAME = "Sajilo Dental";

// The tenant record at `clinics/{clinicId}`, written by the super-admin console. Read-only here:
// `firestore.rules` says `allow write: if false`, so a clinic cannot rename itself.
export interface ClinicProfile {
  id: string;
  name: string;
  address: string;
  phone: string;
  adminEmail: string;
  active: boolean;
  createdAt: string; // ISO string, written server-side
}

// --- dates ---------------------------------------------------------------------------
// Everything resolves against the real system clock. Date-only strings are parsed at local
// midnight so a UTC-negative offset can't shift a visit onto the previous day.

function toLocalISO(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_RE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function todayISO(): string {
  return toLocalISO(new Date());
}

// "2026-07-15" (the storage format, and what every date input emits) -> "15/04/2083".
// Converts canonical AD ISO dates and legacy AD display strings to the Bikram Sambat numeric
// display form (DD/MM/YYYY). Modern BS display strings already have a BS year and pass through.
export function formatDateShort(iso: string): string {
  if (!iso) return "";
  if (ISO_RE.test(iso)) return formatBSShort(iso);
  const legacy = DISPLAY_RE.exec(iso.trim());
  if (!legacy || Number(legacy[3]) >= 2070) return iso;
  const legacyISO = `${legacy[3]}-${legacy[2]}-${legacy[1]}`;
  const bs = formatBSShort(legacyISO);
  return bs === legacyISO ? iso : bs;
}

// The inverse. Some records still carry the DISPLAY string as their date (visits, follow-up
// history); this turns one back into something sortable and comparable.
//
// After the BS migration, stored display dates are Bikram Sambat (e.g. "03/05/2083"). Before it,
// they were AD (e.g. "15/07/2026"). The two ranges don't overlap: BS years are >= 2070 while
// AD clinic data is <= ~2043. Dates with a BS year are converted back through the library;
// legacy AD dates are rearranged directly.
//
// Never hand a "15/07/2026" to `new Date()`: JavaScript reads slashes as MM/DD/YYYY and would
// silently give you 7 March.
export function displayToISO(display: string): string | null {
  const m = DISPLAY_RE.exec(display.trim());
  if (!m) return null;
  const year = Number(m[3]);
  if (year >= 2070) {
    // Bikram Sambat display date — convert through the BS→AD library.
    return bsToAD(year, Number(m[2]), Number(m[1]));
  }
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  return isValidADISO(iso) ? iso : null;
}

export function todayShort(): string {
  return formatDateShort(todayISO());
}

export function todayLabel(): string {
  const weekday = new Date().toLocaleDateString("en-GB", { weekday: "long" });
  return `${weekday}, ${formatDateShort(todayISO())}`;
}

// --- formatting ----------------------------------------------------------------------
export function formatNpr(n: number | null | undefined): string {
  if (n == null || isNaN(n as number)) return "Rs 0";
  return "Rs " + (n as number).toLocaleString("en-IN");
}

// Opens the chat DIRECTLY in the logged-in WhatsApp Web tab. `wa.me` / `api.whatsapp.com` bounce
// through an "Open app / Continue to WhatsApp Web" landing page first; `web.whatsapp.com/send` skips
// it, which is what the clinic wants when it already has WhatsApp Web signed in on the desk machine.
//
// The number must be a full international one, digits only. Nepali mobiles are usually stored as a
// bare 10-digit local number (98…) — WhatsApp can't resolve that, so a bare 10-digit local number
// gets 977 prepended. A number that already carries a country code is left untouched.
export function waLink(phone: string, message?: string): string {
  let digits = phone.replace(/[^0-9]/g, "");
  if (digits.length === 10 && digits.startsWith("9")) digits = `977${digits}`;
  const base = `https://web.whatsapp.com/send?phone=${digits}`;
  return message ? `${base}&text=${encodeURIComponent(message)}` : base;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, "")}`;
}

// Chart entries store whoever was signed in when no doctor was picked, which is an email. Nobody
// wants to read "grand@gmail.com" in a clinical log.
export function personLabel(who: string): string {
  const at = who.indexOf("@");
  return at > 0 ? who.slice(0, at) : who;
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Every part of a name reads with a starting capital, no matter how it was typed into the DB
// ("sagar shrestha" → "Sagar Shrestha"). Only the FIRST letter of each word is forced up; the rest
// is left as-is, so names that already carry capitals ("DR.Shrisha", "McKay") are never mangled.
export function titleCaseName(name: string): string {
  return (name || "").replace(/(^|\s)(\p{L})/gu, (_, sep, ch) => sep + (ch as string).toUpperCase());
}

// --- clinical safety -------------------------------------------------------------------
export const DRUG_ALLERGY_MAP: Record<string, string[]> = {
  penicillin: ["Amoxicillin", "Augmentin", "Penicillin"],
  nsaid: ["Ibuprofen", "Aspirin", "Naproxen", "Diclofenac"],
  "blood thinners": ["Warfarin", "Heparin", "Clopidogrel", "Aspirin"],
};

export function checkDrugAllergyConflict(drugName: string, alerts: string[]): string | null {
  if (!drugName || !alerts) return null;
  const normalizedDrug = drugName.toLowerCase();
  for (const alert of alerts) {
    const normAlert = alert.toLowerCase();
    if (normAlert.includes("penicillin")) {
      const triggers = DRUG_ALLERGY_MAP["penicillin"];
      if (triggers.some((t) => normalizedDrug.includes(t.toLowerCase()))) {
        return "Patient has a documented Penicillin allergy. Avoid Penicillins (e.g. Amoxicillin, Augmentin).";
      }
    }
    if (normAlert.includes("nsaid") || normAlert.includes("aspirin") || normAlert.includes("ibuprofen")) {
      const triggers = DRUG_ALLERGY_MAP["nsaid"];
      if (triggers.some((t) => normalizedDrug.includes(t.toLowerCase()))) {
        return "Patient has a documented NSAID/Aspirin allergy. Avoid NSAIDs (e.g. Ibuprofen).";
      }
    }
  }
  return null;
}

// --- patient record --------------------------------------------------------------------
export interface Visit {
  /** Canonical immutable /visits document that produced this rendered row. */
  visitId?: string;
  date: string;
  doctor: string;
  doctors?: string[];
  procedure: string;
  note?: string;
  tooth?: string;
  // The case (episode of care) this visit belongs to, so the clinical timeline can group visits
  // under the complaint that opened them. Absent on legacy visits and on any ad-hoc entry not
  // tied to a case — those fall into the timeline's "Other" group.
  caseId?: string;
  /** True when the displayed note is an append-only amendment, not the original text. */
  amended?: boolean;
  amendmentReason?: string;
}

/** One immutable sitting from /clinics/{cid}/visits. The UI expands its procedures into Visit rows. */
export interface ClinicalVisitRecord {
  id: string;
  patientId: string;
  patientName: string;
  caseId?: string;
  at: string;
  displayDate: string;
  doctor: string;
  sessionType: "new" | "continue";
  chiefComplaint?: string;
  procedures: Array<{
    procedureCode?: string;
    procedure: string;
    tooth?: string;
    caseStageOrder?: number;
    cost: number;
  }>;
  note?: string;
  recordedBy: string;
  /** Client ISO timestamp used only to order two encounters on the same service date. */
  recordedAt?: string;
  /** SHA-256 of the submitted encounter bundle; binds an idempotent retry to identical data. */
  payloadHash?: string;
  /** Append-only correction metadata. `amends` always points at the original visit. */
  amends?: string;
  amendmentKind?: "note" | "void";
  amendmentReason?: string;
  amendedBy?: string;
  amendmentAuditId?: string;
}

export type FollowUpOutcome = "pending" | "caught" | "missed";

// One follow-up entry in the patient's table (`followUpHistory`, newest-first). Every action —
// schedule, reschedule, mark caught, log a call — is captured here. See
// FOLLOWUP_RECALL_UPGRADE_PLAN.md.
//
// BACKWARD COMPATIBILITY: a live clinic's records were written by an older build as just
// `{ date, reason, doctor, outcome }`. The extra fields below are all OPTIONAL, so an old entry
// reads cleanly — the read layer defaults them (see `normalizeFollowUp`). Nothing is migrated in
// bulk; a record upgrades to the fuller shape the first time someone acts on it.
export interface PatientFollowUp {
  date: string;
  time?: string;
  reason: string;
  doctor: string;
  // The resolution: `pending` = active recall, `caught` = patient came back, `missed` = legacy
  // resolved (an old build marked a superseded recall this way). Only `pending` is actionable.
  outcome: FollowUpOutcome;
  // Type marker. A recall created by rescheduling a prior one carries `rescheduled: true` and badges
  // "Rescheduled"; `note` then reads "from <old date>". Absent = a plain scheduled recall.
  rescheduled?: boolean;
  note?: string;
  // Persisted attempt markers — the "Call" and "Un-response" ticks. Absent on legacy records → false.
  called?: boolean;
  noAnswer?: boolean;
  /** Logical removal metadata; the timeline entry remains in Firestore for audit. */
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

// Structured medical history — the safety spine of the record. `alerts[]` is DERIVED from
// this (via alertsFromHistory) so the point-of-treatment checks (allergy interlock,
// anticoagulant surgery warning) read one flat list.
export interface MedicalHistory {
  allergies: { substance: string; severity?: string }[];
  medications: { name: string; isAnticoagulant?: boolean }[];
  conditions: {
    diabetes?: boolean;
    cardiac?: boolean;
    hypertension?: boolean;
    pregnancy?: boolean;
    bleeding?: boolean;
    bloodThinners?: boolean; // anticoagulant — the one med flag that gates surgery
    other?: string[];
  };
  habits: { smoking?: boolean; bruxism?: boolean };
}

export interface EmergencyContact {
  name: string;
  relation: string;
  phone: string;
}

export interface DentalHistory {
  pastTreatments?: string;
  previousDentist?: string;
  notes?: string;
}

export const emptyMedicalHistory = (): MedicalHistory => ({
  allergies: [],
  medications: [],
  conditions: {},
  habits: {},
});

// Wording matches what the safety checks pattern-match on (e.g. "blood thinner",
// "Penicillin allergy").
export function alertsFromHistory(mh: MedicalHistory | undefined): string[] {
  if (!mh) return [];
  const out: string[] = [];
  mh.allergies.forEach((a) => a.substance && out.push(`${a.substance} allergy`));
  mh.medications
    .filter((m) => m.isAnticoagulant && m.name)
    .forEach((m) => out.push(`On blood thinners (${m.name})`));
  if (mh.conditions.bloodThinners) out.push("On blood thinners (anticoagulant)");
  if (mh.conditions.diabetes) out.push("Diabetic");
  if (mh.conditions.cardiac) out.push("Cardiac condition");
  if (mh.conditions.hypertension) out.push("Hypertension");
  if (mh.conditions.pregnancy) out.push("Pregnant");
  if (mh.conditions.bleeding) out.push("Bleeding disorder");
  (mh.conditions.other || []).forEach((o) => o && out.push(o));
  return out;
}

// IDENTITY: `id` is the Firestore document id, and it is the ONLY identifier. The name is an
// attribute — two patients called Bikash Tamang are two separate records with two separate
// charts, balances and allergy lists. Nothing in this app may key a patient by name again.
export interface PatientDetail {
  id: string; // Firestore document id
  patientNumber: string; // human-facing, e.g. "HDC-1042". Allocated from a transactional counter.
  // The day this record entered the system. Written as a serverTimestamp at registration and
  // normalised to an ISO string on read. Absent on patients registered before it was captured —
  // the directory falls back to their earliest visit date for those.
  createdAt?: string;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  deletionReason?: string;
  revision?: number;
  name: string;
  age: number;
  sex: "M" | "F";
  language: string;
  alerts: string[];
  balance: number;
  // Denormalized write-through fields retained in the document contract. DataGate replaces them
  // with a derivation across all open cases before any screen renders treatment progress.
  planTitle: string;
  planDone: number;
  planTotal: number;
  teeth: string[];
  visits: Visit[];
  notes: string;
  phone?: string;
  treatmentCost?: number;
  // LEGACY POINTER. Older builds also stored the current recall here. The table (`followUpHistory[0]`)
  // is now the source of truth; this is read only as a FALLBACK for old records whose table is empty,
  // so no legacy patient drops off the worklist. Still written by the create paths (harmless).
  nextFollowUp?: { date: string; time?: string; reason: string };
  followUpHistory?: PatientFollowUp[];
  /**
   * Read-only index fields for the Follow-ups worklist. They duplicate no clinical history:
   * `followUpHistory` remains the source of truth. Keeping the current due date and whether
   * the current recall is actionable on the patient document lets the desk read a 10-row queue
   * instead of downloading every patient merely to find today's recalls.
   *
   * They are absent on legacy records until the controlled index backfill runs. Readers must
   * continue to understand the historical `nextFollowUp` / `followUpHistory` shapes.
   */
  followUpIndexActive?: boolean;
  /** A current recall exists, including a completed one kept as a read-only worklist row. */
  followUpIndexPresent?: boolean;
  followUpIndexDueAt?: string;
  /** Query-only directory keys. They do not replace the clinical visit record. */
  directorySearchName?: string;
  directoryLastActivityAt?: string;
  directoryActive?: boolean;
  address?: string;
  emergencyContact?: EmergencyContact;
  medicalHistory?: MedicalHistory;
  dentalHistory?: DentalHistory;
  canalHistory?: CanalChartData[];
}

/** A patient-level context note. The note body is immutable after saving; removal is a soft delete. */
export interface PatientNote {
  id: string;
  body: string;
  recordedAt: string;
  recordedBy: string;
  deletedAt?: string;
  deletedBy?: string;
}

// --- recalls ---------------------------------------------------------------------------
// A recall is NOT its own collection. It is the patient's `nextFollowUp` seen from the front
// desk's side, so it can never disagree with the record — there is one fact, in one place.
//
// Dates on the patient document are dd/mm/yyyy display strings. Everything below compares them
// as ISO, because "09/07/2026" sorts before "10/01/2026" and `new Date("09/07/2026")` is September.

export function followUpDateISO(date: string): string | null {
  return isValidADISO(date) ? date : displayToISO(date);
}

function isoToLocalDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year, month - 1, day); // local midnight; never `new Date(iso)`, which is UTC
}

/** Whole days from today to `iso`. Negative = in the past. */
export function daysUntil(iso: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((isoToLocalDate(iso).getTime() - isoToLocalDate(todayISO()).getTime()) / MS_PER_DAY);
}

/** `iso` shifted by whole days, still ISO. Goes through local midnight, so a month or a DST edge
 *  can't slide the result onto the wrong day the way ISO string surgery would. */
export function addDaysISO(iso: string, days: number): string {
  const d = isoToLocalDate(iso);
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
}

/** "2026-07-14" -> "Tuesday, 30/03/2083". The day header on the appointment board. */
export function dayLabel(iso: string): string {
  const weekday = isoToLocalDate(iso).toLocaleDateString("en-GB", { weekday: "long" });
  return `${weekday}, ${formatDateShort(iso)}`;
}

/** "2026-07-14" -> "Tue". Column headers on a week view. */
export function weekdayShort(iso: string): string {
  return isoToLocalDate(iso).toLocaleDateString("en-GB", { weekday: "short" });
}

export function dueLabelFor(days: number): string {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "1 day overdue";
  return days < 0 ? `${-days} days overdue` : `In ${days} days`;
}

// Converts "14:30" -> "2:30 PM", "09:15" -> "9:15 AM", "9:00" -> "9:00 AM".
// Safely handles empty strings or already-formatted strings.
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

// The badge a timeline entry reads as. Type-based, not date-based: a superseded "scheduled" row
// stays "scheduled" in the record rather than flipping to "overdue".
export type FollowUpEntryKind = "scheduled" | "rescheduled" | "caught" | "missed";

// THE READ LAYER — speaks both data shapes. A modern entry carries `rescheduled` / `called` /
// `noAnswer`; a legacy entry is just `{ date, reason, doctor, outcome }`. Everything downstream reads
// the normalized result, so neither the worklist nor the timeline has to know which shape it got.
export interface NormalizedFollowUp {
  title: string;
  date: string; // as stored (dd/mm/yyyy display or ISO)
  time?: string;
  doctor: string;
  kind: FollowUpEntryKind;
  active: boolean; // outcome === "pending" — the only actionable state
  called: boolean;
  noAnswer: boolean;
  note?: string;
}

export function normalizeFollowUp(f: PatientFollowUp): NormalizedFollowUp {
  const kind: FollowUpEntryKind =
    f.outcome === "caught" ? "caught" : f.outcome === "missed" ? "missed" : f.rescheduled ? "rescheduled" : "scheduled";
  return {
    title: f.reason || "Follow-up",
    date: f.date,
    time: f.time,
    doctor: f.doctor || "—",
    kind,
    // A MISSING outcome means "written before outcomes were recorded", not "resolved". It must read
    // as still-active, or a legacy recall silently disappears from every worklist and the clinic
    // stops calling a patient who was never called. `outcome` is required in TypeScript but that is
    // compile-time only — a Firestore document written by an older build genuinely has no such field.
    // Erring toward active is the safe direction: showing a recall already handled costs one glance;
    // hiding a live one loses the patient.
    active: !f.outcome || f.outcome === "pending",
    called: f.called ?? false,
    noAnswer: f.noAnswer ?? false,
    note: f.note,
  };
}

/** The patient's CURRENT recall = the newest table entry, or the legacy `nextFollowUp` pointer when
 *  the table is empty (imported/older records). Returns null when there is no recall at all. */
export function currentFollowUp(p: PatientDetail): PatientFollowUp | null {
  const head = p.followUpHistory?.find((entry) => !entry.voidedAt);
  if (head) return head;
  if (p.nextFollowUp?.date) {
    return { date: p.nextFollowUp.date, time: p.nextFollowUp.time, reason: p.nextFollowUp.reason, doctor: p.visits?.[0]?.doctor ?? "—", outcome: "pending" };
  }
  return null;
}

/**
 * The two non-clinical fields that make the current worklist queryable. Do not put the
 * historical follow-up array into a query contract: Firestore cannot ask for the newest active
 * element of that array across every patient. The history remains on the patient document and
 * is still what the detail view and audit trail render.
 */
export function currentFollowUpIndex(patient: PatientDetail): Pick<PatientDetail, "followUpIndexActive" | "followUpIndexPresent" | "followUpIndexDueAt"> {
  const current = currentFollowUp(patient);
  const dueAt = current ? followUpDateISO(current.date) : null;
  if (!current || !dueAt) return { followUpIndexActive: false, followUpIndexPresent: false };
  return {
    followUpIndexActive: !current.outcome || current.outcome === "pending",
    followUpIndexPresent: true,
    followUpIndexDueAt: dueAt,
  };
}

/**
 * One row per patient — their CURRENT recall, off `currentFollowUp`. See
 * FOLLOWUP_RECALL_UPGRADE_PLAN.md.
 *
 * A recall is NOT dropped when caught — the page shows the record, so a caught recall stays as a
 * greyed, read-only row (`active: false`, `caught: true`); the VIEW counts only `active` ones toward
 * the tiles. Because we read exactly one entry per patient, a rescheduled recall (whose old entry is
 * now further down the table) can never double-count. Works on legacy records unchanged.
 */
export function deriveFollowUps(patients: PatientDetail[]): FollowUp[] {
  const rows: FollowUp[] = [];

  for (const p of patients) {
    const cur = currentFollowUp(p);
    if (!cur) continue;
    const n = normalizeFollowUp(cur);

    const dueDate = followUpDateISO(n.date);
    if (!dueDate) continue;

    const days = daysUntil(dueDate);
    rows.push({
      id: `${p.id}:${dueDate}`,
      rowVersion: 1,
      patient: p.name,
      patientId: p.id,
      phone: p.phone ?? "",
      reason: n.title,
      lastVisit: p.visits?.[0]?.date ?? "—",
      dueLabel: dueLabelFor(days),
      dueDate,
      time: n.time,
      status: days < 0 ? "overdue" : days === 0 ? "due-today" : "upcoming",
      doctor: n.doctor !== "—" ? n.doctor : p.visits?.[0]?.doctor ?? "—",
      called: n.called,
      noAnswer: n.noAnswer,
      active: n.active,
      caught: n.kind === "caught",
    });
  }

  // Most overdue first, then today, then soonest upcoming.
  return rows.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

// --- money -----------------------------------------------------------------------------
// `charge` = work billed. `payment` = cash taken. `adjustment` = a correction, posted as its own
// entry because the ledger is append-only. A patient's balance is charges − payments − adjustments.
export type LedgerType = "charge" | "payment" | "adjustment";

// How a payment was taken. Cash first (the default), then the wallets and rails a Nepali clinic
// actually sees. A clinic edits this list nowhere yet — it is short and stable enough to live here.
export const PAYMENT_METHODS = ["Cash", "eSewa", "Khalti", "Card", "Bank transfer", "Cheque"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export interface LedgerEntry {
  id: string; // Firestore document id
  recordedAt: string; // ISO datetime — what the books are ordered by
  date: string; // ISO date the money moved, which is not always today
  patientId: string;
  patientName: string; // denormalized for display
  type: LedgerType;
  amount: number; // always positive; `type` carries the direction. For a PAYMENT this is cash taken.
  doctor?: string;
  note?: string;
  method?: string; // how a PAYMENT was taken (Cash, eSewa, …); absent on charges/adjustments
  // A discount is a COLUMN on the settlement, not a row of its own — it rides on the PAYMENT entry
  // that settles the visit. Balance drops by amount + discount; the statement shows it in a Discount
  // column beside the cash, never as a separate line.
  discount?: number;
  /** Adjustment direction; ordinary charges/payments derive their direction from `type`. */
  balanceDirection?: "increase" | "decrease";
  /** An append-only correction reverses this original entry. */
  reversesEntryId?: string;
  /** A corrected replacement points back to the original entry. */
  supersedesEntryId?: string;
  correctionReason?: string;
  recordedBy?: string;
  /** The immutable clinical encounter that produced this line. */
  visitId?: string;
  caseId?: string;
  caseStageOrder?: number;
}

export type NewLedgerEntry = Omit<LedgerEntry, "id" | "recordedAt">;

/** What the front desk collected today. Derived from the books, never counted alongside them. */
export function todaysTakings(ledger: LedgerEntry[]): { collectedToday: number; paymentsToday: number } {
  const today = todayISO();
  const payments = ledger.filter((e) => e.type === "payment" && e.date === today);
  return {
    collectedToday: payments.reduce((sum, e) => sum + e.amount, 0),
    paymentsToday: payments.length,
  };
}

// --- money OUT: clinic spending ---------------------------------------------------------
// The ledger above is money IN (what patients pay). This is money OUT — everything the clinic
// spends. One append-only stream, exactly like the ledger, with a `type` that carries the kind:
//   expense  = operational outflow (rent, utilities, a lab's bill)
//   purchase = stock/consumables bought (carries item + quantity)
//   salary   = a staff payout (carries staffId + month)
// Append-only for the same reason the books are: spending you can silently edit is spending nobody
// can trust. A mistake is corrected with a new, opposite entry, never by rewriting the original.
export type ExpenseType = "expense" | "purchase" | "salary" | "lab_expense";

// A clinic edits this nowhere yet — short and stable enough to live here, like PAYMENT_METHODS.
// No "Salaries" here — staff pay has its own tab and its own entry flow. Offering it as a general
// expense category would let the same money-out be booked twice, under two shapes.
export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities",
  "Lab bills",
  "Consumables",
  "Equipment",
  "Marketing",
  "Maintenance",
  "Taxes & fees",
  "Other",
] as const;

// --- products & suppliers (PRODUCTS_PURCHASING_PLAN.md) ------------------------------------

// A product is an IDENTITY, not a price. What a composite kit costs changes with the supplier, the
// batch and the quantity, so the money lives on the PURCHASE LINE and never here — a price stored
// on the product would be a stale "last price" that quietly misleads.
export const PRODUCT_UNITS = ["box", "packet", "piece", "set", "bottle", "tube", "ml", "gram"] as const;

export const PRODUCT_CATEGORIES = [
  "Consumable",
  "Instrument",
  "PPE",
  "Lab material",
  "Office",
  "Other",
] as const;

export interface Product {
  id: string; // Firestore document id
  name: string;
  /**
   * NOT cosmetic. "2 gloves" and "2 boxes of gloves" differ by a hundredfold, and without the unit
   * no spend total — or any later stock count — can be trusted.
   */
  unit: string;
  category: string;
  /** Retired, never deleted: a deleted product would break every purchase that referenced it. */
  active: boolean;
  note?: string;
}

/** Provenance shared by financial records that can be corrected after entry. */
export interface CorrectionMetadata {
  revision?: number;
  updatedAt?: string;
  updatedBy?: string;
  correctionReason?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
}

// Who the clinic BUYS FROM. Deliberately not `LabSupplier`, which is who it SENDS WORK TO — same
// contact fields, opposite direction, and merging them would put the glove supplier in Lab Tracker.
export interface Supplier {
  id: string; // Firestore document id
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;

  /**
   * What was ALREADY owed to this party on the day the clinic started keeping the ledger here.
   *
   * This is what makes the upgrade need no migration. Purchases recorded before the cutover live
   * in `expenses` and already mean "money that left" — which was true when they were written.
   * Rather than have a script guess whether a July invoice was ever settled, the clinic states the
   * one number it actually knows: what it owes today. Everything before that date is settled by
   * definition, and every statement starts from a figure a human confirmed.
   *
   * Negative is legal: a clinic that has paid a lab in advance is in credit.
   */
  openingBalance: number;
  /**
   * The date `openingBalance` was true. Without it the opening row has no position in a
   * date-sorted statement, and a back-dated purchase would sort above it and make every
   * balance below it wrong.
   */
  openingAsOf: string; // ISO date

  /** Read-only balance returned by the active Worker projection. */
  currentDueAmount?: number;

  /**
   * A dental lab rather than a goods supplier. Same fields, same ledger, same statement — a lab
   * is simply a party the clinic owes money to. The flag only decides which page lists it, and
   * it is never shown as a field in any form.
   */
  isLab: boolean;
}

/**
 * One received invoice — a BILL, not a payment.
 *
 * Kept apart from `expenses` on purpose. `expenses` is the cash book: every row there is money
 * that left. An invoice may be unpaid, part paid, or paid weeks later, so it cannot live in a
 * book whose whole meaning is "this money is gone".
 *
 * Note what is NOT here: no `amountPaid`, no `balance`, no `status`. What is still owed is a
 * question about the SUPPLIER, not about one bill — see `supplierBalance`.
 */
export interface Purchase extends CorrectionMetadata {
  id: string; // Firestore document id
  supplierId: string;
  /** Denormalised so a renamed or deleted supplier cannot blank out invoice history. */
  supplierName: string;
  date: string; // ISO date the goods/work were received
  invoiceNo?: string; // the supplier's own invoice number, if they gave one
  lines: PurchaseLine[];
  /** The line sum, and nothing else. No editable total, no discount row, no tax row. */
  totalAmount: number;
  discount?: number;
  note?: string;
  /** A lab invoice is a supplier purchase too, but its lines describe lab work rather than products. */
  kind?: "product" | "lab_service";
  recordedAt: string; // ISO datetime — provenance
  recordedBy?: string;
  /** Set only when the payment was entered with this purchase. Later supplier payments stay independent. */
  paymentId?: string;
  /** Set on a corrected replacement; the original remains as a voided audit record. */
  correctsPurchaseId?: string;
}

export type NewPurchase = Omit<Purchase, "id">;

/**
 * Money paid to a supplier or lab.
 *
 * A payment entered together with a purchase may carry that purchase's id. Payments entered later
 * remain unlinked because a clinic may settle several invoices with one consolidated amount.
 */
export interface SupplierPayment extends CorrectionMetadata {
  id: string; // Firestore document id
  supplierId: string;
  supplierName: string; // denormalised, same reason as Purchase
  date: string; // ISO date the money moved — may be back-dated
  amount: number; // always positive
  method: string; // Cash, Cheque, Bank transfer, …
  reference?: string; // cheque number, transaction id
  note?: string;
  /** Present only for a payment entered directly with one purchase. */
  purchaseId?: string;
  recordedAt: string;
  recordedBy?: string;
}

export type NewSupplierPayment = Omit<SupplierPayment, "id">;

/**
 * What the clinic owes a party right now.
 *
 * Always computed, never stored. A running balance kept on the supplier document is a second
 * source of truth, and the two drift apart the first moment a write half-fails — leaving no way
 * to tell which one is lying.
 */
export function supplierBalance(
  supplier: Pick<Supplier, "id" | "openingBalance">,
  purchases: Purchase[],
  payments: SupplierPayment[],
): number {
  const owed = purchases
    .filter((p) => p.supplierId === supplier.id && !p.voidedAt)
    .reduce((t, p) => t + p.totalAmount, 0);
  const paid = payments
    .filter((p) => p.supplierId === supplier.id && !p.voidedAt)
    .reduce((t, p) => t + p.amount, 0);
  // `?? 0` is not belt-and-braces: supplier docs written before this upgrade genuinely have no
  // openingBalance, and `undefined + 5000` is NaN — which renders as "Rs NaN" on the tile.
  return (supplier.openingBalance ?? 0) + owed - paid;
}

export type StatementKind = "opening" | "purchase" | "payment";

export interface StatementRow {
  key: string;
  kind: StatementKind;
  date: string;
  description: string;
  /** Each row fills EITHER paid OR due — never both. `balance` always fills. */
  paid: number | null;
  due: number | null;
  balance: number;
}

/**
 * The account statement: opening balance, then every purchase and payment in date order, with the
 * balance after each one.
 */
export function buildSupplierStatement(
  supplier: Pick<Supplier, "id" | "openingBalance" | "openingAsOf">,
  purchases: Purchase[],
  payments: SupplierPayment[],
): StatementRow[] {
  const rows: Omit<StatementRow, "balance">[] = [
    {
      key: "opening",
      kind: "opening",
      // A legacy supplier has no as-of date. Epoch sorts it first, which is correct: whatever
      // it owes predates everything the ledger knows about.
      date: supplier.openingAsOf || "1970-01-01",
      description: "Opening balance",
      paid: null,
      due: null,
    },
    ...purchases
      .filter((p) => p.supplierId === supplier.id && !p.voidedAt)
      .map((p) => ({
        key: `pur_${p.id}`,
        kind: "purchase" as const,
        date: p.date,
        // Invoice and product-line detail stays behind the row's Detail action. The statement
        // itself is the concise financial timeline: one invoice is simply one purchase.
        description: "Purchase",
        paid: null,
        due: p.totalAmount,
      })),
    ...payments
      .filter((p) => p.supplierId === supplier.id && !p.voidedAt)
      .map((p) => ({
        key: `pay_${p.id}`,
        kind: "payment" as const,
        date: p.date,
        description: `Payment · ${p.method}${p.reference ? ` · ${p.reference}` : ""}`,
        paid: p.amount,
        due: null,
      })),
  ];

  // Same-day order is not cosmetic. Goods arrive, then money leaves. Put the payment first and the
  // balance dips negative on a line where the clinic was never in credit — read down that column
  // once and you stop trusting the statement.
  const rank: Record<StatementKind, number> = { opening: 0, purchase: 1, payment: 2 };
  rows.sort((a, b) => a.date.localeCompare(b.date) || rank[a.kind] - rank[b.kind]);

  let running = 0;
  return rows.map((r) => {
    if (r.kind === "opening") running = supplier.openingBalance ?? 0;
    else if (r.kind === "purchase") running += r.due ?? 0;
    else running -= r.paid ?? 0;
    return { ...r, balance: running };
  });
}

/**
 * One line of a supplier invoice.
 *
 * `productName` is denormalized on purpose: a purchase is a financial record and must still read
 * correctly in five years whether or not that product still exists. The id is the link, the name is
 * the evidence. `amount` is what the LINE cost as printed — not unit price, which is derivable and
 * would make someone do arithmetic with a paper invoice in hand.
 */
export interface PurchaseLine {
  productId: string;
  productName: string;
  quantity: number;
  unit?: string;
  rate?: number;
  amount: number;
  note?: string;
}

export interface ExpenseEntry extends CorrectionMetadata {
  id: string; // Firestore document id
  recordedAt: string; // ISO datetime — what the money-out book is ordered by
  date: string; // ISO date the money actually left
  type: ExpenseType;
  category: string; // from EXPENSE_CATEGORIES for an expense; "Salaries"/"Consumables" for the others
  amount: number; // always positive
  payee?: string; // vendor, supplier, or staff name
  method?: string; // how it was paid (Cash, Bank transfer, …)
  note?: string;
  recordedBy?: string; // the account that entered it — provenance, stamped client-side
  // purchase only — the original single-item shape. Kept because stored purchases use it and
  // nothing is migrated; the list renders either shape (see PRODUCTS_PURCHASING_PLAN.md §7).
  item?: string;
  quantity?: number;
  // purchase only — the multi-line shape. One invoice is ONE entry: `amount` is the invoice total
  // and `payee` the supplier, so every existing month filter and total keeps working untouched.
  supplierId?: string;
  invoiceNo?: string;
  lines?: PurchaseLine[];
  // salary only. `amount` is the total paid (base + allowance); the two parts are kept so a payslip
  // can show the breakdown.
  staffId?: string;
  staffName?: string;
  month?: string; // the payroll month, "YYYY-MM"
  base?: number;
  allowance?: number;
}

export type NewExpenseEntry = Omit<ExpenseEntry, "id" | "recordedAt">;

// --- staff -----------------------------------------------------------------------------
export interface SalaryPayout {
  month: string;
  base: number;
  allowance: number;
  status: "paid" | "pending";
}

export interface StaffMember {
  id: string; // Firestore document id. Never the name — names repeat and names change.
  name: string;
  role: string;
  type: "doctor" | "staff"; // a "doctor" is what every doctor picker in the app derives from
  phone: string;
  email: string;
  salary: number;
  joinedDate: string; // ISO "YYYY-MM-DD"
  specialty?: string;
  education?: string;
  experience?: string;
  /** Patient photos are private Worker/R2 media. */
  photoProvider?: "r2" | "none";
  photoUrl?: string;
  payouts: SalaryPayout[];
}

// --- lab -------------------------------------------------------------------------------
// Dispatch workflow: Pending → Sent → Received → Fitted.
// "In Lab" was removed — it conveyed no new information for the clinic (the work is simply
// with the lab between Sent and Received). Orders that still carry "In Lab" in Firestore
// are treated as "Sent" for display and advancement logic (see normaliseLabStatus).
export const LAB_ORDER_STATUSES = ["Pending", "Sent", "Received", "Fitted"] as const;
export type LabOrderStatus = (typeof LAB_ORDER_STATUSES)[number];

/** Legacy status value present in Firestore orders created before the 3-stage simplification. */
export type LegacyLabStatus = LabOrderStatus | "In Lab";

/**
 * Normalises a status value that may have been written by old code.
 * "In Lab" → "Sent"  (still with lab, hasn't returned yet).
 * All other values pass through unchanged.
 */
export function normaliseLabStatus(s: string): LabOrderStatus {
  if (s === "In Lab") return "Sent";
  if ((LAB_ORDER_STATUSES as readonly string[]).includes(s)) return s as LabOrderStatus;
  return "Pending"; // safe fallback for an order that has not yet been dispatched
}

// One step in a lab order's life, kept so the detail view can show the whole journey — when it went
// out, when it came back, when it was fitted — not just where it is now. Appended, never rewritten.
export interface LabStatusEvent {
  status: LabOrderStatus;
  date: string; // ISO date the step happened
  by: string; // who moved it
}

// A lab is not a second database entity: it is a Supplier with `isLab: true`. This alias keeps
// the clinical components readable while ensuring the lab tracker and finance share one record.
export type LabSupplier = Supplier;

export function labSupplierBalance(
  lab: Pick<LabSupplier, "id" | "openingBalance">,
  purchases: Purchase[],
  payments: SupplierPayment[],
): number {
  const opening = lab.openingBalance ?? 0;
  const charged = purchases
    .filter((p) => p.supplierId === lab.id && p.kind === "lab_service")
    .reduce((sum, p) => sum + p.totalAmount, 0);
  const paid = payments
    .filter((p) => p.supplierId === lab.id)
    .reduce((sum, p) => sum + p.amount, 0);
  return opening + charged - paid;
}

export interface LabStatementRow {
  key: string;
  kind: "opening" | "order" | "payment";
  date: string;
  description: string;
  paid: number | null;
  due: number | null;
  balance: number;
}

export function buildLabSupplierStatement(
  lab: Pick<LabSupplier, "id" | "openingBalance" | "openingAsOf">,
  purchases: Purchase[],
  payments: SupplierPayment[],
): LabStatementRow[] {
  const rows: Omit<LabStatementRow, "balance">[] = [
    {
      key: "opening",
      kind: "opening",
      date: lab.openingAsOf || "1970-01-01",
      description: "Opening balance",
      paid: null,
      due: null,
    },
    ...purchases
      .filter((p) => p.supplierId === lab.id && p.kind === "lab_service")
      .map((p) => ({
        key: `bill_${p.id}`,
        kind: "order" as const,
        date: p.date,
        description: `Lab Bill${p.invoiceNo ? ` · Invoice ${p.invoiceNo}` : ""}${p.note ? ` · ${p.note}` : ""}`,
        paid: null,
        due: p.totalAmount,
      })),
    ...payments
      .filter((p) => p.supplierId === lab.id)
      .map((p) => ({
        key: `pay_${p.id}`,
        kind: "payment" as const,
        date: p.date,
        description: `Payment · ${p.method}${p.reference ? ` · ${p.reference}` : ""}`,
        paid: p.amount,
        due: null,
      })),
  ];

  const rank: Record<"opening" | "order" | "payment", number> = { opening: 0, order: 1, payment: 2 };
  rows.sort((a, b) => a.date.localeCompare(b.date) || rank[a.kind] - rank[b.kind]);

  let running = 0;
  return rows.map((r) => {
    if (r.kind === "opening") running = lab.openingBalance ?? 0;
    else if (r.kind === "order") running += r.due ?? 0;
    else running -= r.paid ?? 0;
    return { ...r, balance: running };
  });
}

export interface LabOrder extends CorrectionMetadata {
  id: string; // Firestore document id
  patientId: string; // → PatientDetail.id. Two patients share a name; they never share this.
  patientName: string; // denormalized for display
  procedure: string;
  tooth: string;
  shade: string;
  labId: string; // → LabSupplier.id
  labName: string; // denormalized for display; the lab may later be renamed or deactivated
  sentDate: string;
  status: LabOrderStatus; // the CURRENT step; the latest entry in statusHistory
  notes?: string;
  // Legacy values retained only so old records still render. New clinical lab orders never write a
  // supplier price: the actual external cost belongs on the monthly purchase bill in Finance.
  price?: number;
  /** Purchase-line details captured when work is sent; `price` remains the total for older orders. */
  quantity?: number;
  unit?: string;
  rate?: number;
  // The case this work belongs to, so the patient's Lab tab can group by chief complaint. Optional
  // for back-compat: orders sent before this field existed simply have no case.
  caseId?: string;
  visitId?: string;
  // The full status journey. Optional for back-compat — a legacy order shows just its current status.
  statusHistory?: LabStatusEvent[];
}

// A dispensed drug line, held in the patient's append-only `prescriptions` subcollection.
// `date` is the dd/mm/yyyy the clinic reads; `recordedAt` is what the log is ORDERED by, because
// several scripts can be issued on one date and a display string cannot separate them.
export interface Prescription {
  id: string; // Firestore document id
  recordedAt: string; // ISO datetime, client clock
  date: string;
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
  doctor: string;
  visitId?: string;
  caseId?: string;
  /** A correction/tombstone is a new record which points at the prescription it replaces. */
  supersedes?: string;
  correctionKind?: "amend" | "void";
  correctionReason?: string;
  correctedBy?: string;
}

/** A prescription before Firestore has taken it: no document id, no recorded timestamp yet. */
export type NewPrescription = Omit<Prescription, "id" | "recordedAt">;

// ===========================================================================
// Dental-practice vocabulary — the dropdown values, not clinic records.
// A clinic tunes these in Settings; they exist so the pickers aren't empty on day one.
// ===========================================================================

export interface ProcedureCatalogItem {
  code: string;
  name: string;
  category: string;
  defaultCost: number;
}

export interface PrescriptionPreset {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export const defaultProcedureCatalog: ProcedureCatalogItem[] = [
  { code: "PROC-001", name: "New Patient Consultation & X-ray", category: "Diagnostic", defaultCost: 1500 },
  { code: "PROC-002", name: "Scaling & Polish", category: "Preventive", defaultCost: 2500 },
  { code: "PROC-003", name: "Composite Restoration (Filling)", category: "Restorative", defaultCost: 4000 },
  { code: "PROC-004", name: "Simple Extraction", category: "Surgery", defaultCost: 3000 },
  { code: "PROC-005", name: "Surgical Wisdom Extraction", category: "Surgery", defaultCost: 12000 },
  { code: "PROC-006", name: "Root Canal Treatment (RCT)", category: "Endodontics", defaultCost: 8000 },
  { code: "PROC-007", name: "Zirconia Crown Prep & Fitting", category: "Prosthodontics", defaultCost: 18500 },
];

export const defaultPrescriptionPresets: PrescriptionPreset[] = [
  { medicine: "Amoxicillin 500mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "5 days", instructions: "Take after meals" },
  { medicine: "Ibuprofen 400mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "3 days", instructions: "Take after meals for pain" },
  { medicine: "Paracetamol 500mg", dosage: "1 tablet", frequency: "As needed (SOS)", duration: "3 days", instructions: "Take for pain/fever" },
  { medicine: "Metronidazole 400mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "5 days", instructions: "Avoid alcohol completely" },
];
