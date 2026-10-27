import type { ClinicSession } from "./session/types";

export type ClinicCapability =
  | "followups.access"
  | "appointments.access"
  | "work_entry.access"
  | "patient_record.access"
  | "treatment_progress.access"
  | "lab_tracker.access"
  | "lab_requests.create"
  | "patient_billing_ledger.read"
  | "patient_payments.outstanding.read"
  | "patient_payments.received.read"
  | "patient_payments.collect"
  | "finance.manage"
  | "staff.reference.read"
  | "staff.manage"
  | "treatment_protocols.reference.read"
  | "treatment_protocols.manage"
  | "calendar.access"
  | "clinic_profile.read"
  | "clinic_profile.manage"
  | "clinic_users.manage";

export function hasClinicCapability(session: ClinicSession, capability: ClinicCapability): boolean {
  return session.clinicUser.capabilities.includes(capability);
}
