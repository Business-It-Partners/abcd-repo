import type { Operation } from './contracts';
import { resolveClinicJsonRoute } from './clinicRoutes';

export type ClinicRole = 'admin' | 'doctor' | 'reception';
export type ClinicAppFamily = Extract<Operation, `clinic.app.${string}`>;
export type ClinicAppPolicy = Readonly<{ anyCapabilities: readonly string[]; excludedRoles?: readonly ClinicRole[] }>;

/** Host-owned app families. Signed packages select one family; app IDs are not registered here. */
export const clinicAppPolicies: Readonly<Record<ClinicAppFamily, ClinicAppPolicy>> = Object.freeze({
  'clinic.app.followups': { anyCapabilities: ['followups.access'] },
  'clinic.app.appointments': { anyCapabilities: ['appointments.access'] },
  'clinic.app.work-entry': { anyCapabilities: ['work_entry.access'] },
  'clinic.app.patient-record': { anyCapabilities: ['patient_record.access'] },
  'clinic.app.treatment-progress': { anyCapabilities: ['treatment_progress.access'] },
  'clinic.app.lab-tracker': { anyCapabilities: ['lab_tracker.access'] },
  'clinic.app.finance': { anyCapabilities: ['finance.manage', 'patient_payments.outstanding.read'], excludedRoles: ['reception'] },
  'clinic.app.patient-payments': { anyCapabilities: ['patient_payments.outstanding.read'], excludedRoles: ['admin', 'doctor'] },
  'clinic.app.staff': { anyCapabilities: ['staff.manage'] },
  'clinic.app.treatment-protocols': { anyCapabilities: ['treatment_protocols.manage'] },
  'clinic.app.calendar': { anyCapabilities: ['calendar.access'] },
});

/** Resolve exactly one host-supported app family from verified package capabilities. */
export function clinicAppFamily(capabilities: readonly Operation[]): ClinicAppFamily | undefined {
  const families = capabilities.filter((value): value is ClinicAppFamily => Object.hasOwn(clinicAppPolicies, value));
  return families.length === 1 ? families[0] : undefined;
}

export function appAllowed(family: ClinicAppFamily | undefined, role: ClinicRole | undefined, capabilities: readonly string[]): boolean {
  const policy = family ? clinicAppPolicies[family] : undefined;
  return !!policy && !!role && !policy.excludedRoles?.includes(role) && policy.anyCapabilities.some(value => capabilities.includes(value));
}

export function allowedClinicApiPath(family: ClinicAppFamily | undefined, path: string, method = 'GET'): boolean {
  return !!resolveClinicJsonRoute(family, path, method);
}

/** Trusted session claims narrow a verified package family before credential acquisition. */
export function clinicRequestAllowed(family: ClinicAppFamily | undefined, role: ClinicRole | undefined, capabilities: readonly string[], path: string, method: string): boolean {
  const route = resolveClinicJsonRoute(family, path, method);
  return !!family && appAllowed(family, role, capabilities) && !!route && route.capabilities.every(value => capabilities.includes(value));
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
