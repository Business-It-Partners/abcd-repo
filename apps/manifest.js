import { treatmentProtocolsBundle, treatmentProtocolsVersion } from './treatment-protocols/asset-manifest.js';

const bundle = Object.freeze({
  entry: '/apps/runtime.v1.html',
  entrySha256: 'a1fdc7b765dbd61ee767944deda4b272c756000d703f04534c45584aeb1ec1a4',
  script: '/apps/runtime.v1.js',
  scriptSha256: '43128fca971c7eeca1311e3a9f0b4e3f5b3182834a3565e9fb6eee94683c5be8',
});

function app(id, title, icon, capabilities) {
  return Object.freeze({
    id,
    title,
    icon,
    version: '0.1.0',
    capabilities: Object.freeze(capabilities),
    bundle,
    apiGrants: Object.freeze([]),
  });
}

export const firstPartyApps = Object.freeze([
  app('appointments', 'Appointments', '/assets/dock/appointments.webp', ['appointments.access']),
  app('patients', 'Patients', '/assets/dock/patients.webp', ['patient_record.access']),
  app('calendar', 'Calendar', '/assets/dock/calendar.webp', ['calendar.access']),
  app('finance', 'Finance', '/assets/dock/finance.webp', [
    'finance.manage', 'patient_billing_ledger.read', 'patient_payments.outstanding.read',
    'patient_payments.received.read', 'patient_payments.collect',
  ]),
  app('followups', 'Follow-ups', '/assets/dock/followups.webp', ['followups.access']),
  app('staff', 'Staff', '/assets/dock/staff.webp', ['staff.reference.read', 'staff.manage']),
  app('lab', 'Lab Tracker', '/assets/dock/lab.webp', ['lab_tracker.access', 'lab_requests.create']),
  app('treatment', 'Treatment Progress', '/assets/dock/treatment.webp', ['treatment_progress.access']),
  Object.freeze({
    ...app('protocols', 'Treatment Protocols', '/assets/dock/protocols.webp', ['treatment_protocols.manage']),
    version: treatmentProtocolsVersion,
    bundle: treatmentProtocolsBundle,
    apiGrants: Object.freeze([
      Object.freeze({ method: 'GET', path: '/v1/treatment-protocols' }),
      Object.freeze({ method: 'POST', path: '/v1/treatment-protocols' }),
      Object.freeze({ method: 'PUT', path: '/v1/treatment-protocols/{uuid}' }),
    ]),
  }),
  app('workentry', 'Work Entry', '/assets/dock/workentry.webp', ['work_entry.access']),
]);
