"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  UserPlus,
  Stethoscope,
  Activity,
  Pill,
  Wallet,
  BellRing,
  Check,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ListChecks,
  X,
  Plus,
  Trash2,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Hand,
} from "lucide-react";
import {
  PatientDetail,
  initials,
  titleCaseName,
  formatNpr,
  formatDateShort,
  todayISO,
  type MedicalHistory,
  type LabSupplier,
  alertsFromHistory,
  type ClinicProfile,
  PAYMENT_METHODS,
} from "@/features/patients/model/domain";
import { readRupeeText, rupeeAmount, rupeeValue } from "@/shared/money/inputs";
import {
  FeeScheduleItem,
  TreatmentProtocol,
  CaseEntryData,
  ToothScope,
  priceOf,
  type Case,
  type RxLine,
  type LabOrderInput,
  type ProtocolStage,
  type ProtocolGrade,
} from "@/features/work-entry/model/caseData";
import LabOrderBlock from "@/features/labs/components/LabOrderBlock";
import { type SavedRadiographUpload } from "@/features/patients/media/RadiographUploader";
import ReasonPicker from "./ReasonPicker";
import PeriodontalChart from "@/features/work-entry/components/PeriodontalChart";
import CaseReviewLedger, { type ReviewProcedure, type PerioRow } from "./CaseReviewLedger";
import {
  type ChartMarkInput,
  type ToothPerioData,
  type XrayType,
  type XrayDraft,
  stateMeta,
} from "@/features/work-entry/model/chartData";
import ScreeningChart, { type ChartMark } from "./ScreeningChart";
import RadiographUploader from "@/features/patients/media/RadiographUploader";
import { clearEncounterDraftId, encounterDraftCommandId, encounterDraftId } from "@/features/work-entry/model/encounterDraft";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import { showsStandalonePatientRegistrationFields } from "@/features/patients/standalonePatientRegistration";
import TimePicker from "@/shared/dates/TimePicker";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import CanalDrawer from "@/features/work-entry/components/CanalDrawer";
import { type CanalChartData } from "@/features/work-entry/model/canalData";
import {
  pendingChartSuggestions,
  resolveSuggestionCart,
  suggestedProtocolId,
} from "@/features/work-entry/model/treatmentProtocolSuggestions";
import { Page, PageHeader } from "@/shared/ui/workspace-primitives";
import type { PatientPaymentInput } from "@/features/patients/types";
import { parseWorkEntryPayment } from "@/features/work-entry/workEntryPayment";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import WorkEntryPaymentPanel from "./WorkEntryPaymentPanel";
import DoctorRecallWorkspace from "./DoctorRecallWorkspace";
import type { FollowUpWorklistItem } from "@/features/patients/types";
import type { PatientStepActions } from "@/features/work-entry/patientStepActions";
import { useClinicLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { unpersistedLabOrderDrafts } from "@/features/work-entry/labOrderReview";

// A stage is an imaging stage if its procedure involves a radiograph. Its type is inferred
// from the wording so the upload prefills correctly.
const IMAGING_RE = /cbct|opg|panoramic|x-ray|xray|iopa|radiograph|imaging/i;
function inferXrayType(text: string): XrayType {
  if (/cbct/i.test(text)) return "CBCT";
  if (/opg|panoramic/i.test(text)) return "OPG";
  return "IOPA";
}

// One "Case" = a whole body of treatment for one patient, opened from a protocol recipe.
// This screen is the non-linear wizard that opens it: pick the patient, capture the reason,
// auto-build the staged plan from a protocol, mark what's done today, take payment, review,
// create. It writes through onCreateCase into the same shared store the rest of the app reads.

interface CaseEntryViewProps {
  patients: PatientDetail[];
  doctorsList: string[];
  labs: LabSupplier[];
  clinic: ClinicProfile;
  feeSchedule: FeeScheduleItem[];
  protocols: TreatmentProtocol[];
  /** Every case in the clinic, keyed by patient — to warn before opening a SECOND open case. */
  cases?: Record<string, Case[]>;
  /**
   * Preselect an EXISTING patient and open on the Purpose step — the "new complaint for a patient
   * we already have" path. The same wizard, minus registration. Null/absent = register a new one.
   */
  initialPatientId?: string | null;
  /**
   * Hosted as the BODY of another page (Work Entry). Drops this component's own page header and
   * outer padding so only the step tabs + step content show — the host supplies the title and the
   * way back. The step wizard is otherwise identical.
   */
  embedded?: boolean;
  /** In embedded mode, the "done / back" affordance the host provides (e.g. return to Work Entry). */
  onExit?: () => void;
  /** Patient Record begins with a focused intake page instead of the full wizard tab strip. */
  hideStepTabs?: boolean;
  /** Read-only preview; the Worker allocates the authoritative patient number when Save succeeds. */
  nextPatientNumber?: string | null;
  /** Reuses only the shared Patient & case form inside the continuation workflow. */
  patientStepOnly?: boolean;
  onPatientStepNext?: () => void;
  /** Moves the hosted step's actions into the parent Work Entry wizard header. */
  onPatientStepActionsChange?: (actions: PatientStepActions | null) => void;
  /**
   * Work Entry opens an already-saved patient and case. It keeps this exact wizard UI, but shows
   * the stored patient and case together in a read-only first step and removes finance/review.
   * Persistence of the new case-doctor selection is deliberately added in the Worker phase.
   */
  existingCaseWorkflow?: boolean;
  /** Admin sees payment controls; Doctor retains the same clinical/follow-up step without payment. */
  canCollectPayment?: boolean;
  /** URL-backed step restored by the Work Entry host after refresh or browser history navigation. */
  initialStep?: 1 | 2 | 3 | 4 | 5 | 6;
  /** Notifies the Work Entry host when the visible step changes so it can update the route. */
  onStepChange?: (step: 1 | 2 | 3 | 4 | 5 | 6) => void;
  upcomingFollowUps?: FollowUpWorklistItem[];
  /** Existing case values shown in the Patient & case step. */
  initialChiefComplaint?: string;
  initialCaseOpenedOn?: string;
  initialCaseDoctors?: string[];
  /** Plans already attached to this case by the Worker. They are rendered back into the migrated plan UI. */
  initialPlanSelections?: CaseEntryData["planSelections"];
  /** Stages already completed through the trusted clinical-work endpoint. */
  initialCompletedStages?: Array<{
    sourceProtocolId: string;
    sourceProtocolStageId: string;
    toothCode: string | null;
    treatmentArea: string | null;
  }>;
  /** Existing screening-chart findings loaded from the Worker for this patient. */
  initialChartMarks?: Record<string, ChartMark>;
  /** Existing persisted lab orders for the selected case. */
  initialLabOrders?: LabOrderInput[];
  /** Latest persisted periodontal readings for this patient. */
  initialPerio?: Record<string, ToothPerioData>;
  /** Latest persisted canal sessions for this case, keyed by FDI tooth. */
  initialCanalData?: Record<string, CanalChartData>;
  /** Current durable case id, used when filing a new X-ray. */
  initialChiefComplaintId?: string;
  /** Reloads persisted media after the private upload is finalised. */
  onMediaChanged?: () => void | Promise<void>;
  /** Withdraws a persisted radiograph through the trusted Worker. */
  onRemoveXray?: (mediaAssetId: string, reason: string) => Promise<void>;
  /** One final Worker-owned clinical commit for an existing open case. */
  onCommitTodayWork?: (input: {
    commandId: string;
    completedOn: string;
    completedStages: Array<{
      sourceProtocolId: string;
      sourceProtocolStageId: string;
      toothCode: string | null;
      treatmentArea: string | null;
      chargeAmount: number;
    }>;
    planSelections: CaseEntryData["planSelections"];
    odontogram: {
      recordedOn: string;
      marks: Array<{ toothCode: string; slot: ChartMark["slot"]; value: ChartMark["value"] }>;
      removedMarks: Array<{ toothCode: string; slot: ChartMark["slot"]; value: ChartMark["value"] }>;
    } | null;
    canalMeasurements: Array<{
      sourceProtocolId: string;
      toothCode: string | null;
      treatmentArea: string | null;
      recordedOn: string;
      obturationMaterial: string | null;
      note: string | null;
      records: Array<{ canalLabel: string; workingLengthMm: number; fileNumber: string | null; reference: string | null }>;
    }>;
    doctorNames: string[];
    payment: Omit<PatientPaymentInput, "patientId"> | null;
    followUp: { dueOn: string; dueTime: string | null; reason: string } | null;
    prescriptionItems: RxLine[];
    labOrders: LabOrderInput[];
    periodontalTeeth: Record<string, ToothPerioData> | null;
    closeCase: boolean;
  }) => Promise<{ receiptNumber: string | null }>;
  /** Worker-calculated patient balance before unsaved work in this step is charged. */
  currentOutstandingDue?: number;
  /** Saves an append-only periodontal snapshot for this selected case. */
  onSavePerioChart?: (teeth: Record<string, ToothPerioData>) => Promise<void>;
  /** The successful-case destination. The clinic workflow finishes on Follow-ups. */
  onFinish?: () => void;
  /** Resolves once the patient (if new) and the case have been stored. Rejects on failure. */
  onCreateCase: (data: CaseEntryData) => Promise<void>;
  /** The active adapter owns the precise durable outcome of a successful save. */
  successTitle?: string;
  successBody?: string;
}

const ANTICOAG_RE = /warfarin|blood thinner|anticoagulant|heparin|clopidogrel/i;
const SURGICAL_RE = /extraction|surgery|surgical|implant|extract/i;

// --- shared inline style atoms (this codebase styles heavily inline) -----------------
const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "0px",
  padding: "18px 20px",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
  width: "100%",
  boxSizing: "border-box",
};
const label: React.CSSProperties = {
  display: "block",
  fontSize: "var(--fs-12)",
  fontWeight: "var(--fw-bold)",
  color: "#64748b",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "6px",
};
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  padding: "9px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "0px",
  fontSize: "var(--fs-14)",
  color: "#0f172a",
  background: "#ffffff",
  fontFamily: "inherit",
  outline: "none",
  transition: "border-color 0.15s ease, box-shadow 0.15s ease",
};

function ReadOnlyContextField({ label: fieldLabel, value }: { label: string; value: string }) {
  return <div>
    <span style={{ display: "block", marginBottom: "4px", color: "#64748b", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", letterSpacing: "0.04em", textTransform: "uppercase" }}>{fieldLabel}</span>
    <strong style={{ display: "block", color: "#334155", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", lineHeight: 1.45 }}>{value}</strong>
  </div>;
}
const sectionTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  fontSize: "var(--fs-15)",
  fontWeight: "var(--fw-bold)",
  color: "#0f172a",
  margin: "0 0 16px",
  letterSpacing: "-0.01em",
};
// The two step-four columns are deliberately named as work areas, not merely
// card headings. A stronger title helps the clinician keep care decisions on
// the left and today's money/recall work on the right.
const workAreaTitle: React.CSSProperties = {
  fontSize: "16px",
  fontWeight: 800,
  lineHeight: 1.2,
  letterSpacing: "-0.01em",
};

const NEW_PATIENT_STEPS = [
  { n: 1, label: "Patient & purpose" },
  { n: 2, label: "Chart & plan" },
  { n: 3, label: "Imaging, Rx & lab" },
  { n: 4, label: "Today & payment" },
  { n: 5, label: "Recall" },
  { n: 6, label: "Review & commit" },
] as const;

// A concrete stage inside one planned procedure group. Tooth lives on the GROUP, not the
// stage, so two same-protocol procedures on different teeth stay distinct.
interface GroupStage {
  key: number;
  label: string;
  procedureCode: string;
  sourceProtocolStageId?: string;
  toothScope: ToothScope;
  /** TEXT, not a number: "" is unpriced, "0" is deliberately free. See `lib/inputs`. */
  cost: string;
  doneToday: boolean;
  /** A past visit has already recorded this stage. It stays visible but cannot be re-submitted. */
  alreadyCompleted?: boolean;
  gradeLabel?: string;
  // A clinician-added extra step on top of the protocol's stages ("add other"). Its label is
  // editable inline and it carries no fee code (price typed in).
  custom?: boolean;
}

// One planned procedure = one protocol applied to one tooth (or the whole arch/mouth). The
// unit that carries tooth identity, so different teeth can hold different procedures.
interface PlanGroup {
  gid: number;
  treatmentId?: string;
  protocolId: string;
  protocolName: string;
  category: string;
  phase?: "urgent" | "basic" | "elective";
  isCanal?: boolean;
  toothScope: ToothScope;
  tooth: string; // e.g. "46"; "" for arch/full-mouth
  stages: GroupStage[];
  /** Set on a GRADED protocol. Until a grade is chosen the group deliberately carries no stages. */
  grades?: ProtocolGrade[];
  grade?: string;
  gradeLabel?: string;
}

function planGroupsFromSelections(
  selections: CaseEntryData["planSelections"],
  protocols: TreatmentProtocol[],
  completedStages: CaseEntryViewProps["initialCompletedStages"] = [],
): PlanGroup[] {
  const completedKeys = new Set(
    completedStages.map((stage) => `${stage.sourceProtocolId}:${stage.sourceProtocolStageId}:${stage.toothCode ?? stage.treatmentArea ?? ""}`),
  );
  let groupKey = 1;
  let stageKey = 1;
  return selections.map((selection) => {
    const protocol = protocols.find((item) => item.id === selection.sourceProtocolId);
    const scope: ToothScope = protocol?.stages.some((stage) => stage.toothScope === "tooth")
      ? "tooth"
      : protocol?.stages.some((stage) => stage.toothScope === "arch")
        ? "arch"
        : "full-mouth";
    return {
      gid: groupKey++,
      treatmentId: `persisted-${selection.sourceProtocolId}-${selection.toothCode ?? selection.treatmentArea ?? groupKey}`,
      protocolId: selection.sourceProtocolId,
      protocolName: protocol?.name ?? "Treatment protocol",
      category: protocol?.category ?? "",
      phase: protocol?.phase,
      isCanal: Boolean(protocol?.recordCanals),
      toothScope: scope,
      tooth: selection.toothCode ?? "",
      stages: selection.stages.map((stage) => ({
        key: stageKey++,
        label: stage.stageName,
        procedureCode: stage.sourceProtocolStageId ?? stage.stageName,
        sourceProtocolStageId: stage.sourceProtocolStageId ?? undefined,
        toothScope: scope,
        cost: rupeeValue(stage.price),
        doneToday: completedKeys.has(`${selection.sourceProtocolId}:${stage.sourceProtocolStageId ?? ""}:${selection.toothCode ?? selection.treatmentArea ?? ""}`),
        alreadyCompleted: completedKeys.has(`${selection.sourceProtocolId}:${stage.sourceProtocolStageId ?? ""}:${selection.toothCode ?? selection.treatmentArea ?? ""}`),
      })),
    };
  });
}

function planFingerprint(groups: PlanGroup[]) {
  return JSON.stringify(groups.map((group) => ({
    protocolId: group.protocolId,
    toothScope: group.toothScope,
    tooth: group.tooth.trim(),
    stages: group.stages.map((stage) => ({
      sourceProtocolStageId: stage.sourceProtocolStageId ?? null,
      label: stage.label.trim(),
      cost: rupeeAmount(stage.cost),
      custom: Boolean(stage.custom),
    })),
  })));
}

function chartFingerprint(marks: Record<string, ChartMark>) {
  return JSON.stringify(Object.entries(marks)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([toothCode, mark]) => ({ toothCode, slot: mark.slot, value: mark.value })));
}

function planSelectionsFromGroups(groups: PlanGroup[]): CaseEntryData["planSelections"] {
  return groups.map((group) => ({
    sourceProtocolId: group.protocolId,
    toothCode: group.toothScope === "tooth" ? group.tooth.trim() || null : null,
    treatmentArea: group.toothScope === "tooth" ? null : toothForScope(group.toothScope),
    stages: group.stages
      .filter((stage) => !stage.custom || stage.label.trim())
      .map((stage) => ({
        sourceProtocolStageId: stage.sourceProtocolStageId ?? null,
        stageName: stage.label.trim(),
        price: rupeeAmount(stage.cost),
      })),
  }));
}

function toothForScope(scope: "tooth" | "arch" | "full-mouth"): string {
  if (scope === "arch") return "Arch";
  if (scope === "full-mouth") return "Full mouth";
  return "";
}

export default function CaseEntryView({
  patients,
  doctorsList,
  labs,
  clinic,
  feeSchedule,
  protocols,
  cases,
  initialPatientId,
  embedded,
  onExit,
  hideStepTabs = false,
  nextPatientNumber = null,
  patientStepOnly = false,
  onPatientStepNext,
  onPatientStepActionsChange,
  existingCaseWorkflow = false,
  canCollectPayment = true,
  initialStep = 1,
  onStepChange,
  initialChiefComplaint = "",
  initialCaseOpenedOn,
  initialCaseDoctors = [],
  initialPlanSelections = [],
  initialCompletedStages = [],
  initialChartMarks = {},
  initialLabOrders = [],
  initialPerio,
  initialCanalData = {},
  initialChiefComplaintId,
  onMediaChanged,
  onRemoveXray,
  onCommitTodayWork,
  onSavePerioChart,
  currentOutstandingDue = 0,
  onFinish,
  onCreateCase,
  successTitle = "Case created successfully",
  successBody = "The case has been saved.",
  upcomingFollowUps = [],
}: CaseEntryViewProps) {
  // Prefilled for an existing patient's new case, we skip registration and open on Purpose. The
  // parent remounts (key change) whenever this changes, so reading it once at mount is enough.
  const prefilled = initialPatientId != null;
  const showStandaloneRegistrationFields = showsStandalonePatientRegistrationFields({
    isNewPatient: !prefilled,
    hideStepTabs,
    patientStepOnly,
  });
  const [step, setStep] = useState(initialStep);
  const wizardSteps = NEW_PATIENT_STEPS.map((wizardStep) =>
    wizardStep.n === 4 && !canCollectPayment ? { ...wizardStep, label: "Today's work" } : wizardStep,
  );

  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  // TEMP: step-3 layout preview switcher — three full-bleed arrangements of the same
  // charting/plan building blocks so the clinic can pick one live. Remove once chosen.

  // --- step 1: patient resolution ---
  //
  // There is no patient SEARCH here, and no way to switch to an existing patient. This page has one
  // job: register someone the clinic has never seen. Opening a case for a patient already on file is
  // Work Entry's job — pick them there and hit "New complaint / work", which embeds this very wizard
  // prefilled with that patient, and does it with their chart and open cases already in front of you.
  //
  // Two doors into one room is how a page called "+ New Patient" ends up not being about new
  // patients. So `isNew` is not state any more: standalone means registering, embedded means the
  // host already chose the patient.
  const selectedId = initialPatientId ?? null;
  const isNew = !prefilled;
  const existingPatientAtMount = selectedId ? patients.find((patient) => patient.id === selectedId) ?? null : null;
  const existingAlertsAtMount = existingPatientAtMount?.alerts ?? [];

  // new patient fields (only when isNew)
  const [npName, setNpName] = useState(() => existingCaseWorkflow ? existingPatientAtMount?.name ?? "" : "");
  const [npSex, setNpSex] = useState<"female" | "male" | "other" | "not_recorded">(() => {
    if (!existingCaseWorkflow) return "male";
    if (existingPatientAtMount?.sex === "F") return "female";
    if (existingPatientAtMount?.sex === "M") return "male";
    return "not_recorded";
  });
  const [npPhone, setNpPhone] = useState(() => existingCaseWorkflow ? existingPatientAtMount?.phone ?? "" : "");
  const [npAgeYears, setNpAgeYears] = useState(() => existingCaseWorkflow ? String(existingPatientAtMount?.age ?? "") : "");
  const [npAddress, setNpAddress] = useState(() => existingCaseWorkflow ? existingPatientAtMount?.address ?? "" : "");
  const [npEcName, setNpEcName] = useState(() => existingCaseWorkflow ? existingPatientAtMount?.emergencyContact?.name ?? "" : "");
  const [npEcRel, setNpEcRel] = useState(() => existingCaseWorkflow ? existingPatientAtMount?.emergencyContact?.relation ?? "" : "");
  const [npEcPhone, setNpEcPhone] = useState(() => existingCaseWorkflow ? existingPatientAtMount?.emergencyContact?.phone ?? "" : "");

  // structured medical history (only when isNew)
  const [mhAllergies, setMhAllergies] = useState<{ substance: string; severity?: string }[]>(() =>
    existingCaseWorkflow
      ? existingAlertsAtMount
          .filter((alert) => /allergy/i.test(alert))
          .map((alert) => ({ substance: alert.replace(/\s*allergy\s*/i, "").trim(), severity: "" }))
      : []
  );
  const [mhCond, setMhCond] = useState<{
    diabetes?: boolean;
    cardiac?: boolean;
    hypertension?: boolean;
    pregnancy?: boolean;
    bleeding?: boolean;
    bloodThinners?: boolean;
  }>(() => {
    const historyText = existingAlertsAtMount.join(" ").toLowerCase();
    return existingCaseWorkflow
      ? {
          diabetes: /diabetes|diabetic/.test(historyText),
          cardiac: /cardiac|heart/.test(historyText),
          hypertension: /hypertension|high blood pressure/.test(historyText),
          pregnancy: /pregnan/.test(historyText),
          bleeding: /bleeding/.test(historyText),
          bloodThinners: /blood thinner|anticoagulant/.test(historyText),
        }
      : {};
  });
  const [mhOther, setMhOther] = useState("");
  // The clinician asserting they ASKED. Without it an untouched form saves as "no allergies" — see
  // `intakeTaken`. Deliberately not defaulted true, and deliberately not remembered across patients.
  const [mhReviewed, setMhReviewed] = useState(existingCaseWorkflow);
  // Raised when someone tries to leave step 1 with the history unconfirmed. It asks the same
  // question the checkbox does, because a disabled button that refuses to say WHY teaches nothing —
  // the doctor clicks it twice, gives up, and the record still says "unknown".
  const [mhPrompt, setMhPrompt] = useState(false);

  // --- step 2: purpose ---
  const [chiefComplaint, setChiefComplaint] = useState(initialChiefComplaint);
  const [dateISO, setDateISO] = useState(() => initialCaseOpenedOn ?? todayISO());
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>(initialCaseDoctors);
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const doctor = selectedDoctors.join(", ");
  const [step3SubTab] = useState<"all" | "xray" | "rx" | "lab">("all");

  // Work Entry begins from an already-saved patient and case. Keep a normalized snapshot of the
  // persisted values so the first-step action only says "Save" when something is incomplete or
  // has actually changed. A clean, complete record should let the clinician move straight on.
  const existingCaseDraftFingerprint = JSON.stringify({
    name: npName.trim(),
    sex: npSex,
    phone: npPhone.trim(),
    ageYears: npAgeYears.trim(),
    address: npAddress.trim(),
    emergencyContact: {
      name: npEcName.trim(),
      relation: npEcRel.trim(),
      phone: npEcPhone.trim(),
    },
    allergies: mhAllergies
      .filter((allergy) => allergy.substance.trim())
      .map((allergy) => ({ substance: allergy.substance.trim(), severity: allergy.severity?.trim() ?? "" })),
    conditions: {
      diabetes: !!mhCond.diabetes,
      cardiac: !!mhCond.cardiac,
      hypertension: !!mhCond.hypertension,
      pregnancy: !!mhCond.pregnancy,
      bleeding: !!mhCond.bleeding,
      bloodThinners: !!mhCond.bloodThinners,
      other: mhOther.trim(),
    },
    medicalHistoryReviewed: mhReviewed,
    chiefComplaint: chiefComplaint.trim(),
    caseOpenedOn: dateISO,
    caseDoctors: [...selectedDoctors].sort(),
  });
  const savedExistingCaseDraftFingerprint = useRef(existingCaseDraftFingerprint);
  const existingCaseHasUnsavedChanges = existingCaseWorkflow && existingCaseDraftFingerprint !== savedExistingCaseDraftFingerprint.current;

  const goToStep = (targetStep: 1 | 2 | 3 | 4 | 5 | 6) => {
    if (!existingCaseWorkflow && step === 1 && targetStep > 1) {
      if (!mhReviewed) {
        setMhPrompt(true);
        return;
      }
      if (selectedDoctors.length === 0) {
        setShowDoctorModal(true);
        return;
      }
    }
    if (targetStep === step) return;
    setStep(targetStep);
    onStepChange?.(targetStep);
  };

  // --- step 3: chart & plan ---
  const initialPlanGroups = useRef(planGroupsFromSelections(initialPlanSelections, protocols, initialCompletedStages));
  const stageId = useRef(1 + initialPlanGroups.current.reduce((total, group) => total + group.stages.length, 0));
  const groupId = useRef(1 + initialPlanGroups.current.length);
  // Each planned procedure carries its own tooth, so different teeth hold different work.
  const [groups, setGroups] = useState<PlanGroup[]>(initialPlanGroups.current);
  const [planWasEdited, setPlanWasEdited] = useState(false);
  const currentPlanFingerprint = planFingerprint(groups);
  const savedPlanFingerprint = useRef(currentPlanFingerprint);
  const existingPlanHasUnsavedChanges = existingCaseWorkflow && planWasEdited && currentPlanFingerprint !== savedPlanFingerprint.current;

  useEffect(() => {
    const completedKeys = new Set(
      initialCompletedStages.map((stage) => `${stage.sourceProtocolId}:${stage.sourceProtocolStageId}:${stage.toothCode ?? stage.treatmentArea ?? ""}`),
    );
    if (completedKeys.size === 0) return;
    setGroups((current) => current.map((group) => ({
      ...group,
      stages: group.stages.map((stage) => {
        const key = `${group.protocolId}:${stage.sourceProtocolStageId ?? ""}:${group.toothScope === "tooth" ? group.tooth : toothForScope(group.toothScope)}`;
        return completedKeys.has(key) ? { ...stage, doneToday: true, alreadyCompleted: true } : stage;
      }),
    })));
  }, [initialCompletedStages]);

  const reorderGroupStage = (gid: number, fromIdx: number, toIdx: number) => {
    setPlanWasEdited(true);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.gid !== gid) return g;
        const updated = [...g.stages];
        if (fromIdx < 0 || toIdx < 0 || fromIdx >= updated.length || toIdx >= updated.length) return g;
        // Direct swap / exchange positions between the two target stages only
        const temp = updated[fromIdx];
        updated[fromIdx] = updated[toIdx];
        updated[toIdx] = temp;
        return { ...g, stages: updated };
      })
    );
  };

  // ONE finding per tooth. A screening pass records what the dentist saw on that tooth, and
  // tapping a second condition replaces the first. Layered findings belong in the record.
  const [chartMarks, setChartMarks] = useState<Record<string, ChartMark>>(() => ({ ...initialChartMarks }));
  const [chartWasEdited, setChartWasEdited] = useState(false);
  const savedChartMarks = useRef<Record<string, ChartMark>>({ ...initialChartMarks });
  const currentChartFingerprint = chartFingerprint(chartMarks);
  const savedChartFingerprint = useRef(currentChartFingerprint);
  const existingChartHasUnsavedChanges = existingCaseWorkflow && chartWasEdited && currentChartFingerprint !== savedChartFingerprint.current;
  // Gum readings live here, not inside the perio card, because the patient may not exist until
  // submit. `null` means nothing was probed, and nothing gets written.
  const [perioTeeth, setPerioTeeth] = useState<Record<string, ToothPerioData> | null>(null);
  const onPerioChange = useCallback(
    (teeth: Record<string, ToothPerioData>, probed: boolean) => setPerioTeeth(probed ? teeth : null),
    [],
  );

  // Per-suggestion protocol choice, keyed by tooth — defaulted from the recommendation,
  // overridable before the clinician confirms it into the plan.
  const [suggestSel, setSuggestSel] = useState<Record<string, string>>({});

  // Radiographs use the host-authorised patient-media workflow and remain scoped to this patient.
  const [xrayDrafts, setXrayDrafts] = useState<XrayDraft[]>([]);
  const [savedRadiographUploads, setSavedRadiographUploads] = useState<SavedRadiographUpload[]>([]);

  // Optional prescription (multi-drug, §1e) + optional lab work (§1f).
  const [prescriptions, setPrescriptions] = useState<RxLine[]>([]);
  const [labOrders, setLabOrders] = useState<LabOrderInput[]>(() => initialLabOrders);

  // --- step 4: payment + follow-up ---
  const [paidToday, setPaidToday] = useState("");
  const [discountInput, setDiscountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("");
  const [fuReason, setFuReason] = useState("");
  const [noFollowUpNeeded, setNoFollowUpNeeded] = useState(false);
  const [closeCase, setCloseCase] = useState(false);
  const fuEdited = useRef(false);
  const encounterIdRef = useRef("");
  const encounterCommandIdRef = useRef("");

  const [createStatus, setCreateStatus] = useState<"idle" | "saving" | "done">("idle");
  const [createError, setCreateError] = useState("");
  const [showCreateSuccess, setShowCreateSuccess] = useState(false);
  const [allowParallelCase, setAllowParallelCase] = useState(false);
  const { showToast, showError } = useSnackbar();
  const { beginOperation } = useClinicLoading();

  // --- root canal working length drawer state ---
  const [canalDrawerOpen, setCanalDrawerOpen] = useState(false);
  const [activeCanalTooth, setActiveCanalTooth] = useState("");
  const [canalDataMap, setCanalDataMap] = useState<Record<string, CanalChartData>>(initialCanalData);
  const savedCanalData = useRef<Record<string, CanalChartData>>(initialCanalData);

  const openCanalDrawer = (tooth: string) => {
    setActiveCanalTooth(tooth || "16");
    setCanalDrawerOpen(true);
  };
  const handleSaveCanalData = async (data: CanalChartData) => {
    setCanalDataMap((prev) => ({ ...prev, [data.tooth]: data }));
  };

  // --- derived ---
  const existing = selectedId ? patients.find((p) => p.id === selectedId) ?? null : null;
  const patientName = isNew || existingCaseWorkflow ? titleCaseName(npName.trim()) : existing?.name ?? "";
  const patientChosen = isNew || existingCaseWorkflow ? npName.trim().length > 0 : Boolean(existing);
  const builtMedicalHistory: MedicalHistory = {
    allergies: mhAllergies.filter((a) => a.substance.trim()),
    medications: [],
    conditions: { ...mhCond, other: mhOther.split(",").map((s) => s.trim()).filter(Boolean) },
    habits: {},
  };

  const patientAlerts: string[] = isNew || existingCaseWorkflow
    ? alertsFromHistory(builtMedicalHistory)
    : existing?.alerts || [];

  // Protocols split by scope: tooth-specific ones are offered as chart suggestions;
  // whole-arch / full-mouth ones are added as standalone procedures.
  const toothProtocols = protocols.filter((p) => p.stages.every((s) => s.toothScope === "tooth"));
  const archProtocols = protocols.filter((p) => p.stages.some((s) => s.toothScope !== "tooth"));

  // The recommended tooth-protocol may have been edited away by the clinic; fall back to the
  // first available tooth protocol so the suggestion select always has a valid default.
  const defaultSuggestId = (mark: ChartMark): string => suggestedProtocolId(mark.value, toothProtocols);

  // Every charted finding remains in the suggestion cart while the clinician continues across
  // the mouth. A suggestion leaves only when it is planned or explicitly dismissed.
  const chartSuggestions = pendingChartSuggestions(
    chartMarks,
    groups.filter((group) => group.toothScope === "tooth").map((group) => group.tooth),
  );

  // Flatten groups → the stage list every downstream total/dropdown/submit consumes. Tooth
  // and a per-group identity label come from the owning group.
  const flatStages = groups.flatMap((g) =>
    g.stages.map((s) => ({
      ...s,
      tooth: g.toothScope === "tooth" ? g.tooth : toothForScope(g.toothScope),
      group: g.toothScope === "tooth" ? `${g.protocolName} · ${g.tooth}` : g.protocolName,
      phase: g.phase,
      treatmentId: g.treatmentId,
      sourceProtocolId: g.protocolId,
      sourceProtocolStageId: s.sourceProtocolStageId,
      recordCanals: g.isCanal,
      grade: g.grade,
      gradeLabel: g.gradeLabel,
    }))
  );

  const uniqueProtocolNames = Array.from(new Set(groups.map((g) => g.protocolName)));

  /**
   * Perio charting is offered by treatments that act on the periodontium as a whole — scaling and
   * preventive work, where a 6-site chart is the point of the visit.
   *
   * Mobility is deliberately excluded even though it is filed under Periodontics. A mobile tooth is
   * as often trauma, occlusal overload, a fractured root or an exfoliating deciduous tooth as it is
   * gum disease, so a full probing chart neither diagnoses it nor is worth the chair time. The
   * grade is recorded on the case instead.
   */
  const perioIndicated = groups.some(
    (g) =>
      g.protocolId !== "PROTO-MOBILITY" &&
      (g.category === "Preventive" || g.category === "Periodontics" || g.protocolId === "PROTO-SCALING")
  );

  const feeName = (code: string) => feeSchedule.find((f) => f.code === code)?.name || "";

  // Imaging is surfaced "if needed" — only when the case has a radiograph stage. The type
  // is inferred from that stage (CBCT/OPG/IOPA) so the upload prefills correctly.
  const imagingStage = flatStages.find(
    (s) => IMAGING_RE.test(s.label) || IMAGING_RE.test(feeName(s.procedureCode))
  );
  const imagingType: XrayType = imagingStage
    ? inferXrayType(`${imagingStage.label} ${feeName(imagingStage.procedureCode)}`)
    : "IOPA";

  const agreedTotal = flatStages.reduce((s, r) => s + rupeeAmount(r.cost), 0);
  const todaysCharges = flatStages.reduce((s, r) => s + (r.doneToday ? rupeeAmount(r.cost) : 0), 0);
  const paid = Number(paidToday) || 0;
  // Discount on today's charges, clamped so it never exceeds them.
  const discount = Math.min(Number(discountInput) || 0, todaysCharges);
  const balance = Math.max(0, (existing?.balance || 0) + todaysCharges - discount - paid);
  const workEntryOutstandingDue = currentOutstandingDue + todaysCharges;

  const stageIsSurgical = (r: { label: string; procedureCode: string }) =>
    SURGICAL_RE.test(r.label) || SURGICAL_RE.test(feeName(r.procedureCode));
  const hasSurgical = flatStages.some(stageIsSurgical);
  const onAnticoagulant = patientAlerts.some((a) => ANTICOAG_RE.test(a));
  const surgeryBleedRisk = hasSurgical && onAnticoagulant;

  const firstTooth = groups.map((g) => g.tooth.trim()).find(Boolean) || "";
  const caseTitle =
    groups.length === 0
      ? ""
      : groups.length === 1
        ? `${groups[0].protocolName}${groups[0].tooth ? ` — tooth ${groups[0].tooth}` : ""}`
        : `${uniqueProtocolNames.join(" + ")}${firstTooth ? ` — tooth ${firstTooth}` : ""}`;

  // A patient should carry one open case at a time; a new plan waits until the current one closes.
  // Only an existing patient can already have one (a new registration cannot). The doctor may open
  // a parallel case deliberately by ticking the override.
  const openCaseForPatient =
    !isNew && existing ? (cases?.[existing.id] || []).find((c) => c.status === "open") : undefined;
  const blockedByOpenCase = !!openCaseForPatient && !allowParallelCase;

  /**
   * The intake has actually been TAKEN — not merely displayed.
   *
   * `alertsFromHistory` of an untouched form is `[]`, and an empty allergy list is indistinguishable
   * from "asked, and there are none" once it is stored. That is the difference between a record that
   * is silent and a record that is WRONG, and a dentist reaching for Amoxicillin reads the second one
   * as a clearance. The steps are navigable out of order, so without this a registration could be
   * skipped straight to charting and saved with no date of birth or confirmed history.
   *
   * So: the demographics must be real, and someone must positively assert they asked about the
   * history. `mhReviewed` is what turns an empty list from "unknown" into "none" — it is the whole
   * point of the checkbox, and it is why an empty medical history is allowed but an unconfirmed one
   * is not.
   */
  const ageYears = /^\d{1,3}$/.test(npAgeYears) ? Number(npAgeYears) : null;
  const ageTaken = ageYears !== null && ageYears >= 0 && ageYears <= 130;
  const intakeTaken =
    npName.trim().length > 0
    && ageTaken
    && npPhone.trim().length > 0
    && mhReviewed;

  const canCreate =
    patientChosen && chiefComplaint.trim().length > 0 && flatStages.some((stage) => stage.label.trim()) && !blockedByOpenCase && (!isNew || (intakeTaken && Boolean(dateISO)));

  const existingCaseRequiresSave =
    existingCaseWorkflow
    && (!intakeTaken || !chiefComplaint.trim() || (doctorsList.length > 0 && selectedDoctors.length === 0));
  const showExistingCaseSave = existingCaseWorkflow && (existingCaseRequiresSave || existingCaseHasUnsavedChanges || createStatus === "saving");

  // §1c: the next-visit reason is a dropdown of the remaining (not-done-today) stages —
  // no auto-fill; the doctor chooses. Clinician-added steps belong here exactly like protocol
  // ones; an unnamed one does not, or the dropdown offers a blank line.
  const remainingStages = flatStages.filter((s) => !s.doneToday && s.label.trim());

  // --- handlers ---
  // Confirm a suggestion (or an arch procedure) into the plan as its own group. The tooth
  /* Keyboard navigation helper: focuses element and opens select picker sheet automatically */
  const focusAndOpen = (el: HTMLElement | null) => {
    if (!el) return;
    el.focus();
    if (el instanceof HTMLInputElement) {
      el.select();
    } else if (el instanceof HTMLSelectElement) {
      try {
        if (typeof el.showPicker === "function") {
          el.showPicker();
        }
      } catch {
        /* Fallback for unsupported environments */
      }
    }
  };

  // belongs to the group, so the same protocol on another tooth is a separate group.
  // Protocol stages -> editable plan rows. Shared by adding a group and by switching its grade.
  const toGroupStages = (src: ProtocolStage[], defaultGradeLabel?: string): GroupStage[] =>
    [...src]
      .sort((a, b) => a.order - b.order)
      .map<GroupStage>((s) => ({
      key: stageId.current++,
      label: s.label,
      procedureCode: s.procedureCode,
      sourceProtocolStageId: s.sourceProtocolStageId,
      toothScope: s.toothScope,
        // Price comes from the protocol stage itself (set in Settings or defaults), falling back to fee schedule.
        cost: rupeeValue(s.defaultCost ?? priceOf(feeSchedule, s.procedureCode)),
        doneToday: false,
        gradeLabel: defaultGradeLabel,
      }));

  const addGroup = (protocolId: string, tooth: string) => {
    const proto = protocols.find((p) => p.id === protocolId);
    if (!proto) return;
    const graded = proto.grades?.length ? proto.grades : undefined;
    const defaultGrade = graded ? graded[0] : undefined;
    const stages = defaultGrade ? toGroupStages(defaultGrade.stages, defaultGrade.label) : (graded ? [] : toGroupStages(proto.stages));
    const scope: ToothScope = proto.stages.some((s) => s.toothScope === "tooth")
      ? "tooth"
      : proto.stages.some((s) => s.toothScope === "arch")
        ? "arch"
        : "full-mouth";
    // Allocate identity before the state updater so a one-click batch can add several groups
    // without sharing a treatment id (and so the updater itself stays pure).
    const gid = groupId.current++;
    const treatmentId = `treat-${Date.now()}-${gid}`;
    const isCanal = Boolean(proto.recordCanals);
    setPlanWasEdited(true);
    setGroups((prev) => [
      ...prev,
      {
        gid,
        treatmentId,
        protocolId,
        protocolName: proto.name,
        category: proto.category,
        phase: proto.phase,
        isCanal,
        toothScope: scope,
        tooth: scope === "tooth" ? tooth : "",
        stages,
        grades: graded,
        grade: defaultGrade?.id,
        gradeLabel: defaultGrade?.label,
      },
    ]);
    fuEdited.current = false;
  };

  /** Choosing a grade replaces the group's stages with that grade's, at that grade's prices. */
  const setGroupGrade = (gid: number, gradeId: string) => {
    setPlanWasEdited(true);
    setGroups((prev) =>
      prev.map((g) => {
        if (g.gid !== gid) return g;
        const grade = g.grades?.find((x) => x.id === gradeId);
        if (!grade) return g;
        const completedStages = g.stages.filter((s) => s.doneToday);
        const newStages = toGroupStages(grade.stages, grade.label).map((stg) => {
          const matched = completedStages.find((c) => c.label === stg.label);
          if (matched) {
            return { ...stg, doneToday: true, cost: matched.cost, gradeLabel: matched.gradeLabel || grade.label };
          }
          return stg;
        });
        return { ...g, grade: grade.id, gradeLabel: grade.label, stages: newStages };
      }),
    );
  };

  const updateTooth = (tooth: string, mark: ChartMark) => {
    setChartWasEdited(true);
    setChartMarks((prev) => ({ ...prev, [tooth]: mark }));
  };

  // Dismiss a charted finding: drop the tooth's mark so its suggestion disappears — for a
  // mischart, or a tooth that needs no treatment. (Adding a procedure hides the suggestion
  // via the "already has a group" filter; this is the discard-without-planning path.)
  const dismissTooth = (tooth: string) => {
    setChartWasEdited(true);
    setChartMarks((prev) => {
      const next = { ...prev };
      delete next[tooth];
      return next;
    });
    setSuggestSel((prev) => {
      const next = { ...prev };
      delete next[tooth];
      return next;
    });
  };

  // Mouseless data entry: Enter moves to the next field (text/number/date/select), skipping
  // checkboxes. On the last field, focus the step's Continue button so a final Enter proceeds.
  // Scoped to the form steps — the chart step is click-driven and not wired to this.
  const advanceOnEnter = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "TEXTAREA" || target.tagName === "BUTTON") return;
    if (target.tagName === "INPUT") {
      const t = (target as HTMLInputElement).type;
      if (t === "checkbox" || t === "radio") return;
    }
    const fields = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>(
        "input:not([type=checkbox]):not([type=radio]):not([type=hidden]), select, button[data-entry-field]"
      )
    ).filter((el) => !(el as HTMLInputElement).disabled && el.offsetParent !== null);
    const idx = fields.indexOf(target);
    if (idx === -1) return;
    e.preventDefault();
    const next = fields[idx + 1];
    if (next) {
      focusAndOpen(next);
    } else {
      e.currentTarget.querySelector<HTMLButtonElement>("[data-wizard-next]:not([disabled])")?.focus();
    }
  };

  /**
   * Removing a tooth's planned treatment FREES that tooth — its charted finding goes with it.
   *
   * The finding and the plan were separate state, so deleting the plan left the tooth still marked
   * on the odontogram with no way to clear it in one action: the mark is what RAISED the suggestion,
   * and the suggestion is hidden the moment a group exists for that tooth. So the tooth sat coloured,
   * pointing at treatment the clinician had just decided against, and had to be dismissed separately.
   *
   * Safe to drop the mark here, and only here: nothing has been written yet. `chartMarks` is form
   * state that becomes an examination entry on the patient's chart at SUBMIT. Clearing it now erases
   * no record — it is the clinician still composing. (Once saved, a finding is corrected by a new
   * dated entry that supersedes it, never by deletion — see the odontogram's append-only rule.)
   */
  const removeGroup = (gid: number) => {
    const group = groups.find((g) => g.gid === gid);
    setPlanWasEdited(true);
    setGroups((prev) => prev.filter((g) => g.gid !== gid));

    // Arch and full-mouth procedures own no single tooth, so there is nothing to free.
    const tooth = group?.toothScope === "tooth" ? group.tooth : "";
    if (!tooth) return;

    setChartWasEdited(true);
    setChartMarks((prev) => {
      const next = { ...prev };
      delete next[tooth];
      return next;
    });
    setSuggestSel((prev) => {
      const next = { ...prev };
      delete next[tooth];
      return next;
    });
  };

  const setGroupStage = (gid: number, key: number, patch: Partial<GroupStage>) => {
    setPlanWasEdited(true);
    setGroups((prev) =>
      prev.map((g) =>
        g.gid === gid ? { ...g, stages: g.stages.map((s) => (s.key === key ? { ...s, ...patch } : s)) } : g
      )
    );
  };

  // "Add other" — append a clinician-defined extra step to one procedure's staged plan
  // (e.g. an unplanned review or an added canal). Label + cost typed in; inherits the
  // group's tooth scope so it fans out with the rest.
  const addGroupStage = (gid: number) => {
    setPlanWasEdited(true);
    setGroups((prev) =>
      prev.map((g) =>
        g.gid === gid
          ? { ...g, stages: [...g.stages, { key: stageId.current++, label: "", procedureCode: "", toothScope: g.toothScope, cost: "", doneToday: false, custom: true }] }
          : g
      )
    );
  };

  // Drop a step, and ONLY that step. Clearing every step leaves the treatment block standing — the
  // clinic keeps the tooth + procedure and builds its own steps with "Add step". Removing the whole
  // treatment (and freeing the tooth) is the block's own "Remove" button, a deliberate separate act.
  const removeGroupStage = (gid: number, key: number) => {
    setPlanWasEdited(true);
    setGroups((prev) =>
      prev.map((g) => (g.gid === gid ? { ...g, stages: g.stages.filter((s) => s.key !== key) } : g)),
    );
  };

  const resetForm = () => {
    clearEncounterDraftId("new-case");
    encounterIdRef.current = "";
    encounterCommandIdRef.current = "";
    setStep(1);
    setNpName(""); setNpSex("male"); setNpPhone("");
    setNpAgeYears(""); setNpAddress(""); setNpEcName(""); setNpEcRel(""); setNpEcPhone("");
    setMhAllergies([]); setMhCond({}); setMhOther("");
    // Carried over, `mhReviewed` would let the NEXT patient's blank history be saved as "asked,
    // none" on the strength of the last one's confirmation.
    setMhReviewed(false);
    setChiefComplaint("");
    setDateISO(todayISO());
    setSelectedDoctors([]);
    setGroups([]);
    setPlanWasEdited(false);
    setChartMarks({});
    setChartWasEdited(false);
    setSuggestSel({});
    setXrayDrafts([]);
    setPrescriptions([]);
    setLabOrders([]);
    setPaidToday(""); setDiscountInput(""); setPaymentMethod(PAYMENT_METHODS[0]); setFuDate(""); setFuTime(""); setFuReason(""); setNoFollowUpNeeded(false);
    setCanalDataMap({});
    fuEdited.current = false;
  };

  const submit = async () => {
    if (!canCreate || createStatus === "saving") return;
    if (!encounterIdRef.current) encounterIdRef.current = encounterDraftId("new-case");
    if (!encounterCommandIdRef.current) encounterCommandIdRef.current = encounterDraftCommandId("new-case");
    const data: CaseEntryData = {
      encounterId: encounterIdRef.current,
      commandId: encounterCommandIdRef.current,
      patientId: isNew ? null : existing?.id ?? null,
      patientName,
      isNewPatient: isNew,
      // The patient already exists (the booking made them) but this submission is what finally
      // takes their history. The caller writes these fields ONTO that record — see CaseEntryData.
      newPatient: isNew
        ? {
          // DOB is a legacy nullable column; patient intake records reported age.
          dateOfBirth: null,
          ageYears,
          sex: npSex,
          phone: npPhone.trim(),
          address: npAddress.trim() || undefined,
          emergencyContact: npEcName.trim()
            ? { name: npEcName.trim(), relation: npEcRel.trim(), phone: npEcPhone.trim() }
            : undefined,
        }
        : undefined,
      medicalHistory: isNew ? builtMedicalHistory : undefined,
      dateISO,
      doctor,
      doctors: selectedDoctors,
      chiefComplaint: chiefComplaint.trim(),
      protocolId: groups[0]?.protocolId ?? "",
      title: caseTitle,
      mobilityGrade: groups.find((g) => g.protocolId === "PROTO-MOBILITY")?.grade || flatStages.find((s) => s.grade)?.grade,
      phase: groups[0]?.phase ?? "basic",
      // A custom step the clinician added but never named is not a step. Drop it rather than
      // save a blank row into the treatment plan.
      stages: flatStages
        .filter((s) => !s.custom || s.label.trim())
        .map((s) => ({
          label: s.label.trim(),
          procedureCode: s.procedureCode,
          sourceProtocolId: s.sourceProtocolId,
          sourceProtocolStageId: s.sourceProtocolStageId,
          tooth: s.tooth.trim(),
          cost: rupeeAmount(s.cost),
          doneToday: s.doneToday,
          group: s.group,
          phase: s.phase,
          treatmentId: s.treatmentId,
          recordCanals: s.recordCanals,
          grade: s.grade,
          gradeLabel: s.gradeLabel,
        })),
      planSelections: groups.map((group) => ({
        sourceProtocolId: group.protocolId,
        toothCode: group.toothScope === "tooth" ? group.tooth.trim() || null : null,
        treatmentArea: group.toothScope === "tooth" ? null : toothForScope(group.toothScope),
        stages: group.stages
          .filter((stage) => !stage.custom || stage.label.trim())
          .map((stage) => ({
            sourceProtocolStageId: stage.sourceProtocolStageId ?? null,
            stageName: stage.label.trim(),
            price: rupeeAmount(stage.cost),
          })),
      })),
      paidToday: paid,
      discount: discount > 0 ? discount : undefined,
      paymentMethod: paid > 0 ? paymentMethod : undefined,
      followUp: !noFollowUpNeeded && fuDate ? { dateISO: fuDate, time: fuTime || undefined, reason: fuReason.trim() || "Follow-up" } : null,
      canalDataMap: Object.keys(canalDataMap).length > 0 ? canalDataMap : undefined,
      // One entry per charted tooth. Each still names its slot, so a crown recorded later can
      // never erase a root canal charted here.
      chartMarks: Object.entries(chartMarks).map(
        ([tooth, mark]): ChartMarkInput => ({ tooth, slot: mark.slot, value: mark.value }),
      ),
      prescriptions: (() => {
        const named = prescriptions.filter((d) => d.medicine.trim());
        return named.length ? named : undefined;
      })(),
      labOrders: labOrders,
      perio: perioTeeth ?? undefined,
    };
    setCreateStatus("saving");
    setCreateError("");
    try {
      // The host persists the patient/case through the Worker before this UI reports success.
      await onCreateCase(data);
      clearEncounterDraftId("new-case");
      encounterIdRef.current = "";
      encounterCommandIdRef.current = "";
      setCreateStatus("done");
      setShowCreateSuccess(true);
    } catch (err) {
      setCreateStatus("idle");
      setCreateError((err as Error).message || "Couldn't create the case.");
    }
  };

  const finishCreate = () => {
    setShowCreateSuccess(false);
    setCreateStatus("idle");
    resetForm();
  };

  const patientOnlyEntry = (): CaseEntryData => ({
    encounterId: encounterDraftId("new-case"),
    commandId: encounterDraftCommandId("new-case"),
    patientId: null,
    patientName,
    isNewPatient: true,
    newPatient: {
      dateOfBirth: null,
      ageYears,
      sex: npSex,
      phone: npPhone.trim(),
      address: npAddress.trim() || undefined,
      emergencyContact: npEcName.trim()
        ? { name: npEcName.trim(), relation: npEcRel.trim(), phone: npEcPhone.trim() }
        : undefined,
    },
    medicalHistory: builtMedicalHistory,
    dateISO,
    doctor: "",
    doctors: [],
    chiefComplaint: "",
    protocolId: "",
    title: "",
    stages: [],
    planSelections: [],
    paidToday: 0,
    followUp: null,
  });

  const savePatientOnly = async () => {
    if (!isNew || !intakeTaken || createStatus === "saving") return;
    setCreateStatus("saving"); setCreateError("");
    const finishPatientSaveLoading = beginOperation("New Patient", {
      title: "Saving patient record…",
      message: "Saving the patient profile and safety information.",
    }, true);
    try {
      try {
        await onCreateCase(patientOnlyEntry());
      } catch (error) {
        // An earlier successful intake used this browser draft's command key. That key must
        // never be reused for different patient data; rotate it and submit this new intake once.
        // The host SDK intentionally returns a normalized conflict without the
        // Worker response body. Do not retry a changed intake with a new key;
        // refresh the patient/case context and let the clinician review it.
        throw error;
      }
      clearEncounterDraftId("new-case");
      encounterIdRef.current = "";
      encounterCommandIdRef.current = "";
      setCreateStatus("done"); setShowCreateSuccess(true);
    } catch (error) {
      setCreateStatus("idle");
      setCreateError((error as Error).message || "Could not save the patient.");
    } finally {
      finishPatientSaveLoading();
    }
  };

  const existingCaseEntry = (): CaseEntryData => ({
    encounterId: encounterDraftId("work-entry"),
    // Case edits and the final clinical commit are separate brokered writes and
    // must keep separate idempotency keys for the life of this draft.
    commandId: encounterDraftCommandId("work-entry-case-update"),
    patientId: existing?.id ?? null,
    patientName,
    isNewPatient: false,
    newPatient: {
      dateOfBirth: null,
      ageYears,
      sex: npSex,
      phone: npPhone.trim(),
      address: npAddress.trim() || undefined,
      emergencyContact: npEcName.trim()
        ? { name: npEcName.trim(), relation: npEcRel.trim(), phone: npEcPhone.trim() }
        : undefined,
    },
    medicalHistory: builtMedicalHistory,
    dateISO,
    doctor,
    doctors: selectedDoctors,
    chiefComplaint: chiefComplaint.trim(),
    protocolId: "",
    title: "",
    stages: [],
    planSelections: [],
    paidToday: 0,
    followUp: null,
  });

  const saveExistingCase = async () => {
    if (!existingCaseWorkflow || !existing?.id || !intakeTaken || !chiefComplaint.trim() || createStatus === "saving") return;
    if (doctorsList.length > 0 && selectedDoctors.length === 0) {
      setShowDoctorModal(true);
      return;
    }
    setCreateStatus("saving");
    setCreateError("");
    try {
      await onCreateCase(existingCaseEntry());
      clearEncounterDraftId("work-entry-case-update");
      clearEncounterDraftId("work-entry");
      savedExistingCaseDraftFingerprint.current = existingCaseDraftFingerprint;
      setCreateStatus("idle");
      showToast("Patient and case saved successfully.");
    } catch (error) {
      setCreateStatus("idle");
      setCreateError((error as Error).message || "Could not save the patient and case.");
    }
  };
  const saveExistingCaseRef = useRef(saveExistingCase);
  saveExistingCaseRef.current = saveExistingCase;

  // A continuation uses Work Entry's one canonical wizard header.  Report the
  // Patient & case action state upward so this embedded body does not need a
  // second strip between the tabs and the clinical fields.
  useEffect(() => {
    if (!patientStepOnly) return;
    onPatientStepActionsChange?.({
      onSave: () => { void saveExistingCaseRef.current(); },
      onNext: () => onPatientStepNext?.(),
      saveDisabled: !showExistingCaseSave || existingCaseRequiresSave || createStatus === "saving",
      nextDisabled: showExistingCaseSave,
      saving: createStatus === "saving",
    });
  }, [createStatus, existingCaseRequiresSave, onPatientStepActionsChange, onPatientStepNext, patientStepOnly, showExistingCaseSave]);

  useEffect(() => () => onPatientStepActionsChange?.(null), [onPatientStepActionsChange]);

  const saveExistingTodayWork = async () => {
    if (!existingCaseWorkflow || !onCommitTodayWork || createStatus === "saving") return;
    if (existingCaseRequiresSave) {
      setCreateError("Complete the required Patient & case details before committing this Work Entry.");
      setStep(1);
      return;
    }
    const completedStages = flatStages
      .filter((stage) => stage.doneToday && !stage.alreadyCompleted)
      .map((stage) => ({
        sourceProtocolId: stage.sourceProtocolId,
        sourceProtocolStageId: stage.sourceProtocolStageId,
        toothCode: stage.toothScope === "tooth" ? stage.tooth || null : null,
        treatmentArea: stage.toothScope === "tooth" ? null : stage.tooth || null,
        chargeAmount: rupeeAmount(stage.cost),
      }))
      .filter((stage): stage is { sourceProtocolId: string; sourceProtocolStageId: string; toothCode: string | null; treatmentArea: string | null; chargeAmount: number } => Boolean(stage.sourceProtocolStageId));
    const followUp = !noFollowUpNeeded && fuDate
      ? { dueOn: fuDate, dueTime: fuTime || null, reason: fuReason.trim() || "Follow-up" }
      : null;
    const prescriptionItems = prescriptions.filter((item) => item.medicine.trim());
    const completedOn = todayISO();
    let payment: Omit<PatientPaymentInput, "patientId"> | null = null;
    if (canCollectPayment) {
      try {
        payment = parseWorkEntryPayment({
          paymentDate: completedOn,
          paidToday,
          discount: discountInput,
          paymentMethod,
          outstandingDue: workEntryOutstandingDue,
        });
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : "Check the payment details and try again.");
        return;
      }
    }

    const draftLabOrders = unpersistedLabOrderDrafts(labOrders);
    const odontogram = existingChartHasUnsavedChanges ? {
      recordedOn: dateISO,
      marks: Object.entries(chartMarks).map(([toothCode, mark]) => ({ toothCode, slot: mark.slot, value: mark.value })),
      removedMarks: Object.entries(savedChartMarks.current)
        .filter(([toothCode, savedMark]) => {
          const current = chartMarks[toothCode];
          return !current || current.slot !== savedMark.slot || current.value !== savedMark.value;
        })
        .map(([toothCode, mark]) => ({ toothCode, slot: mark.slot, value: mark.value })),
    } : null;
    const canalMeasurements = Object.values(canalDataMap).flatMap((data) => {
      if (JSON.stringify(data) === JSON.stringify(savedCanalData.current[data.tooth])) return [];
      const group = groups.find((item) => item.isCanal && item.toothScope === "tooth" && item.tooth === data.tooth);
      if (!group) return [];
      return [{
        sourceProtocolId: group.protocolId,
        toothCode: data.tooth || null,
        treatmentArea: null,
        recordedOn: completedOn,
        obturationMaterial: data.obturationMaterial?.trim() || null,
        note: data.medicament?.trim() || null,
        records: data.canals.filter((canal) => canal.lengthMm.trim()).map((canal) => ({
          canalLabel: canal.canal,
          workingLengthMm: Number(canal.lengthMm),
          fileNumber: canal.note?.replace(/^#/, "").trim() || null,
          reference: canal.referencePoint?.trim() || null,
        })),
      }];
    });
    if (!completedStages.length && !payment && !followUp && !prescriptionItems.length && !draftLabOrders.length && !perioTeeth && !odontogram && !canalMeasurements.length && !existingPlanHasUnsavedChanges) {
      setCreateError(canCollectPayment ? "Add or complete treatment, update a chart, record a payment, add a prescription or lab request, or schedule a follow-up before saving." : "Add or complete treatment, update a chart, add a prescription or lab request, or schedule a follow-up before saving.");
      return;
    }
    if (completedStages.length && !selectedDoctors.length) {
      setCreateError("Choose the case doctor before recording completed work.");
      return;
    }
    setCreateStatus("saving");
    setCreateError("");
    const finishCommitLoading = beginOperation("Work Entry", {
      title: "Saving record…",
      message: "Saving clinical work, lab work, payment, and follow-up details.",
    }, true);
    if (!encounterCommandIdRef.current) encounterCommandIdRef.current = encounterDraftCommandId("work-entry");
    const commandId = encounterCommandIdRef.current;
    let committed = false;
    try {
      // Patient/case edits remain their own optimistic-concurrency command.
      // Everything drafted in the clinical tabs is sent to one final command.
      if (existingCaseHasUnsavedChanges) {
        await onCreateCase(existingCaseEntry());
        clearEncounterDraftId("work-entry-case-update");
        savedExistingCaseDraftFingerprint.current = existingCaseDraftFingerprint;
      }
      await onCommitTodayWork({
        commandId,
        completedOn,
        completedStages,
        planSelections: existingPlanHasUnsavedChanges ? planSelectionsFromGroups(groups) : [],
        odontogram,
        canalMeasurements,
        doctorNames: selectedDoctors,
        payment,
        followUp,
        prescriptionItems,
        labOrders: draftLabOrders,
        periodontalTeeth: perioTeeth,
        closeCase,
      });
      if (existingPlanHasUnsavedChanges) {
        savedPlanFingerprint.current = currentPlanFingerprint;
        setPlanWasEdited(false);
      }
      if (odontogram) {
        savedChartMarks.current = { ...chartMarks };
        savedChartFingerprint.current = currentChartFingerprint;
        setChartWasEdited(false);
      }
      savedCanalData.current = { ...canalDataMap };
      setPrescriptions([]);
      setGroups((current) => current.map((group) => ({
        ...group,
        stages: group.stages.map((stage) => stage.doneToday ? { ...stage, alreadyCompleted: true } : stage),
      })));
      setNoFollowUpNeeded(false);
      setFuDate("");
      setFuTime("");
      setFuReason("");
      setPaidToday("");
      setDiscountInput("");
      setPaymentMethod(PAYMENT_METHODS[0]);
      clearEncounterDraftId("work-entry");
      encounterCommandIdRef.current = "";
      committed = true;
    } catch (error) {
      const detail = (error as Error).message || "Could not save today’s clinical work.";
      setCreateError(detail);
      showError(detail);
    } finally {
      setCreateStatus("idle");
      finishCommitLoading();
    }
    if (committed) onExit?.();
  };

  // ============================ RENDER ============================
  const body = (
    <div
      className="clinicIntakeWorkspace"
      style={{
        padding: 0,
        width: "100%",
        maxWidth: "100%",
        margin: 0,
      }}
    >
      {!embedded && (
        <PageHeader
          title={prefilled ? "New case intake" : "New patient registration"}
          subtitle={prefilled ? `${clinic?.name || "Smile Dental Clinic"} · patient intake & treatment plan creation` : undefined}
          back={onExit ? { label: "Patient Record", onClick: onExit } : undefined}
        >{hideStepTabs && <button type="button" className="btn btn-primary" style={{ marginTop: "var(--sp-2)" }} onClick={savePatientOnly} disabled={!intakeTaken || createStatus === "saving"}>Save patient</button>}</PageHeader>
      )}

      {hideStepTabs && createError && (
        <div role="alert" style={{ margin: "0 0 16px", padding: "10px 12px", border: "1px solid #fecaca", color: "#b91c1c", background: "#fef2f2", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)" }}>
          {createError}
        </div>
      )}

      <div style={{ marginTop: "16px", maxWidth: "100%" }}>
        {/* The wizard — single column; the case summary lives in the final Review step. */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Non-linear step header with integrated action button — perfectly aligned margins */}
          {(!hideStepTabs || step !== 1) && <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", background: "#f8fafc", padding: "10px 16px", borderRadius: "12px", border: "1px solid #cbd5e1", boxShadow: "0 2px 10px rgba(15,23,42,0.04)" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {wizardSteps.map((s) => {
                const active = step === s.n;
                const isCompleted = step > s.n;
                const blockedUntilSave = false;
                return (
                  <button
                    key={s.n}
                    type="button"
                    onClick={() => goToStep(s.n)}
                    disabled={blockedUntilSave}
                    title={blockedUntilSave ? "Save the Patient & case details before continuing." : undefined}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 14px",
                      borderRadius: "10px",
                      border: `1.5px solid ${active ? "var(--acc, #0284c7)" : isCompleted ? "#86efac" : "#cbd5e1"}`,
                      background: active ? "var(--acc-soft, #e0f2fe)" : isCompleted ? "#f0fdf4" : "#f8fafc",
                      color: active ? "#0369a1" : isCompleted ? "#166534" : "#334155",
                      fontSize: "var(--fs-13)",
                      fontWeight: active || isCompleted ? "var(--fw-bold)" : "var(--fw-medium)",
                      cursor: blockedUntilSave ? "not-allowed" : "pointer",
                      opacity: blockedUntilSave ? 0.55 : 1,
                      boxShadow: active ? "0 2px 8px rgba(2,132,199,0.15)" : "none",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "22px",
                        height: "22px",
                        borderRadius: "50%",
                        background: active ? "var(--acc, #0284c7)" : isCompleted ? "#16a34a" : "#e2e8f0",
                        color: active || isCompleted ? "#ffffff" : "#475569",
                        fontSize: "var(--fs-12)",
                        fontWeight: "var(--fw-bold)",
                      }}
                    >
                      {isCompleted ? "✓" : s.n}
                    </span>
                    {s.label}
                  </button>
                );
              })}
            </div>

            {/* Header Right Action Button */}
            <div className="clinicWizardHeaderActions">
              {step === 1 && (
                <button type="button" onClick={() => goToStep(2)} disabled={!patientChosen} className="btn btn-primary" style={{ borderRadius: "0px" }}>
                  Next <ArrowRight size={14} />
                </button>
              )}
              {step === 2 && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button type="button" onClick={() => goToStep(1)} className="btn btn-secondary" style={{ borderRadius: "0px" }}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button type="button" onClick={() => goToStep(3)} disabled={groups.length === 0} className="btn btn-primary" style={{ borderRadius: "0px" }}>
                    Next <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {step === 3 && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button type="button" onClick={() => goToStep(2)} className="btn btn-secondary" style={{ borderRadius: "0px" }}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  <button type="button" onClick={() => goToStep(4)} className="btn btn-primary" style={{ borderRadius: "0px" }}>
                    Next <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {step === 4 && (
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button type="button" onClick={() => goToStep(3)} className="btn btn-secondary" style={{ borderRadius: "0px" }}>
                    <ArrowLeft size={14} /> Back
                  </button>
                  {existingCaseWorkflow ? (
                    <button type="button" onClick={() => goToStep(5)} disabled={createStatus === "saving"} className="btn btn-primary" style={{ borderRadius: "0px" }}>
                      Next <ArrowRight size={14} />
                    </button>
                  ) : (
                    <button type="button" onClick={() => goToStep(5)} className="btn btn-primary" style={{ borderRadius: "0px" }}>
                      Next <ArrowRight size={14} />
                    </button>
                  )}
                </div>
              )}
              {step === 5 && createStatus !== "done" && (
                <div style={{ display: "flex", gap: "8px" }}><button type="button" onClick={() => goToStep(4)} className="btn btn-secondary" style={{ borderRadius: "0px" }}><ArrowLeft size={14} /> Back</button><button type="button" onClick={() => goToStep(6)} className="btn btn-primary" style={{ borderRadius: "0px" }}>Next <ArrowRight size={14} /></button></div>
              )}
            </div>
          </div>}

          {!hideStepTabs && step !== 1 && createError && (
            <div role="alert" style={{ padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)" }}>
              {createError}
            </div>
          )}

          {/* Pinned medical-alert banner (safety). Patient identity is shown in the Case
              summary panel on the right, so no separate identity card here. */}
          {patientChosen && patientAlerts.length > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                background: surgeryBleedRisk ? "#fef2f2" : "#fffbeb",
                border: `1px solid ${surgeryBleedRisk ? "#fecaca" : "#fde68a"}`,
                color: surgeryBleedRisk ? "#b91c1c" : "#b45309",
                padding: "12px 14px",
                borderRadius: "0px",
              }}
            >
              <ShieldAlert size={17} style={{ flexShrink: 0, marginTop: "1px" }} />
              <div style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", lineHeight: 1.5 }}>
                <strong>Medical alert:</strong> {patientAlerts.join(" · ")}
                {surgeryBleedRisk && (
                  <div style={{ marginTop: "5px", display: "flex", alignItems: "center", gap: "6px", fontWeight: "var(--fw-bold)" }}>
                    <AlertTriangle size={14} /> Anticoagulant + surgical stage — bleeding risk. Confirm before proceeding.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============ STEP 1 — PATIENT & PURPOSE ============ */}
          {step === 1 && (
            <section style={{ display: "flex", flexDirection: "column", gap: "20px" }} onKeyDown={advanceOnEnter}>

              {createError ? <div style={{ padding: "10px 12px", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)" }}>{createError}</div> : null}

              {/* Case context belongs to the visit wizard. Standalone patient registration keeps
                  its patient-only fields inside Patient Demographics below. */}
              {(!hideStepTabs || patientStepOnly) && <div style={card}>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {(!hideStepTabs || patientStepOnly) && <div>
                    <label style={label}>{existingCaseWorkflow ? "Chief complaint / case" : <>Chief Complaint / Reason {hideStepTabs ? "(optional)" : "*"}</>}</label>
                    <input
                      style={input}
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      placeholder="e.g. Pain in lower right molar, wants a crown on 46"
                    />
                  </div>}
                  {!patientStepOnly && !hideStepTabs && <div style={{ display: "grid", gridTemplateColumns: isNew ? "1fr" : "240px 1fr", gap: "16px", alignItems: "end" }}>
                    {!isNew && <div>
                      <label style={label}>{existingCaseWorkflow ? "Case opened" : "Visit Date"}</label>
                      <DatePicker value={dateISO} onChange={setDateISO} fluid />
                    </div>}
                    <div>
                      <label style={label}>{existingCaseWorkflow ? "Case doctor(s)" : "Attending Doctor(s)"}</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "6px", alignItems: "center" }}>
                        {doctorsList.map((doctorName) => {
                          const selected = selectedDoctors.includes(doctorName);
                          return <label key={doctorName} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", fontSize: "var(--fs-13)", fontWeight: selected ? 750 : 600, borderRadius: "0px", border: selected ? "1.5px solid #0284c7" : "1.5px solid #cbd5e1", background: selected ? "#e0f2fe" : "#ffffff", color: selected ? "#0369a1" : "#334155", cursor: "pointer" }}>
                            <input type="checkbox" checked={selected} onChange={() => setSelectedDoctors(selected ? selectedDoctors.filter((doctor) => doctor !== doctorName) : [...selectedDoctors, doctorName])} style={{ "--checkbox-color": "#0284c7", width: "16px", height: "16px" } as React.CSSProperties} />
                            <span>{doctorName}</span>
                          </label>;
                        })}
                      </div>
                    </div>
                  </div>}
                </div>
              </div>}

              {/* Patient registration and safety details come first so reception can register before the clinical reason is known. */}
              {!isNew && existing && !existingCaseWorkflow && (
                <div style={card}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "46px",
                        height: "46px",
                        borderRadius: "50%",
                        background: "var(--acc-soft, #e0f2fe)",
                        color: "var(--acc, #0284c7)",
                        fontSize: "var(--fs-16)",
                        fontWeight: "var(--fw-bold)",
                      }}
                    >
                      {initials(existing.name)}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)", color: "#1e293b" }}>{existing.name}</div>
                      <div style={{ fontSize: "var(--fs-13)", color: "#64748b", marginTop: "2px" }}>
                        {existing.patientNumber} · {existing.age}{existing.sex} · Balance {formatNpr(existing.balance)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {existingCaseWorkflow ? (
                <section style={{ display: "flex", flexDirection: "column", gap: "16px" }} aria-label="Patient and safety context">
                  <div style={card}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "16px", paddingBottom: "14px", borderBottom: "1px solid #e2e8f0" }}>
                      <div>
                        <p style={{ ...label, margin: 0 }}>Patient record</p>
                        <h3 style={{ margin: "4px 0 0", color: "#10203b", fontSize: "var(--fs-17)", fontWeight: "var(--fw-bold)" }}>{patientName}</h3>
                        <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: "var(--fs-13)" }}>{existing?.patientNumber ?? "Patient record"} · Information is read-only in Work Entry</p>
                      </div>
                      <span style={{ padding: "5px 9px", border: "1px solid #bae6fd", color: "#0369a1", background: "#f0f9ff", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)" }}>Patient record</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "14px 20px", marginTop: "16px" }}>
                      <ReadOnlyContextField label="Phone" value={npPhone || "Not recorded"} />
                      <ReadOnlyContextField label="Age / sex" value={[npAgeYears ? `${npAgeYears} years` : "Age not recorded", npSex === "not_recorded" ? "Not recorded" : npSex[0].toUpperCase() + npSex.slice(1)].filter(Boolean).join(" · ")} />
                      <ReadOnlyContextField label="Address" value={npAddress || "Not recorded"} />
                      <ReadOnlyContextField label="Emergency contact" value={npEcName ? [npEcName, npEcRel, npEcPhone].filter(Boolean).join(" · ") : "Not recorded"} />
                    </div>
                    <p style={{ margin: "16px 0 0", paddingTop: "12px", borderTop: "1px solid #e2e8f0", color: "#64748b", fontSize: "var(--fs-12)", lineHeight: 1.5 }}>Update patient details from Patient Record. This step is for the current case only.</p>
                  </div>
                  <div style={{ ...card, borderColor: patientAlerts.length ? "#fde68a" : "#bbf7d0", background: patientAlerts.length ? "#fffbeb" : "#f0fdf4" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "grid", width: "30px", height: "30px", placeItems: "center", color: patientAlerts.length ? "#b45309" : "#15803d", background: patientAlerts.length ? "#fef3c7" : "#dcfce7" }}><ShieldAlert size={16} /></div>
                      <div>
                        <h4 style={{ margin: 0, color: "#1e293b", fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)" }}>Medical history &amp; risk flags</h4>
                        <p style={{ margin: "2px 0 0", color: "#64748b", fontSize: "var(--fs-12)" }}>Read-only safety context for this patient.</p>
                      </div>
                    </div>
                    <div style={{ marginTop: "14px", padding: "11px 12px", border: `1px solid ${patientAlerts.length ? "#fde68a" : "#bbf7d0"}`, color: patientAlerts.length ? "#92400e" : "#166534", background: "#fff", fontSize: "var(--fs-13)", lineHeight: 1.5 }}><strong>{patientAlerts.length ? "Recorded alerts:" : "Safety profile:"}</strong> {patientAlerts.length ? patientAlerts.join(" · ") : "No recorded allergy or medical-risk alerts."}</div>
                  </div>
                </section>
              ) : isNew ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>
                  {/* Demographics Card */}
                  <div style={card}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "0px", background: "#e0f2fe", color: "#0284c7" }}>
                        <UserPlus size={16} />
                      </div>
                      <div>
                        <h4 style={{ fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)", color: "#1e293b", margin: 0 }}>
                          Patient Demographics
                        </h4>
                      </div>
                    </div>

                    <hr style={{ border: 0, borderTop: "1px solid #f1f5f9", margin: "12px 0 14px" }} />

                    {showStandaloneRegistrationFields && (
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "12px", marginBottom: "14px" }}>
                        <div>
                          <label style={label}>Next Patient Code</label>
                          <input
                            aria-label="Next Patient Code"
                            readOnly
                            style={{ ...input, color: "#334155", background: "#f8fafc", fontWeight: "var(--fw-bold)", fontVariantNumeric: "tabular-nums" }}
                            value={nextPatientNumber ?? "Loading…"}
                          />
                        </div>
                        <div>
                          <label style={label}>Registration Date *</label>
                          <DatePicker id="new-patient-registration-date" value={dateISO} onChange={setDateISO} max={todayISO()} fluid />
                        </div>
                      </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={label}>Full Name *</label>
                        <input
                          style={input}
                          value={npName}
                          onChange={(e) => setNpName(e.target.value)}
                          onBlur={() => setNpName((value) => titleCaseName(value.trim()))}
                          placeholder="e.g. Sita Rai"
                        />
                      </div>
                      <div>
                        <label style={label}>Phone Number</label>
                        <input style={input} value={npPhone} onChange={(e) => setNpPhone(e.target.value)} placeholder="+977 98…" />
                      </div>
                      <div>
                        <label style={label}>Age *</label>
                        <input style={input} type="number" min="0" max="130" step="1" value={npAgeYears} onChange={(e) => setNpAgeYears(e.target.value)} placeholder="e.g. 34" />
                      </div>
                      <div>
                        <label style={label}>Sex</label>
                        <select style={input} value={npSex} onChange={(e) => setNpSex(e.target.value as "female" | "male" | "other" | "not_recorded")}>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="not_recorded">Prefer not to record</option>
                        </select>
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={label}>Address</label>
                        <input style={input} value={npAddress} onChange={(e) => setNpAddress(e.target.value)} placeholder="e.g. Baneshwor, Kathmandu" />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label style={label}>Emergency Contact (optional)</label>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                          <input style={input} value={npEcName} onChange={(e) => setNpEcName(e.target.value)} placeholder="Name" />
                          <input style={input} value={npEcRel} onChange={(e) => setNpEcRel(e.target.value)} placeholder="Relation" />
                          <input style={input} value={npEcPhone} onChange={(e) => setNpEcPhone(e.target.value)} placeholder="Phone" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* COMPARTMENT 3: Medical History & Safety Check */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <label
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "12px 14px",
                        borderRadius: "0px",
                        border: `1.5px solid ${mhReviewed ? "#bbf7d0" : "#fcd34d"}`,
                        background: mhReviewed ? "#f0fdf4" : "#fffbeb",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={mhReviewed}
                        onChange={(e) => setMhReviewed(e.target.checked)}
                        style={{ "--checkbox-color": "#16a34a", marginTop: "3px", flexShrink: 0, width: "16px", height: "16px" } as React.CSSProperties}
                      />
                      <span style={{ fontSize: "var(--fs-13)", lineHeight: 1.5, color: mhReviewed ? "#15803d" : "#92400e", fontWeight: "var(--fw-medium)" }}>
                        <strong>Medical History Verification</strong>
                        <span style={{ display: "block", fontWeight: "var(--fw-normal)", opacity: 0.9, marginTop: "2px" }}>
                          {existingCaseWorkflow ? "Confirm or update the safety profile before planning this case." : "Compulsory assertion — confirm that you asked the patient about allergies and systemic conditions."}
                        </span>
                      </span>
                    </label>

                    <div style={card}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "8px", background: "#fef3c7", color: "#d97706" }}>
                          <ShieldAlert size={16} />
                        </div>
                        <div>
                          <h4 style={{ fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)", color: "#1e293b", margin: 0 }}>
                            Medical History &amp; Risk Flags
                          </h4>
                          <p style={{ fontSize: "var(--fs-12)", color: "#64748b", margin: "1px 0 0" }}>
                            Document drug allergies and medical conditions.
                          </p>
                        </div>
                      </div>

                      <hr style={{ border: 0, borderTop: "1px solid #f1f5f9", margin: "12px 0 14px" }} />

                      {existingCaseWorkflow && (
                        <div style={{ marginBottom: "16px", padding: "10px 12px", border: "1px solid #bae6fd", background: "#f0f9ff", color: "#0c4a6e", fontSize: "var(--fs-13)", lineHeight: 1.5 }}>
                          <strong>Recorded alerts:</strong> {patientAlerts.length ? patientAlerts.join(" · ") : "None recorded"}
                        </div>
                      )}

                      {/* Allergies */}
                      <div style={{ marginBottom: "16px" }}>
                        <label style={label}>Allergies</label>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          {mhAllergies.map((a, i) => (
                            <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 34px", gap: "8px", alignItems: "center" }}>
                              <input
                                style={input}
                                value={a.substance}
                                onChange={(e) => setMhAllergies((prev) => prev.map((x, j) => (j === i ? { ...x, substance: e.target.value } : x)))}
                                placeholder="Substance, e.g. Penicillin"
                              />
                              <input
                                style={input}
                                value={a.severity ?? ""}
                                onChange={(e) => setMhAllergies((prev) => prev.map((x, j) => (j === i ? { ...x, severity: e.target.value } : x)))}
                                placeholder="Severity (optional)"
                              />
                              <button
                                type="button"
                                onClick={() => setMhAllergies((prev) => prev.filter((_, j) => j !== i))}
                                title="Remove allergy"
                                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: "36px", border: "1px solid #e2e8f0", borderRadius: "8px", background: "#fff", color: "#dc2626", cursor: "pointer" }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={() => setMhAllergies((prev) => [...prev, { substance: "", severity: "" }])}
                          className="btn btn-primary btn-sm"
                          style={{ marginTop: mhAllergies.length ? "8px" : "0" }}
                        >
                          <Plus size={13} /> Add Allergy
                        </button>
                      </div>

                      {/* Pre-existing Conditions */}
                      <div style={{ marginBottom: "16px" }}>
                        <label style={label}>Pre-existing Conditions</label>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 16px" }}>
                          {([
                            ["diabetes", "Diabetes"],
                            ["cardiac", "Cardiac"],
                            ["hypertension", "Hypertension"],
                            ["pregnancy", "Pregnancy"],
                            ["bleeding", "Bleeding disorder"],
                            ["bloodThinners", "On blood thinners"],
                          ] as const).map(([key, lbl]) => (
                            <label key={key} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#334155", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={!!mhCond[key]}
                                onChange={(e) => setMhCond((prev) => ({ ...prev, [key]: e.target.checked }))}
                              />
                              {lbl}
                            </label>
                          ))}
                        </div>
                        <input
                          style={{ ...input, marginTop: "10px" }}
                          value={mhOther}
                          onChange={(e) => setMhOther(e.target.value)}
                          placeholder="Other conditions (comma-separated), e.g. Asthma, Thyroid"
                        />
                      </div>

                    </div>
                  </div>
                </div>
              ) : null}
            </section>
          )}

          {/* ============ STEP 2 — CHART & PLAN ============ */}
          {step === 2 && (
            <section style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

              <div style={card}>
                <h3 style={sectionTitle}>
                  <Activity size={15} /> Screening Odontogram Chart
                </h3>
                <ScreeningChart marks={chartMarks} onChartTooth={updateTooth} />
              </div>

              <FloatingSuggestions
                suggestions={chartSuggestions}
                suggestSel={suggestSel}
                setSuggestSel={setSuggestSel}
                toothProtocols={toothProtocols}
                defaultSuggestId={defaultSuggestId}
                onAddAll={(items) => items.forEach(({ protocolId, tooth }) => addGroup(protocolId, tooth))}
                onDismiss={dismissTooth}
              />

              <div style={card}>
                <ArchProcedureButtons archProtocols={archProtocols} groups={groups} onAdd={addGroup} />
              </div>

              <div style={card}>
                <h3 style={sectionTitle}>
                  <ListChecks size={15} /> Treatment Plan ({groups.length})
                </h3>
                {groups.length === 0 ? (
                  <div style={{ padding: "16px", color: "#64748b", fontSize: "var(--fs-13)" }}>
                    No procedures added yet. Tap a tooth above to mark findings, or select an arch procedure.
                  </div>
                ) : (
                  <>
                    <PlanGroups
                      groups={groups}
                      feeName={feeName}
                      removeGroup={removeGroup}
                      setGroupStage={setGroupStage}
                      addGroupStage={addGroupStage}
                      removeGroupStage={removeGroupStage}
                      setGroupGrade={setGroupGrade}
                      reorderGroupStage={reorderGroupStage}
                      canalDataMap={canalDataMap}
                      openCanalDrawer={openCanalDrawer}
                    />
                  </>
                )}
              </div>

              <PerioPanel defaultOpen={perioIndicated} initialPerio={initialPerio} onChange={onPerioChange} onSave={onCommitTodayWork ? undefined : onSavePerioChart} />
            </section>
          )}

          {/* ============ STEP 3 — IMAGING, Rx & LAB (compact workbench) ============ */}
          {step === 3 && (() => {
            /* ── local inline state for draft Rx & lab rows ── */
            /* NOTE: state is lifted to CaseEntryView (prescriptions, labOrders, xrayDrafts) */

            const COMMON_DRUGS_S3 = ["Amoxicillin 500mg", "Ibuprofen 400mg", "Paracetamol 500mg", "Metronidazole 400mg", "Augmentin 625mg", "CHX 0.2% Mouthwash"];
            const FREQS_S3 = ["TDS (3×/day)", "BD (2×/day)", "QD (once/day)", "QID (4×/day)", "SOS (as needed)"];
            const QUICK_RX = [
              { label: "Amox · TDS · 5d", rx: { medicine: "Amoxicillin 500mg", dosage: "1 tab", frequency: "TDS (3×/day)", duration: "5 days", instructions: "" } },
              { label: "Ibu · TDS · 3d", rx: { medicine: "Ibuprofen 400mg", dosage: "1 tab", frequency: "TDS (3×/day)", duration: "3 days", instructions: "" } },
              { label: "Metro · TDS · 5d", rx: { medicine: "Metronidazole 400mg", dosage: "1 tab", frequency: "TDS (3×/day)", duration: "5 days", instructions: "" } },
              { label: "PCM · SOS · 3d", rx: { medicine: "Paracetamol 500mg", dosage: "1 tab", frequency: "SOS (as needed)", duration: "3 days", instructions: "" } },
            ] as const;
            /* small section label */
            const secLabel = (icon: React.ReactNode, text: string, optional = true): React.ReactNode => (
              <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "0px", background: "#f1f5f9", color: "#0284c7" }}>{icon}</span>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "#1e293b" }}>{text}</span>
                {optional && <span style={{ fontSize: "11px", color: "#94a3b8", background: "#f1f5f9", borderRadius: "0px", padding: "1px 7px", fontWeight: 600 }}>optional</span>}
              </div>
            );

            /* tiny input */
            const tinyInput: React.CSSProperties = { ...input, padding: "7px 10px", fontSize: "13px" };
            /* tiny select */
            const tinySelect: React.CSSProperties = { ...input, padding: "7px 10px", fontSize: "13px" };

            /* Keyboard navigation helper: focuses element and opens select picker sheet automatically */
            const focusAndOpen = (el: HTMLElement | null) => {
              if (!el) return;
              el.focus();
              if (el instanceof HTMLInputElement) {
                el.select();
              } else if (el instanceof HTMLSelectElement) {
                try {
                  if (typeof el.showPicker === "function") {
                    el.showPicker();
                  }
                } catch {
                  /* Fallback for unsupported environments */
                }
              }
            };

            /* Keyboard navigation handlers for fast hands-free entry */
            const handleAddRx = () => {
              const drugEl = document.getElementById("rx-drug-select") as HTMLSelectElement | null;
              const doseEl = document.getElementById("rx-dose") as HTMLInputElement | null;
              const freqEl = document.getElementById("rx-freq") as HTMLSelectElement | null;
              const durEl = document.getElementById("rx-dur") as HTMLInputElement | null;
              const selectedMed = drugEl?.value && drugEl.value !== "__custom__" ? drugEl.value : "";
              if (!selectedMed) return;
              setPrescriptions(p => [...p, {
                medicine: selectedMed,
                dosage: doseEl?.value || "1 tab",
                frequency: freqEl?.value || "TDS (3×/day)",
                duration: durEl?.value || "5 days",
                instructions: "",
              }]);
              if (drugEl) {
                drugEl.value = "";
              }
              if (doseEl) doseEl.value = "1 tab";
              if (durEl) durEl.value = "5 days";
            };

            const onRxKeyDown = (e: React.KeyboardEvent<HTMLElement>, nextId?: string) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              if (nextId) {
                const nextEl = document.getElementById(nextId);
                focusAndOpen(nextEl);
              }
            };

            return (
              <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                {/* ── Main 2-column workbench ── */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", alignItems: "start" }}>

                  {/* ════ LEFT COLUMN: X-Ray + Prescription ════ */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>

                    {/* X-RAY ZONE */}
                    {(step3SubTab === "all" || step3SubTab === "xray") && (
                      <div style={{ ...card, padding: "16px" }}>
                        <RadiographUploader
                          drafts={xrayDrafts}
                          setDrafts={setXrayDrafts}
                          patientId={existing?.id}
                          chiefComplaintId={existingCaseWorkflow ? initialChiefComplaintId ?? null : null}
                          defaultType={imagingType}
                          dateLabel={formatDateShort(dateISO)}
                          capturedOn={dateISO}
                          onUploaded={onMediaChanged}
                          savedUploads={savedRadiographUploads}
                          onUploadCompleted={(upload) => setSavedRadiographUploads((current) => current.some((item) => item.mediaAssetId === upload.mediaAssetId) ? current : [...current, upload])}
                          onRemoveSavedUpload={onRemoveXray}
                          onSavedUploadRemoved={(mediaAssetId) => setSavedRadiographUploads((current) => current.filter((upload) => upload.mediaAssetId !== mediaAssetId))}
                        />
                      </div>
                    )}

                    {/* PRESCRIPTION ZONE */}
                    {(step3SubTab === "all" || step3SubTab === "rx") && (
                      <div style={{ ...card, padding: "16px" }}>
                        {secLabel(<Pill size={14} />, "Prescription")}

                        {/* Quick-add regimens */}
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
                          {QUICK_RX.map(r => (
                            <button key={r.label} type="button"
                              onClick={() => setPrescriptions(p => [...p, { ...r.rx }])}
                              style={{ fontSize: "11px", fontWeight: 600, padding: "4px 10px", borderRadius: 20, border: "1px solid #ddd6fe", background: "#f5f3ff", color: "#6d28d9", cursor: "pointer", whiteSpace: "nowrap" }}>
                              + {r.label}
                            </button>
                          ))}
                        </div>

                        {/* Existing prescription rows */}
                        {prescriptions.length > 0 && (
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
                            {prescriptions.map((rx, i) => (
                              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr auto", alignItems: "start", gap: "10px", padding: "12px 14px", background: "#f0fdf4", borderRadius: "0px", border: "1px solid #86efac", borderLeft: "4px solid #16a34a" }}>
                                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
                                  <CheckCircle2 size={16} color="#16a34a" style={{ marginTop: "2px", flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: "10px", fontWeight: 800, color: "#15803d", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "2px" }}>Added prescription</div>
                                    <div style={{ fontSize: "15px", fontWeight: "var(--fw-bold)", color: "#0f172a", marginBottom: "4px" }}>{rx.medicine}</div>
                                    <div style={{ fontSize: "13px", fontWeight: "var(--fw-medium)", color: "#334155" }}>{rx.dosage} · {rx.frequency} · {rx.duration}</div>
                                  </div>
                                </div>
                                <button type="button" onClick={() => setPrescriptions(p => p.filter((_, j) => j !== i))} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "6px" }} title="Remove prescription">
                                  <X size={16} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Inline add form */}
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(180px, 220px) minmax(0, 1fr)", gap: "8px" }}>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...label, marginBottom: 4 }}>Drug</label>
                            <select
                              id="rx-drug-select"
                              style={tinySelect}
                              defaultValue=""
                              onChange={e => {
                                // Selection only fills this draft form. A prescription is saved
                                // exclusively by the explicit Add button below.
                                if (e.target.value === "__custom__") e.target.value = "";
                              }}
                            >
                              <option value="">Select drug…</option>
                              {COMMON_DRUGS_S3.map(d => <option key={d} value={d}>{d}</option>)}
                              <option value="__custom__">✏️ Type custom…</option>
                            </select>
                          </div>
                          <div>
                            <label style={{ ...label, marginBottom: 4 }}>Dose</label>
                            <input
                              id="rx-dose"
                              style={tinyInput}
                              defaultValue="1 tab"
                              placeholder="e.g. 1 tab"
                              list="rx-doses-s3"
                              onKeyDown={(e) => onRxKeyDown(e, "rx-dur")}
                            />
                          </div>
                          <div>
                            <label style={{ ...label, marginBottom: 4 }}>Duration</label>
                            <input
                              id="rx-dur"
                              style={tinyInput}
                              defaultValue="5 days"
                              placeholder="e.g. 5 days"
                              list="rx-durations-s3"
                              onKeyDown={(e) => onRxKeyDown(e, "rx-freq")}
                            />
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={{ ...label, marginBottom: 4 }}>Frequency</label>
                            <select
                              id="rx-freq"
                              style={tinySelect}
                            >
                              {FREQS_S3.map(f => <option key={f} value={f}>{f}</option>)}
                            </select>
                          </div>
                        </div>
                        <button type="button" className="btn btn-primary btn-block" style={{ marginTop: 10 }} onClick={handleAddRx}>
                          <Plus size={13} /> Add to prescription
                        </button>
                        <datalist id="rx-doses-s3"><option value="1 tab" /><option value="2 tabs" /><option value="5 ml" /><option value="10 ml rinse" /></datalist>
                        <datalist id="rx-durations-s3"><option value="3 days" /><option value="5 days" /><option value="7 days" /><option value="10 days" /></datalist>
                      </div>
                    )}
                  </div>

                  {/* ════ RIGHT COLUMN: Lab Work ════ */}
                  {(step3SubTab === "all" || step3SubTab === "lab") && (
                    <LabOrderBlock
                      orders={labOrders}
                      onChange={setLabOrders}
                      defaultTooth={groups.find((g) => g.toothScope === "tooth")?.tooth || undefined}
                      labs={labs}
                      deferPersistence
                      handoffPreview
                    />
                  )}
                </div>
              </section>
            );
          })()}

          {/* ============ STEP 4 — TODAY & PAYMENT / WORK ENTRY TODAY ============ */}
          {step === 4 && (
            <section style={{ display: "flex", flexDirection: "column", gap: "14px" }} onKeyDown={advanceOnEnter}>
              <h3 style={sectionTitle}>
                <StepDot n={4} /> {existingCaseWorkflow ? <ListChecks size={15} /> : <Wallet size={15} />} {canCollectPayment ? "Today & payment" : "Today's work"}
              </h3>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", alignItems: "start" }}>

                  {/* ── LEFT: Treatment cards ── */}
                  <div style={{ ...card, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "#f0f9ff", border: "1px solid #bae6fd", borderTop: "4px solid #0284c7" }}>
                    {groups.length > 0 ? <>
                      <DoneTodayGroups groups={groups} setGroupStage={setGroupStage} />
                    </> : <div style={{ fontSize: "var(--fs-13)", color: "#476a83", padding: "10px 11px", background: "#ffffff", border: "1px solid #bae6fd" }}>
                      {canCollectPayment ? "Choose a plan in the Chart & plan step to mark what is done today. An existing patient balance can still be collected here." : "Choose a plan in the Chart & plan step to mark what is done today."}
                    </div>}
                  </div>

                  {existingCaseWorkflow && canCollectPayment && <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                    {canCollectPayment ? <WorkEntryPaymentPanel
                      idPrefix="start-case-payment"
                      todayCharges={todaysCharges}
                      previousDue={currentOutstandingDue}
                      outstandingDue={workEntryOutstandingDue}
                      paidToday={paidToday}
                      discount={discountInput}
                      paymentMethod={paymentMethod}
                      onPaidTodayChange={setPaidToday}
                      onDiscountChange={setDiscountInput}
                      onPaymentMethodChange={setPaymentMethod}
                    /> : null}
                    <div style={{ display: "none", ...card, padding: "16px", flexDirection: "column", gap: "12px", background: "#f8fafc", border: "1px solid #cbd5e1", borderTop: "4px solid #64748b" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
                      <div style={{ width: "28px", height: "28px", display: "grid", placeItems: "center", borderRadius: "7px", background: "#e2e8f0", color: "#334155", flexShrink: 0 }}><BellRing size={15} /></div>
                      <div><div style={{ ...workAreaTitle, color: "#1e293b" }}>Follow-up</div><div style={{ fontSize: "var(--fs-12)", color: "#64748b", marginTop: "2px" }}>Optional. Schedule the next clinical visit.</div></div>
                    </div>
                    <label style={{ order: 3, display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 12px", borderRadius: "9px", background: noFollowUpNeeded ? "#dcfce7" : "#f0fdf4", border: `1px solid ${noFollowUpNeeded ? "#22c55e" : "#86efac"}`, cursor: "pointer" }}>
                      <input type="checkbox" checked={noFollowUpNeeded} onChange={(event) => { const checked = event.target.checked; setNoFollowUpNeeded(checked); if (checked) { setFuDate(""); setFuTime(""); setFuReason(""); } }} style={{ "--checkbox-color": "#16a34a", width: "18px", height: "18px", marginTop: "1px", flexShrink: 0 } as React.CSSProperties} />
                      <span><strong style={{ display: "block", color: "#14532d", fontSize: "var(--fs-14)" }}>No follow-up needed for this visit</strong><span style={{ display: "block", marginTop: "3px", color: "#35654a", fontSize: "var(--fs-12)" }}>No future recall will be created.</span></span>
                    </label>
                    <div>
                      <label style={label}><BellRing size={11} style={{ display: "inline", marginRight: "4px" }} /> Next visit date &amp; time</label>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 190px) minmax(0, 1fr)", gap: "8px" }}>
                        <DatePicker id="work-entry-follow-up-date" value={fuDate} onChange={setFuDate} fluid disabled={noFollowUpNeeded} />
                        <TimePicker id="work-entry-follow-up-time" value={fuTime} onChange={setFuTime} fluid disabled={noFollowUpNeeded} />
                      </div>
                    </div>
                    <ReasonPicker id="work-entry-follow-up-reason" label="Next visit reason" value={fuReason} onChange={setFuReason} options={remainingStages.filter((stage) => !stage.alreadyCompleted).map((stage) => `${stage.label}${stage.tooth ? ` · tooth ${stage.tooth}` : ""}`)} disabled={noFollowUpNeeded} />
                    <label style={{ order: 4, display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 12px", background: closeCase ? "#fffbeb" : "#f8fafc", border: `1px solid ${closeCase ? "#f59e0b" : "#cbd5e1"}`, cursor: "pointer" }}>
                      <input type="checkbox" checked={closeCase} onChange={(event) => setCloseCase(event.target.checked)} style={{ "--checkbox-color": "#d97706", width: "18px", height: "18px", marginTop: "1px", flexShrink: 0 } as React.CSSProperties} />
                      <span><strong style={{ display: "block", color: "#92400e", fontSize: "var(--fs-14)" }}>Close the case</strong><span style={{ display: "block", marginTop: "3px", color: "#78716c", fontSize: "var(--fs-12)" }}>Any unfinished treatment stages remain pending in case history.</span></span>
                    </label>
                    </div>
                  </div>}

                  {/* ── RIGHT: Payment inputs for new-patient intake. Existing Work Entry uses the trusted panel above. */}
                  {!existingCaseWorkflow && <div style={{ ...card, padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "#f6fdf8", border: "1px solid #bbf7d0", borderTop: "4px solid #16a34a" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
                      <div style={{ width: "28px", height: "28px", display: "grid", placeItems: "center", borderRadius: "7px", background: "#dcfce7", color: "#15803d", flexShrink: 0 }}>
                        <Wallet size={15} />
                      </div>
                      <div>
                        <div style={{ ...workAreaTitle, color: "#14532d" }}>Finance &amp; follow-up</div>
                        <div style={{ fontSize: "var(--fs-12)", color: "#4d7660", marginTop: "2px" }}>Set today&apos;s charge, payment, and next visit.</div>
                      </div>
                    </div>

                    {/* Charges and discount */}
                    <div style={{ padding: "12px", background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#fffbeb", border: "1px solid #fde68a" }}>
                        <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#1e293b" }}>Today&apos;s charges</span>
                        <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "#1e293b" }}>{formatNpr(todaysCharges)}</span>
                      </div>
                      <div>
                        <label style={label}>Discount (Rs)</label>
                        <div style={{ fontSize: "var(--fs-11)", color: "#9a4b12", margin: "-3px 0 6px" }}>Reduces today&apos;s charge — this is not a payment received.</div>
                        <input style={input} type="number" min="0" value={discountInput} onChange={(e) => setDiscountInput(e.target.value)} onFocus={(e) => e.target.select()} placeholder="0" />
                      </div>
                    </div>

                    {/* Payable today */}
                    <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
                      <span style={{ display: "block", fontSize: "var(--fs-11)", color: "#4c4c56", fontWeight: "var(--fw-bold)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>Payable today</span>
                      <span style={{ display: "block", fontSize: "var(--fs-18)", fontWeight: "var(--fw-bold)", color: "#166534", fontVariantNumeric: "tabular-nums" }}>{formatNpr(Math.max(0, todaysCharges - discount))}</span>
                    </div>

                    {/* Payment received */}
                    <div style={{ padding: "12px", background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#166534", textTransform: "uppercase", letterSpacing: "0.04em" }}>Payment received today</div>
                      <div>
                        <label style={label}>Paid today (NPR)</label>
                        <input style={input} type="number" min="0" value={paidToday} onChange={(e) => setPaidToday(e.target.value)} onFocus={(e) => e.target.select()} placeholder="0" />
                      </div>
                      <div>
                        <label style={label}>Payment method</label>
                        <select
                          style={input}
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value)}
                          onFocus={(e) => {
                            const picker = (e.currentTarget as HTMLSelectElement & { showPicker?: () => void }).showPicker;
                            if (typeof picker === "function") {
                              try { picker.call(e.currentTarget); } catch { }
                            }
                          }}
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    {/* Next visit */}
                    <div style={{ display: "none", padding: "12px", background: "#f8fafc", border: "1px solid #cbd5e1", flexDirection: "column", gap: "10px" }}>
                      <div style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#334155", textTransform: "uppercase", letterSpacing: "0.04em" }}>Follow-up</div>
                      <label style={{ order: 3, display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 12px", borderRadius: "9px", background: noFollowUpNeeded ? "#dcfce7" : "#f0fdf4", border: `1px solid ${noFollowUpNeeded ? "#22c55e" : "#86efac"}`, boxShadow: noFollowUpNeeded ? "0 0 0 2px rgba(34, 197, 94, 0.12)" : "none", cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={noFollowUpNeeded}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setNoFollowUpNeeded(checked);
                            if (checked) {
                              setFuDate("");
                              setFuTime("");
                              setFuReason("");
                              fuEdited.current = false;
                            }
                          }}
                          style={{ "--checkbox-color": "#16a34a", width: "18px", height: "18px", marginTop: "1px", flexShrink: 0 } as React.CSSProperties}
                        />
                        <span>
                          <strong style={{ display: "block", color: "#14532d", fontSize: "var(--fs-14)" }}>No follow-up needed for this visit</strong>
                          <span style={{ display: "block", marginTop: "3px", color: "#35654a", fontSize: "var(--fs-12)" }}>Tick this only when the patient does not need to return. No future recall will be created.</span>
                        </span>
                      </label>
                      <div>
                        <label style={label}><BellRing size={11} style={{ display: "inline", marginRight: "4px" }} /> Next visit date &amp; time</label>
                        <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 190px) minmax(0, 1fr)", gap: "8px" }}>
                          <DatePicker
                            id="case-follow-up-date"
                            value={fuDate}
                            onChange={setFuDate}
                            onComplete={() => requestAnimationFrame(() => document.getElementById("case-follow-up-time")?.focus())}
                            fluid
                            disabled={noFollowUpNeeded}
                          />
                          <TimePicker
                            id="case-follow-up-time"
                            value={fuTime}
                            onChange={setFuTime}
                            fluid
                            disabled={noFollowUpNeeded}
                          />
                        </div>
                      </div>

                      <ReasonPicker
                        id="case-follow-up-reason"
                        label="Next visit reason"
                        value={fuReason}
                        onChange={(v) => { fuEdited.current = true; setFuReason(v); }}
                        options={remainingStages.map((s) => `${s.label}${s.tooth ? ` · tooth ${s.tooth}` : ""}`)}
                        disabled={noFollowUpNeeded}
                      />
                    </div>
                  </div>}
              </div>
            </section>
          )}

          {/* ============ STEP 5 — SHARED RECALL ============ */}
          {step === 5 && (
            <section style={card}><h3 style={sectionTitle}><StepDot n={5} /> <BellRing size={15} /> Recall</h3><DoctorRecallWorkspace idPrefix="start-case-recall" date={fuDate} time={fuTime} reason={fuReason} reasonOptions={remainingStages.filter((stage) => !stage.alreadyCompleted).map((stage) => `${stage.label}${stage.tooth ? ` · tooth ${stage.tooth}` : ""}`)} noFollowUpNeeded={noFollowUpNeeded} onDateChange={setFuDate} onTimeChange={setFuTime} onReasonChange={setFuReason} onNoFollowUpChange={(checked) => { setNoFollowUpNeeded(checked); if (checked) { setFuDate(""); setFuTime(""); setFuReason(""); } }} closeCase={closeCase} onCloseCaseChange={setCloseCase} upcoming={upcomingFollowUps} /></section>
          )}

          {/* ============ REVIEW ============ */}
          {step === 6 && (
            <section style={card}>
              <h3 style={sectionTitle}>
                <StepDot n={6} /> <ListChecks size={15} /> {existingCaseWorkflow ? "Review & commit" : "Review & create"}
              </h3>

              {(() => {
                const patientMeta = isNew
                  ? [ageTaken ? `${ageYears} yrs` : "", npSex === "not_recorded" ? "Not recorded" : npSex[0].toUpperCase() + npSex.slice(1), npPhone.trim()].filter(Boolean).join(" · ")
                  : existing
                    ? [existing.patientNumber, `${existing.age} yrs`, existing.sex === "M" ? "Male" : "Female", existing.phone]
                      .filter(Boolean).join(" · ")
                    : "";

                // Grouped by procedure, and matching the submit filter: an unnamed custom step is
                // not saved, so it is not previewed either.
                const reviewProcedures: ReviewProcedure[] = groups
                  .map((g) => ({
                    title: g.protocolName,
                    toothLabel:
                      g.toothScope === "tooth" ? (g.tooth ? `Tooth ${g.tooth}` : "") : toothForScope(g.toothScope),
                    stages: g.stages
                      .filter((s) => !s.custom || s.label.trim())
                      .map((s) => ({ label: s.label.trim() || "Untitled step", cost: rupeeAmount(s.cost), done: s.doneToday, custom: s.custom })),
                  }))
                  .filter((p) => p.stages.length > 0);

                const doneList = groups.flatMap((g) =>
                  g.stages
                    .filter((s) => s.doneToday && (!s.custom || s.label.trim()))
                    .map((s) => ({
                      label: s.label.trim() || "Untitled step",
                      tooth: g.toothScope === "tooth" ? g.tooth : toothForScope(g.toothScope),
                      cost: rupeeAmount(s.cost),
                    })),
                );

                const perioRows: PerioRow[] = perioTeeth
                  ? Object.values(perioTeeth).map((t) => ({
                    tooth: t.tooth,
                    pd: [t.probingDepths.db, t.probingDepths.b, t.probingDepths.mb, t.probingDepths.dl, t.probingDepths.l, t.probingDepths.ml],
                    bop: Object.values(t.bop).filter(Boolean).length,
                    mobility: t.mobility,
                  }))
                  : [];

                return (
                  <CaseReviewLedger
                    patientName={patientName}
                    patientMeta={patientMeta}
                    alerts={patientAlerts}
                    doctor={doctor}
                    doctors={selectedDoctors}
                    visitDate={formatDateShort(dateISO)}
                    chiefComplaint={chiefComplaint}
                    procedures={reviewProcedures}
                    doneToday={doneList}
                    nextVisit={fuDate ? { date: formatDateShort(fuDate), reason: fuReason.trim() } : null}
                    perio={perioRows}
                    canalDataMap={canalDataMap}
                    prescriptions={prescriptions.filter((d) => d.medicine.trim())}
                    labOrders={labOrders}
                    patientAlerts={patientAlerts}
                    money={{ agreed: agreedTotal, todayCharges: todaysCharges, discount: discount > 0 ? discount : undefined, paid, balance }}
                  />
                );
              })()}

              <div style={{ marginTop: "18px" }}>
                {createError && (
                  <div
                    style={{
                      marginBottom: "10px",
                      padding: "10px 12px",
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: "9px",
                      fontSize: "var(--fs-13)",
                      color: "#b91c1c",
                      fontWeight: "var(--fw-medium)",
                    }}
                  >
                    {createError}
                  </div>
                )}
                {isNew && openCaseForPatient && createStatus !== "done" && (
                  <div style={{ marginBottom: "12px", padding: "12px 14px", border: "1px solid #fde68a", borderRadius: "11px", background: "#fffbeb" }}>
                    <div style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#92400e" }}>
                      This patient already has an open case: {openCaseForPatient.chiefComplaint?.trim() || openCaseForPatient.title}
                    </div>
                    <div style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-normal)", color: "#b45309", marginTop: "4px" }}>
                      Continue that case from <strong>Work Entry</strong> instead of opening another. Open a second
                      case only for genuinely parallel treatment.
                    </div>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "9px", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#92400e", cursor: "pointer" }}>
                      <input type="checkbox" checked={allowParallelCase} onChange={(e) => setAllowParallelCase(e.target.checked)} />
                      Open a parallel case anyway
                    </label>
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: createStatus === "done" ? "flex-end" : "flex-start", gap: "10px", flexWrap: "wrap" }}>
                  {createStatus !== "done" && (existingCaseWorkflow ? (
                    <button
                      type="button"
                      onClick={() => void saveExistingTodayWork()}
                      disabled={createStatus === "saving"}
                      className="btn btn-primary btn-tall"
                      style={{ minWidth: "180px" }}
                    >
                      {createStatus === "saving" ? "Committing…" : <><Check size={16} /> Commit Work Entry</>}
                    </button>
                  ) : (() => {
                    const createOff = !canCreate || createStatus !== "idle";
                    return (
                      <button
                        type="button"
                        onClick={submit}
                        disabled={createOff}
                        className="btn btn-primary btn-tall"
                        style={{ minWidth: "168px" }}
                      >
                        {createStatus === "saving" ? <>Saving…</> : <><Check size={16} /> Create case</>}
                      </button>
                    );
                  })())}

                  {/* Hosted in Work Entry → return there; standalone → start a fresh registration. */}
                  <button
                    type="button"
                    onClick={createStatus === "done" ? (onFinish ?? onExit ?? finishCreate) : (onExit ?? finishCreate)}
                    className={`btn btn-tall ${createStatus === "done" ? "btn-primary" : "btn-secondary"}`}
                    style={{ minWidth: createStatus === "done" ? "180px" : "168px" }}
                  >
                    {createStatus === "done" ? <><CheckCircle2 size={16} /> Finish</> : onExit ? <><UserPlus size={16} /> Return to Work Entry</> : <><UserPlus size={16} /> New entry</>}
                  </button>
                </div>

                {createStatus !== "done" && isNew && !intakeTaken ? (
                  // A disabled button with no reason is its own bug — say exactly what is missing.
                  <div style={{ fontSize: "var(--fs-12)", color: "#b45309", fontWeight: "var(--fw-medium)", textAlign: "center", marginTop: "8px" }}>
                    Finish the patient&apos;s details on step 1 — name, age, phone, and confirm their
                    medical history was asked for.
                  </div>
                ) : !canCreate && !blockedByOpenCase ? (
                  <div style={{ fontSize: "var(--fs-12)", color: "#1e293b", fontWeight: "var(--fw-medium)", textAlign: "center", marginTop: "8px" }}>
                    Choose a patient and add at least one procedure to create the case.
                  </div>
                ) : null}
              </div>
            </section>
          )}
        </div>
      </div>

      {/* Answering "Yes" here IS the attestation — it is the same positive assertion the checkbox
          asks for, so it ticks the box and moves on rather than sending the doctor back to hunt
          for it. "Not yet" leaves them on step 1 with the history still unconfirmed. */}
      {mhPrompt && (
        <ConfirmDialog
          title="Did you ask about their medical history?"
          body="Please confirm before moving on — even if there was nothing to note."
          confirmLabel="Yes, I asked"
          cancelLabel="Not yet"
          onConfirm={() => {
            setMhReviewed(true);
            setMhPrompt(false);
            if (selectedDoctors.length === 0) {
              setShowDoctorModal(true);
            } else {
              setStep(2);
            }
          }}
          onCancel={() => setMhPrompt(false)}
        />
      )}

      {showDoctorModal && (
        <ConfirmDialog
          title="Choose Doctor for Case"
          body={
            <div>
              <p style={{ margin: "0 0 14px", fontSize: "var(--fs-14)", color: "#1e293b", fontWeight: "var(--fw-medium)" }}>
                Please select at least one attending doctor for this case before continuing to Chart &amp; plan:
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {doctorsList.map((d) => {
                  const selected = selectedDoctors.includes(d);
                  return (
                    <label
                      key={d}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        padding: "6px 14px",
                        fontSize: "var(--fs-13)",
                        fontWeight: selected ? 750 : 600,
                        borderRadius: "10px",
                        border: selected ? "1.5px solid #7c3aed" : "1.5px solid #cbd5e1",
                        background: selected ? "#ede9fe" : "#ffffff",
                        color: selected ? "#5b21b6" : "#334155",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => {
                          if (selected) {
                            setSelectedDoctors(selectedDoctors.filter((doc) => doc !== d));
                          } else {
                            setSelectedDoctors([...selectedDoctors, d]);
                          }
                        }}
                        style={{
                          "--checkbox-color": "#7c3aed",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        } as React.CSSProperties}
                      />
                      <span>{d}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          }
          confirmLabel="Continue to Chart & Plan"
          cancelLabel="Cancel"
          centered
          onConfirm={() => {
            if (selectedDoctors.length > 0) {
              setShowDoctorModal(false);
              setStep(2);
            }
          }}
          onCancel={() => setShowDoctorModal(false)}
        />
      )}

      {showCreateSuccess && (
        <ConfirmDialog
          title={successTitle}
          body={successBody}
          confirmLabel="OK"
          showCancel={false}
          largeActions
          centered
          onConfirm={() => {
            setShowCreateSuccess(false);
            // Patient Record hosts this as a focused registration form. Once the
            // receptionist acknowledges a successful save, return to its main
            // directory rather than leaving a completed intake form on screen.
            if (hideStepTabs) onExit?.();
          }}
          onCancel={() => setShowCreateSuccess(false)}
        />
      )}

      <CanalDrawer
        isOpen={canalDrawerOpen}
        onClose={() => setCanalDrawerOpen(false)}
        tooth={activeCanalTooth}
        initialData={canalDataMap[activeCanalTooth]}
        onSave={handleSaveCanalData}
      />
    </div>
  );

  if (embedded) return body;
  return <Page>{body}</Page>;
}

// ============================ STEP-3 BUILDING BLOCKS ============================
// Presentational, prop-driven pieces the three step-3 layouts share. They hold no
// business logic — every mutation is a passed-in handler over the one shared state.

function FloatingSuggestions({
  suggestions,
  suggestSel,
  setSuggestSel,
  toothProtocols,
  defaultSuggestId,
  onAddAll,
  onDismiss,
}: {
  suggestions: [string, ChartMark][];
  suggestSel: Record<string, string>;
  setSuggestSel: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  toothProtocols: TreatmentProtocol[];
  defaultSuggestId: (mark: ChartMark) => string;
  onAddAll: (items: Array<{ tooth: string; protocolId: string }>) => void;
  onDismiss: (tooth: string) => void;
  horizontal?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);
  if (suggestions.length === 0) return null;
  const cartItems = resolveSuggestionCart(suggestions, suggestSel, toothProtocols);
  const canAddAll = cartItems.length === suggestions.length;

  return (
    <div
      style={{
        position: "fixed",
        top: "50%",
        transform: "translateY(-50%)",
        left: "24px",
        width: "360px",
        maxWidth: "calc(100vw - 48px)",
        zIndex: 500,
        background: "#ffffff",
        borderRadius: "0px",
        border: "2px solid #0284c7",
        boxShadow: "0 20px 60px rgba(15, 23, 42, 0.35), 0 4px 16px rgba(2, 132, 199, 0.25)",
        overflow: "hidden",
        transition: "all 0.2s ease",
      }}
    >
      {/* Floating Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 12px",
          background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
          color: "#ffffff",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Sparkles size={15} style={{ color: "#ffffff" }} />
          <span style={{ fontSize: "12.5px", fontWeight: "var(--fw-bold)", color: "#ffffff", letterSpacing: "-0.01em" }}>
            Suggested from charting
          </span>
          <span
            style={{
              fontSize: "11px",
              fontWeight: "var(--fw-bold)",
              background: "#ffffff",
              color: "#0284c7",
              padding: "1px 6px",
              borderRadius: "0px",
            }}
          >
            {suggestions.length}
          </span>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(!collapsed);
          }}
          style={{ background: "none", border: "none", color: "#ffffff", cursor: "pointer", padding: "2px 4px" }}
          title={collapsed ? "Expand suggestions" : "Collapse suggestions"}
        >
          {collapsed ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </button>
      </div>

      {/* Floating Widget Body */}
      {!collapsed && (
        <div style={{ display: "flex", flexDirection: "column", maxHeight: "460px", background: "#f8fafc" }}>
          <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" }}>
          {suggestions.map(([tooth, mark]) => {
            const sel = suggestSel[tooth] ?? defaultSuggestId(mark);
            return (
              <div
                key={tooth}
                style={{
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  borderRadius: "0px",
                  padding: "9px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  boxShadow: "0 1px 4px rgba(15, 23, 42, 0.04)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12px", fontWeight: "var(--fw-bold)", color: "#0f172a" }}>
                    Tooth {tooth} · <span style={{ color: "#0284c7" }}>{stateMeta(mark.value).label}</span>
                  </span>
                </div>

                {/* Each row is a cart line. The whole cart is added from the single footer action. */}
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <select
                    style={{ ...input, flex: 1, minWidth: 0, fontSize: "11.5px", padding: "5px 8px", height: "30px", borderRadius: "0px", borderColor: "#0284c7", background: "#ffffff" }}
                    value={sel}
                    onChange={(e) => setSuggestSel((prev) => ({ ...prev, [tooth]: e.target.value }))}
                  >
                    {toothProtocols.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={() => onDismiss(tooth)}
                    title="Dismiss finding"
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "5px 7px", height: "30px", borderRadius: "0px", flexShrink: 0, color: "#dc2626", borderColor: "#fca5a5" }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
          </div>
          <div style={{ padding: "10px", borderTop: "1px solid #cbd5e1", background: "#ffffff" }}>
            <button
              type="button"
              onClick={() => onAddAll(cartItems)}
              disabled={!canAddAll}
              className="btn btn-primary btn-sm"
              style={{ width: "100%", justifyContent: "center", borderRadius: "0px" }}
            >
              <Plus size={13} /> Add all {suggestions.length} to treatment plan
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArchProcedureButtons({
  archProtocols,
  groups,
  onAdd,
}: {
  archProtocols: TreatmentProtocol[];
  groups: PlanGroup[];
  onAdd: (protocolId: string, tooth: string) => void;
}) {
  return (
    <div>
      <label style={label}>Whole-mouth / arch procedures</label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {archProtocols.map((p) => {
          const added = groups.some((g) => g.protocolId === p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={added}
              onClick={() => onAdd(p.id, "")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "9px 13px",
                border: `1px solid ${added ? "#e2e8f0" : "#9aa3b6"}`,
                borderRadius: "10px",
                background: added ? "#f1f5f9" : "#fff",
                color: added ? "#6b7688" : "#1e293b",
                fontSize: "var(--fs-13)",
                fontWeight: "var(--fw-medium)",
                cursor: added ? "not-allowed" : "pointer",
              }}
            >
              {added ? <Check size={13} /> : <Plus size={13} />} {p.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function groupHeading(group: PlanGroup): string {
  if (group.toothScope === "tooth") return `Tooth ${group.tooth} · ${group.protocolName}`;
  if (group.toothScope === "arch") return `Whole arch · ${group.protocolName}`;
  return `Full mouth · ${group.protocolName}`;
}

function PlanGroupBlock({
  group,
  removeGroup,
  setGroupStage,
  addGroupStage,
  removeGroupStage,
  setGroupGrade,
  reorderGroupStage,
  compact,
  canalDataMap,
  openCanalDrawer,
}: {
  group: PlanGroup;
  removeGroup: (gid: number) => void;
  setGroupStage: (gid: number, key: number, patch: Partial<GroupStage>) => void;
  addGroupStage: (gid: number) => void;
  removeGroupStage: (gid: number, key: number) => void;
  setGroupGrade: (gid: number, gradeId: string) => void;
  reorderGroupStage?: (gid: number, fromIdx: number, toIdx: number) => void;
  compact?: boolean;
  canalDataMap?: Record<string, CanalChartData>;
  openCanalDrawer?: (tooth: string) => void;
}) {
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const subtotal = group.stages.reduce((s, st) => s + rupeeAmount(st.cost), 0);
  const recordsCanals = Boolean(group.isCanal);
  const toothNum = group.toothScope === "tooth" ? group.tooth : "";
  const canalData = toothNum ? canalDataMap?.[toothNum] : undefined;
  const hasCanalData = Boolean(canalData && canalData.canals.some(c => Boolean(c.lengthMm)));

  return (
    <div>
      <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "10px", marginBottom: compact ? "10px" : "14px" }}>
        {/* Row 1: Title + Remove Button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "#7c3aed", minWidth: 0, flex: 1, wordBreak: "break-word" }}>
            <Stethoscope size={compact ? 14 : 16} style={{ flexShrink: 0, color: "#7c3aed", marginTop: "2px" }} />
            <span>{groupHeading(group)}</span>
          </span>

          <button
            type="button"
            onClick={() => removeGroup(group.gid)}
            title="Remove group"
            style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "none", border: "none", color: "#ef4444", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", cursor: "pointer", padding: "2px 6px", borderRadius: "0px", flexShrink: 0 }}
          >
            <Trash2 size={13} /> Remove
          </button>
        </div>

        {/* Row 2: Total Price Badge below the Title */}
        {subtotal > 0 && (
          <div style={{ marginTop: "6px", display: "flex", alignItems: "center" }}>
            <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#7c3aed", background: "#f3e8ff", padding: "3px 10px", borderRadius: "0px", border: "1px solid #e9d5ff" }}>
              Total: {formatNpr(subtotal)}
            </span>
          </div>
        )}
      </div>

      {group.grades && (
        <div style={{ marginBottom: compact ? "10px" : "14px" }}>
          <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#475569", marginBottom: "6px", display: "block" }}>
            Select treatment grade
          </span>
          <div style={{ display: "flex", gap: "8px", width: "100%" }}>
            {group.grades.map((gr) => {
              const active = group.grade === gr.id;
              return (
                <button
                  key={gr.id}
                  type="button"
                  onClick={() => setGroupGrade(group.gid, gr.id)}
                  style={{
                    flex: 1,
                    padding: compact ? "6px 10px" : "7px 12px",
                    borderRadius: "0px",
                    border: active ? "1.5px solid #7c3aed" : "1px solid #cbd5e1",
                    background: active ? "#7c3aed" : "#ffffff",
                    color: active ? "#ffffff" : "#475569",
                    fontSize: compact ? "12px" : "12.5px",
                    fontWeight: active ? "var(--fw-bold)" : "var(--fw-medium)",
                    boxShadow: active ? "0 2px 6px rgba(124, 58, 237, 0.2)" : "none",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    textAlign: "center",
                  }}
                >
                  {gr.label}
                </button>
              );
            })}
          </div>

          {!group.grade && (
            <div style={{ marginTop: "10px", padding: "10px 12px", borderRadius: "8px", background: "#f5f3ff", border: "1px dashed #c084fc", color: "#6b21a8", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={15} style={{ flexShrink: 0, color: "#7c3aed" }} />
              <span>Select a grade above to load its treatment steps and fee estimate.</span>
            </div>
          )}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {group.stages.map((stage, i) => {
          const isDragging = draggedIdx === i;
          const isOver = dragOverIdx === i && draggedIdx !== i;

          return (
            <div
              key={stage.key}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", `${i}`);
                setDraggedIdx(i);
              }}
              onDragEnd={() => {
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverIdx(i);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverIdx === i) setDragOverIdx(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const fromIdx = Number(e.dataTransfer.getData("text/plain"));
                if (!isNaN(fromIdx) && fromIdx !== i && reorderGroupStage) {
                  reorderGroupStage(group.gid, fromIdx, i);
                }
                setDraggedIdx(null);
                setDragOverIdx(null);
              }}
              style={{
                display: "grid",
                gridTemplateColumns: "18px 1fr 80px 20px",
                gap: "8px",
                alignItems: "center",
                background: isDragging ? "#faf5ff" : isOver ? "#f3e8ff" : "#f8fafc",
                padding: "6px 8px",
                borderRadius: "6px",
                borderTop: isOver ? "3px solid #7c3aed" : isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                borderLeft: isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                borderRight: isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                borderBottom: isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                opacity: isDragging ? 0.4 : 1,
                transition: "background-color 0.12s ease, border-color 0.12s ease",
              }}
            >
              <div
                data-drag-handle="true"
                onClick={(e) => e.stopPropagation()}
                title="Click & drag to reorder step"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "24px",
                  height: "24px",
                  borderRadius: "4px",
                  background: isDragging || isOver ? "#7c3aed" : "#f1f5f9",
                  color: isDragging || isOver ? "#ffffff" : "#64748b",
                  border: "1px solid #cbd5e1",
                  cursor: isDragging ? "grabbing" : "grab",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                <Hand size={16} />
              </div>

              <div style={{ minWidth: 0 }}>
                {stage.custom ? (
                  <input
                    style={{ ...input, padding: "6px 8px", fontSize: "12px", background: "#ffffff", borderRadius: "5px", height: "39px" }}
                    placeholder="Extra step (e.g. review)"
                    value={stage.label}
                    onChange={(e) => setGroupStage(group.gid, stage.key, { label: e.target.value })}
                  />
                ) : (
                  <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center" }}>
                    <span>{i + 1}. {stage.label}</span>
                    {stage.gradeLabel && (
                      <span style={{ fontSize: "9.5px", fontWeight: "700", color: "#db2777", background: "#fdf2f8", border: "1px solid #fbcfe8", padding: "0 4px", borderRadius: "4px", marginLeft: "5px", flexShrink: 0 }}>
                        {stage.gradeLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>

              <input
                style={{ ...input, textAlign: "right", padding: "6px 8px", fontSize: "12px", fontWeight: "700", background: "#ffffff", borderRadius: "5px", border: "1px solid #cbd5e1", color: "#0f172a", height: "39px" }}
                inputMode="decimal"
                placeholder="Cost"
                value={stage.cost}
                onFocus={(e) => e.target.select()}
                onChange={(e) => setGroupStage(group.gid, stage.key, { cost: readRupeeText(e.target) })}
              />

              <button
                type="button"
                onClick={() => removeGroupStage(group.gid, stage.key)}
                title="Remove this step"
                style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, flexShrink: 0 }}
              >
                <X size={13} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => addGroupStage(group.gid)}
        className="btn btn-secondary btn-sm"
        style={{ marginTop: compact ? "8px" : "10px", border: "1px dashed #cbd5e1", background: "#ffffff", color: "#475569" }}
      >
        <Plus size={compact ? 12 : 13} /> Add step
      </button>

      {recordsCanals && openCanalDrawer && (
        <div style={{ marginTop: "12px", borderTop: "1px dashed #e9d5ff", paddingTop: "12px" }}>
          <button
            type="button"
            onClick={() => openCanalDrawer(toothNum || "16")}
            style={{
              border: "1.5px solid #7c3aed",
              background: "#f5f3ff",
              color: "#7c3aed",
              padding: "9px 14px",
              borderRadius: "10px",
              fontSize: "var(--fs-13)",
              fontWeight: "var(--fw-bold)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              width: "100%",
            }}
          >
            <Activity size={15} />
            {hasCanalData ? `Canal Data (${canalData?.canals.filter(c => c.lengthMm).length} canals) ✎ Edit` : "Record Root Canal Measurements"}
          </button>
        </div>
      )}
    </div>
  );
}

function PlanGroups({
  groups,
  feeName,
  removeGroup,
  setGroupStage,
  addGroupStage,
  removeGroupStage,
  setGroupGrade,
  reorderGroupStage,
  canalDataMap,
  openCanalDrawer,
}: {
  groups: PlanGroup[];
  feeName: (code: string) => string;
  removeGroup: (gid: number) => void;
  setGroupStage: (gid: number, key: number, patch: Partial<GroupStage>) => void;
  addGroupStage: (gid: number) => void;
  removeGroupStage: (gid: number, key: number) => void;
  setGroupGrade: (gid: number, gradeId: string) => void;
  reorderGroupStage?: (gid: number, fromIdx: number, toIdx: number) => void;
  canalDataMap?: Record<string, CanalChartData>;
  openCanalDrawer?: (tooth: string) => void;
}) {
  const blockProps = { feeName, removeGroup, setGroupStage, addGroupStage, removeGroupStage, setGroupGrade, reorderGroupStage, canalDataMap, openCanalDrawer };
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: "16px", alignItems: "start" }}>
      {groups.map((group) => (
        <div key={group.gid} style={{ ...card, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "0px", padding: "16px", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)" }}>
          <PlanGroupBlock group={group} {...blockProps} />
        </div>
      ))}
    </div>
  );
}

// "Done today" as one card per procedure group (mirrors the plan's grouping), laid out in a
// grid when more than one procedure is on the plan. The tooth/procedure lives in each card's
// header so a tick is never ambiguous about which tooth it belongs to. Per-card "Today"
// subtotal + an all-done shortcut. Single-procedure cases render one full-width card.
function DoneTodayGroups({
  groups,
  setGroupStage,
}: {
  groups: PlanGroup[];
  setGroupStage: (gid: number, key: number, patch: Partial<GroupStage>) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "100%" }}>
      {groups.map((group) => {
        const pendingStages = group.stages.filter((stage) => !stage.alreadyCompleted);
        const allDone = pendingStages.length > 0 && pendingStages.every((stage) => stage.doneToday);
        const todaySub = group.stages.reduce((s, st) => s + (st.doneToday ? rupeeAmount(st.cost) : 0), 0);
        return (
          <div key={group.gid} style={{ ...card, background: "#fbf9f4", padding: "13px 14px", display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", letterSpacing: "0.02em", textTransform: "uppercase", color: "var(--acc, #7c3aed)", minWidth: 0 }}>
                <Stethoscope size={13} style={{ flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupHeading(group)}</span>
              </span>
              <button
                type="button"
                onClick={() => pendingStages.forEach((stage) => setGroupStage(group.gid, stage.key, { doneToday: !allDone }))}
                disabled={pendingStages.length === 0}
                style={{ background: "none", border: "none", color: allDone ? "#6b7688" : "var(--acc, #7c3aed)", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", cursor: "pointer", padding: 0, flexShrink: 0, whiteSpace: "nowrap" }}
                title={allDone ? "Uncheck all steps" : "Check all steps in this treatment plan"}
              >
                {pendingStages.length === 0 ? "Recorded" : allDone ? "Uncheck all" : "Select all"}
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              {group.stages.map((stage, i) => (
                <label
                  key={stage.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "9px",
                    padding: "8px 10px",
                    border: `1px solid ${stage.doneToday ? "var(--acc, #7c3aed)" : "#e9e2d6"}`,
                    borderRadius: "8px",
                    background: stage.doneToday ? "var(--acc-soft, #ede9fe)" : "#fff",
                    cursor: stage.alreadyCompleted ? "default" : "pointer",
                    opacity: stage.alreadyCompleted ? 0.72 : 1,
                  }}
                >
                  <input type="checkbox" checked={stage.doneToday} disabled={stage.alreadyCompleted} onChange={(e) => setGroupStage(group.gid, stage.key, { doneToday: e.target.checked })} />
                  <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ flex: 1, fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span style={{ color: "#1e293b", fontWeight: "var(--fw-bold)" }}>{i + 1}.</span> {stage.label}
                    </span>
                    <span style={{ fontSize: "var(--fs-12)", color: "#1e293b", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{formatNpr(rupeeAmount(stage.cost))}</span>
                  </span>
                  {stage.alreadyCompleted ? <span style={{ color: "#15803d", fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)" }}>Recorded</span> : stage.doneToday && <Check size={14} style={{ color: "var(--acc, #7c3aed)", flexShrink: 0 }} />}
                </label>
              ))}
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "2px" }}>
              <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#1e293b" }}>Today</span>
              <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: todaySub > 0 ? "#1e293b" : "#6b7688" }}>{formatNpr(todaySub)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function PerioPanel({
  defaultOpen,
  initialPerio,
  onChange,
  onSave,
}: {
  defaultOpen?: boolean;
  initialPerio?: Record<string, ToothPerioData>;
  onChange: (teeth: Record<string, ToothPerioData>, probed: boolean) => void;
  onSave?: (teeth: Record<string, ToothPerioData>) => Promise<void>;
}) {
  // Available for every case, not only scaling/perio ones — a dentist may want to chart gums
  // any time. Auto-opens when the plan indicates it; stays a one-click toggle otherwise.
  const [openState, setOpenState] = useState(false);
  const open = openState || !!defaultOpen;
  return (
    <div style={{ ...card }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h3 style={sectionTitle}>
          <Activity size={15} /> Periodontal chart{defaultOpen ? " (indicated)" : " (optional)"}
        </h3>
        <label style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#1e293b", cursor: defaultOpen ? "default" : "pointer" }}>
          {/* Closing the card unmounts the chart, so the lifted readings must be dropped too —
              otherwise gums the dentist decided not to record still get written. */}
          <input
            type="checkbox"
            checked={open}
            disabled={defaultOpen}
            onChange={(e) => {
              setOpenState(e.target.checked);
              if (!e.target.checked) onChange({}, false);
            }}
          /> Record gum readings
        </label>
      </div>
      {open && (
        <div style={{ marginTop: "14px" }}>
          <PeriodontalChart initialPerioData={initialPerio} onChange={onChange} onSave={onSave} />
        </div>
      )}
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: "20px",
        height: "20px",
        borderRadius: "50%",
        background: "var(--acc, #7c3aed)",
        color: "#fff",
        fontSize: "var(--fs-12)",
        fontWeight: "var(--fw-bold)",
      }}
    >
      {n}
    </span>
  );
}
