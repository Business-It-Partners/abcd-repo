import type { PatientCase, PatientCaseInput, PatientComplaintPlan, PatientComplaintPlanInput, PatientCore, PatientDirectoryPage, PatientDirectoryRequest, PatientIntakeInput, PatientProfileUpdateInput, PatientRegistrationContext, PatientTimelineEvent, PatientTreatmentPlan } from "@/features/patients/types";
import { clinicRequest } from "@/shared/api/httpClient";
import { patientDirectorySearchParams } from "@/features/patients/patientDirectory";

export const patientsApi = {
  patientRegistrationContext: async (idToken: string): Promise<PatientRegistrationContext> => {
    const result = await clinicRequest<{ context: PatientRegistrationContext }>("/v1/patient-intakes/context", idToken);
    return result.context;
  },
  searchPatients: async (idToken: string, input: PatientDirectoryRequest | string = {}, legacyCursor?: string): Promise<PatientDirectoryPage> => {
    const request = typeof input === "string" ? { query: input, cursor: legacyCursor } : input;
    const params = patientDirectorySearchParams(request);
    return clinicRequest<PatientDirectoryPage>(`/v1/patients${params.size ? `?${params.toString()}` : ""}`, idToken);
  },
  createPatientIntake: async (idToken: string, input: PatientIntakeInput, idempotencyKey = crypto.randomUUID()): Promise<PatientCore> => {
    const result = await clinicRequest<{ patient: PatientCore }>("/v1/patient-intakes", idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.patient;
  },
  createPatientComplaintPlan: async (idToken: string, patientId: string, input: PatientComplaintPlanInput, idempotencyKey = crypto.randomUUID()): Promise<PatientComplaintPlan> => {
    const result = await clinicRequest<{ complaint: PatientComplaintPlan }>(`/v1/patients/${patientId}/complaints`, idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.complaint;
  },
  createPatientCase: async (idToken: string, patientId: string, input: PatientCaseInput, idempotencyKey = crypto.randomUUID()): Promise<PatientCase> => {
    const result = await clinicRequest<{ case: PatientCase }>(`/v1/patients/${patientId}/cases`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.case;
  },
  patientCore: async (idToken: string, patientId: string): Promise<PatientCore> => {
    const result = await clinicRequest<{ patient: PatientCore }>(`/v1/patients/${patientId}/core`, idToken);
    return result.patient;
  },
  updatePatientProfile: async (idToken: string, patientId: string, input: PatientProfileUpdateInput, idempotencyKey = crypto.randomUUID()): Promise<PatientCore> => {
    const result = await clinicRequest<{ patient: PatientCore }>(`/v1/patients/${patientId}/profile`, idToken, {
      method: "PUT", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.patient;
  },
  patientTreatmentPlans: async (idToken: string, patientId: string): Promise<PatientTreatmentPlan[]> => {
    const result = await clinicRequest<{ treatmentPlans: PatientTreatmentPlan[] }>(`/v1/patients/${patientId}/treatment-plans`, idToken);
    return result.treatmentPlans;
  },
  patientTimeline: async (idToken: string, patientId: string): Promise<PatientTimelineEvent[]> => {
    const result = await clinicRequest<{ timeline: PatientTimelineEvent[] }>(`/v1/patients/${patientId}/timeline`, idToken);
    return result.timeline;
  }
};
