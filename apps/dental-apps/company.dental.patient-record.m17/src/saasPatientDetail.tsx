import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PatientDrawer from "@/features/patients/components/PatientDrawer";
import type { PatientDetail as SaaSPatientDetail, LabOrder as SaaSLabOrder, LabSupplier as SaaSLabSupplier } from "@/features/patients/model/domain";
import { formatDateShort, todayISO } from "@/features/patients/model/domain";
import type { Case } from "@/features/work-entry/model/caseData";
import type { PatientCanalMeasurement as SaaSPatientCanalMeasurement } from "@/features/patients/types";
import type { ToothPerioData, XrayImage } from "@/features/work-entry/model/chartData";
import { ClinicRoleProvider } from "@/shell/session/ClinicRoleContext";
import { PatientMediaProvider } from "./saasMediaContext";
import type { PatientDetail as PatientDetailType } from "@/features/patients/model/domain";
import type { PatientCore, PatientMediaAsset, PatientTreatmentPlan, PatientTimelineEvent, PatientNote, PatientPrescription, PatientLedger, PatientFollowUp, PatientPaymentInput } from "./types";
import { errorText, useApp } from "./main";

type ReadResult<T> = { value: T; error: string | null };
type LoadedRead<T> = ReadResult<T> & { loading: boolean; loaded: boolean };
function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason ?? new Error("Request stopped locally.")); return; }
    const finish = () => { signal.removeEventListener("abort", abort); resolve(); };
    const timeout = setTimeout(finish, delay);
    const abort = () => {
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      reject(signal.reason ?? new Error("Request stopped locally."));
    };
    signal.addEventListener("abort", abort, { once: true });
  });
}
async function readWithBrokerCapacityRetry<T>(load: () => Promise<T>, signal: AbortSignal): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    if (signal.aborted) throw signal.reason ?? new Error("Request stopped locally.");
    try { return await load(); }
    catch (cause) {
      const capacityRejected = !!cause && typeof cause === "object" && "code" in cause
        && (cause as { code?: unknown }).code === "BUSY";
      if (!capacityRejected || attempt >= 2 || signal.aborted) throw cause;
      // BUSY is a pre-dispatch rejection. Retry only these idempotent GETs, with a short bound.
      await waitForRetry(200 * (attempt + 1), signal);
    }
  }
}
async function read<T>(load: () => Promise<T>, empty: T, signal: AbortSignal): Promise<LoadedRead<T>> {
  try { return { value: await readWithBrokerCapacityRetry(load, signal), error: null, loading: false, loaded: true }; }
  catch (cause) {
    if (signal.aborted) return { value: empty, error: null, loading: false, loaded: false };
    return { value: empty, error: errorText(cause), loading: false, loaded: true };
  }
}
function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
function arrayFrom<T>(value: unknown, key: string): T[] {
  const row = record(value);
  return row && Array.isArray(row[key]) ? row[key] as T[] : [];
}
function ageFromDateOfBirth(value: string | null): number {
  if (!value) return 0;
  const birth = new Date(`${value}T00:00:00.000Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  if (now.getUTCMonth() < birth.getUTCMonth() || (now.getUTCMonth() === birth.getUTCMonth() && now.getUTCDate() < birth.getUTCDate())) age -= 1;
  return Math.max(0, age);
}
function legacyPatient(core: PatientCore, plans: PatientTreatmentPlan[], timeline: PatientTimelineEvent[], balance: number): SaaSPatientDetail {
  const safetyAlerts = [
    ...core.allergies.filter((allergy) => allergy.status === "active").map((allergy) => `${allergy.allergen} allergy`),
    ...(core.medicalProfile.conditionsSummary ? [core.medicalProfile.conditionsSummary] : []),
  ];
  return {
    id: core.patientId,
    patientNumber: core.patientNumber,
    createdAt: `${core.registeredOn}T00:00:00.000Z`,
    name: core.fullName,
    age: core.ageYears ?? ageFromDateOfBirth(core.dateOfBirth),
    sex: core.sex === "female" ? "F" : "M",
    language: core.preferredLanguage ?? "",
    alerts: safetyAlerts,
    balance,
    planTitle: plans[0]?.chiefComplaint ?? "",
    planDone: plans.flatMap((plan) => plan.protocols).flatMap((protocol) => protocol.stages).filter((stage) => stage.status === "done").length,
    planTotal: plans.flatMap((plan) => plan.protocols).flatMap((protocol) => protocol.stages).length,
    teeth: [...new Set(timeline.map((event) => event.toothCode).filter((tooth): tooth is string => Boolean(tooth)))],
    visits: timeline.filter((event) => event.eventType === "clinical_work").map((event) => ({
      visitId: event.eventId,
      caseId: event.chiefComplaintId ?? undefined,
      date: formatDateShort(event.occurredOn),
      doctor: event.doctors.join(", "),
      doctors: event.doctors,
      procedure: event.title,
      note: event.detail ?? undefined,
      tooth: event.toothCode ?? undefined,
    })),
    notes: "",
    phone: core.phone ?? undefined,
    address: core.address ?? undefined,
    emergencyContact: core.emergencyContactName || core.emergencyContactPhone ? {
      name: core.emergencyContactName ?? "",
      relation: "",
      phone: core.emergencyContactPhone ?? "",
    } : undefined,
  };
}
function workerLabOrder(order: Record<string, unknown>, name: string): SaaSLabOrder {
  const status = order.status === "sent" ? "Sent" : order.status === "received" ? "Received" : order.status === "fitted" ? "Fitted" : "Pending";
  return {
    id: String(order.labOrderId ?? ""),
    patientId: String(order.patientId ?? ""),
    patientName: String(order.patientName ?? name),
    procedure: String(order.labWorkName ?? ""),
    tooth: String(order.toothScope ?? ""),
    shade: String(order.shade ?? ""),
    labId: String(order.supplierId ?? ""),
    labName: String(order.labNameSnapshot ?? ""),
    sentDate: String(order.sentOn ?? ""),
    status,
    notes: String(order.receptionNote ?? order.clinicalNote ?? "") || undefined,
    caseId: String(order.chiefComplaintId ?? ""),
    ...(order.status === "cancelled" ? { voidedAt: String(order.updatedAt ?? ""), voidReason: String(order.receptionNote ?? "Cancelled") } : {}),
  } as SaaSLabOrder;
}
function legacySupplier(value: Record<string, unknown>): SaaSLabSupplier {
  return {
    id: String(value.supplierId ?? ""),
    name: String(value.name ?? ""),
    contactPerson: "",
    phone: "",
    email: "",
    address: "",
    active: value.active === true,
  } as SaaSLabSupplier;
}
function toPerio(teeth: Array<Record<string, unknown>>): Record<string, ToothPerioData> {
  return Object.fromEntries(teeth.filter((tooth) => typeof tooth.toothCode === "string").map((tooth) => [
    tooth.toothCode as string,
    { tooth: tooth.toothCode as string, probingDepths: tooth.probingDepths, recession: tooth.recession, bop: tooth.bleedingOnProbing, mobility: tooth.mobilityGrade } as ToothPerioData,
  ]));
}
function perioForApi(teeth: Record<string, ToothPerioData>) {
  return Object.values(teeth).map((tooth) => ({ toothCode: tooth.tooth, probingDepths: tooth.probingDepths, recession: tooth.recession, bleedingOnProbing: tooth.bop, mobilityGrade: tooth.mobility }));
}

type SnapshotValues = {
  core: PatientCore | null;
  plans: PatientTreatmentPlan[];
  timeline: PatientTimelineEvent[];
  notes: PatientNote[];
  prescriptions: PatientPrescription[];
  followUps: PatientFollowUp[];
  ledger: PatientLedger | null;
  media: PatientMediaAsset[];
  periodontal: unknown;
  canals: unknown;
  labOrders: Record<string, unknown>[];
  suppliers: SaaSLabSupplier[];
  staff: string[];
};
type SnapshotKey = keyof SnapshotValues;
type Snapshot = { [K in SnapshotKey]: LoadedRead<SnapshotValues[K]> };
type PatientSection = "profile" | "cases" | "notes" | "timeline" | "periodontal" | "plan" | "lab" | "xrays" | "prescriptions" | "followups" | "ledger";
const SECTION_READS: Record<PatientSection, SnapshotKey[]> = {
  profile: ["staff"],
  cases: ["plans"],
  notes: ["notes"],
  timeline: ["plans", "timeline"],
  periodontal: ["periodontal"],
  plan: ["plans", "timeline", "canals"],
  lab: ["labOrders", "suppliers"],
  xrays: ["media"],
  prescriptions: ["prescriptions"],
  followups: ["followUps"],
  ledger: ["ledger"],
};
function emptyRead<T>(value: T): LoadedRead<T> { return { value, error: null, loading: false, loaded: false }; }
function emptySnapshot(): Snapshot {
  return {
    core: emptyRead(null), plans: emptyRead([]), timeline: emptyRead([]), notes: emptyRead([]),
    prescriptions: emptyRead([]), followUps: emptyRead([]), ledger: emptyRead(null), media: emptyRead([]),
    periodontal: emptyRead(null), canals: emptyRead(null), labOrders: emptyRead([]), suppliers: emptyRead([]), staff: emptyRead([]),
  };
}
function invalidateRead<K extends SnapshotKey>(snapshot: Snapshot, key: K): Snapshot {
  return { ...snapshot, [key]: { ...snapshot[key], error: null, loaded: false } } as Snapshot;
}

export function SaaSPatientDetail({ patientId }: { patientId: string }) {
  const { api, media, session, run, capabilities } = useApp();
  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const snapshotRef = useRef(snapshot);
  const inFlightReads = useRef(new Map<SnapshotKey, AbortController>());
  const activeSectionRef = useRef<PatientSection | null>(null);
  const [activeSection, setActiveSection] = useState<PatientSection | null>(null);
  const [revision, setRevision] = useState(0);
  const updateSnapshot = useCallback((update: (current: Snapshot) => Snapshot) => {
    const next = update(snapshotRef.current);
    snapshotRef.current = next;
    setSnapshot(next);
  }, []);
  const loadField = useCallback(<K extends SnapshotKey,>(
    key: K,
    empty: SnapshotValues[K],
    load: (signal: AbortSignal) => Promise<SnapshotValues[K]>,
    controller: AbortController,
  ) => {
    if (snapshotRef.current[key].loaded || inFlightReads.current.has(key)) return;
    inFlightReads.current.set(key, controller);
    updateSnapshot((current) => ({
      ...current,
      [key]: { ...current[key], loading: true, error: null },
    } as Snapshot));
    void read(() => load(controller.signal), empty, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      updateSnapshot((current) => ({ ...current, [key]: result } as Snapshot));
    }).finally(() => {
      if (inFlightReads.current.get(key) === controller) inFlightReads.current.delete(key);
    });
  }, [updateSnapshot]);
  const cancelReads = useCallback((controller: AbortController, keys: SnapshotKey[]) => {
    controller.abort();
    const cancelled = keys.filter((key) => inFlightReads.current.get(key) === controller);
    for (const key of cancelled) inFlightReads.current.delete(key);
    if (cancelled.length) updateSnapshot((current) => cancelled.reduce((next, key) => ({
      ...next,
      [key]: { ...next[key], loading: false, loaded: false },
    } as Snapshot), current));
  }, [updateSnapshot]);
  const selectSection = useCallback((section: PatientSection) => {
    activeSectionRef.current = section;
    setActiveSection(section);
  }, []);
  const refresh = useCallback(() => {
    updateSnapshot((current) => {
      let next = invalidateRead(current, "core");
      const active = activeSectionRef.current;
      if (active) for (const key of SECTION_READS[active]) next = invalidateRead(next, key);
      return next;
    });
    setRevision((value) => value + 1);
  }, [updateSnapshot]);
  const execute = useCallback(async <T,>(label: string, command: import("../../../clinic-app-runtime/browserClinicClient").ClinicCommand<T>): Promise<T> => {
    let result!: T;
    await run(label, command, (value) => { result = value; refresh(); });
    return result;
  }, [refresh, run]);

  useEffect(() => {
    const controller = new AbortController();
    loadField("core", null, (signal) => api.core(patientId, signal), controller);
    return () => cancelReads(controller, ["core"]);
  }, [api, cancelReads, loadField, patientId, revision]);

  const canReadLedger = capabilities.has("patient_billing_ledger.read");
  const canReadClinicalCharts = capabilities.has("work_entry.access");
  const canReadLabs = capabilities.has("lab_tracker.access");
  useEffect(() => {
    if (!activeSection) return;
    const controller = new AbortController();
    const keys: SnapshotKey[] = [];
    const queue = <K extends SnapshotKey,>(key: K, empty: SnapshotValues[K], load: (signal: AbortSignal) => Promise<SnapshotValues[K]>) => {
      keys.push(key);
      loadField(key, empty, load, controller);
    };
    switch (activeSection) {
      case "profile":
        queue("staff", [], (signal) => api.staffReferences(signal).then((value) => {
          const staff = arrayFrom<Record<string, unknown>>(value, "doctors");
          return staff.map((person) => String(person.name ?? "")).filter(Boolean);
        }));
        break;
      case "cases":
        queue("plans", [], (signal) => api.plans(patientId, signal));
        break;
      case "notes":
        queue("notes", [], (signal) => api.notes(patientId, signal));
        break;
      case "timeline":
        queue("plans", [], (signal) => api.plans(patientId, signal));
        queue("timeline", [], (signal) => api.timeline(patientId, signal));
        break;
      case "periodontal":
        if (canReadClinicalCharts) queue("periodontal", null, (signal) => api.periodontal(patientId, signal));
        break;
      case "plan":
        queue("plans", [], (signal) => api.plans(patientId, signal));
        queue("timeline", [], (signal) => api.timeline(patientId, signal));
        if (canReadClinicalCharts) queue("canals", null, (signal) => api.canals(patientId, signal));
        break;
      case "lab":
        if (canReadLabs) {
          queue("labOrders", [], (signal) => api.labOrders(patientId, signal).then((value) => arrayFrom<Record<string, unknown>>(value, "labOrders")));
          queue("suppliers", [], (signal) => api.labSuppliers(signal).then((rows) => rows.map((row) => legacySupplier(row as unknown as Record<string, unknown>))));
        }
        break;
      case "xrays":
        queue("media", [], (signal) => api.media(patientId, signal));
        break;
      case "prescriptions":
        queue("prescriptions", [], (signal) => api.prescriptions(patientId, signal));
        break;
      case "followups":
        queue("followUps", [], (signal) => api.followUps(patientId, signal));
        break;
      case "ledger":
        if (canReadLedger) queue("ledger", null, (signal) => api.ledger(patientId, "", "", signal));
        break;
    }
    return () => cancelReads(controller, keys);
  }, [activeSection, api, canReadClinicalCharts, canReadLabs, canReadLedger, cancelReads, loadField, patientId, revision]);

  const core = snapshot.core.value;
  const plans = snapshot.plans.value;
  const timeline = snapshot.timeline.value;
  const patientLedger = snapshot.ledger.value;
  const selectedPatient = useMemo(() => core ? legacyPatient(core, plans, timeline, patientLedger?.summary.outstandingDue ?? 0) : null, [core, plans, timeline, patientLedger]);
  const rawLabOrder = (id: string) => snapshot.labOrders.value.find((order) => String(order.labOrderId) === id);
  const role = session.clinicUser.role === "admin" ? "admin" : session.clinicUser.role === "doctor" ? "doctor" : "assistant";
  const labOrders = useMemo(() => snapshot.labOrders.value.map((order) => workerLabOrder(order, core?.fullName ?? "Patient")), [snapshot.labOrders.value, core?.fullName]);
  const xrayRows = useMemo<XrayImage[]>(() => snapshot.media.value.filter((asset) => asset.status === "active").map((asset) => ({
    id: asset.mediaAssetId,
    imageId: asset.mediaAssetId,
    patientId: asset.patientId,
    patientName: core?.fullName ?? "Patient",
    date: asset.capturedOn ?? asset.createdAt.slice(0, 10),
    recordedAt: asset.createdAt,
    type: asset.xrayType ?? "IOPA",
    tooth: asset.toothCode ?? undefined,
    note: asset.clinicalNote ?? undefined,
    isCloudflareImage: true,
  })), [snapshot.media.value, core?.fullName]);

  if (!snapshot.core.loaded && !snapshot.core.error) return <main className="saasAdapterMessage" role="status">Loading patient record…</main>;
  if (!selectedPatient) return <main className="saasAdapterMessage" role="alert">
    <h2>Patient record unavailable</h2><p>{snapshot.core.error ?? "The clinic could not load this patient record."}</p>
    <button type="button" onClick={refresh}>Retry</button>
  </main>;

  const perioChart = record(record(snapshot.periodontal.value)?.chart);
  const perioTeeth = Array.isArray(perioChart?.teeth) ? perioChart.teeth as Record<string, unknown>[] : [];
  const currentPerio = toPerio(perioTeeth);
  const lastPerioDate = typeof perioChart?.lastChartedOn === "string" ? perioChart.lastChartedOn : undefined;
  const rawCanals = arrayFrom<SaaSPatientCanalMeasurement>(snapshot.canals.value, "sessions");
  const profileSave = async (patch: Partial<PatientDetailType>) => {
    const current = core;
    if (!current) throw new Error("The patient profile is not available.");
    const alerts = patch.alerts ?? selectedPatient.alerts;
    const originalCondition = current.medicalProfile.conditionsSummary;
    const allergyNames = alerts.filter((alert) => alert !== originalCondition).map((alert) => alert.replace(/\s+allergy$/i, "").trim()).filter(Boolean);
    const previous = new Map(current.allergies.filter((allergy) => allergy.status === "active").map((allergy) => [allergy.allergen.toLowerCase(), allergy]));
    const allergies = allergyNames.map((allergen) => {
      const existing = previous.get(allergen.toLowerCase());
      return existing ? { allergen: existing.allergen, reaction: existing.reaction, severity: existing.severity, note: existing.note, recordedOn: existing.recordedOn } : {
        allergen, reaction: null, severity: "unknown" as const, note: null, recordedOn: todayISO(),
      };
    });
    const { rowVersion: medicalRowVersion, ...medicalProfile } = current.medicalProfile;
    const input = {
      expectedPatientRowVersion: current.rowVersion,
      expectedMedicalProfileRowVersion: medicalRowVersion,
      patient: {
        fullName: patch.name ?? current.fullName,
        preferredLanguage: patch.language ?? current.preferredLanguage,
        ageYears: patch.age ?? current.ageYears,
        sex: current.sex === "other" || current.sex === "not_recorded" ? current.sex : patch.sex === "F" ? "female" as const : "male" as const,
        phone: patch.phone ?? current.phone,
        address: patch.address ?? current.address,
        emergencyContactName: patch.emergencyContact?.name ?? current.emergencyContactName,
        emergencyContactPhone: patch.emergencyContact?.phone ?? current.emergencyContactPhone,
      },
      medicalProfile,
      allergies,
    };
    await execute("Update patient profile", api.updateProfile(patientId, input));
  };

  const createPatientNote = async (body: string) => {
    const result = await execute("Create patient note", api.createNote({ patientId, chiefComplaintId: null, noteType: "general", noteDate: todayISO(), body }));
    return result.note as PatientNote;
  };
  const withdrawPatientNote = async (noteId: string, reason: string) => {
    const result = await execute("Withdraw patient note", api.withdrawNote(noteId, reason));
    return result.note as PatientNote;
  };
  const correctPrescription = async (prescription: PatientPrescription, items: PatientPrescription["items"], reason: string) => {
    await execute("Correct prescription", api.correctPrescription(prescription.prescriptionId, {
      patientId, chiefComplaintId: prescription.chiefComplaintId, prescribedOn: todayISO(), note: prescription.note,
      items, reason, expectedRowVersion: prescription.rowVersion,
    }));
  };
  const updateOrderStatus = async (orderId: string, status: SaaSLabOrder["status"], _paymentDate?: string) => {
    const order = rawLabOrder(orderId);
    if (!order || !Number.isInteger(order.rowVersion)) throw new Error("This lab order changed. Reload it before updating its status.");
    const target = status === "Sent" ? "sent" : status === "Received" ? "received" : status === "Fitted" ? "fitted" : "pending_assignment";
    await execute("Update lab order status", api.updateLab(orderId, { expectedRowVersion: order.rowVersion as number, status: target }));
  };
  const assignPendingOrder = async (orderId: string, input: { supplierId: string; labWorkName: string; toothScope: string | null; shade: string | null; sentOn: string; receptionNote: string | null }) => {
    const order = rawLabOrder(orderId);
    if (!order || !Number.isInteger(order.rowVersion)) throw new Error("This lab order changed. Reload it before assigning a supplier.");
    await execute("Assign lab supplier", api.assignLabOrder(orderId, { ...input, expectedRowVersion: order.rowVersion as number }));
  };
  const periodForApiSave = async (teeth: Record<string, ToothPerioData>) => {
    await execute("Save periodontal chart", api.savePeriodontal(patientId, { patientId, chiefComplaintId: null, recordedOn: todayISO(), teeth: perioForApi(teeth) }));
  };
  const createFollowUp = async (input: Omit<import("./types").FollowUpCreateInput, "patientId">) => {
    const result = await execute("Schedule follow-up", api.createFollowUp({ ...input, patientId }));
    return result.followUp as PatientFollowUp;
  };
  const changeCaseStatus = async (caseId: string, input: { patientId: string; expectedRowVersion: number; status: "open" | "completed" | "closed"; reason: string | null }) => {
    await execute("Update chief complaint", api.updateCaseStatus(caseId, input));
  };
  const recordPayment = async (input: Omit<PatientPaymentInput, "patientId">) => {
    await execute("Record patient payment", api.collect({ patientId, ...input }));
  };
  const correctLedger = async (entry: PatientLedger["entries"][number], amount: number, reason: string) => {
    await execute("Correct patient ledger", api.correctLedger(entry.patientLedgerEntryId, { amount, reason, entryDate: todayISO(), expectedRowVersion: entry.rowVersion }));
  };
  const reverseLedger = async (entry: PatientLedger["entries"][number], reason: string) => {
    await execute("Reverse patient ledger entry", api.reverseLedger(entry.patientLedgerEntryId, { reason, entryDate: todayISO(), expectedRowVersion: entry.rowVersion }));
  };

  return <PatientMediaProvider sdk={media}><ClinicRoleProvider role={role}>
    <PatientDrawer
      selectedPatient={selectedPatient}
      onSubTabChange={selectSection}
      clinicName={session.clinic.displayName}
      isClosing={false}
      onClose={() => {}}
      showBackButton={false}
      patientCases={[] as Case[]}
      patientLabOrders={labOrders}
      labs={snapshot.suppliers.value}
      onUpdateOrderStatus={updateOrderStatus}
      onAssignPendingLabOrder={assignPendingOrder}
      patientXrays={xrayRows}
      patientXraysLoading={snapshot.media.loading}
      xrayLoadError={snapshot.media.error}
      onMediaChanged={refresh}
      onRemoveXray={async (id, reason) => { await execute("Withdraw patient X-ray", api.withdrawMedia(id, reason)); }}
      currentPerio={currentPerio}
      patientPeriodontalLoading={snapshot.periodontal.loading}
      patientPeriodontalError={snapshot.periodontal.error}
      lastPerioDate={lastPerioDate}
      onSavePerioChart={periodForApiSave}
      patientPrescriptions={snapshot.prescriptions.value}
      patientPrescriptionsLoading={snapshot.prescriptions.loading}
      patientPrescriptionsError={snapshot.prescriptions.error}
      onWithdrawPrescription={async (prescription, reason) => { await execute("Withdraw prescription", api.withdrawPrescription(prescription.prescriptionId, prescription.rowVersion, reason)); }}
      onCorrectPrescription={correctPrescription}
      patientNotes={snapshot.notes.value}
      patientNotesLoading={snapshot.notes.loading}
      patientNotesError={snapshot.notes.error}
      onCreatePatientNote={createPatientNote}
      onWithdrawPatientNote={withdrawPatientNote}
      patientTimeline={timeline}
      patientTimelineLoading={snapshot.timeline.loading}
      patientTimelineError={snapshot.timeline.error}
      onUpdatePatient={(_id, patch) => profileSave(patch)}
      followUpList={[]}
      doctorsList={snapshot.staff.value}
      procedureCatalog={[]}
      patientCanalMeasurements={rawCanals}
      patientLabLoading={snapshot.labOrders.loading || snapshot.suppliers.loading}
      patientLabError={snapshot.labOrders.error ?? snapshot.suppliers.error}
      patientCanalMeasurementsLoading={snapshot.canals.loading}
      patientCanalMeasurementsError={snapshot.canals.error}
      canViewBillingLedger={capabilities.has("patient_billing_ledger.read")}
      patientLedger={patientLedger}
      ledgerLoading={snapshot.ledger.loading}
      ledgerError={snapshot.ledger.error}
      onCorrectLedgerEntry={correctLedger}
      onReverseLedgerEntry={reverseLedger}
      onRecordPatientPayment={recordPayment}
      patientCoreError={snapshot.core.error}
      patientFollowUps={snapshot.followUps.value}
      patientFollowUpsLoading={snapshot.followUps.loading}
      patientFollowUpsError={snapshot.followUps.error}
      onCreatePatientFollowUp={createFollowUp}
      patientTreatmentPlans={plans}
      patientTreatmentPlansLoading={snapshot.plans.loading}
      patientTreatmentPlansError={snapshot.plans.error}
      onUpdateCaseStatus={changeCaseStatus}
    />
  </ClinicRoleProvider></PatientMediaProvider>;
}
