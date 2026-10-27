"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { PatientPlanSelectionInput, WorkEntryCase } from "@/features/patients/types";
import WorkEntryView, { type WorkEntryCommitDraft } from "@/features/work-entry/components/WorkEntryView";
import type { ToothPerioData } from "@/features/work-entry/model/chartData";
import type { CanalChartData } from "@/features/work-entry/model/canalData";
import type { PatientStepActions } from "./patientStepActions";
import type { Case, TreatmentProtocol } from "@/features/work-entry/model/caseData";
import type { PlanAppendDraft } from "@/features/work-entry/model/draftTypes";
import type { LabSupplier, PatientDetail, ProcedureCatalogItem } from "@/features/patients/model/domain";
import type { FollowUpWorklistItem } from "@/features/patients/types";

type CompletionReference = {
  patientProtocolStageId: string;
  expectedRowVersion: number;
  chargeAmount: number;
};

type InProgressWorkEntryProps = {
  patient: PatientDetail;
  workEntryCase: WorkEntryCase;
  caseDoctorNames: string[];
  doctorsList: string[];
  labs: LabSupplier[];
  protocols: TreatmentProtocol[];
  initialPerio: Record<string, ToothPerioData>;
  initialCanalData: Record<string, CanalChartData>;
  upcomingFollowUps: FollowUpWorklistItem[];
  currentOutstandingDue: number;
  canCollectPayment: boolean;
  initialStep: 1 | 2 | 4 | 5 | 6 | 7 | 8;
  onStepChange: (step: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8) => void;
  onCommit: (draft: WorkEntryCommitDraft, completedStages: CompletionReference[]) => Promise<{ workEntryCase: WorkEntryCase; chargeAmount: number }>;
  onMediaChanged: () => void | Promise<void>;
  onRemoveXray: (mediaAssetId: string, reason: string) => Promise<void>;
  onSaveCanalData: (data: CanalChartData) => Promise<void>;
  onAppendPlan: (plan: PatientPlanSelectionInput, commandId: string) => Promise<WorkEntryCase>;
  onRemovePendingStage: (patientProtocolId: string, stageId: string, expectedRowVersion: number) => Promise<WorkEntryCase>;
  renderPatientStep: (onNext: () => void, onActionsChange: (actions: PatientStepActions | null) => void) => ReactNode;
  onExit: () => void;
};

function continuationCase(workEntryCase: WorkEntryCase, caseDoctorNames: string[]): Case {
  let order = 0;
  const stages = workEntryCase.protocols.flatMap((protocol) => protocol.stages
    .slice()
    .sort((left, right) => left.stageOrder - right.stageOrder)
    .map((stage) => ({
      order: ++order,
      stageId: stage.stageId,
      stageRowVersion: stage.rowVersion,
      label: stage.stageName,
      procedureCode: stage.sourceProtocolStageId ?? stage.stageId,
      tooth: protocol.toothCode ?? protocol.treatmentArea ?? "",
      agreedCost: stage.price,
      status: stage.status === "done" ? "done" as const : stage.status === "cancelled" ? "skipped" as const : "pending" as const,
      group: protocol.protocolName,
      treatmentId: protocol.patientProtocolId,
      treatmentRowVersion: protocol.rowVersion,
    })));

  return {
    id: workEntryCase.chiefComplaintId,
    revision: workEntryCase.rowVersion,
    patientId: workEntryCase.patientId,
    patientName: workEntryCase.patientName,
    protocolId: workEntryCase.protocols[0]?.sourceProtocolId ?? "continuation",
    title: workEntryCase.chiefComplaint,
    chiefComplaint: workEntryCase.chiefComplaint,
    status: "open",
    agreedTotal: stages.reduce((total, stage) => total + stage.agreedCost, 0),
    createdDate: workEntryCase.openedOn,
    createdBy: "Clinic",
    doctors: caseDoctorNames,
    stages,
  };
}

function stageReferences(workEntryCase: WorkEntryCase): Map<number, CompletionReference> {
  let order = 0;
  return new Map<number, CompletionReference>(workEntryCase.protocols.flatMap((protocol) =>
    protocol.stages.slice().sort((left, right) => left.stageOrder - right.stageOrder).map((stage) => {
      order += 1;
      return [order, {
        patientProtocolStageId: stage.stageId,
        expectedRowVersion: stage.rowVersion,
        chargeAmount: stage.price,
      }] as const;
    }),
  ));
}

function procedureCatalogFor(workEntryCase: WorkEntryCase): ProcedureCatalogItem[] {
  const items = new Map<string, ProcedureCatalogItem>();
  for (const protocol of workEntryCase.protocols) {
    for (const stage of protocol.stages) {
      const code = stage.sourceProtocolStageId ?? stage.stageId;
      if (!items.has(code)) items.set(code, { code, name: stage.stageName, category: protocol.protocolName, defaultCost: stage.price });
    }
  }
  return Array.from(items.values());
}

function planFromDraft(draft: PlanAppendDraft, protocols: TreatmentProtocol[]): PatientPlanSelectionInput {
  const submittedCodes = draft.steps.map((step) => step.procedureCode).filter((code): code is string => Boolean(code));
  const template = protocols.find((protocol) => protocol.name.trim().toLowerCase() === draft.title.replace(/\s*·\s*\S+\s*$/, "").trim().toLowerCase())
    ?? protocols.find((protocol) => submittedCodes.length > 0 && submittedCodes.every((code) => protocol.stages.some((stage) => stage.procedureCode === code)));
  if (!template) throw new Error("This treatment protocol is no longer available. Refresh and try again.");
  const templateStages = new Map(template.stages.map((stage) => [stage.procedureCode, stage]));
  return {
    sourceProtocolId: template.id,
    toothCode: draft.toothSpecific ? draft.tooth.trim() || null : null,
    treatmentArea: draft.toothSpecific ? null : draft.tooth.trim() || null,
    stages: draft.steps.map((step) => {
      const source = step.procedureCode ? templateStages.get(step.procedureCode) : undefined;
      if (!source) throw new Error(`The stage "${step.label}" is no longer part of this treatment protocol.`);
      return { sourceProtocolStageId: source.procedureCode, stageName: source.label, price: step.agreedCost };
    }),
  };
}

export function InProgressWorkEntry({ patient, workEntryCase, caseDoctorNames, doctorsList, labs, protocols, initialPerio, initialCanalData, upcomingFollowUps, currentOutstandingDue, canCollectPayment, initialStep, onStepChange, onCommit, onMediaChanged, onRemoveXray, onSaveCanalData, onAppendPlan, onRemovePendingStage, renderPatientStep, onExit }: InProgressWorkEntryProps) {
  const [localCase, setLocalCase] = useState(() => continuationCase(workEntryCase, caseDoctorNames));
  const [localPatient, setLocalPatient] = useState(() => ({ ...patient, canalHistory: Object.values(initialCanalData) }));
  const procedureCatalog = useMemo(() => procedureCatalogFor(workEntryCase), [workEntryCase]);
  const references = useMemo(() => stageReferences(workEntryCase), [workEntryCase]);
  const cases = useMemo(() => ({ [patient.id]: [localCase] }), [patient.id, localCase]);

  useEffect(() => setLocalCase(continuationCase(workEntryCase, caseDoctorNames)), [workEntryCase, caseDoctorNames]);
  useEffect(() => setLocalPatient((current) => ({ ...current, ...patient, canalHistory: Object.values(initialCanalData) })), [patient, initialCanalData]);

  const commitWorkEntry = async (draft: WorkEntryCommitDraft) => {
    const selectedStages = draft.work.completedStageOrders.map((order) => {
      const reference = references.get(order);
      return reference ? { ...reference, chargeAmount: draft.work.completedStageCharges[order] ?? reference.chargeAmount } : null;
    });
    if (selectedStages.some((stage) => !stage)) throw new Error("One selected stage was changed or is unavailable. Refresh the case and try again.");
    const completed = selectedStages.filter((stage): stage is CompletionReference => stage !== null);
    const saved = await onCommit(draft, completed);
    setLocalCase(continuationCase(saved.workEntryCase, caseDoctorNames));
  };

  return <WorkEntryView
    patients={[localPatient]}
    doctorsList={doctorsList}
    labs={labs}
    procedureCatalog={procedureCatalog}
    protocols={protocols}
    ledger={[]}
    followUps={[]}
    upcomingFollowUps={upcomingFollowUps}
    cases={cases}
    toothHistory={[]}
    // Past lab orders belong in Lab Tracker / Patient Record. This visit starts
    // with a clean list and displays only orders added in this Work Entry session.
    initialLabOrders={[]}
    initialPerio={initialPerio}
    initialChiefComplaintId={workEntryCase.chiefComplaintId}
    currentOutstandingDue={currentOutstandingDue}
    canCollectPayment={canCollectPayment}
    initialPatientId={patient.id}
    patientStepLabel="Patient & case"
    renderPatientStep={renderPatientStep}
    initialStep={initialStep}
    onStepChange={onStepChange}
    fixedPatientFlow
    onPatientChange={() => undefined}
    renderNewComplaint={() => null}
    onSaveChartEntry={async () => undefined}
    onSaveEncounter={async () => undefined}
    onCommitWorkEntry={commitWorkEntry}
    onMediaChanged={onMediaChanged}
    onRemoveXray={onRemoveXray}
    onSaveCanalHistory={async (_patientId, canalHistory) => {
      const newest = canalHistory[0];
      if (!newest) return;
      await onSaveCanalData(newest);
      setLocalPatient((current) => ({ ...current, canalHistory }));
    }}
    onAppendTrustedPlan={async (_clinicalCase, draft) => {
      const commandId = `work_entry_plan_${globalThis.crypto.randomUUID().replace(/[^A-Za-z0-9_-]/g, "")}`;
      const saved = await onAppendPlan(planFromDraft(draft, protocols), commandId);
      setLocalCase(continuationCase(saved, caseDoctorNames));
      return true;
    }}
    onRemovePendingStage={async (stage) => {
      if (!stage.treatmentId || !stage.stageId || !stage.stageRowVersion) throw new Error("This stage cannot be linked to the saved treatment plan. Refresh and try again.");
      const saved = await onRemovePendingStage(stage.treatmentId, stage.stageId, stage.stageRowVersion);
      setLocalCase(continuationCase(saved, caseDoctorNames));
    }}
    onFinish={onExit}
  />;
}
