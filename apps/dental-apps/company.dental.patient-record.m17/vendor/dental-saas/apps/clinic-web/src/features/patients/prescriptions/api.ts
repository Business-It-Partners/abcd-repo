import type { PatientPrescription, PrescriptionCreateInput, PrescriptionCorrectionInput, PrescriptionWithdrawalInput } from "@/features/patients/types";
import { clinicRequest } from "@/shared/api/httpClient";

export const prescriptionsApi = {
  withdrawPatientPrescription: async (idToken: string, prescriptionId: string, input: PrescriptionWithdrawalInput, idempotencyKey = crypto.randomUUID()): Promise<PatientPrescription> => {
    const result = await clinicRequest<{ prescription: PatientPrescription }>(`/v1/prescriptions/${prescriptionId}/withdraw`, idToken, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input) });
    return result.prescription;
  },
  correctPatientPrescription: async (idToken: string, prescriptionId: string, input: PrescriptionCorrectionInput, idempotencyKey = crypto.randomUUID()): Promise<PatientPrescription> => {
    const result = await clinicRequest<{ prescription: PatientPrescription }>(`/v1/prescriptions/${prescriptionId}/correct`, idToken, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input) });
    return result.prescription;
  },
  patientPrescriptions: async (idToken: string, patientId: string): Promise<PatientPrescription[]> => {
    const result = await clinicRequest<{ prescriptions: PatientPrescription[] }>(`/v1/patients/${patientId}/prescriptions`, idToken);
    return result.prescriptions;
  },
  createPatientPrescription: async (idToken: string, input: PrescriptionCreateInput, idempotencyKey = crypto.randomUUID()): Promise<PatientPrescription> => {
    const result = await clinicRequest<{ prescription: PatientPrescription }>("/v1/prescriptions", idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.prescription;
  }
};
