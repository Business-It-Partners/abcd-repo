import type { Operation } from './contracts';
import { resolveClinicJsonRoute } from './clinicRoutes';

export type ClinicRole = 'admin' | 'doctor' | 'reception';
export type ClinicAppPolicy = Readonly<{ operation: Operation; anyCapabilities: readonly string[]; excludedRoles?: readonly ClinicRole[] }>;

/** App IDs are stable first-party identities; endpoint scopes stay platform-owned. */
export const clinicApps: Readonly<Record<string, ClinicAppPolicy>> = Object.freeze({
  'company.dental.followups': { operation: 'clinic.app.followups', anyCapabilities: ['followups.access'] },
  'company.dental.appointments': { operation: 'clinic.app.appointments', anyCapabilities: ['appointments.access'] },
  'company.dental.work-entry': { operation: 'clinic.app.work-entry', anyCapabilities: ['work_entry.access'] },
  'company.dental.patient-record': { operation: 'clinic.app.patient-record', anyCapabilities: ['patient_record.access'] },
  'company.dental.treatment-progress': { operation: 'clinic.app.treatment-progress', anyCapabilities: ['treatment_progress.access'] },
  'company.dental.lab-tracker': { operation: 'clinic.app.lab-tracker', anyCapabilities: ['lab_tracker.access'] },
  'company.dental.finance': { operation: 'clinic.app.finance', anyCapabilities: ['finance.manage', 'patient_payments.outstanding.read'], excludedRoles: ['reception'] },
  'company.dental.patient-payments': { operation: 'clinic.app.patient-payments', anyCapabilities: ['patient_payments.outstanding.read'], excludedRoles: ['admin', 'doctor'] },
  'company.dental.staff': { operation: 'clinic.app.staff', anyCapabilities: ['staff.manage'] },
  'company.dental.treatment-protocols': { operation: 'clinic.app.treatment-protocols', anyCapabilities: ['treatment_protocols.manage'] },
  'company.dental.calendar': { operation: 'clinic.app.calendar', anyCapabilities: ['calendar.access'] },
});

export function appOperation(appId: string): Operation | undefined { return clinicApps[appId]?.operation; }

export function appAllowed(appId: string, role: ClinicRole | undefined, capabilities: readonly string[]): boolean {
  const policy = clinicApps[appId];
  return !!policy && !!role && !policy.excludedRoles?.includes(role) && policy.anyCapabilities.some(value => capabilities.includes(value));
}

export function allowedClinicApiPath(appId: string, path: string, method = 'GET'): boolean {
  return !!resolveClinicJsonRoute(appId, path, method);
}

/** Trusted session claims narrow each app contract before credential acquisition. */
export function clinicRequestAllowed(appId: string, role: ClinicRole | undefined, capabilities: readonly string[], path: string, method: string): boolean {
  const route = resolveClinicJsonRoute(appId, path, method);
  return appAllowed(appId, role, capabilities) && !!route && route.capabilities.every(value => capabilities.includes(value));
}

export function containsPresignedHandle(value: unknown, depth = 0): boolean {
  if (!value || typeof value !== 'object') return false;
  if (depth > 12) return true; // Refuse an uninspectable nested response instead of skipping credential checks.
  if (Array.isArray(value)) return value.some(item => containsPresignedHandle(item, depth + 1));
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:uploadurl|uploadheaders|presignedurl|signedurl|signedheaders|authorization|access_token|refresh_token|id_token|accesstoken|refreshtoken|idtoken|clientsecret|privatekey|password)$/i.test(key)) return true;
    if (containsPresignedHandle(item, depth + 1)) return true;
  }
  return false;
}
