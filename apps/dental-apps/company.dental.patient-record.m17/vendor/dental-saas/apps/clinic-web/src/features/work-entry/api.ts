import type { ClinicalWorkFinalisation, ClinicalWorkFinalisationInput, PatientCore, WorkEntryCase, WorkEntryCaseRow, WorkEntryProtocolAddInput, WorkEntryProtocolCancelInput, WorkEntryStageAddInput, WorkEntryStageCancelInput, WorkEntryCaseUpdateInput, WorkEntryCommitInput, WorkEntryCommitResult, CaseStatusUpdateInput } from "@/features/patients/types";
import { clinicRequest } from "@/shared/api/httpClient";

export const workEntryApi = {
  workEntryCases: async (idToken: string): Promise<WorkEntryCaseRow[]> => {
    const result = await clinicRequest<{ cases: WorkEntryCaseRow[] }>("/v1/work-entry/cases", idToken);
    return result.cases;
  },
  workEntryCase: async (idToken: string, chiefComplaintId: string): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/work-entry`, idToken);
    return result.case;
  },
  updateWorkEntryCase: async (idToken: string, chiefComplaintId: string, input: WorkEntryCaseUpdateInput, idempotencyKey = crypto.randomUUID()): Promise<{ patient: PatientCore; case: WorkEntryCase }> => {
    return clinicRequest<{ patient: PatientCore; case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/work-entry`, idToken, {
      method: "PUT", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
  },
  addWorkEntryProtocol: async (idToken: string, chiefComplaintId: string, input: WorkEntryProtocolAddInput, idempotencyKey = crypto.randomUUID()): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/treatment-protocols`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.case;
  },
  cancelWorkEntryProtocol: async (idToken: string, chiefComplaintId: string, patientProtocolId: string, input: WorkEntryProtocolCancelInput, idempotencyKey = crypto.randomUUID()): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/treatment-protocols/${patientProtocolId}/cancel`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.case;
  },
  addWorkEntryStage: async (idToken: string, chiefComplaintId: string, patientProtocolId: string, input: WorkEntryStageAddInput, idempotencyKey = crypto.randomUUID()): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/treatment-protocols/${patientProtocolId}/stages`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.case;
  },
  cancelWorkEntryStage: async (idToken: string, chiefComplaintId: string, patientProtocolId: string, stageId: string, input: WorkEntryStageCancelInput, idempotencyKey = crypto.randomUUID()): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/treatment-protocols/${patientProtocolId}/stages/${stageId}/cancel`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.case;
  },
  reopenWorkEntryCase: async (idToken: string, chiefComplaintId: string, patientId: string): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/reopen`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ patientId }),
    });
    return result.case;
  },
  completeWorkEntryCase: async (idToken: string, chiefComplaintId: string, patientId: string): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/complete`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ patientId }),
    });
    return result.case;
  },
  updateCaseStatus: async (idToken: string, chiefComplaintId: string, input: CaseStatusUpdateInput, idempotencyKey = crypto.randomUUID()): Promise<WorkEntryCase> => {
    const result = await clinicRequest<{ case: WorkEntryCase }>(`/v1/chief-complaints/${chiefComplaintId}/status`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.case;
  },
  finaliseClinicalWork: async (idToken: string, input: ClinicalWorkFinalisationInput, idempotencyKey = crypto.randomUUID()): Promise<ClinicalWorkFinalisation> => {
    const result = await clinicRequest<{ finalisation: ClinicalWorkFinalisation }>("/v1/clinical-work/finalise", idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.finalisation;
  },
  commitWorkEntry: async (idToken: string, input: WorkEntryCommitInput, idempotencyKey = crypto.randomUUID()): Promise<WorkEntryCommitResult> => {
    const result = await clinicRequest<{ commit: WorkEntryCommitResult }>("/v1/work-entry/commit", idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.commit;
  }
};
