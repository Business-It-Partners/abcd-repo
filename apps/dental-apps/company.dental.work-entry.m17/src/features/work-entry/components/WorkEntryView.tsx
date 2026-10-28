"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Stethoscope,
  Plus,
  Trash2,
  Wallet,
  BellRing,
  Check,
  ShieldAlert,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Activity,
  User,
  Sparkles,
  Hand,
  Pencil,
} from "lucide-react";
import {
  formatNpr,
  formatDateShort,
  todayISO,
  initials,
  checkDrugAllergyConflict,
  type PatientDetail,
  type ProcedureCatalogItem,
  type FollowUp,
  type LabSupplier,
  type LedgerEntry,
  PAYMENT_METHODS,
} from "@/features/patients/model/domain";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import { useClinicLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { readRupeeText, rupeeAmount, rupeeValue } from "@/shared/money/inputs";
import { handleFormEnterNavigation, handleFormKeyboardFocus, handleFormKeyboardPointerDown } from "@/shared/ui/workspace-primitives/formKeyboardNavigation";
import {
  type Case,
  type CaseStage,
  type CaseOutcome,
  type LabOrderInput,
  type RxLine,
  defaultProtocols,
  defaultFeeSchedule,
  priceOf,
  sortStagesByGrade,
  nextCaseStageOrder,
  repairCaseStageOrders,
  type TreatmentProtocol,
  type FeeScheduleItem,
} from "@/features/work-entry/model/caseData";
import NewPatientStylePrescription from "@/features/patients/components/NewPatientStylePrescription";
import { type ToothHistoryEntry, type ToothPerioData, type XrayDraft } from "@/features/work-entry/model/chartData";
import { unpersistedLabOrderDrafts } from "@/features/work-entry/labOrderReview";
import ReasonPicker from "./ReasonPicker";
import PeriodontalChart from "@/features/work-entry/components/PeriodontalChart";
import ChairsideChart, { type ChairsideEntry } from "./ChairsideChart";
import RadiographUploader, { type SavedRadiographUpload } from "@/features/patients/media/RadiographUploader";
import { clearEncounterDraftId, encounterDraftCommandId, encounterDraftId } from "@/features/work-entry/model/encounterDraft";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import TimePicker from "@/shared/dates/TimePicker";
import WorkReviewSheet from "./WorkReviewSheet";
import { type PerioRow } from "./ReviewBlocks";

type DentalHistoryWithChiefComplaint = NonNullable<PatientDetail["dentalHistory"]> & {
  chiefComplaint?: string;
};
import CanalDrawer from "@/features/work-entry/components/CanalDrawer";
import { type CanalChartData } from "@/features/work-entry/model/canalData";
import type { FollowUpWorklistItem, PatientPaymentInput } from "@/features/patients/types";
import { parseWorkEntryPayment } from "@/features/work-entry/workEntryPayment";
import WorkEntryPaymentPanel from "./WorkEntryPaymentPanel";
import DoctorRecallWorkspace from "./DoctorRecallWorkspace";
import type { PatientStepActions } from "@/features/work-entry/patientStepActions";
import { Modal, ModalBody, Field, Input, Table, TableWrap, Td, Th, Tr } from "@/shared/ui/workspace-primitives";
import AddTreatmentPlanModal, { type TreatmentPlanStepDraft } from "@/features/work-entry/components/AddTreatmentPlanModal";
import { type PlanAppendDraft } from "@/features/work-entry/model/draftTypes";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import { repairTitledGroupTeeth, toothForExtraStage, toothFromPlanGroup } from "@/features/work-entry/model/workEntryTooth";
import styles from "../WorkEntryWorkspace.module.css";

export interface EncounterLine {
  procedure: string;
  tooth: string;
  cost: number;
  stageOrder?: number;
  group?: string;
  grade?: string;
  gradeLabel?: string;
}

interface LineDraft {
  key: number;
  procedure: string;
  tooth: string;
  cost: string;
  custom: boolean;
  stageOrder?: number;
  group?: string;
  grade?: string;
  gradeLabel?: string;
  /** Patient-specific protocol that owns an ad-hoc stage recorded today. */
  patientProtocolId?: string;
  patientProtocolRowVersion?: number;
}

export interface EncounterData {
  /** Stable across Save retries; Firestore uses it as the idempotency key. */
  encounterId: string;
  /** Stable only for this local browser-session preview. */
  commandId: string;
  patientId: string;
  patientName: string;
  dateISO: string;
  doctor: string;
  sessionType: "new" | "continue";
  chiefComplaint: string;
  lines: EncounterLine[];
  note: string;
  prescriptions?: RxLine[];
  paidToday: number;
  discount?: number;
  paymentMethod?: string;
  followUp: { dateISO: string; time?: string; reason: string } | null;
  labOrders?: LabOrderInput[];
  perio?: Record<string, ToothPerioData>;
  caseId?: string;
  completedStageOrders?: number[];
  outcome?: CaseOutcome;
  outcomeNote?: string;
  canalDataMap?: Record<string, CanalChartData>;
}

export interface WorkTabSaveData {
  commandId: string;
  dateISO: string;
  doctorNames: string[];
  completedStageOrders: number[];
  completedStageCharges: Record<number, number>;
  extraWork: Array<{
    patientProtocolId: string;
    expectedRowVersion: number;
    stageName: string;
    chargeAmount: number;
    /** True when the newly added stage was completed during this visit. */
    completeToday: boolean;
  }>;
  note: string;
}

export interface PrescriptionTabSaveData {
  commandId: string;
  prescribedOn: string;
  items: RxLine[];
}

export interface RecallTabSaveData {
  commandId: string;
  doctorNames: string[];
  payment: Omit<PatientPaymentInput, "patientId"> | null;
  followUp: { dateISO: string; time?: string; reason: string } | null;
}

export interface WorkEntryCommitDraft {
  work: WorkTabSaveData;
  periodontalTeeth: Record<string, ToothPerioData> | null;
  prescriptionItems: RxLine[];
  /** New lab cards are client drafts until the final Work Entry commit. */
  labOrders: LabOrderInput[];
  recall: RecallTabSaveData;
  closeCase: boolean;
}

interface WorkEntryViewProps {
  patients: PatientDetail[];
  doctorsList: string[];
  labs: LabSupplier[];
  procedureCatalog: ProcedureCatalogItem[];
  protocols?: TreatmentProtocol[];
  feeSchedule?: FeeScheduleItem[];
  ledger?: LedgerEntry[];
  followUps: FollowUp[];
  upcomingFollowUps?: FollowUpWorklistItem[];
  cases: Record<string, Case[]>;
  toothHistory: ToothHistoryEntry[];
  initialPerio?: Record<string, ToothPerioData>;
  initialPatientId?: string | null;
  fixedPatientFlow?: boolean;
  /** Continuation workflows retain the shared tab strip but supply their richer Patient & case body. */
  patientStepLabel?: string;
  renderPatientStep?: (onNext: () => void, onActionsChange: (actions: PatientStepActions | null) => void) => React.ReactNode;
  initialStep?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
  onStepChange?: (step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => void;
  initialLabOrders?: LabOrderInput[];
  initialChiefComplaintId?: string | null;
  currentOutstandingDue?: number;
  /** Admin sees payment controls; Doctor retains Recall without payment collection. */
  canCollectPayment?: boolean;
  onPatientChange: (patientId: string | null) => void;
  renderNewComplaint: (patientId: string, onDone: () => void) => React.ReactNode;
  onSaveChartEntry: (
    patientId: string,
    tooth: string,
    entry: ChairsideEntry & { dateISO: string; doctor: string },
  ) => Promise<void>;
  onVoidEntry?: (patientId: string, entry: ToothHistoryEntry) => void;
  onSaveEncounter: (data: EncounterData) => Promise<void>;
  /** Trusted continuation saves. Each tab commits independently. */
  onSaveWorkTab?: (data: WorkTabSaveData) => Promise<void>;
  onSavePerioTab?: (teeth: Record<string, ToothPerioData>, commandId: string, recordedOn: string) => Promise<void>;
  onSavePrescriptionTab?: (data: PrescriptionTabSaveData) => Promise<void>;
  onSaveRecallTab?: (data: RecallTabSaveData) => Promise<void>;
  /** One final Worker-owned clinical commit for the in-progress workflow. */
  onCommitWorkEntry?: (draft: WorkEntryCommitDraft) => Promise<void>;
  onMediaChanged?: () => void | Promise<void>;
  /** Persist canal readings immediately; Work Entry must not wait for the encounter save. */
  onSaveCanalHistory?: (patientId: string, canalHistory: CanalChartData[]) => Promise<void> | void;
  onUpdateCase?: (caseId: string, patch: Partial<Case>) => Promise<void> | void;
  /** Returns true only after the Worker has committed a safe standard plan append. */
  onAppendTrustedPlan?: (clinicalCase: Case, draft: PlanAppendDraft) => Promise<boolean>;
  /** Audited removal for a persisted pending stage. Completed stages never receive this action. */
  onRemovePendingStage?: (stage: CaseStage) => Promise<void>;
  /** Leave the completed encounter and return the clinician to the recall queue. */
  onFinish: () => void;
}

const ANTICOAG_RE = /warfarin|blood thinner|anticoagulant|heparin|clopidogrel/i;
const SURGICAL_RE = /extraction|surgery|surgical|implant|extract/i;

function formatIndianRupeeInput(value: string): string {
  const [whole = "", ...fractionParts] = value.split(".");
  const groupedWhole = whole.length > 3
    ? `${whole.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${whole.slice(-3)}`
    : whole;
  return fractionParts.length ? `${groupedWhole}.${fractionParts.join("")}` : groupedWhole;
}

function caretPositionForGroupedInput(value: string, logicalOffset: number): number {
  if (logicalOffset <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ",") seen += 1;
    if (seen >= logicalOffset) return index + 1;
  }
  return value.length;
}

const card: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #cbd5e1",
  borderRadius: "0px",
  padding: "18px 20px",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
  width: "100%",
  boxSizing: "border-box",
};

// In the fixed, tabbed patient flow the tab bar defines the page edge. Keep
// the tab content flush with it instead of wrapping each step in another card.
const workflowPage: React.CSSProperties = {
  ...card,
  border: "none",
  padding: 0,
  boxShadow: "none",
};

const continuationStepFrame: React.CSSProperties = {
  ...workflowPage,
  border: "1px solid #c6d4df",
  padding: "16px",
  boxShadow: "0 3px 12px rgba(15, 23, 42, 0.05)",
};

const label: React.CSSProperties = {
  display: "block",
  fontSize: "13px",
  fontWeight: "var(--fw-bold)",
  color: "#000000",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: "6px",
};

const input: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid #cbd5e1",
  borderRadius: "10px",
  fontSize: "var(--fs-14)",
  color: "#1e293b",
  background: "#ffffff",
  fontFamily: "inherit",
  transition: "all 0.15s ease",
};

const sectionTitle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "var(--fs-16)",
  fontWeight: "var(--fw-bold)",
  color: "#1e293b",
  margin: "0 0 16px",
};

const stepBadge: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "#7c3aed",
  color: "#ffffff",
  fontSize: "var(--fs-12)",
  fontWeight: "var(--fw-bold)",
};

const CORE_STEPS = [
  { n: 1, displayN: 1, label: "Patient" },
  { n: 2, displayN: 2, label: "Work" },
  { n: 4, displayN: 3, label: "Perio Chart" },
  { n: 5, displayN: 4, label: "Imaging, Rx & Lab" },
] as const;

export default function WorkEntryView({
  patients,
  doctorsList,
  procedureCatalog,
  protocols,
  feeSchedule,
  ledger = [],
  followUps,
  upcomingFollowUps = [],
  cases,
  toothHistory,
  initialPerio,
  initialPatientId,
  fixedPatientFlow = false,
  patientStepLabel,
  renderPatientStep,
  initialStep = 1,
  onStepChange,
  initialLabOrders = [],
  initialChiefComplaintId = null,
  currentOutstandingDue = 0,
  canCollectPayment = true,
  onPatientChange,
  renderNewComplaint,
  onSaveChartEntry,
  onVoidEntry,
  onSaveEncounter,
  onSaveWorkTab,
  onSavePerioTab,
  onSavePrescriptionTab,
  onSaveRecallTab,
  onCommitWorkEntry,
  onMediaChanged,
  onSaveCanalHistory,
  onUpdateCase,
  onAppendTrustedPlan,
  onRemovePendingStage,
  onFinish,
}: WorkEntryViewProps) {
  const [step, setStep] = useState(initialStep);
  const [passedSteps, setPassedSteps] = useState<Set<number>>(() => new Set());
  const paymentCollectionEnabled = canCollectPayment && !fixedPatientFlow;
  const visibleCoreSteps = fixedPatientFlow
    ? CORE_STEPS.map((workflowStep) => workflowStep.n === 5 ? { ...workflowStep, label: "Imaging & Rx" } : workflowStep)
    : CORE_STEPS;
  const paymentStep = paymentCollectionEnabled ? 6 : null;
  const recallStep = paymentCollectionEnabled ? 7 : 6;
  const reviewStep = paymentCollectionEnabled ? 8 : 7;
  const workflowSteps = paymentCollectionEnabled
    ? [...visibleCoreSteps, { n: 6, displayN: 5, label: "Payment" }, { n: 7, displayN: 6, label: "Follow-up" }, { n: 8, displayN: 7, label: "Review & commit" }]
    : [...visibleCoreSteps, { n: 6, displayN: 5, label: "Follow-up" }, { n: 7, displayN: 6, label: "Review & commit" }];
  useEffect(() => {
    setStep(initialStep);
  }, [initialStep]);

  const goToStep = (nextStep: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8, markCurrentPassed = false) => {
    if (!onCommitWorkEntry && nextStep > effStep && currentStepHasUnsavedChanges) {
      setSaveError("Save this section before moving to a later step.");
      return;
    }
    if (markCurrentPassed && nextStep > effStep) {
      setPassedSteps((current) => current.has(effStep) ? current : new Set(current).add(effStep));
    }
    setSaveError("");
    setStep(nextStep);
    onStepChange?.(nextStep);
  };

  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialPatientId ?? null);

  const [dateISO, setDateISO] = useState(() => todayISO());
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [showDoctorRequired, setShowDoctorRequired] = useState(false);
  const doctor = selectedDoctors.join(", ");
  const [sessionType, setSessionType] = useState<"new" | "continue">("new");
  const [newComplaintMode, setNewComplaintMode] = useState(false);
  const [chiefComplaint, setChiefComplaint] = useState("");
  const [note, setNote] = useState("");

  const lineId = useRef(1);
  const firstProc = procedureCatalog[0];
  const [lines, setLines] = useState<LineDraft[]>([
    {
      key: 0,
      procedure: firstProc?.name || "",
      tooth: "",
      cost: rupeeValue(firstProc?.defaultCost || 0),
      custom: false,
    },
  ]);
  // A performed visit can charge a different amount from the original plan quote. Keep that
  // temporary charge here until the stage is ticked, without rewriting the agreed plan price.
  const [stageChargeDrafts, setStageChargeDrafts] = useState<Record<number, string>>({});
  // Newly-added rows are not yet persisted plan stages. This set records which of them should
  // be completed in this visit; unchecked rows are saved as future pending work instead.
  const [completedExtraLineKeys, setCompletedExtraLineKeys] = useState<Set<number>>(() => new Set());

  const [prescriptions, setPrescriptions] = useState<RxLine[]>([]);
  const [prescriptionDraftDirty, setPrescriptionDraftDirty] = useState(false);

  const [paidToday, setPaidToday] = useState("");
  const [showPaymentHistory, setShowPaymentHistory] = useState(false);
  const [discountInput, setDiscountInput] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<string>(PAYMENT_METHODS[0]);
  const [fuDate, setFuDate] = useState("");
  const [fuTime, setFuTime] = useState("");
  const [fuReason, setFuReason] = useState("");
  const [noFollowUpNeeded, setNoFollowUpNeeded] = useState(false);
  const [closeCase, setCloseCase] = useState(false);
  const [labOrders, setLabOrders] = useState<LabOrderInput[]>(initialLabOrders);

  const [canalDrawerOpen, setCanalDrawerOpen] = useState(false);
  const [activeCanalTooth, setActiveCanalTooth] = useState("16");
  const [canalDataMap, setCanalDataMap] = useState<Record<string, CanalChartData>>({});

  // Modal state for adding new treatment plan to open case
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);
  const [addTooth] = useState("14");

  // Modal state for editing existing treatment plan group
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [groupPendingDelete, setGroupPendingDelete] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSteps, setEditSteps] = useState<
    { order: number; label: string; tooth: string; agreedCost: number; status: CaseStage["status"]; doneDate?: string; doneBy?: string; grade?: string; gradeLabel?: string }[]
  >([]);

  // Popup Modal state for adding multiple procedure stages / extra work
  const [showAddStageModal, setShowAddStageModal] = useState(false);
  const [addStageGroupKey, setAddStageGroupKey] = useState("");
  const [addStageGrade, setAddStageGrade] = useState("1");
  const [addStageRows, setAddStageRows] = useState<
    { id: string; label: string; cost: number | string }[]
  >([{ id: "1", label: "", cost: 500 }]);

  const openCanalDrawer = (tooth: string) => {
    setActiveCanalTooth(tooth || "16");
    setCanalDrawerOpen(true);
  };
  const handleSaveCanalData = (data: CanalChartData) => {
    setCanalDataMap((prev) => ({ ...prev, [data.tooth]: data }));
    if (existing && onSaveCanalHistory) {
      // The drawer's Save Readings button is a real save. Replace the reading for this tooth
      // immediately, so navigation or a later encounter failure cannot lose clinical data.
      const history = [data, ...(existing.canalHistory || []).filter((item) => item.tooth !== data.tooth)];
      void Promise.resolve(onSaveCanalHistory(existing.id, history)).catch(() => {
        setSaveError("Could not save canal readings to the patient record.");
      });
    }
  };

  const [xrayDrafts, setXrayDrafts] = useState<XrayDraft[]>([]);
  const [savedRadiographUploads, setSavedRadiographUploads] = useState<SavedRadiographUpload[]>([]);
  const [perioTeeth, setPerioTeeth] = useState<Record<string, ToothPerioData> | null>(null);
  const [outcome] = useState<CaseOutcome | null>(null);
  const onPerioChange = useCallback(
    (teeth: Record<string, ToothPerioData>, edited: boolean) => setPerioTeeth(edited ? teeth : null),
    [],
  );

  const { showLoading, showToast } = useSnackbar();
  const { beginOperation } = useClinicLoading();
  const [saved, setSaved] = useState(false);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingStageId, setRemovingStageId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");

  const fuEdited = useRef(false);
  const encounterIdRef = useRef("");
  const encounterCommandIdRef = useRef("");
  const tabCommandIds = useRef<Record<string, string>>({});
  const loadedCaseIdentity = useRef<string | null>(null);

  const tabCommandId = (tab: string) => {
    if (!tabCommandIds.current[tab]) {
      tabCommandIds.current[tab] = globalThis.crypto.randomUUID();
    }
    return tabCommandIds.current[tab];
  };

  const clearTabCommandId = (tab: string) => {
    delete tabCommandIds.current[tab];
  };

  useEffect(() => {
    onPatientChange(selectedId);
  }, [selectedId, onPatientChange]);

  const existing = selectedId ? patients.find((p) => p.id === selectedId) ?? null : null;
  const patientName = existing?.name ?? "";
  const patientAlerts: string[] = existing?.alerts || [];
  const previousDue = existing?.balance || 0;
  const patientLedger = ledger
    .filter((entry) => entry.patientId === existing?.id)
    .sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt));

  const openCase = useMemo(
    () => (selectedId ? (cases[selectedId] || []).find((c) => c.status === "open") : undefined),
    [selectedId, cases]
  );
  // A continuing visit does not expose the new-case complaint input. Its review
  // and saved draft must therefore use the complaint stored on the active case,
  // never the empty new-case draft (which would fall back to a generic label).
  const activeChiefComplaint = openCase?.chiefComplaint?.trim()
    || openCase?.title?.trim()
    || chiefComplaint.trim();
  const reviewChiefComplaint = sessionType === "continue"
    ? activeChiefComplaint
    : chiefComplaint.trim();

  // Earlier plans could contain duplicate stage orders or an extra stage saved
  // with the new-plan picker's default tooth. Repair those narrow, deterministic
  // defects before a clinician continues the case.
  const repairedCaseRef = useRef("");
  useEffect(() => {
    if (!openCase || !onUpdateCase) return;
    const toothRepairedStages = repairTitledGroupTeeth(openCase.stages);
    const repairedStages = repairCaseStageOrders(toothRepairedStages);
    if (repairedStages === openCase.stages) {
      repairedCaseRef.current = "";
      return;
    }
    const repairKey = `${openCase.id}:${openCase.revision ?? 0}`;
    if (repairedCaseRef.current === repairKey) return;
    repairedCaseRef.current = repairKey;
    void Promise.resolve(onUpdateCase(openCase.id, { stages: repairedStages })).catch(() => {
      repairedCaseRef.current = "";
      setSaveError("This treatment plan could not be repaired. Reload it before recording work.");
    });
  }, [openCase, onUpdateCase, showToast]);

  const pendingStages = useMemo(
    () => (openCase ? openCase.stages.filter((s) => s.status === "pending") : []),
    [openCase]
  );

  const treatmentGroups = useMemo(() => {
    if (!openCase) return [] as { name: string; stages: CaseStage[] }[];
    const order: string[] = [];
    const map = new Map<string, CaseStage[]>();
    const sortedCaseStages = sortStagesByGrade(openCase.stages);
    for (const s of sortedCaseStages) {
      const key = s.group?.trim() || openCase.title || "Treatment";
      // A titled tooth-specific plan (for example, “Mobility · 11”) owns its
      // tooth. Old staged data could contain the new-plan picker's default
      // tooth (14); keep that historical mismatch from affecting what staff
      // see or record while the next case update repairs it in storage.
      const titledTooth = toothFromPlanGroup(key);
      const stage = titledTooth && s.tooth !== titledTooth ? { ...s, tooth: titledTooth } : s;
      if (!map.has(key)) {
        map.set(key, []);
        order.push(key);
      }
      map.get(key)!.push(stage);
    }
    return order.map((name) => ({ name, stages: map.get(name)! }));
  }, [openCase]);


  const handleSharedTreatmentPlan = async (draft: { title: string; tooth: string; toothSpecific: boolean; phase: "urgent" | "basic" | "elective"; steps: TreatmentPlanStepDraft[] }) => {
    if (!openCase) return;
    if (onAppendTrustedPlan && await onAppendTrustedPlan(openCase, draft)) {
      setShowAddPlanModal(false);
      showToast(`Treatment plan "${draft.title}" added successfully!`);
      return;
    }
    if (!onUpdateCase) return;
    const maxOrder = Math.max(0, ...openCase.stages.map((stage) => stage.order));
    const newStages: CaseStage[] = draft.steps.map((step, index) => ({
      order: maxOrder + index + 1,
      label: step.label.trim(),
      procedureCode: step.procedureCode || "PROC-GENERIC",
      tooth: draft.toothSpecific ? (step.tooth.trim() || draft.tooth || "14") : step.tooth,
      agreedCost: step.agreedCost || 0,
      status: "pending",
      group: draft.title,
      phase: draft.phase,
      recordCanals: step.recordCanals,
      grade: step.grade,
      gradeLabel: step.gradeLabel,
    }));
    const stages = [...openCase.stages, ...newStages];
    await onUpdateCase(openCase.id, { stages, agreedTotal: stages.reduce((sum, stage) => sum + stage.agreedCost, 0) });
    setShowAddPlanModal(false);
    showToast(`Treatment plan "${draft.title}" added successfully!`);
  };

  const handleOpenAddStageModal = (groupName: string) => {
    setAddStageGroupKey(groupName);
    setAddStageGrade("1");
    setAddStageRows([{ id: "1", label: "", cost: 500 }]);
    setShowAddStageModal(true);
  };

  const handleConfirmAddStage = async () => {
    const validRows = addStageRows.filter((r) => r.label.trim() !== "");
    if (!addStageGroupKey || validRows.length === 0) return;
    const toothNum = toothForExtraStage(openCase, addStageGroupKey, addTooth || "14");

    if (openCase && onUpdateCase) {
      const gLabel = addStageGrade === "1" ? "Grade I" : addStageGrade === "2" ? "Grade II" : "Grade III";
      const firstNewOrder = nextCaseStageOrder(openCase.stages);
      const newStages: CaseStage[] = validRows.map((r, idx) => {
        const costNum = Number(r.cost) || 0;
        return {
          order: firstNewOrder + idx,
          label: r.label.trim(),
          procedureCode: "PROC-GENERIC",
          tooth: toothNum,
          agreedCost: costNum,
          status: "pending",
          group: addStageGroupKey,
          phase: "basic",
          grade: /mobility/i.test(addStageGroupKey) ? addStageGrade : undefined,
          gradeLabel: /mobility/i.test(addStageGroupKey) ? gLabel : undefined,
        };
      });

      // Repair the one historical mis-assignment made by this dialog before
      // the source tooth was tied to its group. This is intentionally narrow:
      // only groups whose own title names one FDI tooth are corrected.
      const namedGroupTooth = toothFromPlanGroup(addStageGroupKey);
      const repairedStages = namedGroupTooth
        ? openCase.stages.map((stage) => stage.group?.trim() === addStageGroupKey && stage.tooth !== toothNum
          ? { ...stage, tooth: toothNum }
          : stage)
        : openCase.stages;
      const finalStages = [...repairedStages, ...newStages];
      const newAgreedTotal = finalStages.reduce((sum, s) => sum + s.agreedCost, 0);

      await onUpdateCase(openCase.id, {
        stages: finalStages,
        agreedTotal: newAgreedTotal,
      });
    } else {
      const patientProtocolId = openCase?.stages.find((stage) =>
        (stage.group?.trim() || openCase.title?.trim() || "Treatment") === addStageGroupKey
        && Boolean(stage.treatmentId)
      )?.treatmentId;
      const patientProtocolRowVersion = openCase?.stages.find((stage) => stage.treatmentId === patientProtocolId)?.treatmentRowVersion;
      if ((onSaveWorkTab || onCommitWorkEntry) && (!patientProtocolId || patientProtocolRowVersion == null)) {
        setSaveError("This treatment could not be linked to the patient's saved plan. Refresh the case and try again.");
        return;
      }
      const gLabel = addStageGrade === "1" ? "Grade I" : addStageGrade === "2" ? "Grade II" : "Grade III";
      const newLines = validRows.map((r) => {
        const newKey = lineId.current++;
        const costNum = Number(r.cost) || 0;
        return {
          key: newKey,
          procedure: r.label.trim(),
          tooth: toothNum,
          cost: rupeeValue(costNum),
          custom: true,
          group: addStageGroupKey,
          patientProtocolId,
          patientProtocolRowVersion,
          grade: /mobility/i.test(addStageGroupKey) ? addStageGrade : undefined,
          gradeLabel: /mobility/i.test(addStageGroupKey) ? gLabel : undefined,
        };
      });
      setLines((prev) => [...prev, ...newLines]);
    }

    setShowAddStageModal(false);
  };

  const handleSaveEditGroup = async () => {
    if (!editingGroupKey || !onUpdateCase || !openCase) return;
    const remainingStages = openCase.stages.filter(
      (s) => (s.group?.trim() || openCase.title?.trim() || "Treatment") !== editingGroupKey
    );

    const updatedGroupStages: CaseStage[] = editSteps
      .filter((s) => s.label.trim() !== "")
      .map((step, idx) => ({
        order: step.order || remainingStages.length + 1 + idx,
        label: step.label.trim(),
        procedureCode: "PROC-GENERIC",
        tooth: step.tooth.trim() || "14",
        agreedCost: step.agreedCost || 0,
        status: step.status || "pending",
        doneDate: step.doneDate,
        doneBy: step.doneBy,
        group: editTitle.trim(),
        phase: "basic",
      }));

    const finalStages = [...remainingStages, ...updatedGroupStages].map((stage, idx) => ({
      ...stage,
      order: idx + 1,
    }));
    const newAgreedTotal = finalStages.reduce((sum, s) => sum + s.agreedCost, 0);

    await onUpdateCase(openCase.id, {
      stages: finalStages,
      agreedTotal: newAgreedTotal,
    });

    const savedTitleName = editTitle.trim();
    setEditingGroupKey(null);
    showToast(`Treatment plan updated to "${savedTitleName}" successfully!`);
  };

  const handleDeleteGroup = async (groupKey: string) => {
    if (!onUpdateCase || !openCase) return;

    const remainingStages = openCase.stages.filter(
      (s) => (s.group?.trim() || openCase.title?.trim() || "Treatment") !== groupKey
    );
    const newAgreedTotal = remainingStages.reduce((sum, s) => sum + s.agreedCost, 0);

    await onUpdateCase(openCase.id, {
      stages: remainingStages,
      agreedTotal: newAgreedTotal,
    });

    showToast(`Treatment plan "${groupKey}" deleted successfully!`);
  };

  const [draggedStageOrder, setDraggedStageOrder] = useState<number | null>(null);
  const [dragOverStageOrder, setDragOverStageOrder] = useState<number | null>(null);

  const handleReorderPendingStages = async (groupKey: string, draggedOrder: number, targetOrder: number) => {
    if (!onUpdateCase || !openCase || draggedOrder === targetOrder) return;

    const stageGroup = (stage: CaseStage) => stage.group?.trim() || openCase.title?.trim() || "Treatment";
    const groupStages = openCase.stages
      .filter((stage) => stageGroup(stage) === groupKey)
      .sort((a, b) => a.order - b.order);
    const source = groupStages.findIndex((stage) => stage.order === draggedOrder);
    const destination = groupStages.findIndex((stage) => stage.order === targetOrder);
    if (source < 0 || destination < 0) return;

    // Move the stage into its new slot. Swapping the two order values made a three-stage sequence
    // jump unpredictably when moved both up and down.
    const reordered = [...groupStages];
    const [moved] = reordered.splice(source, 1);
    reordered.splice(destination, 0, moved);
    const orderForStage = new Map(reordered.map((stage, index) => [stage.order, groupStages[index].order]));
    const finalStages = openCase.stages.map((stage) => {
      const nextOrder = orderForStage.get(stage.order);
      return nextOrder == null ? stage : { ...stage, order: nextOrder };
    });

    // If a stage was ticked for today's encounter before it was moved, keep that temporary work
    // line attached to the same clinical stage rather than accidentally completing its old slot.
    setLines((current) => current.map((line) => {
      if (line.group !== groupKey || line.stageOrder == null) return line;
      return { ...line, stageOrder: orderForStage.get(line.stageOrder) ?? line.stageOrder };
    }));

    await onUpdateCase(openCase.id, { stages: finalStages });
  };

  const handleRemovePendingStage = async (stage: CaseStage) => {
    if (!onRemovePendingStage || stage.status !== "pending" || !stage.stageId || removingStageId) return;
    if (!window.confirm(`Remove the pending stage "${stage.label}" from this treatment plan?`)) return;
    setRemovingStageId(stage.stageId);
    setSaveError("");
    try {
      await onRemovePendingStage(stage);
      setLines((current) => current.filter((line) => line.stageOrder !== stage.order));
      setStageChargeDrafts((current) => {
        const next = { ...current };
        delete next[stage.order];
        return next;
      });
      showToast(`Pending stage "${stage.label}" removed.`);
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "The pending stage could not be removed.");
    } finally {
      setRemovingStageId(null);
    }
  };

  const dueByPatientId = useMemo(() => {
    const m: Record<string, FollowUp> = {};
    for (const f of followUps) {
      if (!f.active) continue;
      if (f.status !== "overdue" && f.status !== "due-today") continue;
      if (!m[f.patientId]) m[f.patientId] = f;
    }
    return m;
  }, [followUps]);

  const duePatients = useMemo(
    () =>
      patients
        .filter((p) => dueByPatientId[p.id])
        .sort((a, b) => dueByPatientId[a.id].dueDate.localeCompare(dueByPatientId[b.id].dueDate)),
    [patients, dueByPatientId],
  );
  const searching = query.trim().length > 0;
  const showingDue = !searching;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return duePatients;
    return patients
      .filter((p) => p.name.toLowerCase().includes(q) || p.patientNumber.toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, patients, duePatients]);

  const charges = lines.reduce((s, l) => s + rupeeAmount(l.cost), 0);
  const paid = Number(paidToday) || 0;
  const discount = Math.min(Number(discountInput) || 0, charges);
  const priorBalance = existing?.balance || 0;
  const newBalance = Math.max(0, priorBalance + charges - discount - paid);
  // The selected stages are still a draft until the final Work Entry commit,
  // so the payment panel must calculate from the live selection rather than a
  // post-commit balance supplied by the host.
  const workEntryOutstandingDue = Math.max(0, currentOutstandingDue + charges);

  const allergyConflict =
    prescriptions.map((rx) => checkDrugAllergyConflict(rx.medicine, patientAlerts)).find(Boolean) ?? null;

  const hasSurgical = lines.some((l) => SURGICAL_RE.test(l.procedure));
  const onAnticoagulant = patientAlerts.some((a) => ANTICOAG_RE.test(a));
  const surgeryBleedRisk = hasSurgical && onAnticoagulant;

  const canSave =
    !saved &&
    !!selectedId &&
    lines.length > 0 &&
    lines.every((l) => l.procedure.trim().length > 0);

  const effStep = selectedId ? step : 1;
  const fixedFlowStepIndex = workflowSteps.findIndex(({ n }) => n === effStep);
  const previousFixedFlowStep = fixedFlowStepIndex > 0 ? workflowSteps[fixedFlowStepIndex - 1]?.n : null;
  const stepStripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    stepStripRef.current
      ?.querySelector<HTMLButtonElement>("[data-active-step='true']")
      ?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }, [effStep]);

  // A follow-up choice belongs to one patient encounter. Never carry an
  // explicit "no follow-up" choice (or a partially entered recall) to the
  // next patient selected at the desk.
  useEffect(() => {
    setNoFollowUpNeeded(false);
    setFuDate("");
    setFuTime("");
    setFuReason("");
  }, [selectedId]);

  useEffect(() => {
    fuEdited.current = false;
    if (!selectedId) {
      loadedCaseIdentity.current = null;
      setNewComplaintMode(false);
      return;
    }
    const oc = (cases[selectedId] || []).find((c) => c.status === "open");
    const caseIdentity = `${selectedId}:${oc?.id ?? "new"}`;
    // Parent data can refresh when an independent tab saves (for example canal measurements).
    // Only initialise/reset the encounter draft when the user actually opens another case.
    if (loadedCaseIdentity.current === caseIdentity) return;
    loadedCaseIdentity.current = caseIdentity;
    if (oc) {
      setSessionType("continue");
      setChiefComplaint(oc.chiefComplaint?.trim() || oc.title.trim());
      setLines([]);
      setStageChargeDrafts({});
      setSelectedDoctors((oc.doctors ?? (oc.doctor ? [oc.doctor] : []))
        .filter((name) => doctorsList.includes(name)));
      setNewComplaintMode(false);
    } else {
      setNewComplaintMode(true);
    }
  }, [selectedId, cases, doctorsList]);

  const doneOrdersToday = new Set(
    lines.map((l) => l.stageOrder).filter((o): o is number => o != null)
  );

  const willCompleteCase =
    sessionType === "continue" &&
    !!openCase &&
    pendingStages.length > 0 &&
    pendingStages.every((s) => doneOrdersToday.has(s.order));

  const remainingPlan = useMemo(() => {
    if (!selectedId) return [];
    const pts = cases[selectedId] || [];
    return pts
      .filter((c) => c.status === "open")
      .flatMap((c) => c.stages.filter((s) => s.status === "pending").map((s) => ({ ...s, caseId: c.id })));
  }, [selectedId, cases]);

  const recallOptions = remainingPlan
    .filter((s) => !(s.caseId === openCase?.id && doneOrdersToday.has(s.order)))
    .map((s) => `${s.label}${s.tooth ? ` · tooth ${s.tooth}` : ""}`);

  const setLine = (key: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const matchesPlannedStage = (line: LineDraft, stage: CaseStage, group: string) => {
    const sameGroup = !line.group?.trim() || line.group.trim() === group.trim();
    const sameProcedure = line.procedure.trim().toLowerCase() === stage.label.trim().toLowerCase();
    const sameTooth = line.tooth.trim() === (stage.tooth || "").trim();
    if (line.stageOrder != null && stage.order != null) {
      return line.stageOrder === stage.order && sameGroup && sameProcedure && sameTooth;
    }
    if (!line.procedure || !stage.label) return false;
    return sameGroup && sameProcedure && sameTooth;
  };

  const addPlannedStageLine = (stage: CaseStage, group: string) => {
    const charge = stageChargeDrafts[stage.order] ?? rupeeValue(stage.agreedCost);
    setLines((prev) => {
      if (prev.some((line) => matchesPlannedStage(line, stage, group))) return prev;
      return [
        ...prev,
        {
          key: lineId.current++,
          procedure: stage.label,
          tooth: stage.tooth,
          cost: charge,
          custom: true,
          stageOrder: stage.order,
          group,
          grade: stage.grade,
          gradeLabel: stage.gradeLabel,
        },
      ];
    });
  };

  const onProcedurePick = (key: number, value: string) => {
    if (value === "__custom__") {
      setLine(key, { custom: true, procedure: "", cost: "" });
      return;
    }
    const match = procedureCatalog.find((c) => c.code === value);
    if (match) setLine(key, { custom: false, procedure: match.name, cost: rupeeValue(match.defaultCost) });
  };

  const addLine = (group?: string) => {
    const groupObj = group ? treatmentGroups.find((g) => g.name === group) : undefined;
    const autoTooth = groupObj?.stages.find((s) => s.tooth)?.tooth || "";
    const isMobility = /mobility/i.test(group || "");
    const lastGradedStage = groupObj ? [...groupObj.stages].reverse().find((s) => s.grade) : undefined;
    const autoGrade = lastGradedStage?.grade || "1";
    const autoGradeLabel = lastGradedStage?.gradeLabel || (autoGrade === "1" ? "Grade I" : autoGrade === "2" ? "Grade II" : "Grade III");

    setLines((prev) => [
      ...prev,
      {
        key: lineId.current++,
        procedure: "",
        tooth: autoTooth,
        cost: "",
        custom: true,
        group,
        grade: isMobility ? autoGrade : undefined,
        gradeLabel: isMobility ? autoGradeLabel : undefined,
      },
    ]);
  };

  const addInlineDraftStage = (groupName: string) => {
    const owner = openCase?.stages.find((stage) =>
      (stage.group?.trim() || openCase.title?.trim() || "Treatment") === groupName
      && Boolean(stage.treatmentId)
      && stage.treatmentRowVersion != null,
    );
    if (!owner?.treatmentId || owner.treatmentRowVersion == null) {
      setSaveError("This treatment could not be linked to the patient's saved plan. Refresh the case and try again.");
      return;
    }
    const groupObj = treatmentGroups.find((group) => group.name === groupName);
    const isMobility = /mobility/i.test(groupName);
    const lastGradedStage = groupObj ? [...groupObj.stages].reverse().find((stage) => stage.grade) : undefined;
    const grade = lastGradedStage?.grade || "1";
    const gradeLabel = lastGradedStage?.gradeLabel || (grade === "1" ? "Grade I" : grade === "2" ? "Grade II" : "Grade III");

    setLines((current) => [...current, {
      key: lineId.current++,
      procedure: "",
      tooth: toothForExtraStage(openCase, groupName, owner.tooth || "14"),
      cost: "",
      custom: true,
      group: groupName,
      patientProtocolId: owner.treatmentId,
      patientProtocolRowVersion: owner.treatmentRowVersion,
      grade: isMobility ? grade : undefined,
      gradeLabel: isMobility ? gradeLabel : undefined,
    }]);
  };

  const removeLine = (key: number) => {
    setCompletedExtraLineKeys((current) => {
      if (!current.has(key)) return current;
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    setLines((prev) =>
      prev.length === 1 && prev[0]?.stageOrder == null && sessionType === "new"
        ? prev
        : prev.filter((l) => l.key !== key),
    );
  };

  const advanceOnEnter = (e: React.KeyboardEvent<HTMLElement>) => {
    handleFormEnterNavigation(e);
  };

  const submit = async () => {
    if (allergyConflict) {
      setSaveError("Resolve the medication allergy conflict before saving this encounter.");
      return;
    }
    if (selectedDoctors.length === 0) {
      setShowDoctorRequired(true);
      return;
    }
    if (!canSave || saving) return;
    if (!existing) return;
    if (!encounterIdRef.current) encounterIdRef.current = encounterDraftId("work-entry");
    if (!encounterCommandIdRef.current) encounterCommandIdRef.current = encounterDraftCommandId("work-entry");
    const data: EncounterData = {
      encounterId: encounterIdRef.current,
      commandId: encounterCommandIdRef.current,
      patientId: existing.id,
      patientName: existing.name,
      dateISO,
      doctor,
      sessionType,
      chiefComplaint: reviewChiefComplaint,
      lines: lines.map((l) => ({ procedure: l.procedure.trim(), tooth: l.tooth.trim(), cost: rupeeAmount(l.cost), stageOrder: l.stageOrder, group: l.group })),
      note: note.trim(),
      prescriptions: (() => {
        const named = prescriptions.filter((d) => d.medicine.trim());
        return named.length ? named : undefined;
      })(),
      paidToday: paid,
      discount: discount > 0 ? discount : undefined,
      paymentMethod: paid > 0 ? paymentMethod : undefined,
      followUp: !noFollowUpNeeded && fuDate ? { dateISO: fuDate, time: fuTime || undefined, reason: fuReason.trim() || "Follow-up" } : null,
      labOrders: labOrders,
      perio: perioTeeth ?? undefined,
      caseId: sessionType === "continue" ? openCase?.id : undefined,
      completedStageOrders:
        sessionType === "continue"
          ? lines.map((l) => l.stageOrder).filter((o): o is number => o != null)
          : undefined,
      outcome: willCompleteCase && outcome ? outcome : undefined,
      canalDataMap: Object.keys(canalDataMap).length > 0 ? canalDataMap : undefined,
    };
    setSaving(true);
    setSaveError("");
    try {
      await onSaveEncounter(data);
      clearEncounterDraftId("work-entry");
      encounterIdRef.current = "";
      encounterCommandIdRef.current = "";
    } catch (err) {
      setSaveError((err as Error).message || "Couldn't save this encounter.");
      return;
    } finally {
      setSaving(false);
    }
    setSaved(true);
    setShowSaveSuccess(true);
  };

  const runTabSave = async (tab: string, save: (commandId: string) => Promise<void>, successMessage: string) => {
    if (saving) return false;
    setSaving(true);
    setSaveError("");
    try {
      await save(tabCommandId(tab));
      clearTabCommandId(tab);
      showToast(successMessage);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "This section could not be saved.";
      setSaveError(message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveWorkTab = async () => {
    if (!onSaveWorkTab) return;
    const completedStageOrders = lines.map((line) => line.stageOrder).filter((order): order is number => order != null);
    const extraWork = lines
      .filter((line): line is LineDraft & { patientProtocolId: string; patientProtocolRowVersion: number } => Boolean(line.patientProtocolId) && line.patientProtocolRowVersion != null && line.stageOrder == null)
      .map((line) => ({ patientProtocolId: line.patientProtocolId, expectedRowVersion: line.patientProtocolRowVersion, stageName: line.procedure.trim(), chargeAmount: rupeeAmount(line.cost), completeToday: completedExtraLineKeys.has(line.key) }));
    if (!completedStageOrders.length && !extraWork.length && !note.trim()) {
      setSaveError("Select completed treatment stages, add extra work, or enter a clinical note before saving.");
      return;
    }
    if ((completedStageOrders.length || extraWork.some((line) => line.completeToday)) && selectedDoctors.length === 0) {
      setSaveError("Select an attending doctor before saving completed clinical work.");
      return;
    }
    const succeeded = await runTabSave("work", (commandId) => onSaveWorkTab({
      commandId,
      dateISO,
      doctorNames: selectedDoctors,
      completedStageOrders,
      completedStageCharges: Object.fromEntries(
        lines
          .filter((line): line is LineDraft & { stageOrder: number } => line.stageOrder != null)
          .map((line) => [line.stageOrder, rupeeAmount(line.cost)]),
      ),
      extraWork,
      note: note.trim(),
    }), completedStageOrders.length || extraWork.some((line) => line.completeToday)
      ? "Today's clinical work was saved."
      : extraWork.length
        ? "Pending treatment stages were saved."
        : "Clinical note was saved.");
    if (succeeded) {
      setLines([]);
      setStageChargeDrafts({});
      setCompletedExtraLineKeys(new Set());
      setNote("");
    }
  };

  const workHasUnsavedChanges = lines.some((line) => line.stageOrder != null || Boolean(line.patientProtocolId)) || Boolean(note.trim());

  const savePerioTab = async () => {
    if (!onSavePerioTab || !perioTeeth) return;
    const succeeded = await runTabSave("perio", (commandId) => onSavePerioTab(perioTeeth, commandId, dateISO), "Periodontal chart was saved.");
    if (succeeded) setPerioTeeth(null);
  };

  const savePrescriptionTab = async () => {
    if (!onSavePrescriptionTab) return;
    const items = prescriptions.filter((item) => item.medicine.trim());
    if (!items.length || prescriptionDraftDirty) {
      setSaveError(prescriptionDraftDirty ? "Add the current medication to the prescription before saving." : "Add at least one medication before saving.");
      return;
    }
    const succeeded = await runTabSave("prescription", (commandId) => onSavePrescriptionTab({
      commandId,
      prescribedOn: dateISO,
      items,
    }), "Prescription was saved.");
    if (succeeded) setPrescriptions([]);
  };

  const prescriptionHasUnsavedChanges = prescriptions.length > 0 || prescriptionDraftDirty;
  const currentStepHasUnsavedChanges =
    (effStep === 2 && workHasUnsavedChanges)
    || (effStep === 4 && Boolean(perioTeeth))
    || (effStep === 5 && prescriptionHasUnsavedChanges);

  const saveRecallTab = async () => {
    if (!onSaveRecallTab) return;
    if (!noFollowUpNeeded && !fuDate) {
      setSaveError("Choose a follow-up date or confirm that no follow-up is needed.");
      return;
    }
    let payment: Omit<PatientPaymentInput, "patientId"> | null = null;
    if (paymentCollectionEnabled) {
      try {
          payment = parseWorkEntryPayment({
            paymentDate: dateISO,
            paidToday,
            discount: discountInput,
            paymentMethod,
            outstandingDue: workEntryOutstandingDue,
        });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Check the payment details and try again.");
        return;
      }
    }
    const succeeded = await runTabSave("recall", (commandId) => onSaveRecallTab({
      commandId,
      doctorNames: selectedDoctors,
      payment,
      followUp: !noFollowUpNeeded && fuDate
        ? { dateISO: fuDate, time: fuTime || undefined, reason: fuReason.trim() || "Follow-up" }
        : null,
    }), payment ? "Recall and payment were saved." : noFollowUpNeeded ? "Visit finished without a recall." : "Recall was saved.");
    if (succeeded) onFinish();
  };

  const buildRecallDraft = (): RecallTabSaveData | null => {
    if (!noFollowUpNeeded && !fuDate) {
      setSaveError("Choose a follow-up date or confirm that no follow-up is needed.");
      return null;
    }
    let payment: Omit<PatientPaymentInput, "patientId"> | null = null;
    if (paymentCollectionEnabled) {
      try {
        payment = parseWorkEntryPayment({
          paymentDate: dateISO,
          paidToday,
          discount: discountInput,
          paymentMethod,
          outstandingDue: workEntryOutstandingDue,
        });
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "Check the payment details and try again.");
        return null;
      }
    }
    return {
      commandId: tabCommandId("commit"),
      doctorNames: selectedDoctors,
      payment,
      followUp: !noFollowUpNeeded && fuDate
        ? { dateISO: fuDate, time: fuTime || undefined, reason: fuReason.trim() || "Follow-up" }
        : null,
    };
  };

  const commitWorkEntry = async () => {
    if (!onCommitWorkEntry || saving) return;
    if (allergyConflict) {
      setSaveError("Resolve the medication allergy conflict before committing this visit.");
      return;
    }
    if (prescriptionDraftDirty) {
      setSaveError("Add the current medication to the prescription before reviewing the visit.");
      return;
    }
    const recall = buildRecallDraft();
    if (!recall) return;
    const completedStageOrders = lines.map((line) => line.stageOrder).filter((order): order is number => order != null);
    const extraWork = lines
      .filter((line): line is LineDraft & { patientProtocolId: string; patientProtocolRowVersion: number } => Boolean(line.patientProtocolId) && line.patientProtocolRowVersion != null && line.stageOrder == null)
      .map((line) => ({
        patientProtocolId: line.patientProtocolId,
        expectedRowVersion: line.patientProtocolRowVersion,
        stageName: line.procedure.trim(),
        chargeAmount: rupeeAmount(line.cost),
        completeToday: completedExtraLineKeys.has(line.key),
      }));
    setSaving(true);
    setSaveError("");
    const finishCommitLoading = beginOperation("Work Entry", {
      title: "Saving record…",
      message: fixedPatientFlow ? "Saving clinical work and follow-up details." : "Saving clinical work, lab work, payment, and follow-up details.",
    }, true);
    let committed = false;
    try {
      await onCommitWorkEntry({
        work: {
          commandId: recall.commandId,
          dateISO,
          doctorNames: selectedDoctors,
          completedStageOrders,
          completedStageCharges: Object.fromEntries(
            lines.filter((line): line is LineDraft & { stageOrder: number } => line.stageOrder != null)
              .map((line) => [line.stageOrder, rupeeAmount(line.cost)]),
          ),
          extraWork,
          note: note.trim(),
        },
        periodontalTeeth: perioTeeth,
        prescriptionItems: prescriptions.filter((item) => item.medicine.trim()),
        labOrders: fixedPatientFlow ? [] : unpersistedLabOrderDrafts(labOrders),
        recall,
        closeCase,
      });
      clearTabCommandId("commit");
      committed = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Work Entry could not be committed.";
      setSaveError(message);
    } finally {
      setSaving(false);
      finishCommitLoading();
    }
    if (committed) onFinish();
  };

  const editTotalCost = editSteps.reduce((sum, s) => sum + (s.agreedCost || 0), 0);

  return (
    <div style={{ padding: fixedPatientFlow ? "16px 12px 24px" : "24px", maxWidth: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {newComplaintMode && selectedId ? (
            renderNewComplaint(selectedId, () => {
              setNewComplaintMode(false);
              if (pendingStages.length === 0) { setSelectedId(null); setQuery(""); }
            })
          ) : (
            <>
              {/* Streamlined Compact Stepper Bar */}
              {selectedId && (
                <div className={styles.stepBar}>
                  <div ref={stepStripRef} data-work-entry-step-tabs className={styles.stepTabs}>
                    {(onCommitWorkEntry ? workflowSteps : workflowSteps.filter(({ n }) => n !== reviewStep)).map((originalStep) => {
                      const s = originalStep.n === 1 && patientStepLabel
                        ? { ...originalStep, label: patientStepLabel }
                        : originalStep;
                      const active = effStep === s.n;
                      const completed = !active && passedSteps.has(s.n);
                      const locked = (s.n > 1 && !selectedId) || (!onCommitWorkEntry && s.n > effStep && currentStepHasUnsavedChanges);
                      return (
                        <button
                          key={s.n}
                          type="button"
                          disabled={fixedPatientFlow || locked}
                          onClick={fixedPatientFlow ? undefined : () => goToStep(s.n as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)}
                          data-active-step={active ? "true" : undefined}
                          data-work-entry-step={s.n}
                          aria-current={active ? "step" : undefined}
                          aria-label={completed ? `${s.label}, visited` : undefined}
                          title={!onCommitWorkEntry && s.n > effStep && currentStepHasUnsavedChanges ? "Save this section before moving forward." : undefined}
                          className={`${styles.stepButton}${active ? ` ${styles.stepButtonActive}` : completed ? ` ${styles.stepButtonComplete}` : ""}${fixedPatientFlow ? ` ${styles.stepButtonStatic}` : ""}`}
                        >
                          <span className={`${styles.stepNumber}${active ? ` ${styles.stepNumberActive}` : completed ? ` ${styles.stepNumberComplete}` : ""}`}>
                            {completed ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : s.displayN}
                          </span>
                          <span className={styles.stepLabel}>{s.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {fixedPatientFlow && (
                    <div className={`clinicWizardHeaderActions ${styles.stepActions}`} data-work-entry-step-actions>
                      {previousFixedFlowStep !== null && (
                        <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => goToStep(previousFixedFlowStep as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8)}>
                          <ArrowLeft size={14} /> Back
                        </button>
                      )}
                      {effStep === 1 && (renderPatientStep ? (
                        <button type="button" className="btn btn-primary" onClick={() => goToStep(2, true)}>
                          Next <ArrowRight size={14} />
                        </button>
                      ) : (
                        <button type="button" className="btn btn-primary" onClick={() => goToStep(2, true)}>
                          Next <ArrowRight size={14} />
                        </button>
                      ))}
                      {effStep === 2 && (
                        <>
                          {!onCommitWorkEntry && <button type="button" className="btn btn-primary" disabled={!workHasUnsavedChanges || saving} onClick={() => void saveWorkTab()}>
                            {saving ? "Saving…" : "Save work"}
                          </button>}
                          <button type="button" className="btn btn-primary" disabled={(!onCommitWorkEntry && workHasUnsavedChanges) || saving} onClick={() => goToStep(4, true)}>
                            Next <ArrowRight size={14} />
                          </button>
                        </>
                      )}
                      {effStep === 4 && (
                        <>
                          {!onCommitWorkEntry && <button type="button" className="btn btn-primary" disabled={!perioTeeth || saving} onClick={() => void savePerioTab()}>
                            {saving ? "Saving…" : "Save perio chart"}
                          </button>}
                          <button type="button" className="btn btn-primary" disabled={(!onCommitWorkEntry && Boolean(perioTeeth)) || saving} onClick={() => goToStep(5, true)}>
                            Next <ArrowRight size={14} />
                          </button>
                        </>
                      )}
                      {effStep === 5 && (
                        <>
                          {!onCommitWorkEntry && <button type="button" className="btn btn-primary" disabled={!prescriptions.length || prescriptionDraftDirty || saving} onClick={() => void savePrescriptionTab()}>
                            {saving ? "Saving…" : "Save prescription"}
                          </button>}
                          <button type="button" className="btn btn-primary" disabled={(!onCommitWorkEntry && prescriptionHasUnsavedChanges) || saving} onClick={() => goToStep(6, true)}>
                          Next <ArrowRight size={14} />
                          </button>
                        </>
                      )}
                      {effStep === 6 && (
                        paymentCollectionEnabled ? <button type="button" className="btn btn-primary" disabled={saving} onClick={() => goToStep(7, true)}>Next <ArrowRight size={14} /></button>
                          : <button type="button" className="btn btn-primary" disabled={(!noFollowUpNeeded && !fuDate) || saving} onClick={() => onCommitWorkEntry ? goToStep(7, true) : void saveRecallTab()}>{saving ? "Saving…" : onCommitWorkEntry ? <>Next <ArrowRight size={14} /></> : "Save recall"}</button>
                      )}
                      {paymentCollectionEnabled && effStep === 7 && (
                        <button type="button" className="btn btn-primary" disabled={(!noFollowUpNeeded && !fuDate) || saving} onClick={() => onCommitWorkEntry ? goToStep(8, true) : void saveRecallTab()}>{saving ? "Saving…" : onCommitWorkEntry ? <>Next <ArrowRight size={14} /></> : "Save recall"}</button>
                      )}
                      {effStep === reviewStep && onCommitWorkEntry && (
                        <button type="button" className="btn btn-primary" data-work-entry-review-save
                          disabled={!saved && saving}
                          onClick={() => saved ? onFinish?.() : void commitWorkEntry()}>
                          <Check size={16} aria-hidden="true" /> {saved ? "Finish" : saving ? "Saving…" : "Review & save"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {/* STEP 1 — PATIENT RESOLUTION */}
              {effStep === 1 && (renderPatientStep ? (
                <>
                  {renderPatientStep(() => goToStep(2, true), () => undefined)}
                  {fixedPatientFlow && (
                    <section style={{ ...card, marginTop: "14px", background: "#f8fafc", padding: "16px 18px" }} aria-label="Visit details">
                      <h3 style={{ ...sectionTitle, marginBottom: "14px" }}>
                        <Stethoscope size={16} style={{ color: "#1476a6" }} /> Visit details
                      </h3>
                      <div className={styles.visitDetailsGrid} style={{ display: "grid", gap: "16px", alignItems: "start" }}>
                        <div>
                          <label style={label}>Visit date</label>
                          <DatePicker value={dateISO} onChange={setDateISO} fluid />
                        </div>
                        <div>
                          <label style={label}>Attending doctor(s)</label>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                            {doctorsList.map((doctorName) => {
                              const selected = selectedDoctors.includes(doctorName);
                              return (
                                <label key={doctorName} style={{ display: "inline-flex", alignItems: "center", gap: "7px", minHeight: "36px", padding: "5px 12px", border: selected ? "1px solid #1476a6" : "1px solid #cbd5e1", borderRadius: "18px", background: selected ? "#eaf5fb" : "#ffffff", color: selected ? "#124c6e" : "#475569", fontSize: "var(--fs-13)", fontWeight: selected ? "var(--fw-bold)" : "var(--fw-medium)", cursor: "pointer" }}>
                                  <input type="checkbox" checked={selected} onChange={() => setSelectedDoctors((current) => selected ? current.filter((name) => name !== doctorName) : [...current, doctorName])} style={{ accentColor: "#1476a6", cursor: "pointer" }} />
                                  <span>{doctorName}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <section
                  style={fixedPatientFlow ? workflowPage : {
                    background: "#ffffff",
                    borderRadius: "0px",
                    border: "1px solid #e2e8f0",
                    padding: "18px 20px",
                    boxShadow: "0 3px 12px rgba(15, 23, 42, 0.035)",
                  }}
                >
                  {selectedId && !fixedPatientFlow && (
                    <StepNav
                      top
                      backLabel="Change Patient"
                      onBack={fixedPatientFlow ? undefined : () => { setSelectedId(null); setQuery(""); }}
                      onNext={() => goToStep(2, true)}
                      nextLabel="Work Done Today"
                    />
                  )}
                  <h3 style={sectionTitle}>
                    <StepDot n={1} /> <User size={18} style={{ color: "#6366f1" }} /> Patient Resolution
                  </h3>

                  {!selectedId && (
                    <>
                      <div style={{ position: "relative", marginBottom: "16px" }}>
                        <Search size={17} style={{ position: "absolute", left: "14px", top: "12px", color: "var(--acc)" }} />
                        <input
                          autoFocus
                          style={{
                            width: "100%",
                            padding: "10px 14px 10px 40px",
                            border: "1px solid #94a3b8",
                            borderRadius: "0px",
                            fontSize: "var(--fs-14)",
                            color: "#0f172a",
                            background: "#ffffff",
                            outline: "none",
                            boxShadow: "none",
                            transition: "all 0.15s ease",
                          }}
                          placeholder="Search patient by name or phone/ID number…"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                        />
                      </div>
                      <div style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em", margin: "14px 0 8px" }}>
                        {searching ? "Search Results" : "Due Today & Overdue Recalls"}
                      </div>
                      {matches.length === 0 && (
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "28px 20px", border: "1px dashed #94a3b8", borderRadius: "0px", color: "#64748b", background: "#f8fafc" }}>
                          <BellRing size={26} style={{ marginBottom: "10px", color: "#94a3b8" }} />
                          <span style={{ fontSize: "14px", fontWeight: "700", color: "#334155" }}>
                            {searching ? "No patient matches search query" : "No recall appointments due today"}
                          </span>
                          <span style={{ fontSize: "13px", marginTop: "4px", color: "#64748b" }}>
                            {searching ? "Double-check patient name or ID." : "Use the search bar above to look up any walk-in patient."}
                          </span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {matches.map((p) => {
                          const due = showingDue ? dueByPatientId[p.id] : undefined;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelectedId(p.id)}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                padding: "12px 14px",
                                border: "1px solid #e2e8f0",
                                borderRadius: "0px",
                                background: "#ffffff",
                                cursor: "pointer",
                                textAlign: "left",
                                transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                                boxShadow: "none",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = "#c7d2fe";
                                e.currentTarget.style.transform = "translateY(-1px)";
                                e.currentTarget.style.boxShadow = "0 3px 10px rgba(99, 102, 241, 0.08)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = "#e2e8f0";
                                e.currentTarget.style.transform = "translateY(0)";
                                e.currentTarget.style.boxShadow = "none";
                              }}
                            >
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "42px",
                                  height: "42px",
                                  borderRadius: "0px",
                                  background: "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)",
                                  color: "#ffffff",
                                  fontSize: "14px",
                                  fontWeight: "700",
                                  flexShrink: 0,
                                  boxShadow: "none",
                                }}
                              >
                                {initials(p.name)}
                              </span>
                              <span style={{ flex: 1, minWidth: 0 }}>
                                <span style={{ display: "block", fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "#0f172a" }}>{p.name}</span>
                                {due ? (
                                  <span style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#64748b", minWidth: 0, marginTop: "3px" }}>
                                    <span
                                      style={{
                                        flexShrink: 0,
                                        fontSize: "11px",
                                        fontWeight: "700",
                                        padding: "2px 9px",
                                        borderRadius: "999px",
                                        background: due.status === "overdue" ? "#fef2f2" : "#fffbeb",
                                        color: due.status === "overdue" ? "#b91c1c" : "#b45309",
                                        border: `1px solid ${due.status === "overdue" ? "#fecaca" : "#fde68a"}`,
                                      }}
                                    >
                                      {due.dueLabel}
                                    </span>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{due.reason}</span>
                                  </span>
                                ) : (
                                  <span style={{ display: "block", fontSize: "13px", color: "#64748b", marginTop: "3px" }}>
                                    {p.patientNumber} · {p.planTitle}
                                  </span>
                                )}
                              </span>
                              {p.alerts.length > 0 && <ShieldAlert size={18} style={{ color: "#ef4444", flexShrink: 0 }} />}
                              <ArrowRight size={16} style={{ color: "#94a3b8", flexShrink: 0 }} />
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {selectedId && existing && (() => {
                    const patientOpenCase = cases[existing.id]?.find((c) => c.status === "open");
                    const caseDoctors = patientOpenCase?.doctors || (patientOpenCase?.doctor ? [patientOpenCase.doctor] : []);
                    const visitDoctors = existing.visits?.map((v) => v.doctor).filter(Boolean) || [];

                    const doctorSet = new Set<string>();
                    [...selectedDoctors, ...caseDoctors, ...visitDoctors].forEach((docStr) => {
                      if (!docStr) return;
                      docStr.split(/[,&]/).forEach((part) => {
                        const trimmed = part.trim();
                        if (trimmed) doctorSet.add(trimmed);
                      });
                    });

                    const allAssociatedDoctors = Array.from(doctorSet);
                    const attendingClinicians = allAssociatedDoctors.length > 0
                      ? allAssociatedDoctors
                      : (doctorsList.length > 0 ? doctorsList : ["Dr. Arpana Tiwari"]);

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        {/* Patient identity: deliberately separated from clinical context below. */}
                        <div style={{ background: "linear-gradient(135deg, #f0f9ff 0%, #ffffff 68%)", padding: "18px", borderRadius: "12px", border: "1px solid #bae6fd", borderTop: "4px solid #0284c7", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.04)" }}>
                          <div style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: "10px" }}>Patient selected</div>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  width: "46px",
                                  height: "46px",
                                  borderRadius: "50%",
                                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                                  color: "#ffffff",
                                  fontSize: "var(--fs-16)",
                                  fontWeight: "var(--fw-bold)",
                                  flexShrink: 0,
                                  boxShadow: "0 3px 10px rgba(2, 132, 199, 0.22)",
                                }}
                              >
                                {initials(existing.name)}
                              </span>
                              <div>
                                <div style={{ fontSize: "var(--fs-17)", fontWeight: "var(--fw-bold)", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                  <span>{existing.name}</span>
                                  <span style={{ fontSize: "var(--fs-12)", fontWeight: "700", color: "#0369a1", background: "#e0f2fe", border: "1px solid #bae6fd", padding: "2px 8px", borderRadius: "12px" }}>
                                    ID: {existing.patientNumber}
                                  </span>
                                </div>
                                <div style={{ fontSize: "var(--fs-13)", color: "#64748b", marginTop: "3px", display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                                  <span>{existing.age} yrs ({existing.sex === "M" ? "Male" : "Female"})</span>
                                  {existing.phone && <span>· 📞 {existing.phone}</span>}
                                  {existing.address && <span>· 📍 {existing.address}</span>}
                                </div>
                              </div>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", marginTop: "16px", paddingTop: "14px", borderTop: "1px solid #bae6fd", fontSize: "var(--fs-13)" }}>
                            <div style={{ padding: "10px 12px", border: "1px solid #dbeafe", borderRadius: "8px", background: "#ffffff" }}>
                              <div style={{ color: "#64748b", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Attending clinicians</div>
                              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "5px" }}>
                                {attendingClinicians.map((clinician) => (
                                  <span key={clinician} style={{ color: "#4f46e5", fontWeight: "var(--fw-bold)", lineHeight: 1.3 }}>{clinician}</span>
                                ))}
                              </div>
                            </div>
                            <div style={{ padding: "10px 12px", border: "1px solid #dbeafe", borderRadius: "8px", background: "#ffffff" }}>
                              <div style={{ color: "#64748b", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Preferred language</div>
                              <div style={{ color: "#1e293b", fontWeight: "var(--fw-bold)" }}>{existing.language || "Nepali"}</div>
                            </div>
                            <div style={{ padding: "10px 12px", border: "1px solid #dbeafe", borderRadius: "8px", background: "#ffffff" }}>
                              <div style={{ color: "#64748b", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>Emergency contact</div>
                              <div style={{ color: "#1e293b", fontWeight: "var(--fw-bold)" }}>
                                {existing.emergencyContact?.name ? `${existing.emergencyContact.name} (${existing.emergencyContact.phone})` : "Not recorded"}
                              </div>
                            </div>
                          </div>

                          {(existing.notes || (existing.dentalHistory as DentalHistoryWithChiefComplaint | undefined)?.chiefComplaint) && (
                            <div style={{ marginTop: "12px", padding: "12px 14px", background: "#faf5ff", borderRadius: "8px", border: "1px solid #e9d5ff", fontSize: "var(--fs-13)" }}>
                              <div style={{ color: "#7e22ce", fontWeight: "var(--fw-bold)", fontSize: "var(--fs-11)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "4px" }}>Visit context</div>
                              <div style={{ color: "#1e293b", fontWeight: "var(--fw-medium)" }}>{existing.notes || (existing.dentalHistory as DentalHistoryWithChiefComplaint | undefined)?.chiefComplaint}</div>
                            </div>
                          )}
                        </div>

                        {patientAlerts.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              background: "#fff7ed",
                              border: "1px solid #fdba74",
                              borderLeft: "4px solid #ea580c",
                              color: "#9a3412",
                              padding: "14px 16px",
                              borderRadius: "8px",
                            }}
                          >
                            <ShieldAlert size={20} style={{ flexShrink: 0, marginTop: "1px" }} />
                            <div>
                              <div style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "3px" }}>Clinical safety alert</div>
                              <div style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", lineHeight: 1.5 }}>{patientAlerts.join(" · ")}</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </section>
              ))}

              {/* STEP 2 — WORK DONE TODAY */}
              {effStep === 2 && (
                <section style={fixedPatientFlow ? continuationStepFrame : card} onKeyDown={advanceOnEnter} onFocusCapture={handleFormKeyboardFocus} onPointerDownCapture={handleFormKeyboardPointerDown}>
                  {!fixedPatientFlow && (
                    <StepNav
                      top
                      onBack={() => goToStep(1)}
                      onSave={onSaveWorkTab ? () => void saveWorkTab() : undefined}
                      saveLabel="Save work"
                      saveDisabled={!workHasUnsavedChanges}
                      saving={saving}
                      onNext={() => goToStep(4, true)}
                      nextLabel="Perio Chart"
                      nextDisabled={workHasUnsavedChanges}
                    />
                  )}
                  <h3 style={sectionTitle}>
                    <StepDot n={2} /> <Stethoscope size={16} style={{ color: "#7c3aed" }} /> Work Done Today
                  </h3>

                  {!fixedPatientFlow && <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 1fr) minmax(360px, 2fr) auto", gap: "16px", alignItems: "end", marginBottom: "16px", background: "#f8fafc", padding: "14px 16px", borderRadius: "14px", border: "1px solid #e2e8f0" }}>
                    <div>
                      <label style={label}>Visit Date</label>
                      <div style={{ width: "180px", maxWidth: "100%" }}>
                        <DatePicker value={dateISO} onChange={setDateISO} fluid />
                      </div>
                    </div>
                    <div>
                      <label style={label}>Attending Doctor(s)</label>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                        {doctorsList.map((d) => {
                          const selected = selectedDoctors.includes(d);
                          return (
                            <label
                              key={d}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "6px 14px",
                                fontSize: "var(--fs-13)",
                                fontWeight: "var(--fw-bold)",
                                borderRadius: "20px",
                                border: selected ? "1.5px solid #7c3aed" : "1px solid #cbd5e1",
                                background: selected ? "#f3e8ff" : "#ffffff",
                                color: selected ? "#6b21a8" : "#475569",
                                cursor: "pointer",
                                transition: "all 0.15s ease",
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
                                style={{ "--checkbox-color": "#7c3aed", cursor: "pointer" } as React.CSSProperties}
                              />
                              <span>{d}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>}

                  {sessionType === "new" && (
                    <div style={{ marginBottom: "16px" }}>
                      <label style={label}>Chief Complaint *</label>
                      <input
                        style={input}
                        value={chiefComplaint}
                        onChange={(e) => setChiefComplaint(e.target.value)}
                        placeholder="e.g. Pain in lower right molar, sensitivity to cold"
                      />
                    </div>
                  )}

                  {surgeryBleedRisk && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        marginBottom: "16px",
                        background: "#fef2f2",
                        border: "1px solid #fecaca",
                        color: "#dc2626",
                        padding: "12px 16px",
                        borderRadius: "12px",
                      }}
                    >
                      <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "1px" }} />
                      <div style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", lineHeight: 1.5 }}>
                        Anticoagulant medication + surgical procedure — high bleeding risk. Confirm patient clearance before proceeding.
                      </div>
                    </div>
                  )}

                  <div>
                    {sessionType !== "continue" ? <label style={label}>Work Procedures Performed Today</label> : null}

                    {sessionType === "continue" ? (
                      <div className={styles.treatmentProtocolGrid} data-work-entry-treatment-grid>
                        {treatmentGroups.map((tg) => {
                          const sortedStages = sortStagesByGrade(tg.stages);
                          const donePrior = sortedStages.filter((s) => s.status === "done");
                          const pending = sortedStages.filter((s) => s.status === "pending");
                          const extras = lines.filter((l) => l.stageOrder == null && (l.group ?? "") === tg.name);
                          const teeth = Array.from(new Set(tg.stages.map((s) => s.tooth).filter(Boolean)));
                          const isMobilityGroup = /mobility/i.test(tg.name);
                          const hasExplicitCanalSetting = tg.stages.some((stage) => typeof stage.recordCanals === "boolean");
                          const recordsCanals = tg.stages.some((stage) => stage.recordCanals === true)
                            || (!hasExplicitCanalSetting && /root\s*canal|rct/i.test(tg.name));
                          return (
                            <div key={tg.name} style={{ minWidth: 0, border: "1px solid #d6e1ed", borderRadius: "2px", background: "#ffffff", padding: "16px", boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)" }}>
                              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "14px", paddingBottom: "10px", borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "#7c3aed" }}>
                                    <Stethoscope size={15} style={{ flexShrink: 0 }} />
                                    {tg.name.replace(/\s*\(\s*Grade\s*(?:I{1,3}|V?I{0,3}|\d+)\s*\)/gi, "")}
                                  </span>
                                  {teeth.length > 0 && (
                                    <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#0369a1", background: "#e0f2fe", padding: "2px 8px", borderRadius: "3px" }}>
                                      Tooth {teeth.join(", ")}
                                    </span>
                                  )}
                                </div>

                                {onUpdateCase && (
                                  <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
                                    {/* Legacy direct-edit flows retain their plan removal control. */}
                                    <button
                                      type="button"
                                      onClick={() => setGroupPendingDelete(tg.name)}
                                      className="btn btn-secondary btn-sm"
                                      style={{ padding: "3px 7px", color: "#dc2626" }}
                                      title="Delete Treatment Plan"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div style={{ marginTop: "-6px", marginBottom: "12px", display: "flex", alignItems: "center" }}>
                                <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#7c3aed", background: "#f3e8ff", padding: "3px 10px", borderRadius: "3px", border: "1px solid #e9d5ff" }}>
                                  Total: {formatNpr(tg.stages.reduce((total, stage) => total + rupeeAmount(stage.agreedCost), 0))}
                                </span>
                              </div>

                              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                {donePrior.map((s, dIdx) => {
                                  const isDragging = draggedStageOrder === s.order;
                                  const isOver = dragOverStageOrder === s.order && draggedStageOrder !== s.order;
                                  return (
                                    <div
                                      key={`done-${s.order}`}
                                      draggable={Boolean(onUpdateCase)}
                                      onDragStart={(e) => {
                                        if (!onUpdateCase) return;
                                        e.dataTransfer.setData("text/plain", `${s.order}`);
                                        setDraggedStageOrder(s.order);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedStageOrder(null);
                                        setDragOverStageOrder(null);
                                      }}
                                      onDragOver={(e) => {
                                        if (onUpdateCase) {
                                          e.preventDefault();
                                          setDragOverStageOrder(s.order);
                                        }
                                      }}
                                      onDragLeave={(e) => {
                                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                        if (dragOverStageOrder === s.order) setDragOverStageOrder(null);
                                      }}
                                      onDrop={(e) => {
                                        if (!onUpdateCase) return;
                                        e.preventDefault();
                                        const fromOrder = Number(e.dataTransfer.getData("text/plain"));
                                        if (!isNaN(fromOrder) && fromOrder !== s.order) {
                                          handleReorderPendingStages(tg.name, fromOrder, s.order);
                                        }
                                        setDraggedStageOrder(null);
                                        setDragOverStageOrder(null);
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px 10px",
                                        borderTop: isOver ? "3px solid #7c3aed" : isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                                        borderRight: isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                                        borderBottom: isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                                        borderRadius: "5px",
                                        borderLeft: isDragging ? "1.5px dashed #7c3aed" : "1px solid #e2e8f0",
                                        background: isDragging ? "#faf5ff" : isOver ? "#f3e8ff" : "#ffffff",
                                        opacity: isDragging ? 0.4 : 1,
                                        transition: "background-color 0.12s ease, border-color 0.12s ease",
                                      }}
                                    >
                                      {onUpdateCase && (
                                        <div
                                          data-drag-handle="true"
                                          onClick={(e) => e.stopPropagation()}
                                          title="Click & drag to reorder step"
                                          style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            width: "18px",
                                            height: "22px",
                                            borderRadius: "0px",
                                            background: isDragging || isOver ? "#7c3aed" : "#e2e8f0",
                                            color: isDragging || isOver ? "#ffffff" : "#64748b",
                                            border: "1px solid #cbd5e1",
                                            cursor: isDragging ? "grabbing" : "grab",
                                            flexShrink: 0,
                                            transition: "all 0.15s ease",
                                          }}
                                        >
                                          <Hand size={13} />
                                        </div>
                                      )}
                                      <span role="checkbox" aria-checked="true" aria-disabled="true" aria-label={`${s.label} already completed`} title="This stage is already recorded" style={{ display: "inline-grid", placeItems: "center", width: "17px", height: "17px", margin: "0 auto", border: "1px solid #15803d", borderRadius: "3px", background: "#16a34a", color: "#ffffff", flexShrink: 0 }}>
                                        <Check size={12} strokeWidth={3} aria-hidden="true" />
                                      </span>
                                      <span style={{ flex: 1, minWidth: 0 }}>
                                        <span style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                          <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "#1e293b" }}>{dIdx + 1}. {s.label}</span>
                                          {(s.gradeLabel || s.grade || isMobilityGroup) && (
                                            <span style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", background: "#f3e8ff", padding: "1px 6px", borderRadius: "0px", color: "#7c3aed", border: "1px solid #e9d5ff" }}>
                                              {s.gradeLabel || (s.grade ? `Grade ${s.grade}` : "Grade I")}
                                            </span>
                                          )}
                                        </span>
                                        {(s.doneBy || s.doneDate) && (
                                          <span style={{ display: "block", fontSize: "var(--fs-12)", color: "#64748b" }}>
                                            {s.doneBy ? `done by ${s.doneBy}` : ""}{s.doneDate ? ` · ${formatDateShort(s.doneDate)}` : ""}
                                          </span>
                                        )}
                                      </span>
                                      <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "#334155", fontVariantNumeric: "tabular-nums" }}>{formatNpr(s.agreedCost)}</span>
                                    </div>
                                  );
                                })}

                                {pending.map((s, sIdx) => {
                                  const isSameStage = (line: LineDraft) => matchesPlannedStage(line, s, tg.name);
                                  const selectedLine = lines.find(isSameStage);
                                  const done = Boolean(selectedLine);
                                  const charge = selectedLine?.cost ?? stageChargeDrafts[s.order] ?? rupeeValue(s.agreedCost);
                                  const isDragging = draggedStageOrder === s.order;
                                  const isOver = dragOverStageOrder === s.order && draggedStageOrder !== s.order;
                                  return (
                                    <div
                                      key={`${s.order}-${s.label}-${sIdx}`}
                                      draggable={Boolean(onUpdateCase)}
                                      onDragStart={(e) => {
                                        if (!onUpdateCase) return;
                                        e.dataTransfer.setData("text/plain", `${s.order}`);
                                        setDraggedStageOrder(s.order);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedStageOrder(null);
                                        setDragOverStageOrder(null);
                                      }}
                                      onDragOver={(e) => {
                                        if (onUpdateCase) {
                                          e.preventDefault();
                                          setDragOverStageOrder(s.order);
                                        }
                                      }}
                                      onDragLeave={(e) => {
                                        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                        if (dragOverStageOrder === s.order) setDragOverStageOrder(null);
                                      }}
                                      onDrop={(e) => {
                                        if (!onUpdateCase) return;
                                        e.preventDefault();
                                        const fromOrder = Number(e.dataTransfer.getData("text/plain"));
                                        if (!isNaN(fromOrder) && fromOrder !== s.order) {
                                          handleReorderPendingStages(tg.name, fromOrder, s.order);
                                        }
                                        setDraggedStageOrder(null);
                                        setDragOverStageOrder(null);
                                      }}
                                      onClick={(e) => {
                                        const target = e.target as HTMLElement;
                                        if (target.closest("[data-drag-handle]") || target.closest("button") || target.closest("input") || target.closest("select")) {
                                          return;
                                        }
                                        if (done) {
                                          setLines((prev) => prev.filter((l) => !isSameStage(l)));
                                        } else {
                                          addPlannedStageLine(s, tg.name);
                                        }
                                      }}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                        padding: "8px 10px",
                                        borderTop: isOver ? "3px solid #7c3aed" : isDragging ? "1.5px dashed #7c3aed" : `1.5px solid ${done ? "#7c3aed" : "#cbd5e1"}`,
                                        borderLeft: isDragging ? "1.5px dashed #7c3aed" : `1.5px solid ${done ? "#7c3aed" : "#cbd5e1"}`,
                                        borderRight: isDragging ? "1.5px dashed #7c3aed" : `1.5px solid ${done ? "#7c3aed" : "#cbd5e1"}`,
                                        borderBottom: isDragging ? "1.5px dashed #7c3aed" : `1.5px solid ${done ? "#7c3aed" : "#cbd5e1"}`,
                                        borderRadius: "5px",
                                        background: isDragging ? "#faf5ff" : isOver ? "#f3e8ff" : done ? "#f3e8ff" : "#ffffff",
                                        opacity: isDragging ? 0.4 : 1,
                                        transition: "background-color 0.12s ease, border-color 0.12s ease",
                                        cursor: "pointer",
                                      }}
                                    >
                                        {onUpdateCase && (
                                          <div
                                            data-drag-handle="true"
                                            onClick={(e) => e.stopPropagation()}
                                            title="Click & drag to reorder step"
                                            style={{
                                              display: "flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              width: "18px",
                                              height: "22px",
                                            borderRadius: "0px",
                                              background: isDragging || isOver ? "#7c3aed" : "#f1f5f9",
                                              color: isDragging || isOver ? "#ffffff" : "#64748b",
                                              border: "1px solid #cbd5e1",
                                              cursor: isDragging ? "grabbing" : "grab",
                                              flexShrink: 0,
                                              transition: "all 0.15s ease",
                                            }}
                                          >
                                            <Hand size={13} />
                                          </div>
                                        )}
                                        <input
                                          type="checkbox"
                                          checked={done}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            if (e.target.checked) {
                                              addPlannedStageLine(s, tg.name);
                                            } else {
                                              setLines((prev) => prev.filter((l) => !isSameStage(l)));
                                            }
                                          }}
                                          style={{ "--checkbox-color": "#7c3aed", width: "16px", height: "16px", cursor: "pointer" } as React.CSSProperties}
                                        />
                                        <span style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                          <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: done ? "#6b21a8" : "#1e293b" }}>{donePrior.length + sIdx + 1}. {s.label}</span>
                                          {(s.gradeLabel || s.grade || isMobilityGroup) && (
                                            <span style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", background: "#f3e8ff", padding: "1px 6px", borderRadius: "0px", color: "#7c3aed", border: "1px solid #e9d5ff" }}>
                                              {s.gradeLabel || (s.grade ? `Grade ${s.grade}` : "Grade I")}
                                            </span>
                                          )}
                                        </span>
                                        <input
                                          aria-label={`Today's charge for ${s.label}`}
                                          title="Charge for this completed stage"
                                          className={styles.stagePriceInput}
                                          style={{ ...input, width: "128px", minWidth: "128px", height: "39px", padding: "6px 8px", textAlign: "right", fontWeight: "var(--fw-bold)", fontVariantNumeric: "tabular-nums", background: "#ffffff" }}
                                          inputMode="decimal"
                                          value={formatIndianRupeeInput(charge)}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            const target = e.currentTarget;
                                            const caret = target.selectionStart ?? target.value.length;
                                            const logicalCaret = target.value.slice(0, caret).replace(/[^\d.]/g, "").length;
                                            const next = readRupeeText(target);
                                            const groupedNext = formatIndianRupeeInput(next);
                                            target.value = groupedNext;
                                            const nextCaret = caretPositionForGroupedInput(groupedNext, logicalCaret);
                                            target.setSelectionRange(nextCaret, nextCaret);
                                            setStageChargeDrafts((current) => ({ ...current, [s.order]: next }));
                                            if (selectedLine) {
                                              setLine(selectedLine.key, { cost: next });
                                            } else {
                                              setLines((current) => [
                                                ...current,
                                                {
                                                  key: lineId.current++,
                                                  procedure: s.label,
                                                  tooth: s.tooth,
                                                  cost: next,
                                                  custom: true,
                                                  stageOrder: s.order,
                                                  group: tg.name,
                                                  grade: s.grade,
                                                  gradeLabel: s.gradeLabel,
                                                },
                                              ]);
                                            }
                                          }}
                                        />
                                        {done ? (
                                          <Check size={16} style={{ color: "#7c3aed", flexShrink: 0 }} />
                                        ) : onRemovePendingStage && s.stageId ? (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              void handleRemovePendingStage(s);
                                            }}
                                            disabled={Boolean(removingStageId)}
                                            aria-label={`Remove pending stage ${s.label}`}
                                            title={`Remove pending stage "${s.label}"`}
                                            style={{
                                              background: "none",
                                              border: "none",
                                              color: "#dc2626",
                                              cursor: removingStageId ? "wait" : "pointer",
                                              opacity: removingStageId && removingStageId !== s.stageId ? 0.45 : 1,
                                              padding: "2px 4px",
                                              borderRadius: "0px",
                                              display: "inline-flex",
                                              alignItems: "center",
                                              justifyContent: "center",
                                              flexShrink: 0,
                                              transition: "color 0.15s ease",
                                            }}
                                          >
                                            {removingStageId === s.stageId ? "…" : <Trash2 size={14} />}
                                          </button>
                                        ) : null}
                                      </div>
                                  );
                                })}

                                {extras.map((l) => {
                                  const completeToday = completedExtraLineKeys.has(l.key);
                                  return (
                                  <div key={l.key} style={{ display: "grid", gridTemplateColumns: isMobilityGroup ? "24px minmax(0, 1fr) 88px 80px 20px" : "24px minmax(0, 1fr) 80px 20px", gap: "8px", alignItems: "center", background: completeToday ? "#f3e8ff" : "#f8fafc", padding: "6px 8px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                                    <input
                                      type="checkbox"
                                      checked={completeToday}
                                      onChange={(event) => setCompletedExtraLineKeys((current) => {
                                        const next = new Set(current);
                                        if (event.target.checked) next.add(l.key); else next.delete(l.key);
                                        return next;
                                      })}
                                      aria-label={`Complete ${l.procedure || "extra work"} today`}
                                      title="Mark this extra work as completed today"
                                      style={{ "--checkbox-color": "#7c3aed", width: "16px", height: "16px", cursor: "pointer" } as React.CSSProperties}
                                    />
                                    <div style={{ minWidth: 0 }}>{!l.custom ? (
                                      <select style={{ ...input, width: "100%", height: "39px", padding: "6px 8px", fontSize: "12px", background: "#ffffff", borderRadius: "5px" }} value={procedureCatalog.find((c) => c.name === l.procedure)?.code || "__custom__"} onChange={(e) => onProcedurePick(l.key, e.target.value)}>
                                        {procedureCatalog.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
                                        <option value="__custom__">Custom procedure…</option>
                                      </select>
                                    ) : (
                                      <input style={{ ...input, width: "100%", height: "39px", padding: "6px 8px", fontSize: "12px", background: "#ffffff", borderRadius: "5px" }} placeholder="Extra step (e.g. review)" value={l.procedure} onChange={(e) => setLine(l.key, { procedure: e.target.value })} />
                                    )}</div>
                                    {isMobilityGroup && (
                                      <select
                                        style={{ ...input, width: "100%", height: "39px", padding: "6px 8px", background: "#ffffff", color: "#7c3aed", fontWeight: "var(--fw-bold)", cursor: "pointer" }}
                                        value={l.grade || "1"}
                                        onChange={(e) => {
                                          const g = e.target.value;
                                          const gLabel = g === "1" ? "Grade I" : g === "2" ? "Grade II" : "Grade III";
                                          setLine(l.key, { grade: g, gradeLabel: gLabel });
                                        }}
                                      >
                                        <option value="1">Grade I</option>
                                        <option value="2">Grade II</option>
                                        <option value="3">Grade III</option>
                                      </select>
                                    )}
                                    <input
                                      style={{ ...input, width: "80px", minWidth: "80px", height: "39px", padding: "6px 8px", textAlign: "right", fontSize: "12px", fontWeight: "700", background: "#ffffff", borderRadius: "5px", border: "1px solid #cbd5e1", color: "#0f172a" }}
                                      inputMode="decimal"
                                      placeholder="Cost"
                                      aria-label={`Cost for ${l.procedure || "extra work"}`}
                                      value={formatIndianRupeeInput(l.cost)}
                                      onChange={(event) => {
                                        const target = event.currentTarget;
                                        const caret = target.selectionStart ?? target.value.length;
                                        const logicalCaret = target.value.slice(0, caret).replace(/[^\d.]/g, "").length;
                                        const next = readRupeeText(target);
                                        const groupedNext = formatIndianRupeeInput(next);
                                        target.value = groupedNext;
                                        setLine(l.key, { cost: next });
                                        const nextCaret = caretPositionForGroupedInput(groupedNext, logicalCaret);
                                        target.setSelectionRange(nextCaret, nextCaret);
                                      }}
                                    />
                                    <button type="button" onClick={() => removeLine(l.key)} title="Remove this step" aria-label="Remove this step" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0, flexShrink: 0 }}>
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                  );
                                })}
                              </div>

                              {(onUpdateCase || onSaveWorkTab || onCommitWorkEntry) && (
                                <button
                                  type="button"
                                  onClick={() => onCommitWorkEntry ? addInlineDraftStage(tg.name) : handleOpenAddStageModal(tg.name)}
                                  className="btn btn-primary btn-sm"
                                  style={{ marginTop: "10px", minHeight: "36px", padding: "6px 12px", border: "1px solid #0284c7", background: "#0284c7", color: "#ffffff" }}
                                >
                                  <Plus size={13} /> Add stage
                                </button>
                              )}

                              {/* Root Canal Working Length Trigger Pill */}
                              {recordsCanals && (() => {
                                const toothNum = teeth[0] ?? "";
                                return (
                                  <button
                                    type="button"
                                    onClick={() => openCanalDrawer(toothNum || "16")}
                                    className="btn btn-secondary"
                                    style={{
                                      marginTop: "10px",
                                      marginLeft: "8px",
                                      width: "fit-content",
                                      maxWidth: "100%",
                                      border: "1px solid #d8b4fe",
                                      background: "#ffffff",
                                      color: "#6b21a8",
                                      minHeight: "42px",
                                      padding: "10px 14px",
                                      borderRadius: "0px",
                                      fontSize: "var(--fs-14)",
                                      fontWeight: "var(--fw-bold)",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      gap: "8px",
                                      boxShadow: "0 2px 6px rgba(124, 58, 237, 0.08)",
                                      transition: "all 0.2s ease",
                                      whiteSpace: "normal",
                                    }}
                                  >
                                    <Stethoscope size={16} style={{ color: "#7c3aed" }} />
                                    <span>Canal Length</span>
                                  </button>
                                );
                              })()}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {lines.map((l) => (
                            <div key={l.key} style={{ display: "grid", gridTemplateColumns: "1fr 90px 120px 34px", gap: "8px", alignItems: "center" }}>
                              {!l.custom ? (
                                <select style={input} value={procedureCatalog.find((c) => c.name === l.procedure)?.code || "__custom__"} onChange={(e) => onProcedurePick(l.key, e.target.value)}>
                                  {procedureCatalog.map((c) => (<option key={c.code} value={c.code}>{c.name}</option>))}
                                  <option value="__custom__">✏️ Custom procedure…</option>
                                </select>
                              ) : (
                                <input style={input} placeholder="Procedure name" value={l.procedure} onChange={(e) => setLine(l.key, { procedure: e.target.value })} />
                              )}
                              <input style={{ ...input, textAlign: "center" }} placeholder="Tooth" value={l.tooth} onChange={(e) => setLine(l.key, { tooth: e.target.value })} />
                              <input style={{ ...input, textAlign: "right" }} inputMode="decimal" placeholder="Cost" value={l.cost} onChange={(e) => setLine(l.key, { cost: readRupeeText(e.target) })} />
                              <button type="button" onClick={() => removeLine(l.key)} disabled={lines.length === 1} title="Remove" style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", height: "36px", border: "1px solid #fecaca", borderRadius: "8px", background: "#fef2f2", color: "#dc2626", cursor: lines.length === 1 ? "not-allowed" : "pointer" }}>
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                        <button type="button" onClick={() => addLine()} className="btn btn-secondary btn-sm" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          <Plus size={14} /> Add Another Procedure
                        </button>
                      </>
                    )}
                  </div>

                  <div className={styles.clinicalNoteSection}>
                    <label className={styles.clinicalNoteLabel} htmlFor="work-entry-clinical-note">Clinical Note</label>
                    <textarea
                      id="work-entry-clinical-note"
                      className={styles.clinicalNoteInput}
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Findings, materials used, patient feedback, next steps…"
                    />
                  </div>
                </section>
              )}

              {/* STEP 3 — TOOTH CHART */}
              {effStep === 3 && existing && (
                <section style={fixedPatientFlow ? workflowPage : card}>
                  <StepNav top onBack={() => goToStep(2)} onNext={() => goToStep(4, true)} nextLabel="Perio Chart" />
                  <h3 style={sectionTitle}>
                    <StepDot n={3} /> <Activity size={16} style={{ color: "#7c3aed" }} /> Chairside Tooth Chart
                  </h3>
                  <p style={{ fontSize: "var(--fs-13)", color: "#64748b", margin: "0 0 16px" }}>
                    Click any tooth number on the arch to chart conditions or procedures performed today.
                  </p>
                  <ChairsideChart
                    toothHistory={toothHistory}
                    onSave={(tooth, entry) => onSaveChartEntry(existing.id, tooth, { ...entry, dateISO, doctor })}
                    onError={setSaveError}
                    onVoidEntry={(entry) => onVoidEntry?.(existing.id, entry)}
                  />
                </section>
              )}

              {/* STEP 4 — PERIODONTAL CHART */}
              {effStep === 4 && (
                <section style={fixedPatientFlow ? continuationStepFrame : card}>
                  {!fixedPatientFlow && (
                    <StepNav
                      top
                      onBack={() => goToStep(2)}
                      onSave={onSavePerioTab ? () => void savePerioTab() : undefined}
                      saveLabel="Save perio chart"
                      saveDisabled={!perioTeeth}
                      saving={saving}
                      onNext={() => goToStep(5, true)}
                      nextLabel="Imaging, Rx &amp; Lab"
                    />
                  )}
                  <h3 style={sectionTitle}>
                    <StepDot n={3} /> <Activity size={16} style={{ color: "#7c3aed" }} /> Periodontal Charting
                  </h3>
                  <p style={{ fontSize: "var(--fs-13)", color: "#64748b", margin: "0 0 16px" }}>
                    Record periodontal probing depths (DB, B, MB, DL, L, ML), bleeding points, and mobility.
                  </p>
                  <PeriodontalChart initialPerioData={initialPerio} onChange={onPerioChange} />
                </section>
              )}

              {/* STEP 5 — IMAGING, RX & LAB */}
              {effStep === 5 && (
                <section style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {!fixedPatientFlow && (
                    <StepNav
                      top
                      onBack={() => goToStep(4)}
                      onNext={() => goToStep(6, true)}
                      nextLabel={paymentCollectionEnabled ? "Payment" : "Follow-up"}
                    />
                  )}

                  {/* Radiographs and prescriptions share one balanced row; lab requirements are omitted from this step. */}
                  <div
                    data-work-entry-imaging-layout
                    style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "14px", alignItems: "start" }}
                  >
                    <div data-work-entry-radiographs style={{ ...card, padding: "16px", minWidth: 0 }}>
                      <RadiographUploader
                        drafts={xrayDrafts}
                        setDrafts={setXrayDrafts}
                        patientId={existing?.id}
                        chiefComplaintId={initialChiefComplaintId}
                        defaultType="IOPA"
                        dateLabel={formatDateShort(dateISO)}
                        capturedOn={dateISO}
                        onUploaded={onMediaChanged}
                        onError={setSaveError}
                        savedUploads={savedRadiographUploads}
                        onUploadCompleted={(upload) => setSavedRadiographUploads((current) => current.some((item) => item.mediaAssetId === upload.mediaAssetId) ? current : [...current, upload])}
                      />
                    </div>
                    <div data-work-entry-prescription style={{ ...card, padding: "16px", minWidth: 0 }}>
                      <NewPatientStylePrescription drugs={prescriptions} onChange={setPrescriptions} onDraftDirtyChange={setPrescriptionDraftDirty} />
                    </div>
                  </div>
                </section>
              )}

              {/* STEP 6 — ADMIN PAYMENT */}
              {paymentStep !== null && effStep === paymentStep && (
                <section style={fixedPatientFlow ? continuationStepFrame : card}>
                  <h3 style={sectionTitle}><StepDot n={5} /> <Wallet size={16} style={{ color: "#15803d" }} /> Payment</h3>
                  <p style={{ margin: "0 0 16px", color: "#64748b", fontSize: "var(--fs-13)" }}>Record an optional payment or discount for this visit before scheduling the next recall.</p>
                  <WorkEntryPaymentPanel
                    idPrefix="continued-case-payment"
                    todayCharges={charges}
                    previousDue={currentOutstandingDue}
                    outstandingDue={workEntryOutstandingDue}
                    paidToday={paidToday}
                    discount={discountInput}
                    paymentMethod={paymentMethod}
                    onPaidTodayChange={setPaidToday}
                    onDiscountChange={setDiscountInput}
                    onPaymentMethodChange={setPaymentMethod}
                  />
                </section>
              )}

              {/* SHARED RECALL — every role reaches this after optional Admin payment. */}
              {effStep === recallStep && (
                <section style={fixedPatientFlow ? continuationStepFrame : { ...card, border: "none", boxShadow: "none" }} onKeyDown={advanceOnEnter} onFocusCapture={handleFormKeyboardFocus} onPointerDownCapture={handleFormKeyboardPointerDown}>
                  {!fixedPatientFlow && (
                    <StepNav
                      top
                      onBack={() => goToStep(paymentCollectionEnabled ? 6 : 5)}
                      onSave={onSaveRecallTab ? () => void saveRecallTab() : undefined}
                      saveLabel="Save recall"
                      saving={saving}
                    />
                  )}
                  <h3 style={sectionTitle}>
                    <StepDot n={paymentCollectionEnabled ? 6 : 5} /> <BellRing size={16} style={{ color: "#7c3aed" }} /> Follow-up
                  </h3>
                  <DoctorRecallWorkspace
                    idPrefix="continued-case-recall"
                    date={fuDate}
                    time={fuTime}
                    reason={fuReason}
                    reasonOptions={recallOptions}
                    noFollowUpNeeded={noFollowUpNeeded}
                    onDateChange={setFuDate}
                    onTimeChange={setFuTime}
                    onReasonChange={(value) => { fuEdited.current = true; setFuReason(value); }}
                    onNoFollowUpChange={(checked) => { setNoFollowUpNeeded(checked); if (checked) { setFuDate(""); setFuTime(""); setFuReason(""); fuEdited.current = false; } }}
                    closeCase={closeCase}
                    onCloseCaseChange={onCommitWorkEntry ? setCloseCase : undefined}
                    upcoming={upcomingFollowUps}
                  />{false && <div className="workEntryRecallGrid" style={{ display: "grid", gap: "16px" }}>
                    {paymentCollectionEnabled ? <WorkEntryPaymentPanel
                      idPrefix="continued-case-payment"
                      todayCharges={charges}
                      previousDue={currentOutstandingDue}
                      outstandingDue={workEntryOutstandingDue}
                      paidToday={paidToday}
                      discount={discountInput}
                      paymentMethod={paymentMethod}
                      onPaidTodayChange={setPaidToday}
                      onDiscountChange={setDiscountInput}
                      onPaymentMethodChange={setPaymentMethod}
                    /> : null}
                    <div style={{ padding: "16px", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: "16px", alignContent: "start", background: "#f8fafc", border: "1px solid #cbd5e1", borderTop: "4px solid #64748b" }}>
                    <div style={{ gridColumn: "1 / -1", color: "#1e293b", fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)" }}>Follow-up</div>
                    <div style={{ gridColumn: "1 / -1", order: 3 }}>
                      <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "11px 12px", borderRadius: "9px", background: noFollowUpNeeded ? "#dcfce7" : "#f0fdf4", border: `1px solid ${noFollowUpNeeded ? "#22c55e" : "#86efac"}`, boxShadow: noFollowUpNeeded ? "0 0 0 2px rgba(34, 197, 94, 0.12)" : "none", cursor: "pointer" }}>
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
                    </div>
                    {onCommitWorkEntry ? <label style={{ gridColumn: "1 / -1", order: 4, display: "flex", alignItems: "flex-start", gap: "10px", padding: "12px 14px", border: `1px solid ${closeCase ? "#f59e0b" : "#cbd5e1"}`, background: closeCase ? "#fffbeb" : "#f8fafc", cursor: "pointer" }}>
                      <input type="checkbox" checked={closeCase} onChange={(event) => setCloseCase(event.target.checked)} style={{ "--checkbox-color": "#d97706", marginTop: "2px" } as React.CSSProperties} />
                      <span><strong style={{ display: "block", color: "#92400e", fontSize: "var(--fs-13)" }}>Close the case</strong><span style={{ color: "#78716c", fontSize: "var(--fs-12)" }}>Pending treatment stages remain in history and can be resumed only after reopening the case.</span></span>
                    </label> : null}
                    <div style={{ gridColumn: "1 / -1" }}>
                      <label style={label}><BellRing size={12} style={{ display: "inline", marginRight: "4px" }} /> Follow-up Date &amp; Time</label>
                      <div className="workEntryFollowUpDateTime" style={{ display: "grid", gridTemplateColumns: "minmax(150px, 190px) minmax(0, 1fr)", gap: "10px" }}>
                        <DatePicker
                          id="work-follow-up-date"
                          value={fuDate}
                          onChange={setFuDate}
                          onComplete={() => requestAnimationFrame(() => document.getElementById("work-follow-up-time")?.focus())}
                          fluid
                          disabled={noFollowUpNeeded}
                        />
                        <TimePicker
                          id="work-follow-up-time"
                          value={fuTime}
                          onChange={setFuTime}
                          fluid
                          disabled={noFollowUpNeeded}
                        />
                      </div>
                    </div>
                    <ReasonPicker
                      id="work-follow-up-reason"
                      label="Follow-up Reason"
                      value={fuReason}
                      onChange={(v) => { fuEdited.current = true; setFuReason(v); }}
                      options={recallOptions}
                      placeholder="e.g. Crown fitting, suture removal"
                      disabled={noFollowUpNeeded}
                    />
                    </div>
                  </div>}
                </section>
              )}

              {/* STEP 7 — REVIEW & BILL */}
              {effStep === reviewStep && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <section style={fixedPatientFlow ? workflowPage : { ...card, padding: "20px", border: "none", boxShadow: "none" }}>
                    {(() => {
                      const patientMeta = existing
                        ? [existing.patientNumber, `${existing.age} yrs`, existing.sex === "M" ? "Male" : "Female", existing.phone]
                            .filter(Boolean).join(" · ")
                        : "";

                      const doneList = lines
                        .filter((l) => l.procedure.trim())
                        .map((l) => ({ label: l.procedure.trim(), tooth: l.tooth.trim(), cost: rupeeAmount(l.cost) }));

                      const perioRows: PerioRow[] = perioTeeth
                        ? Object.values(perioTeeth).map((t) => ({
                            tooth: t.tooth,
                            pd: [t.probingDepths.db, t.probingDepths.b, t.probingDepths.mb, t.probingDepths.dl, t.probingDepths.l, t.probingDepths.ml],
                            bop: Object.values(t.bop).filter(Boolean).length,
                            mobility: t.mobility,
                          }))
                        : [];

                      return (
                        <WorkReviewSheet
                          patientName={patientName}
                          patientMeta={patientMeta}
                          alerts={patientAlerts}
                          doctor={doctor}
                          visitDate={formatDateShort(dateISO)}
                          chiefComplaint={reviewChiefComplaint}
                          doneToday={doneList}
                          nextVisit={fuDate ? { date: formatDateShort(fuDate), reason: fuReason.trim() } : null}
                          caseStatus={onCommitWorkEntry && closeCase ? "Closed after this visit" : undefined}
                          perio={perioRows}
                          prescriptions={prescriptions.filter((d) => d.medicine.trim())}
                          labOrders={fixedPatientFlow ? [] : labOrders}
                          patientAlerts={patientAlerts}
                          money={{ todayCharges: charges, discount: discount > 0 ? discount : undefined, previousDue: priorBalance, paid, balance: newBalance }}
                        />
                      );
                    })()}

                    {/* A saved encounter ends in the same focused Finish flow as a new case. */}
                    {!fixedPatientFlow && <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                        <button
                          type="button"
                          onClick={saved ? onFinish : () => void (onCommitWorkEntry ? commitWorkEntry() : submit())}
                          disabled={!saved && (onCommitWorkEntry ? saving : (!canSave || saving))}
                          className="btn btn-primary btn-tall"
                          style={{ minWidth: "132px", fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)" }}
                        >
                          <Check size={16} /> {saved ? "Finish" : saving ? "Saving…" : onCommitWorkEntry ? "Commit Work Entry" : "Confirm & Save Encounter"}
                        </button>
                      </div>
                    </div>}
                  </section>
                </div>
              )}
            </>
          )}
        </div>

      {showPaymentHistory && existing && (
        <Modal title={<><Wallet size={18} style={{ color: "#7c3aed" }} /> Payment History — {existing.name}</>} onClose={() => setShowPaymentHistory(false)} maxWidth={820}>
          <ModalBody>
            <div style={{ marginBottom: "14px", padding: "12px 14px", border: "1px solid #fed7aa", background: "#fff7ed", borderRadius: "0px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: "var(--fw-bold)", color: "#9a3412" }}>Current outstanding balance</span>
              <span style={{ fontSize: "var(--fs-18)", fontWeight: "var(--fw-bold)", color: "#c2410c", fontVariantNumeric: "tabular-nums" }}>{formatNpr(previousDue)}</span>
            </div>
            {patientLedger.length === 0 ? (
              <p style={{ margin: 0, padding: "20px 4px", color: "#64748b" }}>No billing or payment history for this patient yet.</p>
            ) : (
              <div style={{ border: "1px solid #cddbe7" }}>
                <TableWrap><Table minWidth={700}>
                  <thead><Tr><Th>Date</Th><Th>Type</Th><Th>For / note</Th><Th>Method</Th><Th align="right">Amount</Th></Tr></thead>
                  <tbody>{patientLedger.map((entry) => {
                    const payment = entry.type === "payment";
                    return <Tr key={entry.id}><Td>{formatDateShort(entry.date)}</Td><Td style={{ fontWeight: 550, color: payment ? "#16a34a" : entry.type === "adjustment" ? "#d97706" : "#334155" }}>{entry.type === "payment" ? "Payment" : entry.type === "adjustment" ? "Adjustment" : "Charge"}</Td><Td>{entry.note || "—"}</Td><Td>{entry.method || "—"}</Td><Td align="right" style={{ fontWeight: 550, color: payment ? "#16a34a" : "#1e293b", fontVariantNumeric: "tabular-nums" }}>{payment ? "−" : "+"}{formatNpr(entry.amount)}</Td></Tr>;
                  })}</tbody>
                </Table></TableWrap>
              </div>
            )}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px" }}><button type="button" className="btn btn-secondary" onClick={() => setShowPaymentHistory(false)}>Close</button></div>
          </ModalBody>
        </Modal>
      )}

      <CanalDrawer
        isOpen={canalDrawerOpen}
        onClose={() => setCanalDrawerOpen(false)}
        tooth={activeCanalTooth}
        initialData={canalDataMap[activeCanalTooth] || existing?.canalHistory?.find((c) => c.tooth === activeCanalTooth)}
        onSave={handleSaveCanalData}
      />

      {showDoctorRequired && !fixedPatientFlow && (
        <ConfirmDialog
          title="Select the attending doctor"
          body={
            <div>
              <p style={{ margin: "0 0 12px" }}>Every saved encounter must identify the doctor responsible for the clinical work.</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {doctorsList.map((name) => {
                  const selected = selectedDoctors.includes(name);
                  return (
                    <label key={name} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 9px", border: `1px solid ${selected ? "#7c3aed" : "#cbd5e1"}`, background: selected ? "#f3e8ff" : "#fff", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => setSelectedDoctors((current) => selected ? current.filter((doctorName) => doctorName !== name) : [...current, name])}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
              {doctorsList.length === 0 && <p style={{ margin: "12px 0 0", color: "#b91c1c" }}>Add an active doctor in Staff before saving a clinical encounter.</p>}
            </div>
          }
          confirmLabel="Save encounter"
          confirmDisabled={selectedDoctors.length === 0}
          busy={saving}
          onConfirm={() => {
            setShowDoctorRequired(false);
            void submit();
          }}
          onCancel={() => setShowDoctorRequired(false)}
        />
      )}

      {showSaveSuccess && (
        <ConfirmDialog
          title="Encounter saved successfully"
          body="This visit has been added to the patient record, clinical timeline, and financial ledger."
          confirmLabel="Finish"
          showCancel={false}
          largeActions
          onConfirm={() => {
            setShowSaveSuccess(false);
            onFinish();
          }}
          onCancel={() => {
            setShowSaveSuccess(false);
            onFinish();
          }}
        />
      )}

      {groupPendingDelete && (
        <ConfirmDialog
          title="Delete treatment plan?"
          body={<>Remove <strong>{groupPendingDelete}</strong> and its stages from this patient&apos;s active treatment plan?</>}
          confirmLabel="Delete plan"
          destructive
          onConfirm={() => {
            const group = groupPendingDelete;
            setGroupPendingDelete(null);
            void handleDeleteGroup(group);
          }}
          onCancel={() => setGroupPendingDelete(null)}
        />
      )}

      {/* Modal: Add Treatment Plan inside Work Entry */}
      <AddTreatmentPlanModal
        open={showAddPlanModal}
        protocols={protocols?.length ? protocols : defaultProtocols}
        feeSchedule={feeSchedule?.length ? feeSchedule : defaultFeeSchedule}
        onClose={() => setShowAddPlanModal(false)}
        onSubmit={handleSharedTreatmentPlan}
      />
      {/* Modal: Edit Treatment Plan inside Work Entry */}
      {editingGroupKey && (
        <Modal title={<><Pencil size={18} style={{ color: "#7c3aed" }} /> Edit Treatment Plan</>} onClose={() => setEditingGroupKey(null)} maxWidth={580}>
          <ModalBody as="form" onSubmit={(e) => { e.preventDefault(); handleSaveEditGroup(); }}>
            {/* Mobility Grade Progression Selector */}
            {/mobility/i.test(editTitle) && (() => {
              const mobProto = defaultProtocols.find((p) => p.id === "PROTO-MOBILITY");
              const gradesList = mobProto?.grades || [
                { id: "1", label: "Grade I", stages: mobProto?.stages || [] },
                { id: "2", label: "Grade II", stages: mobProto?.stages || [] },
                { id: "3", label: "Grade III", stages: mobProto?.stages || [] },
              ];
              return (
                <div style={{ marginBottom: "14px", background: "#fcf5ff", padding: "10px 12px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
                  <label style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#7c3aed", display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                    <Sparkles size={14} /> Select Mobility Grade
                  </label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    {gradesList.map((gradeItem) => {
                      const isGradeI = gradeItem.label === "Grade I" && /\bGrade\s*I\b/i.test(editTitle);
                      const isGradeII = gradeItem.label === "Grade II" && /\bGrade\s*II\b/i.test(editTitle);
                      const isGradeIII = gradeItem.label === "Grade III" && /\bGrade\s*III\b/i.test(editTitle);
                      const active = isGradeI || isGradeII || isGradeIII;

                      return (
                        <button
                          key={gradeItem.id}
                          type="button"
                          onClick={() => {
                            const tMatch = editTitle.match(/·\s*(\d+)/);
                            const toothStr = tMatch ? tMatch[1] : (editSteps[0]?.tooth || "21");
                            setEditTitle(`Mobility (${gradeItem.label}) · ${toothStr}`);
                            setEditSteps((prev) => {
                              const completedSteps = prev.filter((s) => s.status === "done");
                              const completedForThisGrade = new Set(
                                completedSteps
                                  .filter((s) => (s.gradeLabel || `Grade ${s.grade}`) === gradeItem.label)
                                  .map((s) => s.label.toLowerCase().trim())
                              );

                              const gradeSteps = gradeItem.stages.map((stg, i) => ({
                                order: completedSteps.length + 1 + i,
                                label: stg.label,
                                tooth: toothStr,
                                agreedCost: stg.defaultCost || priceOf(defaultFeeSchedule, stg.procedureCode) || 500,
                                status: "pending" as const,
                                grade: gradeItem.id,
                                gradeLabel: gradeItem.label,
                              }));

                              const pendingGradeSteps = gradeSteps.filter(
                                (stg) => !completedForThisGrade.has(stg.label.toLowerCase().trim())
                              );

                              return [...completedSteps, ...pendingGradeSteps];
                            });
                          }}
                          style={{
                            flex: 1,
                            padding: "7px 10px",
                            borderRadius: "8px",
                            fontSize: "var(--fs-12)",
                            fontWeight: "var(--fw-bold)",
                            border: active ? "1.5px solid #7c3aed" : "1px solid #cbd5e1",
                            background: active ? "#7c3aed" : "#ffffff",
                            color: active ? "#ffffff" : "#475569",
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {gradeItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <Field label="Treatment Plan Title *">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </Field>

            <div style={{ marginTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#1e293b", margin: 0 }}>
                  Procedure Steps ({editSteps.length})
                </label>
                <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#7c3aed" }}>
                  Total Quote: {formatNpr(editTotalCost)}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "240px", overflowY: "auto", paddingRight: "4px" }}>
                {editSteps.map((step, sIdx) => (
                  <div key={sIdx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 32px", gap: "8px", alignItems: "center", background: "#f8fafc", padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <Input
                      placeholder="Step Procedure Label"
                      value={step.label}
                      onChange={(e) => {
                        const next = [...editSteps];
                        next[sIdx].label = e.target.value;
                        setEditSteps(next);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Cost (NPR)"
                      value={step.agreedCost || ""}
                      onChange={(e) => {
                        const next = [...editSteps];
                        next[sIdx].agreedCost = Number(e.target.value) || 0;
                        setEditSteps(next);
                      }}
                    />
                    <button
                      type="button"
                      disabled={editSteps.length <= 1}
                      onClick={() => setEditSteps(editSteps.filter((_, i) => i !== sIdx))}
                      style={{ background: "none", border: "none", color: editSteps.length <= 1 ? "#cbd5e1" : "#dc2626", cursor: editSteps.length <= 1 ? "not-allowed" : "pointer", display: "flex" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setEditSteps([...editSteps, { order: 0, label: "", tooth: "", agreedCost: 500, status: "pending" }])}
                className="btn btn-secondary"
                style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <Plus size={13} /> Add Procedure Step
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button type="button" onClick={() => setEditingGroupKey(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Check size={14} /> Save Changes ({formatNpr(editTotalCost)})
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Modal: Add Procedure Stage / Extra Work */}
      {showAddStageModal && (
        <Modal
          title={<><Plus size={18} style={{ color: "#7c3aed" }} /> Add Procedure Stage</>}
          onClose={() => setShowAddStageModal(false)}
          maxWidth={520}
        >
          <ModalBody as="form" onSubmit={(e) => { e.preventDefault(); handleConfirmAddStage(); }}>
            {/* Header Banner */}
            <div style={{ marginBottom: "14px", background: "#f8fafc", padding: "10px 14px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Adding Stage To:
              </div>
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#1e293b", marginTop: "2px" }}>
                {addStageGroupKey.replace(/\s*\(\s*Grade\s*(?:I{1,3}|V?I{0,3}|\d+)\s*\)/gi, "")}
              </div>
            </div>

            {/* Mobility Grade Selection ABOVE the stage rows */}
            {/mobility/i.test(addStageGroupKey) && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#475569", display: "block", marginBottom: "6px" }}>
                  Mobility Grade
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[
                    { id: "1", label: "Grade I" },
                    { id: "2", label: "Grade II" },
                    { id: "3", label: "Grade III" },
                  ].map((g) => {
                    const active = addStageGrade === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setAddStageGrade(g.id)}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          border: active ? "1.5px solid #7c3aed" : "1px solid #cbd5e1",
                          background: active ? "#7c3aed" : "#ffffff",
                          color: active ? "#ffffff" : "#475569",
                          boxShadow: active ? "0 2px 6px rgba(124, 58, 237, 0.2)" : "none",
                          transition: "all 0.15s ease",
                          textAlign: "center",
                        }}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Multi-Stage Rows List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {addStageRows.map((r, index) => (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 36px",
                    gap: "8px",
                    alignItems: "center",
                    background: "#f8fafc",
                    padding: "8px 10px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    {index === 0 && (
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "3px" }}>
                        Stage Name *
                      </label>
                    )}
                    <input
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px" }}
                      placeholder="e.g. Suture removal, Healing review"
                      value={r.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddStageRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, label: val } : item)));
                      }}
                      required={index === 0}
                      autoFocus={index === 0}
                    />
                  </div>

                  <div>
                    {index === 0 && (
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block", marginBottom: "3px" }}>
                        Price (NPR) *
                      </label>
                    )}
                    <input
                      style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "13px", textAlign: "right" }}
                      type="number"
                      placeholder="500"
                      value={r.cost}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddStageRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, cost: val } : item)));
                      }}
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (addStageRows.length > 1) {
                        setAddStageRows((prev) => prev.filter((item) => item.id !== r.id));
                      }
                    }}
                    disabled={addStageRows.length <= 1}
                    title="Remove stage row"
                    style={{
                      marginTop: index === 0 ? "17px" : "0",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "34px",
                      border: "1px solid #fecaca",
                      borderRadius: "8px",
                      background: addStageRows.length <= 1 ? "#f1f5f9" : "#fef2f2",
                      color: addStageRows.length <= 1 ? "#cbd5e1" : "#dc2626",
                      cursor: addStageRows.length <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setAddStageRows((prev) => [
                    ...prev,
                    { id: `${Date.now()}-${prev.length}`, label: "", cost: 500 },
                  ])
                }
                className="btn btn-secondary"
                style={{ marginTop: "4px", minWidth: "148px", minHeight: "36px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "var(--fs-13)", color: "#6d28d9", borderColor: "#ddd6fe", background: "#fcf8ff" }}
              >
                <Plus size={13} /> Add Stage
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button type="button" onClick={() => setShowAddStageModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={!addStageRows.some((r) => r.label.trim())} className="btn btn-primary">
                <Check size={14} /> Add ({addStageRows.filter((r) => r.label.trim()).length || 1} Stage{addStageRows.filter((r) => r.label.trim()).length > 1 ? "s" : ""})
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}
      {saveError && (
        <ConfirmDialog
          title="Something needs attention"
          body={<span role="alert">{saveError}</span>}
          confirmLabel="OK"
          showCancel={false}
          centered
          onConfirm={() => setSaveError("")}
          onCancel={() => setSaveError("")}
        />
      )}
    </div>
  );
}

function StepDot({ n }: { n: number }) {
  return <span style={stepBadge}>{n}</span>;
}

function StepNav({
  onBack,
  backLabel = "Back",
  onNext,
  nextLabel,
  nextDisabled,
  onSave,
  saveLabel = "Save",
  saveDisabled,
  saving,
  top,
}: {
  onBack?: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  onSave?: () => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  saving?: boolean;
  top?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "10px",
        marginTop: top ? 0 : "18px",
        marginBottom: top ? "16px" : 0,
        paddingBottom: top ? "14px" : 0,
        borderBottom: top ? "1px solid #e2e8f0" : "none",
      }}
    >
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="btn btn-secondary"
        >
          <ArrowLeft size={14} /> {backLabel}
        </button>
      ) : (
        <span />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saveDisabled || saving}
            className="btn btn-primary"
          >
            {saving ? "Saving…" : saveLabel}
          </button>
        )}
        {onNext && (
          <button
            type="button"
            onClick={onNext}
            disabled={nextDisabled || saving}
            data-wizard-next
            className="btn btn-primary"
          >
            {nextLabel || "Next"} <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
