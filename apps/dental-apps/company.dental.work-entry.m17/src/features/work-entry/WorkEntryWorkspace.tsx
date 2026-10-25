"use client";

import { staffApi } from "@/features/staff/api";
import { treatmentProtocolsApi } from "@/features/treatment-protocols/api";
import { patientsApi } from "@/features/patients/api";
import { patientMediaApi } from "@/features/patients/media/api";
import { patientBillingApi } from "@/features/patients/billing/api";
import { workEntryApi } from "@/features/work-entry/api";
import { clinicalChartsApi } from "@/features/work-entry/charts/api";
import { suppliersApi } from "@/features/finance/suppliers/api";
import { followUpsApi } from "@/features/follow-ups/api";

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { TreatmentProtocol } from "@/shell/session/types";
import type { AllergySeverity, FollowUpWorklistItem, OdontogramMark, PatientCanalMeasurement, PatientCore, PatientIntakeInput, PatientLedger, PatientPlanSelectionInput, PatientSummary, WorkEntryCase, WorkEntryCaseRow, PeriodontalTooth } from "@/features/patients/types";
import type { StaffReference } from "@/features/staff/types";
import type { ClinicSupplier } from "@/features/finance/suppliers/types";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { ClinicDataTable } from "@/shared/ui/ClinicDataTable";
import { CaseStatusUpdateModal, type CaseStatusValue } from "@/features/work-entry/CaseStatusUpdateModal";
import { useClinicLoading, useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { ClinicPageRefreshAction, useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import { useWorkEntryNavigationBlocker } from "@/shell/navigation/ClinicNavigationGuard";
import CaseEntryView from "@/features/work-entry/components/CaseEntryView";
import { InProgressWorkEntry } from "./InProgressWorkEntry";
import type { ChartMark } from "@/features/work-entry/components/ScreeningChart";
import type { ToothPerioData } from "@/features/work-entry/model/chartData";
import type { CanalChartData } from "@/features/work-entry/model/canalData";
import { defaultFeeSchedule, type CaseEntryData, type TreatmentProtocol as CareTreatmentProtocol } from "@/features/work-entry/model/caseData";
import type { ClinicProfile, LabSupplier, PatientDetail } from "@/features/patients/model/domain";
import styles from "./WorkEntryWorkspace.module.css";
import { StandardPageScroll } from "@/shared/ui/StandardPageScroll";
import { useClinicRouteState } from "@/shell/routing/useClinicRouteState";
import { inProgressStepForTab, startCaseStepForTab, tabForInProgressStep, tabForStartCaseStep } from "./workEntryRouteState";

type NewCaseDraft = { patient: PatientSummary | null; complaint: string };

const today = () => new Date().toISOString().slice(0, 10);

function ageFromDateOfBirth(dateOfBirth: string | null) {
  if (!dateOfBirth) return 0;
  const birth = new Date(`${dateOfBirth}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return Math.max(0, age);
}

function chartMarksFromApi(marks: OdontogramMark[]): Record<string, ChartMark> {
  return Object.fromEntries(marks.map((mark) => [mark.toothCode, { slot: mark.slot, value: mark.value } as ChartMark]));
}

function perioFromApi(teeth: PeriodontalTooth[]): Record<string, ToothPerioData> {
  return Object.fromEntries(teeth.map((tooth) => [tooth.toothCode, { tooth: tooth.toothCode, probingDepths: tooth.probingDepths, recession: tooth.recession, bop: tooth.bleedingOnProbing, mobility: tooth.mobilityGrade }]));
}

function perioForApi(teeth: Record<string, ToothPerioData>): PeriodontalTooth[] {
  return Object.values(teeth).map((tooth) => ({ toothCode: tooth.tooth, probingDepths: tooth.probingDepths, recession: tooth.recession, bleedingOnProbing: tooth.bop, mobilityGrade: tooth.mobility }));
}

function canalDataFromApi(sessions: PatientCanalMeasurement[], doctors: StaffReference[]): Record<string, CanalChartData> {
  return Object.fromEntries(sessions.filter((session) => session.toothCode).map((session) => [session.toothCode as string, {
    tooth: session.toothCode as string,
    treatmentId: session.patientProtocolId,
    date: session.recordedOn,
    doctor: session.recordedByStaffId ? doctors.find((doctor) => doctor.staffId === session.recordedByStaffId)?.fullName : undefined,
    medicament: session.note ?? undefined,
    obturationMaterial: session.obturationMaterial ?? undefined,
    canals: session.records.map((record) => ({ canal: record.canalLabel, lengthMm: String(record.workingLengthMm), note: record.fileNumber ?? "", referencePoint: record.reference ?? "", date: session.recordedOn })),
  }]));
}

async function patientOdontogramOrEmpty(idToken: string, patientId: string): Promise<OdontogramMark[]> {
  try {
    return await clinicalChartsApi.patientOdontogram(idToken, patientId);
  } catch (cause) {
    // An unavailable chart route is surfaced to the clinician; do not silently
    // turn a transport or authorization failure into an empty clinical record.
    throw cause;
  }
}

function legacyLab(supplier: ClinicSupplier): LabSupplier {
  return {
    id: supplier.supplierId,
    name: supplier.name,
    contactPerson: supplier.contactPerson ?? "",
    phone: supplier.phone ?? "",
    email: supplier.email ?? "",
    address: supplier.address ?? "",
    active: supplier.active,
    openingBalance: supplier.openingBalanceAmount,
    openingAsOf: supplier.openingBalanceAsOf,
    currentDueAmount: supplier.currentDueAmount,
    isLab: true,
  };
}

function legacyPatient(core: PatientCore, outstandingDue = 0): PatientDetail {
  // Work Entry can be opened while a Worker rollout is in progress. Treat
  // optional patient-care child records as optional at this UI boundary so a
  // missing medical profile or allergy list cannot take down the case form.
  const medicalProfile = core.medicalProfile ?? {
    conditionsSummary: null,
    currentMedicationsSummary: null,
    habitsSummary: null,
    medicalNotes: null,
    verifiedOn: null,
    rowVersion: 0,
  };
  const allergies = Array.isArray(core.allergies) ? core.allergies : [];
  const conditions = medicalProfile.conditionsSummary?.trim();
  return {
    id: core.patientId,
    patientNumber: core.patientNumber,
    createdAt: `${core.registeredOn}T00:00:00.000Z`,
    name: core.fullName,
    age: core.ageYears ?? ageFromDateOfBirth(core.dateOfBirth),
    sex: core.sex === "female" ? "F" : "M",
    language: "",
    alerts: [
      ...allergies.filter((allergy) => allergy.status === "active").map((allergy) => `${allergy.allergen} allergy`),
      ...(conditions ? [conditions] : []),
    ],
    balance: outstandingDue,
    planTitle: "",
    planDone: 0,
    planTotal: 0,
    teeth: [],
    visits: [],
    notes: "",
    phone: core.phone ?? undefined,
    address: core.address ?? undefined,
    emergencyContact: core.emergencyContactName ? {
      name: core.emergencyContactName,
      relation: "",
      phone: core.emergencyContactPhone ?? "",
    } : undefined,
  };
}

function normalisePatientCore(core: PatientCore): PatientCore {
  const medicalProfile = core.medicalProfile ?? {
    conditionsSummary: null,
    currentMedicationsSummary: null,
    habitsSummary: null,
    medicalNotes: null,
    verifiedOn: null,
    rowVersion: 0,
  };
  return {
    ...core,
    medicalProfile,
    allergies: Array.isArray(core.allergies) ? core.allergies : [],
  };
}

function normaliseWorkEntryCase(caseItem: WorkEntryCase): WorkEntryCase {
  return {
    ...caseItem,
    caseDoctorStaffIds: Array.isArray(caseItem.caseDoctorStaffIds)
      ? caseItem.caseDoctorStaffIds.filter((staffId): staffId is string => typeof staffId === "string")
      : [],
    protocols: Array.isArray(caseItem.protocols)
      ? caseItem.protocols.map((protocol) => ({
          ...protocol,
          stages: Array.isArray(protocol.stages) ? protocol.stages : [],
        }))
      : [],
  };
}

function toCareProtocol(protocol: TreatmentProtocol): CareTreatmentProtocol {
  const toothScope = protocol.toothScope === "full_mouth" ? "full-mouth" : protocol.toothScope;
  return {
    id: protocol.protocolId,
    starterTemplateCode: protocol.starterTemplateCode,
    name: protocol.name,
    category: protocol.category,
    recordCanals: protocol.recordsCanalMeasurements,
    stages: protocol.stages
      .filter((stage) => stage.active)
      .sort((left, right) => left.stageOrder - right.stageOrder)
      .map((stage) => ({
        order: stage.stageOrder,
        label: stage.stageName,
        procedureCode: stage.protocolStageId,
        sourceProtocolStageId: stage.protocolStageId,
        toothScope,
        recallIntervalDays: 0,
        defaultCost: stage.price,
      })),
  };
}

const workEntryClinic: ClinicProfile = {
  id: "work-entry",
  name: "Clinic workspace",
  address: "",
  phone: "",
  adminEmail: "",
  active: true,
  createdAt: "",
};

function displayStatus(status: "open" | "in_progress" | "complete" | "completed" | "closed" | undefined) {
  if (status === "in_progress") return "In progress";
  if (status === "completed" || status === "complete") return "Complete";
  if (!status) return "Open";
  return status[0].toUpperCase() + status.slice(1);
}

async function readWithBrokerCapacityRetry<T>(read: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await read();
    } catch (cause) {
      const capacityRejected = !!cause && typeof cause === "object" && "code" in cause
        && (cause as { code?: unknown }).code === "BUSY";
      if (!capacityRejected || attempt >= 2) throw cause;
      // A BUSY result is rejected before dispatch. These calls are GETs, so a
      // short bounded retry is safe while a batch keeps below the broker cap.
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}

function worklistStatusFor(caseItem: WorkEntryCaseRow["cases"][number]) {
  // Staging can briefly serve a previous Worker version during a frontend
  // rollout. Keep the worklist usable until its response includes the new
  // protocol count and derived worklist status.
  return caseItem.worklistStatus ?? (caseItem.status === "open" ? "open" : "complete");
}

function planFor(protocol: TreatmentProtocol, location: string): PatientPlanSelectionInput {
  return {
    sourceProtocolId: protocol.protocolId,
    toothCode: protocol.toothScope === "tooth" ? location.trim() || null : null,
    treatmentArea: protocol.toothScope === "tooth" ? null : location.trim() || null,
    stages: protocol.stages.filter((stage) => stage.active).map((stage) => ({
      sourceProtocolStageId: stage.protocolStageId, stageName: stage.stageName, price: stage.price,
    })),
  };
}

function normalizedSeverity(value: string | undefined): AllergySeverity {
  const severity = value?.trim().toLowerCase();
  return severity === "mild" || severity === "moderate" || severity === "severe" ? severity : "unknown";
}

function medicalProfileFromEntry(entry: CaseEntryData, current: PatientCore["medicalProfile"]): PatientIntakeInput["medicalProfile"] {
  const history = entry.medicalHistory;
  if (!history) return current;
  const conditions = [
    history.conditions.diabetes ? "Diabetes" : "",
    history.conditions.cardiac ? "Cardiac condition" : "",
    history.conditions.hypertension ? "Hypertension" : "",
    history.conditions.pregnancy ? "Pregnancy" : "",
    history.conditions.bleeding ? "Bleeding disorder" : "",
    history.conditions.bloodThinners ? "On blood thinners" : "",
    ...(history.conditions.other ?? []),
  ].filter(Boolean).join(", ");
  const habits = [history.habits.smoking ? "Smoking" : "", history.habits.bruxism ? "Bruxism" : ""].filter(Boolean).join(", ");
  return {
    conditionsSummary: conditions || null,
    currentMedicationsSummary: current.currentMedicationsSummary,
    habitsSummary: habits || null,
    medicalNotes: current.medicalNotes,
    verifiedOn: entry.dateISO,
  };
}

export function WorkEntryWorkspace({ canCollectPayment, canChooseLabSupplier }: {
  canCollectPayment: boolean;
  /** Doctors submit a supplier-free lab request and must not load the lab directory. */
  canChooseLabSupplier: boolean;
  onLabOrdersChanged?: () => Promise<void>;
}) {
  const { beginOperation } = useClinicLoading();
  const { showError } = useClinicSnackbar();
  const { route, openDetail, patch } = useClinicRouteState();
  const [rows, setRows] = useState<WorkEntryCaseRow[]>([]);
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [doctors, setDoctors] = useState<StaffReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const query = route.params.search ?? "";
  const [newCase, setNewCase] = useState<NewCaseDraft | null>(null);
  const [newCasePatientQuery, setNewCasePatientQuery] = useState("");
  const [newCasePatients, setNewCasePatients] = useState<PatientSummary[]>([]);
  const [newCasePatientIndex, setNewCasePatientIndex] = useState(-1);
  const [newCaseSearchBusy, setNewCaseSearchBusy] = useState(false);
  const newCaseSearchVersion = useRef(0);
  const activePatientMatchRef = useRef<HTMLButtonElement>(null);
  const newCaseComplaintRef = useRef<HTMLTextAreaElement>(null);
  const caseOpenVersion = useRef(0);
  const closingCaseRef = useRef(false);
  const openingFinishRef = useRef<null | (() => void)>(null);
  const [openingCaseId, setOpeningCaseId] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<WorkEntryCase | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<"start" | "continue" | null>(null);
  const [selectedPatientCore, setSelectedPatientCore] = useState<PatientCore | null>(null);
  const [selectedLedger, setSelectedLedger] = useState<PatientLedger | null>(null);
  const [selectedChartMarks, setSelectedChartMarks] = useState<Record<string, ChartMark>>({});
  const [selectedLabs, setSelectedLabs] = useState<LabSupplier[]>([]);
  const [selectedPerio, setSelectedPerio] = useState<Record<string, ToothPerioData>>({});
  const [selectedCanalData, setSelectedCanalData] = useState<Record<string, CanalChartData>>({});
  const [upcomingFollowUps, setUpcomingFollowUps] = useState<FollowUpWorklistItem[]>([]);
  // Existing cases already have the window's Back button as their page-level exit. Keep that
  // history route available; only a brand-new unsaved case draft blocks host navigation.
  useWorkEntryNavigationBlocker(Boolean(newCase));
  const [newCaseBusy, setNewCaseBusy] = useState(false);
  const [caseBusy, setCaseBusy] = useState(false);
  const statusFilter = route.params.status === "completed" || route.params.status === "closed" || route.params.status === "all" ? route.params.status : "active";
  const [statusTarget, setStatusTarget] = useState<{ caseId: string; patientId: string; rowVersion: number; title: string; status: CaseStatusValue; pendingStageCount: number; pendingStageNames: string[] } | null>(null);
  const [protocolDraft, setProtocolDraft] = useState<{ protocolId: string; location: string } | null>(null);
  const [completionOpen, setCompletionOpen] = useState(false);
  const [completedStageIds, setCompletedStageIds] = useState<string[]>([]);
  const [completedDoctorIds, setCompletedDoctorIds] = useState<string[]>([]);
  useClinicPageLoading("Work Entry", loading);

  // Kept only to minimize changes to the pinned SaaS workflow signatures. The
  // SDK adapters deliberately ignore this empty compatibility value; credentials
  // are acquired by the Dental OS host, never from the renderer.
  const token = useCallback(async () => "", []);

  const loadPatientLedger = useCallback(
    (idToken: string, patientId: string): Promise<PatientLedger | null> =>
      canCollectPayment ? patientBillingApi.patientLedger(idToken, patientId) : Promise.resolve(null),
    [canCollectPayment],
  );

  const load = useCallback(async ({ background = false }: { background?: boolean } = {}) => {
    if (!background) setLoading(true);
    setError(null);
    try {
      const idToken = await token();
      const [caseRows, protocolRows, staffRows] = await Promise.all([workEntryApi.workEntryCases(idToken), treatmentProtocolsApi.treatmentProtocols(idToken), staffApi.listStaffReferences(idToken)]);
      setRows(caseRows); setProtocols(protocolRows.filter((protocol) => protocol.active && protocol.stages.some((stage) => stage.active)));
      setDoctors(staffRows.filter((staff) => staff.staffType === "doctor" && staff.status === "active"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Work Entry could not be loaded.");
    } finally { if (!background) setLoading(false); }
  }, [token]);

  const workEntryRefreshRegistration = useMemo(() => selectedCase || loading ? null : {
    key: "work-entry",
    label: "Work Entry",
    refresh: () => load({ background: true }),
    successMessage: "Work Entry is up to date.",
    placement: "page-action" as const,
  }, [load, loading, selectedCase]);
  useClinicPageRefresh(workEntryRefreshRegistration);

  useEffect(() => { void load(); }, [load]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? rows.filter((row) => `${row.fullName} ${row.patientNumber} ${row.phone ?? ""} ${row.cases.map((item) => item.chiefComplaint).join(" ")}`.toLowerCase().includes(needle)) : rows;
  }, [query, rows]);
  const visibleCases = useMemo(() => filteredRows.flatMap((patient) => patient.cases
    .filter((caseItem) => statusFilter === "all" || (statusFilter === "active" ? caseItem.status === "open" : caseItem.status === statusFilter))
    .map((caseItem) => ({ patient, caseItem }))), [filteredRows, statusFilter]);

  const updateCaseStatus = async (status: CaseStatusValue, reason: string | null) => {
    if (!statusTarget) return;
    const updated = normaliseWorkEntryCase(await workEntryApi.updateCaseStatus(await token(), statusTarget.caseId, {
      patientId: statusTarget.patientId,
      expectedRowVersion: statusTarget.rowVersion,
      status,
      reason,
    }));
    if (selectedCase?.chiefComplaintId === updated.chiefComplaintId) setSelectedCase(updated);
    await load();
  };

  const searchNewCasePatients = useCallback(async (value: string) => {
    const search = value.trim();
    const version = ++newCaseSearchVersion.current;
    if (!search) { setNewCasePatients([]); setNewCasePatientIndex(-1); setNewCaseSearchBusy(false); return; }
    setNewCaseSearchBusy(true);
    try {
      const result = await patientsApi.searchPatients(await token(), search);
      if (version === newCaseSearchVersion.current) {
        const matches = result.patients.slice(0, 8);
        setNewCasePatients(matches);
        setNewCasePatientIndex(matches.length ? 0 : -1);
      }
    } catch (cause) {
      if (version === newCaseSearchVersion.current) {
        setNewCasePatients([]);
        setNewCasePatientIndex(-1);
        setError(cause instanceof Error ? cause.message : "Registered patients could not be searched.");
      }
    } finally {
      if (version === newCaseSearchVersion.current) setNewCaseSearchBusy(false);
    }
  }, [token]);

  useEffect(() => {
    activePatientMatchRef.current?.scrollIntoView({ block: "nearest" });
  }, [newCasePatientIndex]);

  const chooseNewCasePatient = useCallback((patient: PatientSummary) => {
    setNewCase((current) => current ? { ...current, patient } : current);
    setNewCasePatientQuery("");
    setNewCasePatients([]);
    setNewCasePatientIndex(-1);
    requestAnimationFrame(() => newCaseComplaintRef.current?.focus());
  }, []);

  const updateNewCasePatientQuery = (value: string) => {
    setNewCasePatientQuery(value);
    setNewCasePatients([]);
    setNewCasePatientIndex(-1);
    void searchNewCasePatients(value);
  };

  const handleNewCasePatientKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!newCasePatients.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setNewCasePatientIndex((current) => current < newCasePatients.length - 1 ? current + 1 : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setNewCasePatientIndex((current) => current > 0 ? current - 1 : newCasePatients.length - 1);
    } else if (event.key === "Enter" && newCasePatientIndex >= 0) {
      event.preventDefault();
      chooseNewCasePatient(newCasePatients[newCasePatientIndex]);
    } else if (event.key === "Escape") {
      setNewCasePatients([]);
      setNewCasePatientIndex(-1);
    }
  };

  const openCase = async (chiefComplaintId: string, flow: "start" | "continue") => {
    if (openingCaseId) return;
    const requestVersion = ++caseOpenVersion.current;
    closingCaseRef.current = false;
    const finishLoading = beginOperation("Work Entry", {
      title: "Opening patient case…",
      message: "Loading the chart, treatment plan and clinical records.",
    });
    openingFinishRef.current = finishLoading;
    setOpeningCaseId(chiefComplaintId);
    setError(null);
    try {
      const idToken = await token();
      const workEntryCase = normaliseWorkEntryCase(await workEntryApi.workEntryCase(idToken, chiefComplaintId));
      const patientId = workEntryCase.patientId;
      // ApiBroker caps each app at four in-flight calls (and the whole OS at
      // eight). Keep this chart/context fan-out to three concurrent GETs and
      // retry a local BUSY rejection rather than failing the entire case open.
      const [patientResult, ledger, marks] = await Promise.all([
        readWithBrokerCapacityRetry(() => patientsApi.patientCore(idToken, patientId)),
        readWithBrokerCapacityRetry(() => loadPatientLedger(idToken, patientId)),
        readWithBrokerCapacityRetry(() => patientOdontogramOrEmpty(idToken, patientId)),
      ]);
      const [labSuppliers, periodontalChart, canalMeasurements] = await Promise.all([
        readWithBrokerCapacityRetry(() => canChooseLabSupplier ? suppliersApi.listSuppliers(idToken, "lab") : Promise.resolve<ClinicSupplier[]>([])),
        readWithBrokerCapacityRetry(() => clinicalChartsApi.patientPeriodontalChart(idToken, patientId)),
        readWithBrokerCapacityRetry(() => clinicalChartsApi.patientCanalMeasurements(idToken, patientId)),
      ]);
      const followUps = await readWithBrokerCapacityRetry(() => followUpsApi.listFollowUps(idToken));
      if (requestVersion !== caseOpenVersion.current || closingCaseRef.current) return;
      const patient = normalisePatientCore(patientResult);
      setSelectedPatientCore(patient);
      setSelectedLedger(ledger);
      setSelectedCase(workEntryCase);
      setSelectedFlow(flow);
      setSelectedChartMarks(chartMarksFromApi(marks));
      setSelectedLabs(labSuppliers.map(legacyLab));
      setSelectedPerio(perioFromApi(periodontalChart.teeth));
      setSelectedCanalData(canalDataFromApi(canalMeasurements.filter((session) => session.chiefComplaintId === workEntryCase.chiefComplaintId), doctors));
      setUpcomingFollowUps(followUps.filter((followUp) => followUp.status === "pending" && followUp.dueOn >= today()).slice(0, 12));
      setCompletedDoctorIds(workEntryCase.caseDoctorStaffIds);
    }
    catch (cause) {
      if (requestVersion === caseOpenVersion.current && !closingCaseRef.current) {
        setError(cause instanceof Error ? cause.message : "The case could not be opened.");
        // A failed detail load must leave the worklist route. Otherwise the route effect sees
        // the same case ID again and keeps reopening it, which traps the user behind loading UI.
        patch({ caseId: null, patientId: null, workTab: null }, "replace");
      }
    }
    finally {
      if (requestVersion === caseOpenVersion.current) setOpeningCaseId(null);
      if (openingFinishRef.current === finishLoading) openingFinishRef.current = null;
      finishLoading();
    }
  };

  useEffect(() => {
    const caseId = route.params.caseId;
    if (!caseId) {
      closingCaseRef.current = false;
      if (selectedCase) {
        setSelectedCase(null);
        setSelectedFlow(null);
        setSelectedPatientCore(null);
        setSelectedLedger(null);
      }
      return;
    }
    if (closingCaseRef.current) return;
    if (selectedCase?.chiefComplaintId === caseId || openingCaseId) return;
    const listCase = rows.flatMap((row) => row.cases).find((item) => item.chiefComplaintId === caseId);
    if (!loading && !listCase) {
      patch({ caseId: null, patientId: null, workTab: null }, "replace");
      return;
    }
    // The two clinical flows intentionally retain their own UI and purpose:
    // an Open case starts in intake/plan, while an In-progress case resumes
    // the treatment-day workspace. Both will use their final-save action.
    if (listCase) void openCase(caseId, worklistStatusFor(listCase) === "in_progress" ? "continue" : "start");
  // `openCase` deliberately remains an event-style loader; depending on its changing closure
  // would reopen the same route after every supporting-data refresh.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, openingCaseId, patch, route.params.caseId, rows, selectedCase]);

  const createCase = async () => {
    if (!newCase?.patient) { setError("Select the patient for this new case."); return; }
    if (!newCase.complaint.trim()) { setError("Enter the chief complaint before saving the case."); return; }
    setNewCaseBusy(true); setError(null);
    try {
      await patientsApi.createPatientCase(await token(), newCase.patient.patientId, { chiefComplaint: newCase.complaint.trim(), openedOn: today() });
      setNewCase(null); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The case could not be created."); }
    finally { setNewCaseBusy(false); }
  };

  const addProtocol = async () => {
    if (!selectedCase) return;
    const protocol = protocols.find((item) => item.protocolId === protocolDraft?.protocolId);
    if (!protocol) return;
    const input = { patientId: selectedCase.patientId, plan: planFor(protocol, protocolDraft?.location ?? "") };
    if ((protocol.toothScope === "tooth" && !input.plan.toothCode) || (protocol.toothScope !== "tooth" && !input.plan.treatmentArea)) {
      setError(protocol.toothScope === "tooth" ? "Enter the tooth for this treatment protocol." : "Enter the treatment area for this treatment protocol."); return;
    }
    setCaseBusy(true); setError(null);
    try { setSelectedCase(normaliseWorkEntryCase(await workEntryApi.addWorkEntryProtocol(await token(), selectedCase.chiefComplaintId, input))); setProtocolDraft(null); await load(); }
    catch (cause) {
      setError(cause instanceof Error ? cause.message : "The treatment protocol could not be added.");
    } finally { setCaseBusy(false); }
  };

  const cancelProtocol = async (patientProtocolId: string) => {
    if (!selectedCase) return;
    const protocol = selectedCase.protocols.find((item) => item.patientProtocolId === patientProtocolId);
    if (!protocol) return;
    const reason = window.prompt(`Cancel ${protocol.protocolName}? This cancels its pending stages only and does not change completed work or charges. Enter the reason.`)?.trim();
    if (!reason) return;
    setCaseBusy(true); setError(null);
    try {
      setSelectedCase(normaliseWorkEntryCase(await workEntryApi.cancelWorkEntryProtocol(await token(), selectedCase.chiefComplaintId, patientProtocolId, {
        patientId: selectedCase.patientId, expectedRowVersion: protocol.rowVersion, reason,
      })));
      await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The treatment plan could not be cancelled."); }
    finally { setCaseBusy(false); }
  };

  const recordCompletedWork = async () => {
    if (!selectedCase) return;
    const selected = selectedCase.protocols.flatMap((protocol) => protocol.stages.filter((stage) => completedStageIds.includes(stage.stageId)).map((stage) => ({ protocol, stage })));
    if (!selected.length) { setError("Select at least one completed stage."); return; }
    if (doctors.length && !completedDoctorIds.length) { setError("Select the doctor who completed this work."); return; }
    if (selected.some(({ stage }) => !stage.sourceProtocolStageId)) { setError("One selected stage cannot be linked to its treatment template. Refresh the case and try again."); return; }
    setCaseBusy(true); setError(null);
    try {
      await workEntryApi.finaliseClinicalWork(await token(), {
        patientId: selectedCase.patientId, chiefComplaintId: selectedCase.chiefComplaintId, completedOn: today(),
        completedStages: selected.map(({ protocol, stage }) => ({ sourceProtocolId: protocol.sourceProtocolId, sourceProtocolStageId: stage.sourceProtocolStageId as string, toothCode: protocol.toothCode, treatmentArea: protocol.treatmentArea })),
        doctorStaffIds: completedDoctorIds,
      });
      setSelectedCase(normaliseWorkEntryCase(await workEntryApi.workEntryCase(await token(), selectedCase.chiefComplaintId)));
      setCompletedStageIds([]); setCompletedDoctorIds([]); setCompletionOpen(false); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The completed work could not be recorded."); }
    finally { setCaseBusy(false); }
  };

  const saveSelectedPatientCase = async (entry: CaseEntryData) => {
    if (!selectedCase || !selectedPatientCore) throw new Error("Patient details are unavailable. Reload the case and try again.");
    const patientInput = entry.newPatient;
    if (!patientInput) throw new Error("Patient details are unavailable. Reload the case and try again.");
    const doctorIdsByName = new Map(doctors.map((doctor) => [doctor.fullName, doctor.staffId]));
    const selectedDoctorIds = (entry.doctors ?? []).map((name) => doctorIdsByName.get(name)).filter((staffId): staffId is string => Boolean(staffId));
    if (selectedDoctorIds.length !== (entry.doctors ?? []).length) {
      throw new Error("One selected case doctor is no longer active. Refresh the case and try again.");
    }
    const priorAllergies = new Map((selectedPatientCore.allergies ?? []).filter((allergy) => allergy.status === "active").map((allergy) => [allergy.allergen.trim().toLowerCase(), allergy]));
    const result = await workEntryApi.updateWorkEntryCase(await token(), selectedCase.chiefComplaintId, {
      patientId: selectedPatientCore.patientId,
      expectedPatientRowVersion: selectedPatientCore.rowVersion,
      expectedMedicalProfileRowVersion: selectedPatientCore.medicalProfile.rowVersion,
      expectedCaseRowVersion: selectedCase.rowVersion,
      patient: {
        fullName: entry.patientName,
        ageYears: patientInput.ageYears,
        sex: patientInput.sex,
        phone: patientInput.phone || null,
        address: patientInput.address || null,
        emergencyContactName: patientInput.emergencyContact?.name || null,
        emergencyContactPhone: patientInput.emergencyContact?.phone || null,
      },
      medicalProfile: medicalProfileFromEntry(entry, selectedPatientCore.medicalProfile),
      allergies: (entry.medicalHistory?.allergies ?? []).filter((allergy) => allergy.substance.trim()).map((allergy) => {
        const previous = priorAllergies.get(allergy.substance.trim().toLowerCase());
        return {
          allergen: allergy.substance.trim(),
          reaction: previous?.reaction ?? null,
          severity: normalizedSeverity(allergy.severity) === "unknown" ? previous?.severity ?? "unknown" : normalizedSeverity(allergy.severity),
          note: previous?.note ?? null,
          recordedOn: entry.dateISO,
        };
      }),
      chiefComplaint: entry.chiefComplaint,
      openedOn: entry.dateISO,
      caseDoctorStaffIds: selectedDoctorIds,
    }, entry.commandId);
    const updatedPatient = normalisePatientCore(result.patient);
    const updatedCase = normaliseWorkEntryCase(result.case);
    setSelectedPatientCore(updatedPatient);
    setSelectedCase(updatedCase);
    setCompletedDoctorIds(updatedCase.caseDoctorStaffIds);
    await load();
  };

  const exitSelectedCase = () => {
    closingCaseRef.current = true;
    caseOpenVersion.current += 1;
    openingFinishRef.current?.();
    openingFinishRef.current = null;
    patch({ caseId: null, patientId: null, workTab: null }, "push");
    setSelectedCase(null);
    setSelectedFlow(null);
    setOpeningCaseId(null);
    setSelectedPatientCore(null);
    setSelectedLedger(null);
    setSelectedChartMarks({});
    setSelectedLabs([]);
    setSelectedPerio({});
    setSelectedCanalData({});
    setUpcomingFollowUps([]);
  };

  if (selectedCase && selectedPatientCore && selectedFlow === "continue") return <section className={styles.continuationWorkspace} key="work-entry-continuation">
    <InProgressWorkEntry
      patient={legacyPatient(selectedPatientCore, selectedLedger?.summary.outstandingDue ?? 0)}
      workEntryCase={selectedCase}
      caseDoctorNames={selectedCase.caseDoctorStaffIds.map((staffId) => doctors.find((doctor) => doctor.staffId === staffId)?.fullName).filter((name): name is string => Boolean(name))}
      doctorsList={doctors.map((doctor) => doctor.fullName)}
      labs={selectedLabs}
      protocols={protocols.map(toCareProtocol)}
      initialPerio={selectedPerio}
      initialCanalData={selectedCanalData}
      upcomingFollowUps={upcomingFollowUps}
      currentOutstandingDue={selectedLedger?.summary.outstandingDue ?? 0}
      canCollectPayment={canCollectPayment}
      initialStep={inProgressStepForTab(route.params.workTab)}
      onStepChange={(step) => patch({ workTab: tabForInProgressStep(step) }, "replace")}
      onCommit={async (draft, completedStages) => {
        const { work, periodontalTeeth, prescriptionItems, recall, closeCase } = draft;
        const doctorIdsByName = new Map(doctors.map((doctor) => [doctor.fullName, doctor.staffId]));
        const doctorStaffIds = work.doctorNames.map((name) => doctorIdsByName.get(name)).filter((staffId): staffId is string => Boolean(staffId));
        const completesNewStage = work.extraWork.some((stage) => stage.completeToday);
        if ((completedStages.length || completesNewStage) && doctorStaffIds.length !== work.doctorNames.length) {
          throw new Error("One selected case doctor is no longer active. Refresh the case and try again.");
        }
        const idToken = await token();
        const requestedByStaffId = recall.followUp
          ? doctors.find((doctor) => doctor.fullName === recall.doctorNames[0])?.staffId ?? null
          : null;
        const commit = await workEntryApi.commitWorkEntry(idToken, {
          patientId: selectedCase.patientId,
          chiefComplaintId: selectedCase.chiefComplaintId,
          workDate: work.dateISO,
          expectedCaseRowVersion: selectedCase.rowVersion,
          doctorStaffIds,
          planSelections: [],
          plannedCompletedStages: [],
          completedStages: completedStages.map((stage) => ({
            patientProtocolStageId: stage.patientProtocolStageId,
            expectedRowVersion: stage.expectedRowVersion,
            chargeAmount: stage.chargeAmount,
          })),
          addedStages: work.extraWork.map((stage) => ({
            patientProtocolId: stage.patientProtocolId,
            expectedRowVersion: stage.expectedRowVersion,
            stageName: stage.stageName,
            chargeAmount: stage.chargeAmount,
            completeToday: stage.completeToday,
          })),
          note: work.note || null,
          odontogram: null,
          periodontalChart: periodontalTeeth ? perioForApi(periodontalTeeth) : null,
          canalMeasurements: [],
          prescription: prescriptionItems.length ? {
            note: null,
            items: prescriptionItems.map((item) => ({
              medicineName: item.medicine.trim(),
              dose: item.dosage.trim() || null,
              frequency: item.frequency.trim() || null,
              duration: item.duration.trim() || null,
              instructions: item.instructions.trim(),
            })),
          } : null,
          labOrders: [],
          followUp: recall.followUp ? {
            dueOn: recall.followUp.dateISO,
            dueTime: recall.followUp.time ?? null,
            reason: recall.followUp.reason,
            requestedByStaffId,
          } : null,
          payment: null,
          caseDisposition: closeCase ? { status: "closed", reason: null } : null,
        }, recall.commandId);
        const [caseResult, ledger] = await Promise.all([
          workEntryApi.workEntryCase(idToken, selectedCase.chiefComplaintId),
          loadPatientLedger(idToken, selectedCase.patientId),
        ]);
        const updated = normaliseWorkEntryCase(caseResult);
        setSelectedCase(updated);
        setSelectedLedger(ledger);
        setCompletedDoctorIds(updated.caseDoctorStaffIds);
        await load();
        if (periodontalTeeth) setSelectedPerio(periodontalTeeth);
        return { workEntryCase: updated, chargeAmount: commit.chargeAmount };
      }}
      onMediaChanged={async () => undefined}
      onRemoveXray={async (mediaAssetId, reason) => {
        await patientMediaApi.withdrawPatientMedia(mediaAssetId, reason);
      }}
      onSaveCanalData={async (data) => {
        const protocol = selectedCase.protocols.find((item) => item.toothCode === data.tooth && protocols.find((template) => template.protocolId === item.sourceProtocolId)?.recordsCanalMeasurements);
        if (!protocol) throw new Error("This tooth does not have an eligible root-canal protocol in the selected case.");
        const saved = await clinicalChartsApi.savePatientCanalMeasurement(await token(), selectedCase.patientId, {
          patientId: selectedCase.patientId,
          chiefComplaintId: selectedCase.chiefComplaintId,
          patientProtocolId: protocol.patientProtocolId,
          plan: null,
          recordedOn: today(),
          recordedByStaffId: null,
          obturationMaterial: data.obturationMaterial?.trim() || null,
          note: data.medicament?.trim() || null,
          records: data.canals.filter((canal) => canal.lengthMm.trim()).map((canal) => ({ canalLabel: canal.canal, workingLengthMm: Number(canal.lengthMm), fileNumber: canal.note?.trim() || null, reference: canal.referencePoint?.trim() || null })),
        });
        setSelectedCanalData((current) => ({ ...current, ...canalDataFromApi([saved], doctors) }));
      }}
      onRemovePendingStage={async (patientProtocolId, stageId, expectedRowVersion) => {
        const updated = normaliseWorkEntryCase(await workEntryApi.cancelWorkEntryStage(
          await token(),
          selectedCase.chiefComplaintId,
          patientProtocolId,
          stageId,
          {
            patientId: selectedCase.patientId,
            expectedRowVersion,
            reason: "Removed by clinician from Work Entry.",
          },
        ));
        setSelectedCase(updated);
        setCompletedDoctorIds(updated.caseDoctorStaffIds);
        await load();
        return updated;
      }}
      onAppendPlan={async (plan, commandId) => {
        const updated = normaliseWorkEntryCase(await workEntryApi.addWorkEntryProtocol(await token(), selectedCase.chiefComplaintId, {
          patientId: selectedCase.patientId,
          plan,
        }, commandId));
        setSelectedCase(updated);
        await load();
        return updated;
      }}
      renderPatientStep={() => (
        <section className={styles.caseContext} aria-label="Patient and case context">
          <div className={styles.caseContextHeader}>
            <div>
              <p className={styles.caseContextEyebrow}>Patient &amp; case</p>
              <h2>{selectedPatientCore.fullName}</h2>
              <p className={styles.caseContextMeta}>{selectedPatientCore.patientNumber} · Opened {selectedCase.openedOn}</p>
            </div>
            <span className={`${styles.status} ${styles[selectedCase.status] ?? styles.open}`}>{displayStatus(selectedCase.status)}</span>
          </div>
          <div className={styles.caseContextGrid}>
            <div>
              <span>Chief complaint</span>
              <strong>{selectedCase.chiefComplaint}</strong>
            </div>
            <div>
              <span>Contact</span>
              <strong>{selectedPatientCore.phone || "No phone recorded"}</strong>
            </div>
            <div>
              <span>Case doctor(s)</span>
              <strong>{selectedCase.caseDoctorStaffIds
                .map((staffId) => doctors.find((doctor) => doctor.staffId === staffId)?.fullName)
                .filter((name): name is string => Boolean(name))
                .join(", ") || "Not assigned"}</strong>
            </div>
            <div>
              <span>Safety profile</span>
              <strong>{selectedPatientCore.allergies.filter((allergy) => allergy.status === "active").length
                ? "Review active alerts before treatment"
                : "No active allergy alerts"}</strong>
            </div>
          </div>
        </section>
      )}
      onExit={exitSelectedCase}
    />
  </section>;

  if (selectedCase && selectedPatientCore) return <section className={styles.workspace} key="work-entry-case">
    <CaseEntryView
      key={selectedCase.chiefComplaintId}
      embedded
      existingCaseWorkflow
      canCollectPayment={canCollectPayment}
      initialStep={startCaseStepForTab(route.params.workTab)}
      onStepChange={(step) => patch({ workTab: tabForStartCaseStep(step) }, "replace")}
      initialPatientId={selectedPatientCore.patientId}
      initialChiefComplaint={selectedCase.chiefComplaint}
      initialCaseOpenedOn={selectedCase.openedOn}
      initialCaseDoctors={[]}
      initialPlanSelections={selectedCase.protocols.map((protocol) => ({
        sourceProtocolId: protocol.sourceProtocolId,
        toothCode: protocol.toothCode,
        treatmentArea: protocol.treatmentArea,
        stages: protocol.stages.map((stage) => ({
          sourceProtocolStageId: stage.sourceProtocolStageId,
          stageName: stage.stageName,
          price: stage.price,
        })),
      }))}
      initialCompletedStages={selectedCase.protocols.flatMap((protocol) =>
        protocol.stages
          .filter((stage) => stage.status === "done" && stage.sourceProtocolStageId)
          .map((stage) => ({
            sourceProtocolId: protocol.sourceProtocolId,
            sourceProtocolStageId: stage.sourceProtocolStageId as string,
            toothCode: protocol.toothCode,
            treatmentArea: protocol.treatmentArea,
          })),
      )}
      initialChartMarks={selectedChartMarks}
      patients={[legacyPatient(selectedPatientCore, selectedLedger?.summary.outstandingDue ?? 0)]}
      doctorsList={doctors.map((doctor) => doctor.fullName)}
      labs={selectedLabs}
      initialLabOrders={[]}
      initialPerio={selectedPerio}
      initialCanalData={selectedCanalData}
      upcomingFollowUps={upcomingFollowUps}
      initialChiefComplaintId={selectedCase.chiefComplaintId}
      currentOutstandingDue={selectedLedger?.summary.outstandingDue ?? 0}
      clinic={workEntryClinic}
      feeSchedule={defaultFeeSchedule}
      protocols={protocols.map(toCareProtocol)}
      cases={{}}
      onExit={exitSelectedCase}
      onMediaChanged={async () => undefined}
      onRemoveXray={async (mediaAssetId, reason) => {
        await patientMediaApi.withdrawPatientMedia(mediaAssetId, reason);
      }}
      onCreateCase={saveSelectedPatientCase}
      onSavePerioChart={async (teeth) => {
        const chart = await clinicalChartsApi.savePatientPeriodontalChart(await token(), selectedCase.patientId, { patientId: selectedCase.patientId, chiefComplaintId: selectedCase.chiefComplaintId, recordedOn: today(), teeth: perioForApi(teeth) });
        setSelectedPerio(perioFromApi(chart.teeth));
      }}
      onCommitTodayWork={async ({ commandId, completedOn, completedStages, planSelections, odontogram, canalMeasurements, doctorNames, followUp, prescriptionItems, periodontalTeeth, closeCase }) => {
        const idToken = await token();
        // Resolve against the latest durable case so optimistic concurrency is
        // checked at the final command boundary.
        const currentCase = normaliseWorkEntryCase(await workEntryApi.workEntryCase(idToken, selectedCase.chiefComplaintId));
        setSelectedCase(currentCase);
        const doctorIdsByName = new Map(doctors.map((doctor) => [doctor.fullName, doctor.staffId]));
        const doctorStaffIds = doctorNames
          .map((name) => doctorIdsByName.get(name))
          .filter((staffId): staffId is string => Boolean(staffId));
        if (completedStages.length && doctorStaffIds.length !== doctorNames.length) {
          throw new Error("One selected case doctor is no longer active. Refresh the case and try again.");
        }

        try {
          const commit = await workEntryApi.commitWorkEntry(idToken, {
            patientId: currentCase.patientId,
            chiefComplaintId: currentCase.chiefComplaintId,
            workDate: completedOn,
            expectedCaseRowVersion: currentCase.rowVersion,
            doctorStaffIds,
            planSelections,
            plannedCompletedStages: completedStages,
            completedStages: [],
            addedStages: [],
            note: null,
            odontogram,
            periodontalChart: periodontalTeeth ? perioForApi(periodontalTeeth) : null,
            canalMeasurements,
            prescription: prescriptionItems.length ? {
              note: null,
              items: prescriptionItems.map((item) => ({
                medicineName: item.medicine.trim(),
                dose: item.dosage.trim() || null,
                frequency: item.frequency.trim() || null,
                duration: item.duration.trim() || null,
                instructions: item.instructions.trim(),
              })),
            } : null,
            labOrders: [],
            followUp: followUp ? {
              dueOn: followUp.dueOn,
              dueTime: followUp.dueTime,
              reason: followUp.reason,
              requestedByStaffId: doctorStaffIds[0] ?? null,
            } : null,
            payment: null,
            caseDisposition: closeCase ? { status: "closed", reason: null } : null,
          }, commandId);
          const [caseResult, ledger, chart, canals] = await Promise.all([
            workEntryApi.workEntryCase(idToken, currentCase.chiefComplaintId),
            loadPatientLedger(idToken, currentCase.patientId),
            patientOdontogramOrEmpty(idToken, currentCase.patientId),
            clinicalChartsApi.patientCanalMeasurements(idToken, currentCase.patientId),
          ]);
          const updatedCase = normaliseWorkEntryCase(caseResult);
          setSelectedCase(updatedCase);
          setSelectedLedger(ledger);
          setSelectedChartMarks(chartMarksFromApi(chart));
          setSelectedCanalData(canalDataFromApi(canals, doctors));
          setCompletedDoctorIds(updatedCase.caseDoctorStaffIds);
          if (periodontalTeeth) setSelectedPerio(periodontalTeeth);
          await load();
          return { receiptNumber: commit.receiptNumber };
        } catch (cause) {
          const [caseRefresh, ledgerRefresh] = await Promise.allSettled([
            workEntryApi.workEntryCase(idToken, currentCase.chiefComplaintId),
            loadPatientLedger(idToken, currentCase.patientId),
          ]);
          if (caseRefresh.status === "fulfilled") {
            const reconciled = normaliseWorkEntryCase(caseRefresh.value);
            setSelectedCase(reconciled);
            setCompletedDoctorIds(reconciled.caseDoctorStaffIds);
          }
          if (ledgerRefresh.status === "fulfilled") setSelectedLedger(ledgerRefresh.value);
          throw cause;
        }
      }}
    />
  </section>;

  if (selectedCase) return <section className={styles.workspace}>
    <div className={styles.detailHeading}>
      <div><p className={styles.eyebrow}>WORK ENTRY · {selectedCase.patientNumber}</p><h2>{selectedCase.patientName}</h2><p>{selectedCase.chiefComplaint}</p></div>
      <span className={`${styles.status} ${styles[selectedCase.status]}`}>{displayStatus(selectedCase.status)}</span>
    </div>
    {error ? <p className={styles.error}>{error}</p> : null}
    <section className={styles.caseCard}>
      <div className={styles.caseActions}>
        <button className="secondaryAction" disabled={caseBusy} type="button" onClick={() => setStatusTarget({ caseId: selectedCase.chiefComplaintId, patientId: selectedCase.patientId, rowVersion: selectedCase.rowVersion, title: selectedCase.chiefComplaint, status: selectedCase.status, pendingStageCount: selectedCase.protocols.flatMap((protocol) => protocol.stages).filter((stage) => stage.status === "pending").length, pendingStageNames: selectedCase.protocols.flatMap((protocol) => protocol.stages).filter((stage) => stage.status === "pending").map((stage) => stage.stageName) })}>Update status</button>
        <label>Add treatment protocol<select aria-label="Add treatment protocol" value={protocolDraft?.protocolId ?? ""} disabled={caseBusy || selectedCase.status !== "open"} onChange={(event) => setProtocolDraft(event.target.value ? { protocolId: event.target.value, location: "" } : null)}><option value="">Select a protocol…</option>{protocols.map((protocol) => <option key={protocol.protocolId} value={protocol.protocolId}>{protocol.name}</option>)}</select></label>
        {selectedCase.status === "open" ? <button className="primaryAction" disabled={caseBusy} onClick={() => { setError(null); setCompletionOpen(true); }} type="button">Record completed work</button> : <p style={{ margin: 0, color: "#64748b" }}>Clinical work is unavailable while this case is {displayStatus(selectedCase.status).toLowerCase()}. Update its status to open to continue treatment.</p>}
      </div>
      {selectedCase.protocols.length ? selectedCase.protocols.map((protocol) => <article className={styles.protocolCard} key={protocol.patientProtocolId}>
        <header><strong>{protocol.protocolName}</strong><span>{protocol.toothCode ? `Tooth ${protocol.toothCode}` : protocol.treatmentArea}</span>{protocol.status === "active" ? <button className="secondaryAction" disabled={caseBusy} type="button" onClick={() => void cancelProtocol(protocol.patientProtocolId)}>Cancel pending plan</button> : null}</header>
        <ol>{protocol.stages.map((stage) => <li key={stage.stageId}><span>{stage.stageOrder}. {stage.stageName}</span><span>{stage.status === "done" ? "Done" : stage.status === "cancelled" ? "Cancelled" : "Pending"} · Rs {stage.price.toLocaleString()}</span></li>)}</ol>
      </article>) : <p className={styles.empty}>No treatment protocols are attached to this case yet.</p>}
    </section>
    {protocolDraft ? <ClinicModal title="Add treatment protocol" size="small" onClose={() => !caseBusy && setProtocolDraft(null)} closeDisabled={caseBusy} description={`Add ${protocols.find((protocol) => protocol.protocolId === protocolDraft.protocolId)?.name ?? "the selected protocol"} to this case.`}><div className={styles.caseForm}><label>{protocols.find((protocol) => protocol.protocolId === protocolDraft.protocolId)?.toothScope === "tooth" ? "Tooth" : "Treatment area"}<input autoFocus value={protocolDraft.location} onChange={(event) => setProtocolDraft({ ...protocolDraft, location: event.target.value })} placeholder={protocols.find((protocol) => protocol.protocolId === protocolDraft.protocolId)?.toothScope === "tooth" ? "e.g. 46" : "e.g. Full mouth"} /></label><div className={styles.modalActions}><button className="secondaryAction" disabled={caseBusy} type="button" onClick={() => setProtocolDraft(null)}>Cancel</button><button className="primaryAction" disabled={caseBusy} type="button" onClick={() => void addProtocol()}>{caseBusy ? "Adding…" : "Add protocol"}</button></div></div></ClinicModal> : null}
    {completionOpen ? <ClinicModal title="Record completed work" size="medium" onClose={() => !caseBusy && setCompletionOpen(false)} closeDisabled={caseBusy} description="Only selected stages are recorded, charged, and linked to the selected clinician(s)."><div className={styles.completionForm}><fieldset><legend>Completed stages</legend>{selectedCase.protocols.flatMap((protocol) => protocol.stages.filter((stage) => stage.status === "pending").map((stage) => <label key={stage.stageId}><input type="checkbox" checked={completedStageIds.includes(stage.stageId)} onChange={(event) => setCompletedStageIds((current) => event.target.checked ? [...current, stage.stageId] : current.filter((id) => id !== stage.stageId))} />{protocol.protocolName} · {stage.stageName} <span>Rs {stage.price.toLocaleString()}</span></label>))}</fieldset>{doctors.length ? <fieldset><legend>Completed by</legend>{doctors.map((doctor) => <label key={doctor.staffId}><input type="checkbox" checked={completedDoctorIds.includes(doctor.staffId)} onChange={(event) => setCompletedDoctorIds((current) => event.target.checked ? [...current, doctor.staffId] : current.filter((id) => id !== doctor.staffId))} />{doctor.fullName}</label>)}</fieldset> : <p className={styles.noDoctors}>No active doctors are in the staff directory. Add one before recording attributed clinical work.</p>}<div className={styles.modalActions}><button className="secondaryAction" disabled={caseBusy} type="button" onClick={() => setCompletionOpen(false)}>Cancel</button><button className="primaryAction" disabled={caseBusy || !doctors.length} type="button" onClick={() => void recordCompletedWork()}>{caseBusy ? "Recording…" : "Record work"}</button></div></div></ClinicModal> : null}
  </section>;

  return <section className={styles.workspace} key="work-entry-list" data-sajilo-standard-page="">
    <StandardPageScroll contentClassName="workEntryPageScrollContent">
    <div className={styles.heading} data-sajilo-page-header><div><h2>Work Entry</h2></div><div className={styles.headingActions}><ClinicPageRefreshAction placement="page-action" /><ClinicActionButton className={styles.newCaseButton} onClick={() => { setError(null); setNewCasePatientQuery(""); setNewCasePatients([]); setNewCase({ patient: null, complaint: "" }); }}>＋ New case</ClinicActionButton></div></div>
    {error && rows.length > 0 ? <p className={styles.error}>{error}</p> : null}
    <ClinicDataTable
      rows={visibleCases}
      standardPage
      rowKey={({ caseItem }) => caseItem.chiefComplaintId}
      noun="cases"
      minWidth={780}
      loading={loading}
      loadingLabel="Loading clinical worklist…"
      error={!loading && rows.length === 0 ? error : null}
      errorHint="Try refreshing the page or check the clinic connection."
      filters={<><div className={styles.statusFilterGroup} aria-label="Case status filter">{(["all", "active", "completed", "closed"] as const).map((filter) => <button key={filter} type="button" aria-pressed={statusFilter === filter} className={`${styles.statusFilterChip}${statusFilter === filter ? ` ${styles.statusFilterChipActive}` : ""}`} onClick={() => patch({ status: filter === "active" ? null : filter }, "push")}>{filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}</button>)}</div><input className={styles.tableSearch} value={query} onChange={(event) => patch({ search: event.target.value || null })} placeholder="Search patient, record ID, phone or complaint…" aria-label="Search cases" /><span className={styles.tableCount}>{loading ? "Loading cases…" : `${visibleCases.length} cases`}</span></>}
      empty={loading || error ? null : <div className={styles.noRows}><strong>{query ? "No cases match this search" : "No patient cases yet"}</strong><span>{query ? "Try a patient name, record ID, phone number, or complaint." : "Use New case when a registered patient is ready to begin treatment."}</span>{query ? <button className="secondaryAction" onClick={() => patch({ search: null })} type="button">Clear search</button> : null}</div>}
      columns={[
        { key: "patient", header: "Patient", sortable: true, value: ({ patient }) => patient.fullName, render: ({ patient }, index) => <div className={styles.casePatientCell}><span className={styles.caseIndex} style={{ fontVariantNumeric: "tabular-nums" }}>{index + 1}</span><div className={styles.tableCell}><strong>{patient.fullName}</strong><small>{patient.patientNumber}{patient.phone ? ` · ${patient.phone}` : ""}</small></div></div> },
        { key: "complaint", header: "Chief complaint / case", sortable: true, value: ({ caseItem }) => caseItem.chiefComplaint, render: ({ caseItem }) => <div className={styles.tableCell}><strong>{caseItem.chiefComplaint}</strong><small>Opened {caseItem.openedOn}</small></div> },
        { key: "protocols", header: "Treatment protocols", align: "center", value: ({ caseItem }) => caseItem.treatmentProtocolCount ?? 0 },
        { key: "status", header: "Status", render: ({ caseItem }) => { const status = worklistStatusFor(caseItem); return <span className={`${styles.status} ${styles[status]}`}>{displayStatus(status)}</span>; } },
        { key: "actions", header: "Actions", align: "right", render: ({ patient, caseItem }) => { const opening = openingCaseId === caseItem.chiefComplaintId; return <div style={{ display: "inline-flex", gap: "6px" }}>{caseItem.status === "open" ? <ClinicActionButton size="compact" disabled={openingCaseId !== null} onClick={() => openDetail("caseId", caseItem.chiefComplaintId)}>{opening ? "Opening…" : "Start work"}</ClinicActionButton> : null}<button className="secondaryAction" type="button" onClick={() => setStatusTarget({ caseId: caseItem.chiefComplaintId, patientId: patient.patientId, rowVersion: caseItem.rowVersion, title: caseItem.chiefComplaint, status: caseItem.status, pendingStageCount: 0, pendingStageNames: [] })}>Update</button></div>; } },
      ]}
    />
    </StandardPageScroll>
    {statusTarget ? <CaseStatusUpdateModal caseTitle={statusTarget.title} currentStatus={statusTarget.status} pendingStageCount={statusTarget.pendingStageCount} pendingStageNames={statusTarget.pendingStageNames} onClose={() => setStatusTarget(null)} onSave={updateCaseStatus} /> : null}
    {newCase ? (
      <ClinicModal
        title="Create chief complaint"
        description={newCase.patient ? `New case for ${newCase.patient.fullName} · ${newCase.patient.patientNumber}` : "Search and select the registered patient first."}
        onClose={() => !newCaseBusy && setNewCase(null)}
        closeDisabled={newCaseBusy}
        maxWidth={620}
      >
        <div className={styles.caseForm}>
          {newCase.patient ? (
            <section aria-label="Selected patient" className={styles.selectedPatient}>
              <strong>{newCase.patient.fullName}</strong>
              <span>{newCase.patient.patientNumber}</span>
              <button
                type="button"
                onClick={() => {
                  setNewCase({ ...newCase, patient: null });
                  setNewCasePatientQuery("");
                  setNewCasePatients([]);
                  setNewCasePatientIndex(-1);
                }}
              >
                Change patient
              </button>
            </section>
          ) : (
            <div className={styles.caseField}>
              <label htmlFor="new-case-patient-search">Find patient</label>
              <input
                id="new-case-patient-search"
                autoFocus
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                name="sajilo-new-case-patient-lookup"
                data-1p-ignore
                data-lpignore="true"
                role="combobox"
                aria-autocomplete="list"
                aria-controls="new-case-patient-matches"
                aria-expanded={newCasePatients.length > 0}
                aria-activedescendant={newCasePatientIndex >= 0 ? `new-case-patient-match-${newCasePatients[newCasePatientIndex]?.patientId}` : undefined}
                value={newCasePatientQuery}
                onChange={(event) => updateNewCasePatientQuery(event.target.value)}
                onKeyDown={handleNewCasePatientKeyDown}
                placeholder="Search by name, record ID or phone"
              />
              {newCasePatients.length ? (
                <div className={styles.patientMatches} id="new-case-patient-matches" role="listbox" aria-label="Patient suggestions">
                  {newCasePatients.map((patient, index) => (
                    <button
                      aria-selected={index === newCasePatientIndex}
                      className={index === newCasePatientIndex ? styles.patientMatchActive : undefined}
                      id={`new-case-patient-match-${patient.patientId}`}
                      key={patient.patientId}
                      ref={index === newCasePatientIndex ? activePatientMatchRef : undefined}
                      role="option"
                      type="button"
                      onClick={() => chooseNewCasePatient(patient)}
                    >
                      {patient.fullName}
                      <small>{patient.patientNumber}{patient.phone ? ` · ${patient.phone}` : ""}</small>
                    </button>
                  ))}
                </div>
              ) : newCaseSearchBusy ? <small className={styles.patientSearchHint}>Searching registered patients…</small> : newCasePatientQuery ? <small className={styles.patientSearchHint}>No matching registered patient.</small> : null}
            </div>
          )}
          <div className={styles.caseField}>
            <label htmlFor="new-case-complaint">Chief complaint</label>
            <textarea
              ref={newCaseComplaintRef}
              id="new-case-complaint"
              disabled={!newCase.patient}
              value={newCase.complaint}
              maxLength={1000}
              onChange={(event) => setNewCase({ ...newCase, complaint: event.target.value })}
              placeholder="e.g. Pain in lower right molar"
            />
          </div>
          <div className={styles.modalActions}>
            <button className="secondaryAction" disabled={newCaseBusy} type="button" onClick={() => setNewCase(null)}>Cancel</button>
            <button className="primaryAction" disabled={newCaseBusy || !newCase.patient} type="button" onClick={() => void createCase()}>{newCaseBusy ? "Saving…" : "Save case"}</button>
          </div>
        </div>
      </ClinicModal>
    ) : null}
  </section>;
}
