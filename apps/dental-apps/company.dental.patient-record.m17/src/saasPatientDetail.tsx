import { useCallback, useEffect, useMemo, useState } from "react";
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
async function read<T>(promise: Promise<T>, empty: T): Promise<ReadResult<T>> {
  try { return { value: await promise, error: null }; }
  catch (cause) { return { value: empty, error: errorText(cause) }; }
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

type Snapshot = {
  core: ReadResult<PatientCore | null>;
  plans: ReadResult<PatientTreatmentPlan[]>;
  timeline: ReadResult<PatientTimelineEvent[]>;
  notes: ReadResult<PatientNote[]>;
  prescriptions: ReadResult<PatientPrescription[]>;
  followUps: ReadResult<PatientFollowUp[]>;
  ledger: ReadResult<PatientLedger | null>;
  media: ReadResult<PatientMediaAsset[]>;
  odontogram: ReadResult<unknown>;
  periodontal: ReadResult<unknown>;
  canals: ReadResult<unknown>;
  labOrders: ReadResult<Record<string, unknown>[]>;
  suppliers: ReadResult<SaaSLabSupplier[]>;
  staff: ReadResult<string[]>;
};

export function SaaSPatientDetail({ patientId }: { patientId: string }) {
  const { api, media, session, run, capabilities } = useApp();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadError, setReloadError] = useState<string | null>(null);
  const refresh = useCallback(() => setRevision((value) => value + 1), []);
  const execute = useCallback(async <T,>(label: string, command: import("../../../../packages/app-sdk/src/clinicClient").ClinicCommand<T>): Promise<T> => {
    let result!: T;
    await run(label, command, (value) => { result = value; refresh(); });
    return result;
  }, [refresh, run]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setReloadError(null);
    const canReadLedger = capabilities.has("patient_billing_ledger.read");
    const canReadClinicalCharts = capabilities.has("work_entry.access");
    const canReadLabs = capabilities.has("lab_tracker.access");
    void Promise.all([
      read(api.core(patientId), null),
      read(api.plans(patientId), []),
      read(api.timeline(patientId), []),
      read(api.notes(patientId), []),
      read(api.prescriptions(patientId), []),
      read(api.followUps(patientId), []),
      read(canReadLedger ? api.ledger(patientId) : Promise.resolve(null), null),
      read(api.media(patientId), []),
      read(canReadClinicalCharts ? api.odontogram(patientId) : Promise.resolve(null), null),
      read(canReadClinicalCharts ? api.periodontal(patientId) : Promise.resolve(null), null),
      read(canReadClinicalCharts ? api.canals(patientId) : Promise.resolve(null), null),
      read(canReadLabs ? api.labOrders(patientId).then((value) => arrayFrom<Record<string, unknown>>(value, "labOrders")) : Promise.resolve([]), []),
      read(canReadLabs ? api.labSuppliers().then((rows) => rows.map((row) => legacySupplier(row as unknown as Record<string, unknown>))) : Promise.resolve([]), []),
      read(api.staffReferences().then((value) => {
        const staff = arrayFrom<Record<string, unknown>>(value, "doctors");
        return staff.map((person) => String(person.name ?? "")).filter(Boolean);
      }), []),
    ]).then(([core, plans, timeline, notes, prescriptions, followUps, ledger, imageList, odontogram, periodontal, canals, labOrders, suppliers, staff]) => {
      if (!active) return;
      const next: Snapshot = { core, plans, timeline, notes, prescriptions, followUps, ledger, media: imageList, odontogram, periodontal, canals, labOrders, suppliers, staff };
      setSnapshot(next);
      setReloadError(core.error && !core.value ? core.error : null);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, capabilities, media, patientId, revision]);

  const core = snapshot?.core.value ?? null;
  const plans = snapshot?.plans.value ?? [];
  const timeline = snapshot?.timeline.value ?? [];
  const patientLedger = snapshot?.ledger.value ?? null;
  const selectedPatient = useMemo(() => core ? legacyPatient(core, plans, timeline, patientLedger?.summary.outstandingDue ?? 0) : null, [core, plans, timeline, patientLedger]);
  const rawLabOrder = (id: string) => snapshot?.labOrders.value.find((order) => String(order.labOrderId) === id);
  const role = session.clinicUser.role === "admin" ? "admin" : session.clinicUser.role === "doctor" ? "doctor" : "assistant";
  const labOrders = useMemo(() => snapshot?.labOrders.value.map((order) => workerLabOrder(order, core?.fullName ?? "Patient")) ?? [], [snapshot, core?.fullName]);
  const xrayRows = useMemo<XrayImage[]>(() => (snapshot?.media.value ?? []).filter((asset) => asset.status === "active").map((asset) => ({
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
  })), [snapshot?.media.value, core?.fullName]);

  if (loading && !core) return <main className="saasAdapterMessage" role="status">Loading patient record…</main>;
  if (!selectedPatient) return <main className="saasAdapterMessage" role="alert">
    <h2>Patient record unavailable</h2><p>{reloadError ?? "The clinic could not load this patient record."}</p>
    <button type="button" onClick={refresh}>Retry</button>
  </main>;

  const perioChart = record(record(snapshot?.periodontal.value)?.chart);
  const perioTeeth = Array.isArray(perioChart?.teeth) ? perioChart.teeth as Record<string, unknown>[] : [];
  const currentPerio = toPerio(perioTeeth);
  const lastPerioDate = typeof perioChart?.lastChartedOn === "string" ? perioChart.lastChartedOn : undefined;
  const rawCanals = arrayFrom<SaaSPatientCanalMeasurement>(snapshot?.canals.value, "sessions");
  const rowLoading = loading;
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
      clinicName={session.clinic.displayName}
      isClosing={false}
      onClose={() => {}}
      showBackButton={false}
      patientCases={[] as Case[]}
      patientLabOrders={labOrders}
      labs={snapshot?.suppliers.value ?? []}
      onUpdateOrderStatus={updateOrderStatus}
      onAssignPendingLabOrder={assignPendingOrder}
      patientXrays={xrayRows}
      xrayLoadError={snapshot?.media.error}
      onMediaChanged={refresh}
      onRemoveXray={async (id, reason) => { await execute("Withdraw patient X-ray", api.withdrawMedia(id, reason)); }}
      currentPerio={currentPerio}
      lastPerioDate={lastPerioDate}
      onSavePerioChart={periodForApiSave}
      patientPrescriptions={snapshot?.prescriptions.value ?? []}
      patientPrescriptionsLoading={rowLoading}
      patientPrescriptionsError={snapshot?.prescriptions.error}
      onWithdrawPrescription={async (prescription, reason) => { await execute("Withdraw prescription", api.withdrawPrescription(prescription.prescriptionId, prescription.rowVersion, reason)); }}
      onCorrectPrescription={correctPrescription}
      patientNotes={snapshot?.notes.value ?? []}
      patientNotesLoading={rowLoading}
      patientNotesError={snapshot?.notes.error}
      onCreatePatientNote={createPatientNote}
      onWithdrawPatientNote={withdrawPatientNote}
      patientTimeline={timeline}
      patientTimelineLoading={rowLoading}
      patientTimelineError={snapshot?.timeline.error}
      onUpdatePatient={(_id, patch) => profileSave(patch)}
      followUpList={[]}
      doctorsList={snapshot?.staff.value ?? []}
      procedureCatalog={[]}
      patientCanalMeasurements={rawCanals}
      patientCanalMeasurementsLoading={rowLoading}
      patientCanalMeasurementsError={snapshot?.canals.error}
      canViewBillingLedger={capabilities.has("patient_billing_ledger.read")}
      patientLedger={patientLedger}
      ledgerLoading={rowLoading}
      ledgerError={snapshot?.ledger.error}
      onCorrectLedgerEntry={correctLedger}
      onReverseLedgerEntry={reverseLedger}
      onRecordPatientPayment={recordPayment}
      patientCoreError={snapshot?.core.error}
      patientFollowUps={snapshot?.followUps.value ?? []}
      patientFollowUpsLoading={rowLoading}
      patientFollowUpsError={snapshot?.followUps.error}
      onCreatePatientFollowUp={createFollowUp}
      patientTreatmentPlans={plans}
      patientTreatmentPlansLoading={rowLoading}
      patientTreatmentPlansError={snapshot?.plans.error}
      onUpdateCaseStatus={changeCaseStatus}
      patientOdontogram={arrayFrom(snapshot?.odontogram.value, "marks") as import("./types").OdontogramMark[]}
      patientOdontogramLoading={rowLoading}
      patientOdontogramError={snapshot?.odontogram.error}
    />
  </ClinicRoleProvider></PatientMediaProvider>;
}
