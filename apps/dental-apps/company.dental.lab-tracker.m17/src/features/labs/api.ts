import type { ClinicClient, ClinicCommand } from '../../../../../../packages/app-sdk/src/clinicClient';
import type {
  ClinicLabOrder,
  LabOrderAssignmentInput,
  LabOrderCreateInput,
  LabOrderUpdateInput,
  LabPatientCase,
  LabPatientSummary,
} from './types';
import type { ClinicSupplier, SupplierUpdateInput, SupplierWriteInput } from './supplierTypes';

const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const nullableText = (value: unknown): value is string | null => value === null || text(value);

function patientSummary(value: unknown): value is LabPatientSummary {
  return record(value) && text(value.patientId) && text(value.patientNumber)
    && text(value.fullName) && nullableText(value.phone);
}

function patientCase(value: unknown): value is LabPatientCase {
  return record(value) && text(value.chiefComplaintId) && text(value.chiefComplaint)
    && text(value.openedOn) && ['open', 'completed', 'closed'].includes(String(value.status));
}

export function isClinicLabOrder(value: unknown): value is ClinicLabOrder {
  if (!record(value)) return false;
  return text(value.labOrderId) && text(value.patientId)
    && text(value.patientNumber) && text(value.patientName)
    && text(value.chiefComplaintId) && nullableText(value.supplierId)
    && nullableText(value.labNameSnapshot)
    && text(value.labWorkName) && nullableText(value.toothScope)
    && nullableText(value.shade) && nullableText(value.requestedOn)
    && nullableText(value.sentOn) && nullableText(value.receivedOn) && nullableText(value.fittedOn)
    && ['pending_assignment', 'sent', 'received', 'fitted', 'cancelled'].includes(String(value.status))
    && nullableText(value.clinicalNote) && nullableText(value.receptionNote)
    && text(value.createdAt) && text(value.updatedAt)
    && Number.isSafeInteger(value.rowVersion) && Number(value.rowVersion) > 0;
}

export function isClinicSupplier(value: unknown): value is ClinicSupplier {
  if (!record(value)) return false;
  return text(value.supplierId) && text(value.name)
    && ['lab', 'both', 'goods'].includes(String(value.supplierType))
    && nullableText(value.contactPerson) && nullableText(value.phone) && nullableText(value.email) && nullableText(value.address)
    && typeof value.active === 'boolean' && Number.isSafeInteger(value.rowVersion) && Number(value.rowVersion) > 0
    && typeof value.openingBalanceAmount === 'number' && Number.isFinite(value.openingBalanceAmount)
    && text(value.openingBalanceAsOf) && typeof value.currentDueAmount === 'number' && Number.isFinite(value.currentDueAmount)
    && text(value.createdAt) && text(value.updatedAt);
}

function orderReceipt(value: unknown): value is { labOrder: ClinicLabOrder } {
  return record(value) && isClinicLabOrder(value.labOrder);
}

function supplierReceipt(value: unknown): value is { supplier: ClinicSupplier } {
  return record(value) && isClinicSupplier(value.supplier);
}

export class LabTrackerApi {
  constructor(private readonly client: ClinicClient) {}

  async listLabOrders(): Promise<ClinicLabOrder[]> {
    const value = await this.client.read<unknown>('/v1/lab-orders');
    if (!record(value) || !Array.isArray(value.labOrders) || !value.labOrders.every(isClinicLabOrder)) {
      throw new Error('The clinic returned an invalid lab order list.');
    }
    return value.labOrders;
  }

  async listLabSuppliers(): Promise<ClinicSupplier[]> {
    const value = await this.client.read<unknown>('/v1/clinic/suppliers?scope=lab');
    if (!record(value) || !Array.isArray(value.suppliers) || !value.suppliers.every(isClinicSupplier)) {
      throw new Error('The clinic returned an invalid lab supplier list.');
    }
    return value.suppliers;
  }

  async searchPatients(query: string): Promise<LabPatientSummary[]> {
    const params = new URLSearchParams({ q: query.trim(), limit: '8' });
    const value = await this.client.read<unknown>(`/v1/patients?${params.toString()}`);
    if (!record(value) || !Array.isArray(value.patients) || !value.patients.every(patientSummary)) {
      throw new Error('The clinic returned an invalid patient search result.');
    }
    return value.patients.slice(0, 8);
  }

  async listPatientCases(patientId: string): Promise<LabPatientCase[]> {
    const value = await this.client.read<unknown>(`/v1/patients/${encodeURIComponent(patientId)}/treatment-plans`);
    if (!record(value) || !Array.isArray(value.treatmentPlans)) {
      throw new Error('The clinic returned an invalid patient case list.');
    }
    const cases = value.treatmentPlans.map((plan) => record(plan) ? {
      chiefComplaintId: plan.chiefComplaintId,
      chiefComplaint: plan.chiefComplaint,
      openedOn: plan.openedOn,
      status: plan.status,
    } : plan);
    if (!cases.every(patientCase)) throw new Error('The clinic returned an invalid patient case list.');
    return cases;
  }

  createLabOrder(input: LabOrderCreateInput): ClinicCommand<{ labOrder: ClinicLabOrder }> {
    return this.client.command('POST', '/v1/lab-orders', input, orderReceipt);
  }

  assignLabRequest(id: string, input: LabOrderAssignmentInput): ClinicCommand<{ labOrder: ClinicLabOrder }> {
    return this.client.command('POST', `/v1/lab-orders/${id}/assign`, input, orderReceipt);
  }

  updateLabOrder(id: string, input: LabOrderUpdateInput): ClinicCommand<{ labOrder: ClinicLabOrder }> {
    return this.client.command('PATCH', `/v1/lab-orders/${id}`, input, orderReceipt);
  }

  createLabSupplier(input: SupplierWriteInput): ClinicCommand<{ supplier: ClinicSupplier }> {
    return this.client.command('POST', '/v1/clinic/suppliers', input, supplierReceipt);
  }

  updateLabSupplier(id: string, input: SupplierUpdateInput): ClinicCommand<{ supplier: ClinicSupplier }> {
    return this.client.command('PATCH', `/v1/clinic/suppliers/${id}`, input, supplierReceipt);
  }
}
