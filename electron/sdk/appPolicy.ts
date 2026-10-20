import type { Operation } from './contracts';

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

const apiPrefixes: Readonly<Record<string, readonly string[]>> = Object.freeze({
  'company.dental.appointments': ['/v1/appointments', '/v1/clinic/staff-references', '/v1/patients'],
  'company.dental.work-entry': ['/v1/work-entry', '/v1/chief-complaints', '/v1/clinical-work', '/v1/treatment-protocols', '/v1/patients', '/v1/clinic/staff-references', '/v1/lab-orders', '/v1/lab-requests'],
  'company.dental.patient-record': ['/v1/patients', '/v1/patient-', '/v1/follow-ups', '/v1/appointments', '/v1/chief-complaints', '/v1/clinical-work', '/v1/prescriptions', '/v1/lab-orders', '/v1/lab-requests', '/v1/work-entry', '/v1/treatment-protocols', '/v1/clinic/staff-references', '/v1/clinic/suppliers'],
  'company.dental.treatment-progress': ['/v1/treatment-progress', '/v1/patients', '/v1/chief-complaints', '/v1/treatment-protocols', '/v1/follow-ups'],
  'company.dental.lab-tracker': ['/v1/lab-orders', '/v1/lab-requests', '/v1/clinic/suppliers', '/v1/clinic/staff-references'],
  'company.dental.finance': ['/v1/clinic/operating-expenses', '/v1/clinic/products', '/v1/clinic/purchases', '/v1/clinic/salary-payouts', '/v1/clinic/supplier-payments', '/v1/clinic/suppliers', '/v1/clinic/transaction-record', '/v1/patient-payments', '/v1/patient-ledger', '/v1/patients', '/v1/clinic/staff-references'],
  'company.dental.patient-payments': ['/v1/patient-payments', '/v1/patient-ledger', '/v1/patients'],
  'company.dental.staff': ['/v1/clinic/staff', '/v1/clinic/staff-references', '/v1/clinical-work'],
  'company.dental.treatment-protocols': ['/v1/treatment-protocols'],
  'company.dental.calendar': ['/v1/calendar-tasks', '/v1/appointments', '/v1/clinic/staff-references'],
});

export function appOperation(appId: string): Operation | undefined { return clinicApps[appId]?.operation; }

export function appAllowed(appId: string, role: ClinicRole | undefined, capabilities: readonly string[]): boolean {
  const policy = clinicApps[appId];
  return !!policy && !!role && !policy.excludedRoles?.includes(role) && policy.anyCapabilities.some(value => capabilities.includes(value));
}

function allowedFollowUpsPath(path: string, method: string): boolean {
  let url: URL;
  try { url = new URL(path, 'https://clinic-api.invalid'); } catch { return false; }
  if (url.origin !== 'https://clinic-api.invalid' || url.hash) return false;
  const pathname = url.pathname;
  if (pathname === '/v1/follow-ups') return method === 'GET' && url.search === '' || method === 'POST' && url.search === '';
  if (pathname === '/v1/clinic/staff-references') return method === 'GET' && url.search === '';
  if (pathname === '/v1/patients') {
    if (method !== 'GET') return false;
    const params = [...url.searchParams.entries()];
    const query = url.searchParams.get('q');
    return params.length === 2
      && typeof query === 'string'
      && query.trim().length > 0
      && query.length <= 120
      && url.searchParams.get('limit') === '8';
  }
  const match = pathname.match(/^\/v1\/follow-ups\/([A-Za-z0-9_-]+)\/(toggle|schedule)$/);
  return !!match && method === 'PATCH' && url.search === '';
}

export function allowedClinicApiPath(appId: string, path: string, method = 'GET'): boolean {
  if (path === '/v1/me' || path.startsWith('/v1/dental-os/') || path.startsWith('/v1/platform/') || path.startsWith('/v1/auth/')) return false;
  if (appId === 'company.dental.followups') return allowedFollowUpsPath(path, method.toUpperCase());
  const pathname = path.split('?', 1)[0];
  return (apiPrefixes[appId] ?? []).some(prefix => pathname === prefix || pathname.startsWith(prefix.endsWith('-') ? prefix : `${prefix}/`) || prefix.endsWith('-') && pathname.startsWith(prefix));
}

export function containsPresignedHandle(value: unknown, depth = 0): boolean {
  if (depth > 12 || !value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(item => containsPresignedHandle(item, depth + 1));
  for (const [key, item] of Object.entries(value)) {
    if (/^(?:uploadurl|uploadheaders|presignedurl|signedurl|signedheaders|authorization|access_token|refresh_token|id_token|accesstoken|refreshtoken|idtoken|clientsecret|privatekey|password)$/i.test(key)) return true;
    if (containsPresignedHandle(item, depth + 1)) return true;
  }
  return false;
}
