// Clinical charts — the odontogram and periodontal chart. These are DEFAULT, PERMANENT,
// ONE-PER-PATIENT facets of every patient record (see CASE_ENTRY_SYSTEM_PLAN.md §"charts
// belong to the patient, not the case"). They exist from patient creation (empty), are
// longitudinal (dated history, never overwritten), and are SURFACED conditionally in the
// UI — existence is unconditional, display is "if needed".

import { bsToAD } from "@/shared/dates/nepaliDate";

// ---------------------------------------------------------------------------
// Odontogram — a dated, append-only log of what happened to each tooth.
//
// A tooth is NOT one condition. It is several independent facts that coexist: a molar can be
// root-treated AND crowned AND have been filled before that. Storing one "state" per tooth makes
// them fight, and the newest one silently erases the rest — so a crown hides the root canal
// underneath it, and years later nobody knows the tooth is endodontically treated.
//
// So each entry changes exactly ONE SLOT. Current state is the newest entry PER SLOT, and the
// slots never overwrite each other.
//
// A slot with no entries is UNRECORDED, which is not the same as healthy. A tooth nobody has
// looked at must render blank. Writing "sound" for it is a false statement in a medical record.
// ---------------------------------------------------------------------------

export type ToothSlot = "presence" | "structure" | "endodontics" | "prosthesis";

/**
 * Is the tooth there, and has it erupted?
 *
 * "extracted" = we took it out. "shed" = a baby tooth that fell out on its own, which is normal
 * development, not a loss. "missing" = absent, reason unknown or congenital — what you record when
 * a new patient arrives with a gap and nobody knows the story.
 *
 * NOT here: mobility. That is a periodontal measurement (grade 0-3) and it already lives on the
 * perio chart. Two homes for one fact means two answers.
 */
export type PresenceState =
  | "erupted"
  | "unerupted"
  | "impacted"
  | "extracted"
  | "shed"
  | "missing"
  | "implant"
  | "mobility";

/** The crown of the tooth itself: is it sound, carious, or restored? */
export type StructureState = "sound" | "decayed" | "filled" | "sealant";

/** The root canal system. Untouched by anything placed on top of the tooth. */
export type EndodonticState = "root-treated" | "retreated";

/** What has been cemented onto or into the tooth. */
export type ProsthesisState = "crown" | "veneer" | "bridge";

export type ToothStateValue = PresenceState | StructureState | EndodonticState | ProsthesisState;

/** Where an entry came from. `correction` entries are tombstones — see `supersedes`. */
export type ChartSource = "examination" | "treatment" | "manual" | "correction";

export const TOOTH_SURFACES = ["M", "O", "D", "B", "L", "I"] as const;

export interface ToothHistoryEntry {
  id: string; // Firestore document id

  // TWO dates, deliberately.
  //   `date`       — date of SERVICE: the day the work was done. What the chart is read against.
  //   `recordedAt` — date of ENTRY: the day someone typed it in.
  // They differ whenever Saturday's visit is logged on Monday. "Treated 1 Jan, recorded 3 Jan" is
  // honest; "treated 3 Jan" is false. Ordering uses service date first, entry time to break ties.
  recordedAt: string; // ISO datetime
  date: string; // dd/mm/yyyy

  tooth: string; // FDI

  // BOTH OPTIONAL, and at least one of {value, note} is always present.
  //   A condition is what changes the CHART — only a value can recolour a tooth.
  //   A note is what happened, in the dentist's words: "RCT, 3 canals, WL 21mm, CaOH dressing".
  // A note alone is a story with no state change. A value alone is a state change with no story.
  // Never let the note be the only place a clinical change exists, or the chart will lie.
  slot?: ToothSlot;
  value?: ToothStateValue;
  surfaces?: string[]; // structure only, e.g. ["M","O","D"]

  doctor: string; // who DID the work, not who is logged in
  source: ChartSource;

  // Where a treatment entry came from, so "where did this crown come from?" has an answer.
  caseId?: string;
  stageOrder?: number;
  visitId?: string;

  note?: string;

  // The id of an entry made in error. An entry carrying this is a TOMBSTONE: it is not a state,
  // it only voids its target. Nothing is ever edited or deleted — the mistake and the fix both
  // stay visible, which is what protects the clinic.
  supersedes?: string;
}

/** A chart entry before Firestore has taken it: no document id, no recorded timestamp yet. */
export type NewToothHistoryEntry = Omit<ToothHistoryEntry, "id" | "recordedAt">;

/** One examination finding, as the entry wizard hands it over. */
export interface ChartMarkInput {
  tooth: string;
  slot: ToothSlot;
  value: ToothStateValue;
  surfaces?: string[];
}

// A patient's odontogram = their tooth history, newest first.
export type Odontogram = ToothHistoryEntry[];

/** The live state of one tooth: at most one entry per slot, or none if never recorded. */
export type ToothChart = Partial<Record<ToothSlot, ToothHistoryEntry>>;

// --- display metadata ------------------------------------------------------------------

interface StateMeta {
  label: string;
  fill: string;
  border: string;
}

export const PRESENCE_META: Record<PresenceState, StateMeta> = {
  erupted: { label: "Present", fill: "#ffffff", border: "#94a3b8" },
  unerupted: { label: "Unerupted", fill: "#f8fafc", border: "#cbd5e1" },
  impacted: { label: "Impacted", fill: "#fae8ff", border: "#c026d3" },
  extracted: { label: "Extracted", fill: "#f1f5f9", border: "#cbd5e1" },
  shed: { label: "Shed (natural)", fill: "#f8fafc", border: "#e2e8f0" },
  missing: { label: "Missing", fill: "#f8fafc", border: "#e2e8f0" },
  implant: { label: "Implant", fill: "#e0e7ff", border: "#6366f1" },
  mobility: { label: "Mobility", fill: "#fdf4ff", border: "#a855f7" },
};

export const STRUCTURE_META: Record<StructureState, StateMeta> = {
  sound: { label: "Healthy", fill: "#ffffff", border: "#94a3b8" },
  decayed: { label: "Decayed", fill: "#fee2e2", border: "#ef4444" },
  filled: { label: "Filled", fill: "#dbeafe", border: "#3b82f6" },
  sealant: { label: "Sealant", fill: "#ccfbf1", border: "#14b8a6" },
};

export const ENDODONTIC_META: Record<EndodonticState, StateMeta> = {
  "root-treated": { label: "Root-treated", fill: "#ede9fe", border: "#7c3aed" },
  retreated: { label: "Re-treated", fill: "#ddd6fe", border: "#6d28d9" },
};

export const PROSTHESIS_META: Record<ProsthesisState, StateMeta> = {
  crown: { label: "Crowned", fill: "#fef3c7", border: "#d97706" },
  veneer: { label: "Veneer", fill: "#fef9c3", border: "#ca8a04" },
  bridge: { label: "Bridge", fill: "#fef08a", border: "#a16207" },
};

export const SLOT_META: {
  slot: ToothSlot;
  label: string;
  values: ToothStateValue[];
  meta: Record<string, StateMeta>;
}[] = [
  { slot: "presence", label: "Presence", values: Object.keys(PRESENCE_META) as PresenceState[], meta: PRESENCE_META },
  { slot: "structure", label: "Structure", values: Object.keys(STRUCTURE_META) as StructureState[], meta: STRUCTURE_META },
  { slot: "endodontics", label: "Root canal", values: Object.keys(ENDODONTIC_META) as EndodonticState[], meta: ENDODONTIC_META },
  { slot: "prosthesis", label: "Prosthesis", values: Object.keys(PROSTHESIS_META) as ProsthesisState[], meta: PROSTHESIS_META },
];

const ALL_META: Record<string, StateMeta> = {
  ...PRESENCE_META,
  ...STRUCTURE_META,
  ...ENDODONTIC_META,
  ...PROSTHESIS_META,
};

export function stateMeta(value: ToothStateValue): StateMeta {
  return ALL_META[value] ?? { label: value, fill: "#ffffff", border: "#94a3b8" };
}

export function slotOf(value: ToothStateValue): ToothSlot {
  if (value in PRESENCE_META) return "presence";
  if (value in STRUCTURE_META) return "structure";
  if (value in ENDODONTIC_META) return "endodontics";
  return "prosthesis";
}

// --- screening palette -----------------------------------------------------------------

/**
 * The flat, one-tap palette the New Case examination uses.
 *
 * A dentist screening a mouth wants ONE tap per tooth, not "pick a slot, pick a value, pick a
 * surface". So the intake chart hides the slots entirely — but every tap still lands as a
 * slot-scoped entry, which is what stops a later crown from erasing the root canal beneath it.
 *
 * Mobility is deliberately absent: it is a periodontal grade (0-3), it lives on the perio chart,
 * and a tooth chart that also carries it would give the clinic two answers to one question.
 * Surfaces are absent too — they are recorded from the patient's record, not mid-examination.
 */
export const SCREENING_PALETTE: { label: string; slot: ToothSlot; value: ToothStateValue }[] = [
  { label: "Healthy", slot: "structure", value: "sound" },
  { label: "Decayed", slot: "structure", value: "decayed" },
  { label: "Filled", slot: "structure", value: "filled" },
  { label: "Sealant", slot: "structure", value: "sealant" },
  { label: "Root canal", slot: "endodontics", value: "root-treated" },
  { label: "Crowned", slot: "prosthesis", value: "crown" },
  { label: "Bridge", slot: "prosthesis", value: "bridge" },
  { label: "Impacted", slot: "presence", value: "impacted" },
  { label: "Extracted", slot: "presence", value: "extracted" },
  { label: "Missing", slot: "presence", value: "missing" },
  { label: "Implant", slot: "presence", value: "implant" },
  { label: "Mobility", slot: "presence", value: "mobility" },
];

// --- derivation ------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DISPLAY_DATE = /^(\d{2})\/(\d{2})\/(\d{4})$/;

/** Sortable key: service date first, entry time only to break ties within the same day. */
function orderKey(entry: ToothHistoryEntry): string {
  const raw = entry.date ?? "";
  const m = DISPLAY_DATE.exec(raw.trim());
  let iso: string;
  if (m) {
    const year = Number(m[3]);
    // BS display dates (year >= 2070) are converted through the library; legacy AD dates rearranged.
    iso = year >= 2070
      ? (bsToAD(year, Number(m[2]), Number(m[1])) ?? "0000-00-00")
      : `${m[3]}-${m[2]}-${m[1]}`;
  } else {
    iso = ISO_DATE.test(raw) ? raw : "0000-00-00";
  }
  return `${iso}|${entry.recordedAt}`;
}

/**
 * The live chart: for every tooth, the newest surviving entry in each slot.
 *
 * Entries voided by a correction are dropped, and so are the correction tombstones themselves —
 * a tombstone records that something was wrong, it does not assert a state.
 */
export function deriveToothChart(history: ToothHistoryEntry[]): Record<string, ToothChart> {
  const voided = new Set<string>();
  for (const e of history) if (e.supersedes) voided.add(e.supersedes);

  const live = history
    .filter((e) => !e.supersedes && !voided.has(e.id))
    .sort((a, b) => orderKey(b).localeCompare(orderKey(a))); // newest first

  const out: Record<string, ToothChart> = {};
  for (const e of live) {
    if (!e.slot || !e.value) continue; // a note-only entry tells a story; it changes no state
    const chart = (out[e.tooth] ??= {});
    if (!(e.slot in chart)) chart[e.slot] = e; // first seen per slot IS the newest
  }
  return out;
}

/**
 * Teeth that have been WORKED ON, as opposed to merely looked at.
 *
 * The record marks these with a dot: colour says what the tooth is, the dot says something was
 * done here. A tooth found decayed at screening but never treated gets colour and no dot — which
 * tells the dentist at a glance where they have operated versus where they have only looked.
 */
export function treatedTeeth(history: ToothHistoryEntry[]): Set<string> {
  const voided = new Set<string>();
  for (const e of history) if (e.supersedes) voided.add(e.supersedes);

  const out = new Set<string>();
  for (const e of history) {
    if (e.source === "treatment" && !e.supersedes && !voided.has(e.id)) out.add(e.tooth);
  }
  return out;
}

/**
 * Just the values, no entry metadata — what it takes to DRAW a tooth.
 *
 * The record derives these from the history. The examination chart builds them straight from the
 * single finding the dentist tapped. Same shape, so one renderer serves both.
 */
export type ToothValues = Partial<Record<ToothSlot, ToothStateValue>>;

export function toothValues(chart: ToothChart | undefined): ToothValues {
  const out: ToothValues = {};
  if (!chart) return out;
  for (const { slot } of SLOT_META) {
    const entry = chart[slot];
    if (entry) out[slot] = entry.value;
  }
  return out;
}

/** True once the tooth is gone. An implant stands in the socket; it is not the tooth coming back. */
export function isGone(values: ToothValues | undefined): boolean {
  const value = values?.presence;
  return value === "extracted" || value === "shed" || value === "missing";
}

export function isMissing(chart: ToothChart | undefined): boolean {
  return isGone(toothValues(chart));
}

/**
 * Can this slot still be charted on this tooth?
 *
 * A missing tooth's story is over: "decay on 46" is nonsense once 46 is in a jar. The only thing
 * that may follow an extraction is an implant — a new object in the same socket — and once that
 * implant is placed, a crown may be seated on it.
 */
export function canChart(values: ToothValues | undefined, slot: ToothSlot): boolean {
  if (!isGone(values)) return true;
  return slot === "presence";
}

/** A one-line summary of everything true about a tooth right now. */
export function describeValues(values: ToothValues | undefined): string {
  if (!values) return "Unrecorded";
  const parts = SLOT_META.map(({ slot }) => values[slot])
    .filter((v): v is ToothStateValue => Boolean(v))
    .map((v) => stateMeta(v).label);
  return parts.length ? parts.join(" · ") : "Unrecorded";
}

export function describeTooth(chart: ToothChart | undefined): string {
  return describeValues(toothValues(chart));
}

// --- procedure → outcome ---------------------------------------------------------------

export interface ChartOutcome {
  slot: ToothSlot;
  value: ToothStateValue;
}

/**
 * What a COMPLETED procedure does to a tooth. One slot, one value — never the whole tooth.
 *
 * A root canal touches `endodontics` and nothing else, so the crown that follows cannot erase it.
 * Diagnostics (X-rays, consults) and arch-level work (scaling, dentures) return null: an X-ray
 * does not change a tooth.
 */
export function outcomeOfProcedure(code: string): ChartOutcome | null {
  switch (code) {
    case "PROC-003": // Composite restoration
      return { slot: "structure", value: "filled" };
    case "PROC-004": // Simple extraction
    case "PROC-005": // Surgical wisdom extraction
      return { slot: "presence", value: "extracted" };
    case "PROC-006": // Root canal treatment
      return { slot: "endodontics", value: "root-treated" };
    case "PROC-007": // Zirconia crown prep & fitting
    case "PROC-013": // Implant abutment + crown
      return { slot: "prosthesis", value: "crown" };
    case "PROC-011": // Implant placement
      return { slot: "presence", value: "implant" };
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Periodontal chart — dated snapshots so pocket depths can be trended over time.
// ---------------------------------------------------------------------------
export interface ToothPerioData {
  tooth: string;
  probingDepths: { db: number; b: number; mb: number; dl: number; l: number; ml: number };
  recession: { db: number; b: number; mb: number };
  bop: { db: boolean; b: boolean; mb: boolean; dl: boolean; l: boolean; ml: boolean };
  mobility: 0 | 1 | 2 | 3;
}

// One charting session. Never edited — the point of a perio chart is to compare this month's
// pockets with last year's, which only works if last year's still says what it said.
export interface PerioSnapshot {
  id: string; // Firestore document id
  recordedAt: string; // ISO datetime — what the series is ordered by
  date: string; // dd/mm/yyyy, as read
  doctor: string;
  teeth: Record<string, ToothPerioData>;
  visitId?: string;
  caseId?: string;
  /** Append-only correction/tombstone metadata. */
  supersedes?: string;
  correctionKind?: "void";
  correctionReason?: string;
  correctedBy?: string;
}

export type NewPerioSnapshot = Omit<PerioSnapshot, "id" | "recordedAt">;

// The patient's CURRENT gum readings — one value per tooth. Perio is treated exactly like the
// odontogram: an append-only log underneath, but only the latest state per tooth is shown, no
// history to read. Each save probes a few teeth; this merges every session so the newest reading
// for each tooth wins and previously-charted teeth are never lost. Snapshots arrive newest-first
// (listPerioCharts), so we apply them oldest-first for latest-wins.
export function deriveCurrentPerio(snapshots: PerioSnapshot[]): Record<string, ToothPerioData> {
  const current: Record<string, ToothPerioData> = {};
  const superseded = new Set(snapshots.map((snap) => snap.supersedes).filter((id): id is string => Boolean(id)));
  const effective = snapshots.filter((snap) => !snap.supersedes && !superseded.has(snap.id));
  for (const snap of [...effective].reverse()) {
    for (const [tooth, data] of Object.entries(snap.teeth)) {
      current[tooth] = data;
    }
  }
  return current;
}

// ---------------------------------------------------------------------------
// Radiographs / imaging — tied to a tooth (or arch) + date + type + visit, never a
// loose "uploaded file". One-per-patient collection, longitudinal.
// ---------------------------------------------------------------------------
export type XrayType = "IOPA" | "OPG" | "CBCT" | "Intraoral photo";

interface XrayImageBase {
  id: string;
  recordedAt?: string; // ISO, stamped by the repo; newest-first ordering
  patientName: string;
  tooth?: string;
  date: string; // visit-log display style
  type: XrayType;
  note?: string;
  visitId?: string;
  caseId?: string;
  voidedAt?: string;
  voidedBy?: string;
  voidReason?: string;
  voidAuditId?: string;
}

/** Private images expose only their metadata id; the Worker authorises each view. */
export interface XrayImage extends XrayImageBase {
  isCloudflareImage: true;
  imageId: string;
  /** Added by the Dental OS adapter so the private media broker can scope image reads. */
  patientId?: string;
}

// One film in the capture UI. It exists locally only while the Worker-authorised private-R2
// upload is in progress; finalisation persists its metadata independently of encounter saving.
export interface XrayDraft {
  key: string;
  tooth?: string;
  type: XrayType;
  note?: string;
  previewUrl: string;
  mimeType?: string;
  byteSize?: number;
  checksum?: string;
  sourceFilename?: string;
  status: "uploading" | "done" | "error";
}

export const XRAY_TYPES: XrayType[] = ["IOPA", "OPG", "CBCT", "Intraoral photo"];
