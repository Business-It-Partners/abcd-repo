import { useEffect, useState } from "react";
import CaseEntryView from "@/features/work-entry/components/CaseEntryView";
import { defaultFeeSchedule, type TreatmentProtocol, type ProtocolStage, type CaseEntryData, type Case } from "@/features/work-entry/model/caseData";
import type { ClinicProfile, PatientDetail as SaaSPatientDetail, LabSupplier as SaaSLabSupplier } from "@/features/patients/model/domain";
import type { PatientDirectoryCriteria } from "@/features/patients/hooks/useServerPatientDirectory";
import type { PatientTreatmentProtocolReference, PatientLabSupplier } from "./api";
import type { PatientIntakeInput } from "./types";
import { useApp } from "./main";

function legacyPatient(patient: { patientId: string; patientNumber: string; fullName: string; registeredOn: string; ageYears: number | null; sex: string | null; phone: string | null }): SaaSPatientDetail {
  return {
    id: patient.patientId,
    patientNumber: patient.patientNumber,
    createdAt: `${patient.registeredOn}T00:00:00.000Z`,
    name: patient.fullName,
    age: patient.ageYears ?? 0,
    sex: patient.sex === "female" ? "F" : "M",
    language: "",
    alerts: [],
    balance: 0,
    planTitle: "",
    planDone: 0,
    planTotal: 0,
    teeth: [],
    visits: [],
    notes: "",
    phone: patient.phone ?? undefined,
  };
}
function legacySupplier(supplier: PatientLabSupplier): SaaSLabSupplier {
  return { id: supplier.supplierId, name: supplier.name, contactPerson: "", phone: "", email: "", address: "", active: supplier.active, openingBalance: 0, openingAsOf: "", isLab: true };
}
function scope(value: string | undefined): ProtocolStage["toothScope"] {
  if (value === "arch") return "arch";
  if (value === "full-mouth" || value === "full_mouth") return "full-mouth";
  return "tooth";
}
function mappedStages(stages: PatientTreatmentProtocolReference["stages"]): ProtocolStage[] {
  return stages.map((stage, index) => ({
    order: index + 1,
    label: stage.label,
    procedureCode: stage.sourceProtocolStageId ?? stage.label,
    sourceProtocolStageId: stage.sourceProtocolStageId,
    toothScope: scope(stage.toothScope),
    recallIntervalDays: 0,
    defaultCost: stage.defaultCost,
  }));
}
function legacyProtocol(protocol: PatientTreatmentProtocolReference): TreatmentProtocol {
  return {
    id: protocol.id,
    name: protocol.name,
    category: "Dental treatment",
    recordCanals: protocol.recordCanals,
    stages: mappedStages(protocol.stages),
    grades: protocol.grades?.map((grade) => ({ id: grade.id, label: grade.label, stages: mappedStages(grade.stages) })),
  };
}
function nullable(value: string | undefined): string | null { return value?.trim() || null; }
function normalizeSeverity(value: string | undefined): PatientIntakeInput["allergies"][number]["severity"] {
  const severity = value?.trim().toLowerCase();
  return severity === "mild" || severity === "moderate" || severity === "severe" ? severity : "unknown";
}
function medicalProfile(entry: CaseEntryData): PatientIntakeInput["medicalProfile"] {
  const history = entry.medicalHistory;
  if (!history) return { conditionsSummary: null, currentMedicationsSummary: null, habitsSummary: null, medicalNotes: null, verifiedOn: null };
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
    currentMedicationsSummary: history.medications.map((medication) => medication.name).filter(Boolean).join(", ") || null,
    habitsSummary: habits || null,
    medicalNotes: entry.dentalHistory?.notes ?? null,
    verifiedOn: entry.dateISO,
  };
}
function intakeInput(entry: CaseEntryData): PatientIntakeInput {
  const patient = entry.newPatient;
  if (!entry.isNewPatient || !patient) throw new Error("Choose a new patient profile before saving this registration.");
  const complaintPlan = entry.planSelections.length ? {
    chiefComplaint: entry.chiefComplaint,
    openedOn: entry.dateISO,
    plans: entry.planSelections,
  } : undefined;
  return {
    fullName: entry.patientName.trim(),
    preferredLanguage: null,
    dateOfBirth: patient.dateOfBirth,
    ageYears: patient.ageYears,
    sex: patient.sex,
    phone: nullable(patient.phone),
    address: nullable(patient.address),
    emergencyContactName: nullable(patient.emergencyContact?.name),
    emergencyContactPhone: nullable(patient.emergencyContact?.phone),
    registeredOn: entry.dateISO,
    medicalProfile: medicalProfile(entry),
    allergies: (entry.medicalHistory?.allergies ?? []).map((allergy) => ({
      allergen: allergy.substance.trim(),
      reaction: null,
      severity: normalizeSeverity(allergy.severity),
      note: null,
      recordedOn: entry.dateISO,
    })),
    ...(complaintPlan ? { complaintPlan } : {}),
  };
}

export function SaaSPatientIntake({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const { api, run, session, capabilities } = useApp();
  const [patients, setPatients] = useState<SaaSPatientDetail[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [labs, setLabs] = useState<SaaSLabSupplier[]>([]);
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [nextPatientNumber, setNextPatientNumber] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const criteria: PatientDirectoryCriteria = { query: "", cohort: "all", month: "" };
    void Promise.allSettled([
      api.directory({ ...criteria, cursor: null, limit: 10 }),
      api.staffReferences(),
      api.context(),
      capabilities.has("lab_tracker.access") ? api.labSuppliers() : Promise.resolve([]),
      capabilities.has("work_entry.access") ? api.treatmentProtocols() : Promise.resolve([]),
    ]).then((results) => {
      if (!active) return;
      const [directory, references, context, suppliers, treatmentProtocols] = results;
      if (directory.status === "fulfilled") setPatients(directory.value.patients.map(legacyPatient));
      if (references.status === "fulfilled") {
        const doctors = references.value && typeof references.value === "object" && Array.isArray((references.value as { doctors?: unknown[] }).doctors)
          ? (references.value as { doctors: Array<{ name?: string }> }).doctors.map((person) => String(person.name ?? "")).filter(Boolean)
          : [];
        setDoctors(doctors);
      }
      if (context.status === "fulfilled") setNextPatientNumber(context.value.nextPatientNumber);
      if (suppliers.status === "fulfilled") setLabs(suppliers.value.map(legacySupplier));
      if (treatmentProtocols.status === "fulfilled") setProtocols(treatmentProtocols.value.map(legacyProtocol));
    });
    return () => { active = false; };
  }, [api, capabilities]);

  const clinic: ClinicProfile = {
    id: "",
    name: session.clinic.displayName,
    address: "",
    phone: "",
    adminEmail: "",
    active: true,
    createdAt: "",
  };

  return <CaseEntryView
    patients={patients}
    doctorsList={doctors}
    labs={labs}
    clinic={clinic}
    feeSchedule={defaultFeeSchedule}
    protocols={protocols}
    cases={{} as Record<string, Case[]>}
    onExit={() => { onSaved(); onBack(); }}
    hideHeaderBack
    hideStepTabs
    nextPatientNumber={nextPatientNumber}
    successTitle="Patient record saved successfully"
    successBody="The patient record and safety profile have been saved."
    onCreateCase={async (entry) => {
      const input = intakeInput(entry);
      await run("Register patient", api.createIntake(input), (result) => {
        if (!result.patient?.patientId) throw new Error("The clinic did not return a patient identifier.");
        onSaved();
      });
    }}
  />;
}
