import type {
  CaseStatusUpdateInput,
  ClinicalWorkFinalisation,
  ClinicalWorkFinalisationInput,
  PatientCore,
  PatientCanalMeasurement,
  PatientLedger,
  PatientPeriodontalChart,
  FollowUpWorklistItem,
  OdontogramMark,
  WorkEntryCase,
  WorkEntryCaseRow,
  WorkEntryCaseUpdateInput,
  WorkEntryCommitInput,
  WorkEntryCommitResult,
  WorkEntryProtocolAddInput,
  WorkEntryProtocolCancelInput,
  WorkEntryStageAddInput,
  WorkEntryStageCancelInput,
} from '@/features/patients/types';
import type { ClinicSupplier } from '@/features/finance/suppliers/types';
import { clinicClient } from '@/sdk/client';
import { executeClinicCommand } from '@/sdk/commands';

export type WorkEntryContext = {
  case: WorkEntryCase;
  patient: PatientCore;
  ledger: PatientLedger | null;
  odontogram: OdontogramMark[];
  labSuppliers: ClinicSupplier[];
  periodontalChart: PatientPeriodontalChart;
  canalMeasurements: PatientCanalMeasurement[];
  followUps: FollowUpWorklistItem[];
};

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const validCommitEnvelope = (value: unknown): boolean => record(value) && record(value.commit)
  && Array.isArray(value.commit.completedStageIds)
  && Array.isArray(value.commit.addedPendingStageIds)
  && Array.isArray(value.commit.labOrderIds)
  && Number.isSafeInteger(value.commit.caseRowVersion);

export const workEntryApi = {
  workEntryCases: async (_idToken: string): Promise<WorkEntryCaseRow[]> => (await clinicClient().read<{ cases: WorkEntryCaseRow[] }>('/v1/work-entry/cases')).cases,
  workEntryCase: async (_idToken: string, chiefComplaintId: string): Promise<WorkEntryCase> => (await clinicClient().read<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/work-entry`)).case,
  workEntryContext: async (_idToken: string, chiefComplaintId: string): Promise<WorkEntryContext> => (await clinicClient().read<{ context: WorkEntryContext }>(`/v1/chief-complaints/${chiefComplaintId}/work-entry/context`)).context,
  updateWorkEntryCase: async (_idToken: string, chiefComplaintId: string, input: WorkEntryCaseUpdateInput, idempotencyKey?: string): Promise<{ patient: PatientCore; case: WorkEntryCase }> =>
    executeClinicCommand('PUT', `/v1/chief-complaints/${chiefComplaintId}/work-entry`, input, idempotencyKey),
  addWorkEntryProtocol: async (_idToken: string, chiefComplaintId: string, input: WorkEntryProtocolAddInput, idempotencyKey?: string): Promise<WorkEntryCase> =>
    (await executeClinicCommand<{ case: WorkEntryCase }>('POST', `/v1/chief-complaints/${chiefComplaintId}/treatment-protocols`, input, idempotencyKey)).case,
  cancelWorkEntryProtocol: async (_idToken: string, chiefComplaintId: string, patientProtocolId: string, input: WorkEntryProtocolCancelInput, idempotencyKey?: string): Promise<WorkEntryCase> =>
    (await executeClinicCommand<{ case: WorkEntryCase }>('POST', `/v1/chief-complaints/${chiefComplaintId}/treatment-protocols/${patientProtocolId}/cancel`, input, idempotencyKey)).case,
  addWorkEntryStage: async (_idToken: string, chiefComplaintId: string, patientProtocolId: string, input: WorkEntryStageAddInput, idempotencyKey?: string): Promise<WorkEntryCase> =>
    (await executeClinicCommand<{ case: WorkEntryCase }>('POST', `/v1/chief-complaints/${chiefComplaintId}/treatment-protocols/${patientProtocolId}/stages`, input, idempotencyKey)).case,
  cancelWorkEntryStage: async (_idToken: string, chiefComplaintId: string, patientProtocolId: string, stageId: string, input: WorkEntryStageCancelInput, idempotencyKey?: string): Promise<WorkEntryCase> =>
    (await executeClinicCommand<{ case: WorkEntryCase }>('POST', `/v1/chief-complaints/${chiefComplaintId}/treatment-protocols/${patientProtocolId}/stages/${stageId}/cancel`, input, idempotencyKey)).case,
  reopenWorkEntryCase: async (_idToken: string, chiefComplaintId: string, patientId: string): Promise<WorkEntryCase> =>
    (await executeClinicCommand<{ case: WorkEntryCase }>('POST', `/v1/chief-complaints/${chiefComplaintId}/reopen`, { patientId })).case,
  completeWorkEntryCase: async (_idToken: string, chiefComplaintId: string, patientId: string): Promise<WorkEntryCase> =>
    (await executeClinicCommand<{ case: WorkEntryCase }>('POST', `/v1/chief-complaints/${chiefComplaintId}/complete`, { patientId })).case,
  updateCaseStatus: async (_idToken: string, chiefComplaintId: string, input: CaseStatusUpdateInput, idempotencyKey?: string): Promise<WorkEntryCase> =>
    (await executeClinicCommand<{ case: WorkEntryCase }>('POST', `/v1/chief-complaints/${chiefComplaintId}/status`, input, idempotencyKey)).case,
  finaliseClinicalWork: async (_idToken: string, input: ClinicalWorkFinalisationInput, idempotencyKey?: string): Promise<ClinicalWorkFinalisation> =>
    (await executeClinicCommand<{ finalisation: ClinicalWorkFinalisation }>('POST', '/v1/clinical-work/finalise', input, idempotencyKey)).finalisation,
  commitWorkEntry: async (_idToken: string, input: WorkEntryCommitInput, idempotencyKey?: string): Promise<WorkEntryCommitResult> => {
    const result = await executeClinicCommand<{ commit: WorkEntryCommitResult }>('POST', '/v1/work-entry/commit', input, idempotencyKey, validCommitEnvelope);
    return result.commit;
  },
};
