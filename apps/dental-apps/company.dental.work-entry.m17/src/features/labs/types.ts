export const labOrderStatuses = ["pending_assignment", "sent", "received", "fitted", "cancelled"] as const;
export type LabOrderStatus = (typeof labOrderStatuses)[number];
export type ClinicLabOrder = {
  labOrderId: string; patientId: string; patientNumber: string; patientName: string; chiefComplaintId: string;
  supplierId: string | null; labNameSnapshot: string | null; labWorkName: string; toothScope: string | null; shade: string | null;
  requestedOn: string | null; sentOn: string | null; receivedOn: string | null; fittedOn: string | null; status: LabOrderStatus;
  clinicalNote: string | null; receptionNote: string | null; createdAt: string; updatedAt: string; rowVersion: number;
};
export type LabOrderCreateInput = { patientId: string; chiefComplaintId: string; supplierId: string; labWorkName: string; toothScope: string | null; shade: string | null; requestedOn: string; sentOn?: string | null; receivedOn?: string | null; fittedOn?: string | null; status?: Exclude<LabOrderStatus, "pending_assignment">; note?: string | null; };
export type LabRequestCreateInput = { patientId: string; chiefComplaintId: string; labWorkName: string; toothScope: string | null; shade: string | null; clinicalNote: string | null; };
export type LabOrderAssignmentInput = { supplierId: string; labWorkName: string; toothScope: string | null; shade: string | null; sentOn: string; receptionNote: string | null; expectedRowVersion: number };
export type LabOrderUpdateInput = { expectedRowVersion: number; status?: LabOrderStatus; clearAssignment?: boolean; receivedOn?: string | null; fittedOn?: string | null; receptionNote?: string | null; };
