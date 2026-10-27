import { treatmentProtocolsBundle, treatmentProtocolsVersion } from './treatment-protocols/asset-manifest.js';
import { financeBundle, financeVersion } from './finance/asset-manifest.js';
import { calendarBundle, calendarVersion } from './calendar/asset-manifest.js';
import { treatmentProgressBundle, treatmentProgressVersion } from './treatment-progress/asset-manifest.js';
import { workEntryBundle, workEntryVersion } from './dental-apps/company.dental.work-entry.m17/asset-manifest.js';
import { patientRecordBundle, patientRecordVersion } from './dental-apps/company.dental.patient-record.m17/asset-manifest.js';
import { appApiGrantsForApp, appMediaGrantsForApp, financeSessionCapabilities } from './catalog.js';

const bundle = Object.freeze({
  entry: '/apps/runtime.v1.html',
  entrySha256: 'a1fdc7b765dbd61ee767944deda4b272c756000d703f04534c45584aeb1ec1a4',
  script: '/apps/runtime.v1.js',
  scriptSha256: '43128fca971c7eeca1311e3a9f0b4e3f5b3182834a3565e9fb6eee94683c5be8',
});

function app(id, title, icon, capabilities, options = {}) {
  return Object.freeze({
    id,
    title,
    icon,
    version: options.version ?? '0.1.0',
    capabilities: Object.freeze(capabilities),
    bundle: options.bundle ?? bundle,
    apiGrants: options.apiGrants ?? appApiGrantsForApp(id),
    mediaGrants: options.mediaGrants ?? appMediaGrantsForApp(id),
    ...(options.sessionCapabilities ? { sessionCapabilities: options.sessionCapabilities } : {}),
  });
}

export const firstPartyApps = Object.freeze([
  app('appointments', 'Appointments', '/assets/dock/appointments.webp', ['appointments.access']),
  app('patients', 'Patients', '/assets/dock/patients.webp', ['patient_record.access'], {
    version: patientRecordVersion,
    bundle: patientRecordBundle,
  }),
  app('calendar', 'Calendar', '/assets/dock/calendar.webp', ['calendar.access'], {
    version: calendarVersion,
    bundle: calendarBundle,
  }),
  app('finance', 'Finance', '/assets/dock/finance.webp', [
    'finance.manage', 'patient_payments.outstanding.read',
  ], {
    version: financeVersion,
    bundle: financeBundle,
    sessionCapabilities: financeSessionCapabilities,
  }),
  app('followups', 'Follow-ups', '/assets/dock/followups.webp', ['followups.access']),
  app('staff', 'Staff', '/assets/dock/staff.webp', ['staff.reference.read', 'staff.manage']),
  app('lab', 'Lab Tracker', '/assets/dock/lab.webp', ['lab_tracker.access', 'lab_requests.create']),
  app('treatment', 'Treatment Progress', '/assets/dock/treatment.webp', ['treatment_progress.access'], {
    version: treatmentProgressVersion,
    bundle: treatmentProgressBundle,
  }),
  app('protocols', 'Treatment Protocols', '/assets/dock/protocols.webp', ['treatment_protocols.manage'], {
    version: treatmentProtocolsVersion,
    bundle: treatmentProtocolsBundle,
  }),
  app('workentry', 'Work Entry', '/assets/dock/workentry.webp', ['work_entry.access'], {
    version: workEntryVersion,
    bundle: workEntryBundle,
  }),
]);
