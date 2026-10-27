import { treatmentProtocolsBundle, treatmentProtocolsVersion } from './treatment-protocols/asset-manifest.js';
import { financeBundle, financeVersion } from './finance/asset-manifest.js';
import { calendarBundle, calendarVersion } from './calendar/asset-manifest.js';
import { treatmentProgressBundle, treatmentProgressVersion } from './treatment-progress/asset-manifest.js';
import { workEntryBundle, workEntryVersion } from './dental-apps/company.dental.work-entry.m17/asset-manifest.js';
import { patientRecordBundle, patientRecordVersion } from './dental-apps/company.dental.patient-record.m17/asset-manifest.js';
import { appointmentsBundle, appointmentsVersion } from './dental-apps/company.dental.appointments.m17/asset-manifest.js';
import { followupsBundle, followupsVersion } from './dental-apps/company.dental.followups.m17/asset-manifest.js';
import { staffBundle, staffVersion } from './dental-apps/company.dental.staff.m17/asset-manifest.js';
import { labBundle, labVersion } from './dental-apps/company.dental.lab-tracker.m17/asset-manifest.js';
import { appApiGrantsForApp, appMediaGrantsForApp, financeSessionCapabilities } from './catalog.js';

function app(id, title, icon, capabilities, options = {}) {
  return Object.freeze({
    id,
    title,
    icon,
    version: options.version ?? '0.1.0',
    capabilities: Object.freeze(capabilities),
    bundle: options.bundle,
    apiGrants: options.apiGrants ?? appApiGrantsForApp(id),
    mediaGrants: options.mediaGrants ?? appMediaGrantsForApp(id),
    ...(options.sessionCapabilities ? { sessionCapabilities: options.sessionCapabilities } : {}),
  });
}

export const firstPartyApps = Object.freeze([
  app('appointments', 'Appointments', '/assets/dock/appointments.webp', ['appointments.access'], {
    version: appointmentsVersion,
    bundle: appointmentsBundle,
  }),
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
  app('followups', 'Follow-ups', '/assets/dock/followups.webp', ['followups.access'], {
    version: followupsVersion,
    bundle: followupsBundle,
  }),
  app('lab', 'Lab Tracker', '/assets/dock/lab.webp', ['lab_tracker.access'], {
    version: labVersion,
    bundle: labBundle,
  }),
  app('treatment', 'Treatment Progress', '/assets/dock/treatment.webp', ['treatment_progress.access'], {
    version: treatmentProgressVersion,
    bundle: treatmentProgressBundle,
  }),
  app('protocols', 'Treatment Protocols', '/assets/dock/protocols.webp', ['treatment_protocols.manage'], {
    version: treatmentProtocolsVersion,
    bundle: treatmentProtocolsBundle,
  }),
  app('staff', 'Staff', '/assets/dock/staff.webp', ['staff.manage'], {
    version: staffVersion,
    bundle: staffBundle,
  }),
  app('workentry', 'Work Entry', '/assets/dock/workentry.webp', ['work_entry.access'], {
    version: workEntryVersion,
    bundle: workEntryBundle,
  }),
]);
