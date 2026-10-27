// Case-based treatment system — types plus the clinic's default fee schedule and treatment
// protocols. See CASE_ENTRY_SYSTEM_PLAN.md.
//
// The chain: FeeScheduleItem (clinic price) → ProtocolStage (recipe step, priced from a
// fee code) → CaseStage (a patient's actual stage, price quote-LOCKED at case creation).
//
// Cases themselves are patient records and start empty.

import { type ChartMarkInput, type ToothPerioData } from "@/features/work-entry/model/chartData";
import { type MedicalHistory, type EmergencyContact, type DentalHistory } from "@/features/patients/model/domain";
import { type CanalChartData } from "@/features/work-entry/model/canalData";

// ---------------------------------------------------------------------------
// Fee schedule — the clinic's master price list. Every cost defaults from here.
// ---------------------------------------------------------------------------
export interface FeeScheduleItem {
  code: string;
  name: string;
  category: string;
  price: number;
  active: boolean;
}

// ---------------------------------------------------------------------------
// Treatment protocol — a reusable recipe: an ordered list of staged visits.
// ---------------------------------------------------------------------------
export type ToothScope = "tooth" | "arch" | "full-mouth";

export interface ProtocolStage {
  order: number;
  label: string;
  procedureCode: string; // → FeeScheduleItem.code (kept for charting + imaging/surgical detection)
  /** Canonical Worker template stage; absent only for a clinician-added pending stage. */
  sourceProtocolStageId?: string;
  toothScope: ToothScope;
  recallIntervalDays: number; // days from this stage to the next visit
  // The stage's default price. The clinic sets this per protocol in Settings; it seeds the case
  // stage cost at creation (still editable there). Optional/0 for protocols priced elsewhere or
  // not yet priced — a clinic starts every stage at 0 and fills its own fees in.
  defaultCost?: number;
}

/**
 * One grade of a graded protocol — its own editable stage list and its own prices.
 *
 * Deliberately a full stage list per grade rather than per-grade price overrides on shared stages.
 * What the clinic sees under a grade IS what the case gets: no fallback to reason about, and a
 * grade can drop a procedure that does not apply to it (you do not splint a tooth you are taking
 * out) instead of pricing it at zero and hoping nobody adds it.
 */
export interface ProtocolGrade {
  /** Stable key, kept when the label is renamed. Matches the perio mobility scale: "1" | "2" | "3". */
  id: string;
  label: string;
  stages: ProtocolStage[];
}

export interface TreatmentProtocol {
  id: string;
  /** Stable origin code for a seeded clinic protocol; ids are tenant-specific UUIDs. */
  starterTemplateCode?: string | null;
  name: string;
  category: string;
  // Which phase this treatment usually belongs to (urgent pain relief → basic → elective).
  phase?: "urgent" | "basic" | "elective";
  recordCanals?: boolean;
  stages: ProtocolStage[];
  /**
   * Present ⇒ the protocol is GRADED: the clinician picks a grade and gets that grade's stages,
   * and `stages` above is used only as the seed when a clinic first switches grades on.
   *
   * Optional, and absent on every protocol saved before this existed — so a clinic already using
   * the app keeps exactly the protocol it has. Grades are switched on per protocol, never applied
   * retroactively to stored config: silently adding a grade axis to a live protocol would change
   * what patients get quoted.
   */
  grades?: ProtocolGrade[];
}

/**
 * Mobility is a finding and grade recorded on an individual tooth. It must never be configured
 * as an arch or whole-mouth procedure: doing so makes a tooth chart unable to offer the protocol
 * and loses which tooth the grade belongs to.
 */
export const MOBILITY_PROTOCOL_ID = "PROTO-MOBILITY";

/**
 * Repairs the scope field in a Mobility protocol saved before Mobility was modelled as per-tooth.
 *
 * This deliberately preserves the clinic's stage labels, procedure codes, recall intervals and
 * prices. Only the routing field is corrected, both for the protocol seed stages and for every
 * grade's own stages.
 */
export function normalizeMobilityProtocol(protocol: TreatmentProtocol): TreatmentProtocol {
  if (protocol.id !== MOBILITY_PROTOCOL_ID) return protocol;

  const asToothStage = (stage: ProtocolStage): ProtocolStage => ({ ...stage, toothScope: "tooth" });
  return {
    ...protocol,
    stages: protocol.stages.map(asToothStage),
    grades: protocol.grades?.map((grade) => ({
      ...grade,
      stages: grade.stages.map(asToothStage),
    })),
  };
}

// ---------------------------------------------------------------------------
// Case — one protocol instance on one patient. The single source of truth for
// that patient's body of work. Prices are LOCKED at creation (quote-time lock).
// ---------------------------------------------------------------------------
export type CaseStatus = "open" | "completed" | "cancelled";
export type CaseStageStatus = "pending" | "done" | "skipped";

// The CLINICAL result of a case, distinct from `status`. A case can be `completed` (every planned
// stage done) yet be a `failure` — the RCT needs retreatment, the implant never integrated. Set at
// close and amendable later (an outcome can change months on), so the amendment is audited.
export type CaseOutcome = "success" | "failure" | "partial";

export interface CaseStage {
  order: number;
  /** Persisted stage identity used by the audited pending-stage removal command. */
  stageId?: string;
  stageRowVersion?: number;
  label: string;
  procedureCode: string;
  tooth: string;
  agreedCost: number; // locked from the fee schedule when the case was created
  status: CaseStageStatus;
  doneDate?: string;
  doneBy?: string;
  /** Immutable encounter that completed this stage; permits a safe later reversal. */
  completedVisitId?: string;
  // Multi-procedure / phased plans (CLINICAL_REVIEW_UPGRADE_PLAN §1a). A case can hold
  // stages from several procedures, grouped by `group` (procedure label) and `phase`.
  // Optional so existing single-procedure cases stay valid.
  group?: string;
  phase?: "urgent" | "basic" | "elective";
  treatmentId?: string;
  treatmentRowVersion?: number;
  recordCanals?: boolean;
  // Which grade of a graded protocol this was planned at — the reason the price is what it is.
  // Stored on the stage, like `group`, because a case flattens several groups into one list.
  grade?: string;
  gradeLabel?: string;
}

export interface GradeProgressionLogEntry {
  from: string;
  to: string;
  date: string; // ISO date or dd/mm/yyyy
  by?: string;
}

export interface Case {
  id: string; // Firestore document id
  /** Optimistic-concurrency token shared by plan edits and encounter transactions. */
  revision?: number;
  patientId: string;
  patientName: string; // denormalized for display
  protocolId: string;
  title: string;
  chiefComplaint?: string;
  status: CaseStatus;
  phase?: "urgent" | "basic" | "elective";
  agreedTotal: number;
  createdDate: string;
  createdBy: string;
  doctor?: string;
  doctors?: string[];
  stages: CaseStage[];
  mobilityGrade?: string; // "1" | "2" | "3"
  gradeProgressionLog?: GradeProgressionLogEntry[];
  outcome?: CaseOutcome;
  outcomeNote?: string;
  outcomeBy?: string; // who recorded/last-amended the outcome
  outcomeDate?: string; // dd/mm/yyyy the outcome was recorded/amended
  /** Encounter that created this episode and, when applicable, recorded its outcome. */
  createdVisitId?: string;
  outcomeVisitId?: string;
}

export interface CaseEntryStageInput {
  label: string;
  procedureCode: string;
  /** Clinic treatment-protocol template selected for this patient-plan group. */
  sourceProtocolId?: string;
  sourceProtocolStageId?: string;
  tooth: string;
  cost: number;
  doneToday: boolean;
  group?: string;
  phase?: "urgent" | "basic" | "elective";
  treatmentId?: string;
  recordCanals?: boolean;
  grade?: string;
  gradeLabel?: string;
}

export interface RxLine {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
}

export interface LabOrderInput {
  /** Present only after this clinical request has been persisted by the Worker. */
  labOrderId?: string;
  /** Required when changing the persisted lab order. */
  rowVersion?: number;
  procedure: string;
  tooth: string;
  shade: string;
  labId: string;
  labName: string;
  notes: string;
  /** Legacy import fields. New clinical lab orders deliberately carry no supplier price. */
  quantity?: number;
  unit?: string;
  rate?: number;
  price?: number;
}

export interface CaseEntryData {
  /** Stable across Create retries; Firestore uses it as the idempotency key. */
  encounterId: string;
  /** Stable across retries, but separate from the immutable visit id for trusted Worker commands. */
  commandId: string;
  patientId: string | null;
  patientName: string;
  isNewPatient: boolean;
  newPatient?: {
    dateOfBirth: string | null;
    ageYears: number | null;
    sex: "female" | "male" | "other" | "not_recorded";
    phone: string;
    address?: string;
    emergencyContact?: EmergencyContact;
  };
  medicalHistory?: MedicalHistory;
  dentalHistory?: DentalHistory;
  dateISO: string;
  doctor: string;
  doctors?: string[];
  chiefComplaint: string;
  protocolId: string;
  title: string;
  mobilityGrade?: string;
  phase?: "urgent" | "basic" | "elective";
  stages: CaseEntryStageInput[];
  /**
   * The browser submits its pending-plan edits with the source template IDs.
   * The Worker validates those references and persists only pending stages;
   * this is never a clinical completion or a financial charge command.
   */
  planSelections: Array<{
    sourceProtocolId: string;
    toothCode: string | null;
    treatmentArea: string | null;
    stages: Array<{
      sourceProtocolStageId: string | null;
      stageName: string;
      price: number;
    }>;
  }>;
  paidToday: number;
  // A discount on today's charges, in rupees. A column on the settlement; reduces the balance.
  discount?: number;
  // How the payment was taken (Cash / eSewa / …). Present only when paidToday > 0.
  paymentMethod?: string;
  followUp: { dateISO: string; time?: string; reason: string } | null;
  // Optional examination marks from the "if needed" chart panel — affected teeth and the
  // condition observed/set. Fanned out to the patient's odontogram on case creation.
  chartMarks?: ChartMarkInput[];
  // Optional prescriptions (multi-drug, §1e) and optional lab work (§1f).
  prescriptions?: RxLine[];
  labOrders?: LabOrderInput[];
  // Optional gum readings taken during this visit. Present only when a site was actually probed —
  // an untouched chart is all zeros, and storing it would claim the gums were measured healthy.
  perio?: Record<string, ToothPerioData>;
  canalDataMap?: Record<string, CanalChartData>;
}

// Helper: resolve a fee-schedule price by code (0 if unknown/inactive).
export function priceOf(feeSchedule: FeeScheduleItem[], code: string): number {
  const item = feeSchedule.find((f) => f.code === code && f.active);
  return item ? item.price : 0;
}

// ===========================================================================
// Clinic defaults — dental-practice vocabulary, editable in Settings. Not patient data.
// ===========================================================================

// Covers every procedure the protocols below reference, so every protocol stage resolves
// to a price.
export const defaultFeeSchedule: FeeScheduleItem[] = [
  { code: "PROC-001", name: "New Patient Consultation & X-ray", category: "Diagnostic", price: 1500, active: true },
  { code: "PROC-002", name: "Scaling & Polish", category: "Preventive", price: 2500, active: true },
  { code: "PROC-003", name: "Composite Restoration (Filling)", category: "Restorative", price: 4000, active: true },
  { code: "PROC-004", name: "Simple Extraction", category: "Surgery", price: 3000, active: true },
  { code: "PROC-005", name: "Surgical Wisdom Extraction", category: "Surgery", price: 12000, active: true },
  { code: "PROC-006", name: "Root Canal Treatment (RCT)", category: "Endodontics", price: 8000, active: true },
  { code: "PROC-007", name: "Zirconia Crown Prep & Fitting", category: "Prosthodontics", price: 18500, active: true },
  { code: "PROC-008", name: "OPG X-ray", category: "Diagnostic", price: 1200, active: true },
  { code: "PROC-009", name: "CBCT Scan", category: "Diagnostic", price: 4500, active: true },
  { code: "PROC-010", name: "Suture Removal / Healing Review", category: "Surgery", price: 800, active: true },
  { code: "PROC-011", name: "Implant Placement (Surgical)", category: "Implants", price: 45000, active: true },
  { code: "PROC-012", name: "Implant Healing Review", category: "Implants", price: 1000, active: true },
  { code: "PROC-013", name: "Implant Abutment + Crown", category: "Implants", price: 35000, active: true },
  { code: "PROC-014", name: "Ortho Records + Bracket Bonding", category: "Orthodontics", price: 60000, active: true },
  { code: "PROC-015", name: "Ortho Monthly Adjustment", category: "Orthodontics", price: 2500, active: true },
  { code: "PROC-016", name: "Ortho Debond + Retainer", category: "Orthodontics", price: 8000, active: true },
  { code: "PROC-017", name: "Denture Impressions", category: "Prosthodontics", price: 5000, active: true },
  { code: "PROC-018", name: "Denture Bite Registration", category: "Prosthodontics", price: 3000, active: true },
  { code: "PROC-019", name: "Denture Try-in", category: "Prosthodontics", price: 3000, active: true },
  { code: "PROC-020", name: "Complete Denture Fit", category: "Prosthodontics", price: 24000, active: true },
  { code: "PROC-021", name: "Denture 1-week Review", category: "Prosthodontics", price: 500, active: true },
  { code: "PROC-022", name: "Dental Checkup", category: "Diagnostic", price: 500, active: true },
  // Mobility management procedures
  { code: "PROC-023", name: "Scaling & Root Planing (Mobility)", category: "Periodontics", price: 500, active: true },
  { code: "PROC-024", name: "Splinting (Mobility)", category: "Periodontics", price: 2000, active: true },
  { code: "PROC-025", name: "Extraction (Mobility)", category: "Surgery", price: 2000, active: true },
  // Whole-mouth / arch additions. Prices intentionally start at 0 until the clinic sets them.
  { code: "PROC-026", name: "Fluoride Gel", category: "Preventive", price: 0, active: true },
  { code: "PROC-027", name: "Retainers", category: "Orthodontics", price: 0, active: true },
  { code: "PROC-028", name: "Night Guard", category: "Prosthodontics", price: 0, active: true },
  { code: "PROC-029", name: "Sports Guard", category: "Prosthodontics", price: 0, active: true },
];

const S = (
  order: number,
  label: string,
  procedureCode: string,
  toothScope: ToothScope,
  recallIntervalDays: number,
  defaultCost?: number
): ProtocolStage => ({ order, label, procedureCode, toothScope, recallIntervalDays, defaultCost });

// Helper: Sort stages so earlier grades appear first (Grade I -> Grade II -> Grade III),
// and non-graded stages or stages within the same grade maintain their order.
export function sortStagesByGrade(stages: CaseStage[]): CaseStage[] {
  const gradeRank = (s: CaseStage): number => {
    if (!s.grade) return 0;
    const num = parseInt(s.grade, 10);
    return isNaN(num) ? 99 : num;
  };

  return [...stages].sort((a, b) => {
    const rA = gradeRank(a);
    const rB = gradeRank(b);
    if (rA !== rB) return rA - rB;
    return a.order - b.order;
  });
}

/** The next globally unique stage order for a case. Orders are the stable identifiers used when
 * an encounter advances a pending stage, so using array length is unsafe after a stage is deleted. */
export function nextCaseStageOrder(stages: Pick<CaseStage, "order">[]): number {
  return Math.max(0, ...stages.map((stage) => (Number.isFinite(stage.order) ? stage.order : 0))) + 1;
}

/** Repair legacy cases whose stage-order identifiers collided after a delete/add operation. */
export function repairCaseStageOrders(stages: CaseStage[]): CaseStage[] {
  const seen = new Set<number>();
  const hasCollision = stages.some((stage) => {
    if (!Number.isFinite(stage.order) || seen.has(stage.order)) return true;
    seen.add(stage.order);
    return false;
  });
  return hasCollision ? stages.map((stage, index) => ({ ...stage, order: index + 1 })) : stages;
}

// Stages per grade for Mobility
const mobilityStages = (): ProtocolStage[] => [
  S(1, "Scaling and Root Planing", "PROC-023", "tooth", 7, 500),
  S(2, "Splinting", "PROC-024", "tooth", 14, 2000),
  S(3, "Extraction", "PROC-025", "tooth", 0, 2000),
];

export const defaultProtocols: TreatmentProtocol[] = [
  {
    id: "PROTO-RCT",
    name: "Root Canal + Crown",
    category: "Endodontics",
    phase: "basic",
    recordCanals: true,
    stages: [
      S(1, "Consultation & IOPA X-ray", "PROC-001", "tooth", 3),
      S(2, "RCT — cleaning & shaping", "PROC-006", "tooth", 7),
      S(3, "RCT — obturation", "PROC-006", "tooth", 14),
      S(4, "Crown prep & fitting", "PROC-007", "tooth", 180),
    ],
  },
  {
    id: "PROTO-EXT",
    name: "Simple Extraction",
    category: "Surgery",
    phase: "urgent",
    stages: [
      S(1, "Simple extraction", "PROC-004", "tooth", 7),
      S(2, "Healing review", "PROC-010", "tooth", 0),
    ],
  },
  {
    id: "PROTO-WISDOM",
    name: "Surgical Wisdom Extraction",
    category: "Surgery",
    phase: "urgent",
    stages: [
      S(1, "Consultation & OPG", "PROC-008", "tooth", 3),
      S(2, "Surgical extraction", "PROC-005", "tooth", 7),
      S(3, "Suture removal", "PROC-010", "tooth", 0),
    ],
  },
  {
    id: "PROTO-IMPLANT",
    name: "Single Implant",
    category: "Implants",
    phase: "elective",
    stages: [
      S(1, "Consultation & CBCT", "PROC-009", "tooth", 7),
      S(2, "Implant placement (surgical)", "PROC-011", "tooth", 14),
      S(3, "Osseointegration healing review", "PROC-012", "tooth", 90),
      S(4, "Abutment + crown", "PROC-013", "tooth", 180),
    ],
  },
  {
    id: "PROTO-ORTHO",
    name: "Orthodontics (Braces)",
    category: "Orthodontics",
    phase: "elective",
    stages: [
      S(1, "Records + bracket bonding", "PROC-014", "arch", 30),
      S(2, "Monthly adjustment", "PROC-015", "arch", 30),
      S(3, "Monthly adjustment", "PROC-015", "arch", 30),
      S(4, "Debond + retainer", "PROC-016", "arch", 180),
    ],
  },
  {
    id: "PROTO-DENTURE",
    name: "Complete Denture",
    category: "Prosthodontics",
    phase: "basic",
    stages: [
      S(1, "Impressions", "PROC-017", "arch", 7),
      S(2, "Bite registration", "PROC-018", "arch", 7),
      S(3, "Try-in", "PROC-019", "arch", 7),
      S(4, "Denture fit", "PROC-020", "arch", 7),
      S(5, "1-week review", "PROC-021", "arch", 0),
    ],
  },
  {
    id: "PROTO-SCALING",
    name: "Scaling & Polish",
    category: "Preventive",
    phase: "basic",
    stages: [S(1, "Scaling & polish", "PROC-002", "full-mouth", 180)],
  },
  {
    id: "PROTO-FLUORIDE",
    name: "Fluoride Gel",
    category: "Preventive",
    phase: "basic",
    stages: [S(1, "Fluoride gel application", "PROC-026", "full-mouth", 180)],
  },
  {
    id: "PROTO-RETAINERS",
    name: "Retainers",
    category: "Orthodontics",
    phase: "elective",
    stages: [S(1, "Retainer delivery", "PROC-027", "arch", 180)],
  },
  {
    id: "PROTO-NIGHT-GUARD",
    name: "Night Guard",
    category: "Prosthodontics",
    phase: "elective",
    stages: [S(1, "Night guard delivery", "PROC-028", "arch", 180)],
  },
  {
    id: "PROTO-SPORTS-GUARD",
    name: "Sports Guard",
    category: "Prosthodontics",
    phase: "elective",
    stages: [S(1, "Sports guard delivery", "PROC-029", "arch", 180)],
  },
  {
    id: "PROTO-FILLING",
    name: "Composite Filling",
    category: "Restorative",
    phase: "basic",
    stages: [S(1, "Composite restoration", "PROC-003", "tooth", 0)],
  },
  {
    id: MOBILITY_PROTOCOL_ID,
    name: "Mobility",
    category: "Periodontics",
    phase: "basic",
    stages: mobilityStages(),
    // Graded: mobility is scored I-III and the treatment — and its price — follows the score.
    grades: [
      {
        id: "1",
        label: "Grade I",
        stages: [
          S(1, "Scaling and Root Planing", "PROC-023", "tooth", 7, 500),
        ],
      },
      {
        id: "2",
        label: "Grade II",
        stages: [
          S(1, "Scaling and Root Planing", "PROC-023", "tooth", 7, 500),
          S(2, "Splinting", "PROC-024", "tooth", 14, 2000),
        ],
      },
      {
        id: "3",
        label: "Grade III",
        stages: [
          S(1, "Extraction", "PROC-025", "tooth", 0, 2000),
        ],
      },
    ],
  },
];
