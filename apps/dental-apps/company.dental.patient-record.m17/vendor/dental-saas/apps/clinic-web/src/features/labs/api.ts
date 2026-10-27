import type { ClinicLabOrder, LabOrderAssignmentInput, LabOrderCreateInput, LabOrderUpdateInput, LabRequestCreateInput } from "@/features/labs/types";
import { clinicRequest } from "@/shared/api/httpClient";

export const labsApi = {
  listLabOrders: async (idToken: string, patientId?: string): Promise<ClinicLabOrder[]> => {
    const path = patientId ? `/v1/patients/${patientId}/lab-orders` : "/v1/lab-orders";
    const result = await clinicRequest<{ labOrders: ClinicLabOrder[] }>(path, idToken);
    return result.labOrders;
  },
  createLabOrder: async (idToken: string, input: LabOrderCreateInput, idempotencyKey = crypto.randomUUID()): Promise<ClinicLabOrder> => {
    const result = await clinicRequest<{ labOrder: ClinicLabOrder }>("/v1/lab-orders", idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.labOrder;
  },
  createLabRequest: async (idToken: string, input: LabRequestCreateInput, idempotencyKey = crypto.randomUUID()): Promise<ClinicLabOrder> => {
    const result = await clinicRequest<{ labOrder: ClinicLabOrder }>("/v1/lab-requests", idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input),
    });
    return result.labOrder;
  },
  assignLabOrder: async (idToken: string, labOrderId: string, input: LabOrderAssignmentInput): Promise<ClinicLabOrder> => {
    const result = await clinicRequest<{ labOrder: ClinicLabOrder }>(`/v1/lab-orders/${labOrderId}/assign`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(input),
    });
    return result.labOrder;
  },
  updateLabOrder: async (idToken: string, labOrderId: string, input: LabOrderUpdateInput): Promise<ClinicLabOrder> => {
    const result = await clinicRequest<{ labOrder: ClinicLabOrder }>(`/v1/lab-orders/${labOrderId}`, idToken, {
      method: "PATCH",
      headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      body: JSON.stringify(input),
    });
    return result.labOrder;
  }
};
