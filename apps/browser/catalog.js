// Browser-only first-party catalog derived from the M17 app manifests on read-only main.
// These are discovery/read grants, NOT write grants. The Worker remains authoritative.
export const browserModules = Object.freeze({
  appointments: {
    source: 'company.dental.appointments.m17', title: 'Appointments', icon: '/assets/dock/appointments.webp',
    views: [
      { id: 'diary', title: 'Appointment diary', route: '/v1/appointments' },
      { id: 'team', title: 'Doctors', route: '/v1/clinic/staff-references' },
    ],
    routes: [/^\/v1\/appointments(?:\?[a-zA-Z0-9%=&+_.-]{0,450})?$/, /^\/v1\/appointments\/summary\?today=\d{4}-\d{2}-\d{2}$/, /^\/v1\/clinic\/staff-references$/],
  },
  patients: {
    source: 'company.dental.patient-record.m17', title: 'Patient Record', icon: '/assets/dock/patients.webp',
    views: [
      { id: 'directory', title: 'Patient directory', route: '/v1/patients?limit=30' },
      { id: 'intake', title: 'Intake context', route: '/v1/patient-intakes/context' },
    ],
    routes: [/^\/v1\/patients(?:\?[a-zA-Z0-9%=&+_.-]{0,450})?$/, /^\/v1\/patient-intakes\/context$/, /^\/v1\/patients\/[a-zA-Z0-9_-]{1,80}\/(?:core|timeline|treatment-plans|notes|prescriptions|follow-ups|ledger|media|odontogram|periodontal-chart|canal-measurements|lab-orders)(?:\?[a-zA-Z0-9%=&+_.-]{0,200})?$/],
  },
  calendar: {
    source: 'company.dental.calendar.m17', title: 'Calendar', icon: '/assets/dock/calendar.webp',
    views: [{ id: 'tasks', title: 'Clinic tasks', route: '/v1/calendar-tasks' }],
    routes: [/^\/v1\/calendar-tasks\?from=\d{4}-\d{2}-\d{2}&to=\d{4}-\d{2}-\d{2}$/],
  },
  finance: {
    source: 'company.dental.finance.m17', title: 'Finance', icon: '/assets/dock/finance.webp',
    views: [
      { id: 'transactions', title: 'Transaction Record', route: '/v1/clinic/transaction-record', capability: 'finance.manage' },
      { id: 'payments', title: 'Patient payments', route: '/v1/patient-payments' },
      { id: 'expenses', title: 'General expenses', route: '/v1/clinic/operating-expenses', capability: 'finance.manage' },
      { id: 'salary', title: 'Salary payments', route: '/v1/clinic/salary-payouts', capability: 'finance.manage' },
      { id: 'products', title: 'Product list', route: '/v1/clinic/products', capability: 'finance.manage' },
      { id: 'purchases', title: 'Purchases', route: '/v1/clinic/purchases', capability: 'finance.manage' },
      { id: 'suppliers', title: 'Supplier list', route: '/v1/clinic/suppliers', capability: 'finance.manage' },
      { id: 'supplierPayments', title: 'Supplier payments', route: '/v1/clinic/supplier-payments', capability: 'finance.manage' },
    ],
    routes: [/^\/v1\/clinic\/(?:transaction-record|operating-expenses|salary-payouts|products|purchases|suppliers|supplier-payments)(?:\?[a-zA-Z0-9%=&+_.-]{0,450})?$/, /^\/v1\/patient-payments(?:\?[a-zA-Z0-9%=&+_.-]{0,450})?$/],
  },
  followups: {
    source: 'company.dental.followups.m17', title: 'Follow-ups', icon: '/assets/dock/followups.webp',
    views: [
      { id: 'worklist', title: 'Follow-up worklist', route: '/v1/follow-ups' },
      { id: 'doctors', title: 'Doctors', route: '/v1/clinic/staff-references' },
    ],
    routes: [/^\/v1\/follow-ups$/, /^\/v1\/clinic\/staff-references$/, /^\/v1\/patients\?q=[a-zA-Z0-9%+_.-]{0,120}&limit=8$/],
  },
  staff: {
    source: 'company.dental.staff.m17', title: 'Staff', icon: '/assets/dock/staff.webp',
    views: [{ id: 'directory', title: 'Staff directory', route: '/v1/clinic/staff' }],
    routes: [/^\/v1\/clinic\/staff$/, /^\/v1\/clinic\/staff\/[a-zA-Z0-9_-]{1,80}(?:\/clinical-work(?:\?[a-zA-Z0-9%=&+_.-]{0,200})?)?$/],
  },
  lab: {
    source: 'company.dental.lab-tracker.m17', title: 'Lab Tracker', icon: '/assets/dock/lab.webp',
    views: [
      { id: 'orders', title: 'Lab orders', route: '/v1/lab-orders' },
      { id: 'suppliers', title: 'Lab suppliers', route: '/v1/clinic/suppliers?scope=lab' },
    ],
    routes: [/^\/v1\/lab-orders$/, /^\/v1\/clinic\/suppliers\?scope=lab$/],
  },
  treatment: {
    source: 'company.dental.treatment-progress.m17', title: 'Treatment Progress', icon: '/assets/dock/treatment.webp',
    views: [{ id: 'progress', title: 'Active treatment plans', route: '/v1/treatment-progress' }],
    routes: [/^\/v1\/treatment-progress$/],
  },
  protocols: {
    source: 'company.dental.m17.treatment-protocols', title: 'Treatment Protocols', icon: '/assets/dock/protocols.webp',
    views: [{ id: 'library', title: 'Treatment protocols', route: '/v1/treatment-protocols' }],
    routes: [/^\/v1\/treatment-protocols$/],
  },
  workentry: {
    source: 'company.dental.work-entry.m17', title: 'Work Entry', icon: '/assets/dock/workentry.webp',
    views: [{ id: 'cases', title: 'Active case worklist', route: '/v1/work-entry/cases' }],
    routes: [/^\/v1\/work-entry\/cases$/, /^\/v1\/chief-complaints\/[a-zA-Z0-9_-]{1,80}\/work-entry$/],
  },
});

export function canReadAppPath(appId, path) {
  if (typeof path !== 'string' || path.length > 512) return false;
  if (!path.startsWith('/v1/') || /[\\#\s\x00-\x1f]/.test(path)) return false;
  if (/%(?:2f|5c|2e|00)/i.test(path) || path.includes('..') || path.includes('//')) return false;
  return !!browserModules[appId]?.routes.some(pattern => pattern.test(path));
}

export function permittedView(appId, viewId, capabilities) {
  const app = browserModules[appId];
  const view = app?.views.find(item => item.id === viewId);
  return view && (!view.capability || capabilities?.includes(view.capability)) ? view : null;
}
