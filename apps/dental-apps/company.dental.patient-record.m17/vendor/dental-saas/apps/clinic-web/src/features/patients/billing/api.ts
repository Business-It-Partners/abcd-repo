import type { PatientLedger, PatientLedgerCorrectionInput, PatientLedgerReversalInput, PatientPayment, PatientPaymentInput, PatientPaymentsReport } from "@/features/patients/types";
import { clinicRequest } from "@/shared/api/httpClient";

export const patientBillingApi = {
  correctPatientLedgerEntry: async (idToken: string, ledgerEntryId: string, input: PatientLedgerCorrectionInput, idempotencyKey = crypto.randomUUID()): Promise<{ patientLedgerEntryId: string; currentDueAmount: number }> => {
    const result = await clinicRequest<{ correction: { patientLedgerEntryId: string; currentDueAmount: number } }>(`/v1/patient-ledger/${ledgerEntryId}/correct`, idToken, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input) });
    return result.correction;
  },
  reversePatientLedgerEntry: async (idToken: string, ledgerEntryId: string, input: PatientLedgerReversalInput, idempotencyKey = crypto.randomUUID()): Promise<{ patientLedgerEntryId: string; currentDueAmount: number }> => {
    const result = await clinicRequest<{ reversal: { patientLedgerEntryId: string; currentDueAmount: number } }>(`/v1/patient-ledger/${ledgerEntryId}/reverse`, idToken, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input) });
    return result.reversal;
  },
  patientPayments: async (idToken: string, from?: string, to?: string): Promise<PatientPaymentsReport> => {
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const query = params.size ? `?${params.toString()}` : "";
    return clinicRequest<PatientPaymentsReport>(`/v1/patient-payments${query}`, idToken);
  },
  patientLedger: async (idToken: string, patientId: string, month?: string, cursor?: string): Promise<PatientLedger> => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (cursor) params.set("cursor", cursor);
    const result = await clinicRequest<{ ledger: PatientLedger }>(`/v1/patients/${patientId}/ledger${params.size ? `?${params.toString()}` : ""}`, idToken);
    return result.ledger;
  },
  createPatientPayment: async (idToken: string, input: PatientPaymentInput, idempotencyKey = crypto.randomUUID()): Promise<PatientPayment> => {
    const result = await clinicRequest<{ payment: PatientPayment }>(`/v1/patients/${input.patientId}/payments`, idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.payment;
  }
};
