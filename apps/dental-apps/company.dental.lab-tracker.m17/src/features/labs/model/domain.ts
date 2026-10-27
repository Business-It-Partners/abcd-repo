import { formatDateShort, todayISO } from '@/shared/dates/nepaliDate';
import type { ClinicLabOrder } from '../types';
import type { ClinicSupplier } from '../supplierTypes';

export { formatDateShort, todayISO };

export type LabOrderStatus = 'Pending' | 'Sent' | 'Received' | 'Fitted' | 'Cancelled';
export type LabStatusEvent = { status: LabOrderStatus; date: string; by: string };

export type LabOrder = {
  id: string;
  patientId: string;
  patientName: string;
  procedure: string;
  tooth: string;
  shade: string;
  labId: string;
  labName: string;
  sentDate: string;
  status: LabOrderStatus;
  notes?: string;
  caseId?: string;
  statusHistory?: LabStatusEvent[];
  clinicalNote?: string;
  voidedAt?: string;
  voidReason?: string;
};

export type LabSupplier = {
  id: string;
  name: string;
  supplierType?: 'lab' | 'both';
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  openingBalance: number;
  openingAsOf: string;
  active: boolean;
  isLab: true;
};

const legacyStatus: Record<ClinicLabOrder['status'], LabOrderStatus> = {
  pending_assignment: 'Pending',
  sent: 'Sent',
  received: 'Received',
  fitted: 'Fitted',
  cancelled: 'Cancelled',
};

export function toLabOrder(order: ClinicLabOrder): LabOrder {
  const status = legacyStatus[order.status];
  const statusHistory: LabStatusEvent[] = [];
  if (order.sentOn) statusHistory.push({ status: 'Sent', date: order.sentOn, by: '' });
  if (order.receivedOn) statusHistory.push({ status: 'Received', date: order.receivedOn, by: '' });
  if (order.fittedOn) statusHistory.push({ status: 'Fitted', date: order.fittedOn, by: '' });
  return {
    id: order.labOrderId,
    patientId: order.patientId,
    patientName: order.patientName,
    procedure: order.labWorkName,
    tooth: order.toothScope ?? '',
    shade: order.shade ?? '',
    labId: order.supplierId ?? '',
    labName: order.labNameSnapshot ?? '',
    sentDate: order.sentOn ?? '',
    status,
    notes: order.receptionNote || undefined,
    clinicalNote: order.clinicalNote || undefined,
    caseId: order.chiefComplaintId,
    statusHistory,
    ...(order.status === 'cancelled' ? { voidedAt: order.updatedAt, voidReason: order.receptionNote || 'Cancelled' } : {}),
  };
}

export function toLabSupplier(supplier: ClinicSupplier): LabSupplier {
  if (supplier.supplierType === 'goods') throw new Error('A goods supplier cannot be used as a lab.');
  return {
    id: supplier.supplierId,
    name: supplier.name,
    supplierType: supplier.supplierType,
    contactPerson: supplier.contactPerson ?? '',
    phone: supplier.phone ?? '',
    email: supplier.email ?? '',
    address: supplier.address ?? '',
    openingBalance: supplier.openingBalanceAmount,
    openingAsOf: supplier.openingBalanceAsOf,
    active: supplier.active,
    isLab: true,
  };
}
