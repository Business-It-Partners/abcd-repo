const appIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const appVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const capabilityPattern = /^[a-z0-9][a-z0-9_.-]{0,99}$/;
const iconPathPattern = /^\/assets\/dock\/[a-z0-9-]+\.webp$/;
const appAssetPathPattern = /^\/apps\/[a-z0-9.-]+\.(?:html|js|css)$/;
const apiPathPattern = /^\/v1\/(?:[a-z0-9-]+|\{uuid\})(?:\/(?:[a-z0-9-]+|\{uuid\}))*$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const sha256Pattern = /^[a-f0-9]{64}$/;
export const financeSessionCapabilities = Object.freeze([
  'finance.manage', 'patient_payments.outstanding.read', 'patient_payments.received.read',
  'patient_billing_ledger.read', 'patient_payments.collect', 'staff.manage',
]);
const knownMediaGrants = Object.freeze({
  appointments: Object.freeze([]),
  calendar: Object.freeze([]),
  finance: Object.freeze([]),
  followups: Object.freeze([]),
  lab: Object.freeze([]),
  staff: Object.freeze([]),
  treatment: Object.freeze([]),
  protocols: Object.freeze([]),
  workentry: Object.freeze(['clinic.media.read']),
  patients: Object.freeze(['clinic.media.read', 'clinic.media.upload']),
});

// These capabilities are exposed as app context so source UI can hide controls
// for which the signed-in clinic user has no role. They do not add API access:
// each request must still match the app's explicit route grant below.
const knownAppContextCapabilities = Object.freeze({
  workentry: Object.freeze([
    'work_entry.access', 'patient_payments.collect', 'patient_billing_ledger.read',
    'lab_tracker.access', 'lab_requests.create', 'treatment_protocols.reference.read',
    'staff.reference.read', 'followups.access',
  ]),
  patients: Object.freeze([
    'patient_record.access', 'work_entry.access', 'patient_billing_ledger.read',
    'patient_payments.collect', 'finance.manage', 'lab_tracker.access',
    'lab_requests.create', 'staff.reference.read', 'treatment_protocols.reference.read',
  ]),
  appointments: Object.freeze(['appointments.access', 'staff.reference.read']),
  followups: Object.freeze(['followups.access', 'staff.reference.read']),
  staff: Object.freeze(['staff.manage', 'finance.manage']),
  lab: Object.freeze(['lab_tracker.access', 'lab_requests.create', 'finance.manage']),
});

export function appContextCapabilitiesForApp(appId) {
  return knownAppContextCapabilities[appId] ?? Object.freeze([]);
}

function apiGrant(method, path, capabilities = [], queryPolicy = null) {
  return Object.freeze({ method, path, capabilities: Object.freeze(capabilities), queryPolicy });
}

// Per-app route templates and required Worker capabilities follow each app's
// pinned source contract, recorded in its import manifest or migration docs.
// Query policies preserve each contract's bounded parameter sets.
const apiRoutePolicies = Object.freeze({
  appointments: Object.freeze([
    apiGrant('GET', '/v1/clinic/staff-references', ['appointments.access']),
    apiGrant('GET', '/v1/appointments/summary', ['appointments.access'], 'appointment-summary'),
    apiGrant('GET', '/v1/appointments', ['appointments.access'], 'appointment-range'),
    apiGrant('POST', '/v1/appointments', ['appointments.access']),
    apiGrant('PATCH', '/v1/appointments/{uuid}', ['appointments.access']),
    apiGrant('POST', '/v1/appointments/{uuid}/status', ['appointments.access']),
  ]),
  calendar: Object.freeze([
    apiGrant('GET', '/v1/calendar-tasks', [], 'calendar-task-range'),
    apiGrant('POST', '/v1/calendar-tasks'),
    apiGrant('PATCH', '/v1/calendar-tasks/{uuid}'),
    apiGrant('POST', '/v1/calendar-tasks/{uuid}/archive'),
  ]),
  finance: Object.freeze([
    apiGrant('GET', '/v1/clinic/transaction-record', ['finance.manage'], 'finance-date-range'),
    apiGrant('GET', '/v1/patient-payments', ['patient_payments.outstanding.read'], 'finance-date-range'),
    apiGrant('GET', '/v1/patients/{uuid}/ledger', ['patient_billing_ledger.read'], 'finance-ledger'),
    apiGrant('POST', '/v1/patients/{uuid}/payments', ['patient_payments.collect']),
    apiGrant('GET', '/v1/clinic/operating-expenses', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/operating-expenses', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/operating-expenses/{uuid}/correct', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/operating-expenses/{uuid}/void', ['finance.manage']),
    apiGrant('GET', '/v1/clinic/salary-payouts', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/salary-payouts', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/salary-payouts/{uuid}/correct', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/salary-payouts/{uuid}/void', ['finance.manage']),
    apiGrant('GET', '/v1/clinic/staff', ['staff.manage']),
    apiGrant('GET', '/v1/clinic/products', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/products', ['finance.manage']),
    apiGrant('PATCH', '/v1/clinic/products/{uuid}', ['finance.manage']),
    apiGrant('GET', '/v1/clinic/purchases', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/purchases', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/purchases/{uuid}/correct', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/purchases/{uuid}/void', ['finance.manage']),
    apiGrant('GET', '/v1/clinic/suppliers', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/suppliers', ['finance.manage']),
    apiGrant('PATCH', '/v1/clinic/suppliers/{uuid}', ['finance.manage']),
    apiGrant('GET', '/v1/clinic/suppliers/{uuid}/statement', ['finance.manage']),
    apiGrant('GET', '/v1/clinic/supplier-payments', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/supplier-payments', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/supplier-payments/{uuid}/correct', ['finance.manage']),
    apiGrant('POST', '/v1/clinic/supplier-payments/{uuid}/void', ['finance.manage']),
  ]),
  followups: Object.freeze([
    apiGrant('GET', '/v1/follow-ups', ['followups.access']),
    apiGrant('GET', '/v1/clinic/staff-references', ['followups.access']),
    apiGrant('GET', '/v1/patients', ['followups.access'], 'work-entry-patient-lookup'),
    apiGrant('POST', '/v1/follow-ups', ['followups.access']),
    apiGrant('PATCH', '/v1/follow-ups/{uuid}/toggle', ['followups.access']),
    apiGrant('PATCH', '/v1/follow-ups/{uuid}/schedule', ['followups.access']),
  ]),
  staff: Object.freeze([
    apiGrant('GET', '/v1/clinic/staff', ['staff.manage']),
    apiGrant('GET', '/v1/clinic/staff/{uuid}', ['staff.manage']),
    apiGrant('POST', '/v1/clinic/staff', ['staff.manage']),
    apiGrant('PATCH', '/v1/clinic/staff/{uuid}', ['staff.manage']),
    apiGrant('GET', '/v1/clinic/staff/{uuid}/clinical-work', ['staff.manage'], 'staff-clinical-work'),
    apiGrant('GET', '/v1/clinic/salary-payouts', ['finance.manage']),
    apiGrant('GET', '/v1/clinic/staff/{uuid}/documents', ['staff.manage']),
    apiGrant('POST', '/v1/clinic/staff/{uuid}/documents/{uuid}/withdraw', ['staff.manage']),
  ]),
  lab: Object.freeze([
    apiGrant('GET', '/v1/lab-orders', ['lab_tracker.access']),
    apiGrant('GET', '/v1/clinic/suppliers', ['lab_tracker.access'], 'lab-suppliers'),
    apiGrant('POST', '/v1/lab-orders/{uuid}/assign', ['lab_tracker.access']),
    apiGrant('PATCH', '/v1/lab-orders/{uuid}', ['lab_tracker.access']),
    apiGrant('POST', '/v1/clinic/suppliers', ['lab_tracker.access']),
    apiGrant('PATCH', '/v1/clinic/suppliers/{uuid}', ['lab_tracker.access']),
  ]),
  treatment: Object.freeze([
    apiGrant('GET', '/v1/treatment-progress'),
  ]),
  protocols: Object.freeze([
    apiGrant('GET', '/v1/treatment-protocols'),
    apiGrant('POST', '/v1/treatment-protocols'),
    apiGrant('PUT', '/v1/treatment-protocols/{uuid}'),
  ]),
  workentry: Object.freeze([
    apiGrant('GET', '/v1/work-entry/cases'),
    apiGrant('GET', '/v1/chief-complaints/{uuid}/work-entry', ['work_entry.access']),
    apiGrant('PUT', '/v1/chief-complaints/{uuid}/work-entry', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols/{uuid}/cancel', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols/{uuid}/stages', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols/{uuid}/stages/{uuid}/cancel', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/reopen', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/complete', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/status', ['work_entry.access']),
    apiGrant('POST', '/v1/clinical-work/finalise', ['work_entry.access']),
    apiGrant('POST', '/v1/work-entry/commit', ['work_entry.access']),
    apiGrant('GET', '/v1/patients', [], 'work-entry-patient-lookup'),
    apiGrant('GET', '/v1/patients/{uuid}/core'),
    apiGrant('POST', '/v1/patients/{uuid}/cases', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/odontogram', ['work_entry.access']),
    apiGrant('PUT', '/v1/patients/{uuid}/odontogram', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/periodontal-chart', ['work_entry.access']),
    apiGrant('PUT', '/v1/patients/{uuid}/periodontal-chart', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/canal-measurements', ['work_entry.access']),
    apiGrant('POST', '/v1/patients/{uuid}/canal-measurements', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/ledger', ['patient_billing_ledger.read'], 'patient-ledger'),
    apiGrant('GET', '/v1/patients/{uuid}/media', [], 'patient-media-list'),
    apiGrant('GET', '/v1/follow-ups', ['followups.access'], 'follow-up-list'),
    apiGrant('GET', '/v1/treatment-protocols', ['treatment_protocols.reference.read']),
    apiGrant('GET', '/v1/clinic/staff-references', ['staff.reference.read']),
    apiGrant('GET', '/v1/clinic/suppliers', ['lab_tracker.access'], 'lab-suppliers'),
  ]),
  patients: Object.freeze([
    apiGrant('GET', '/v1/patients', [], 'patient-directory'),
    apiGrant('GET', '/v1/patient-intakes/context'),
    apiGrant('POST', '/v1/patient-intakes'),
    apiGrant('GET', '/v1/patients/{uuid}/core'),
    apiGrant('PUT', '/v1/patients/{uuid}/profile'),
    apiGrant('POST', '/v1/patients/{uuid}/complaints', ['work_entry.access']),
    apiGrant('POST', '/v1/patients/{uuid}/cases', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/treatment-plans'),
    apiGrant('GET', '/v1/patients/{uuid}/timeline'),
    apiGrant('GET', '/v1/patients/{uuid}/notes'),
    apiGrant('GET', '/v1/patients/{uuid}/prescriptions'),
    apiGrant('GET', '/v1/patients/{uuid}/follow-ups'),
    apiGrant('GET', '/v1/patients/{uuid}/ledger', ['patient_billing_ledger.read'], 'patient-ledger'),
    apiGrant('GET', '/v1/patients/{uuid}/media', [], 'patient-media-list'),
    apiGrant('GET', '/v1/patients/{uuid}/odontogram', ['work_entry.access']),
    apiGrant('PUT', '/v1/patients/{uuid}/odontogram', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/periodontal-chart', ['work_entry.access']),
    apiGrant('PUT', '/v1/patients/{uuid}/periodontal-chart', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/canal-measurements', ['work_entry.access']),
    apiGrant('POST', '/v1/patients/{uuid}/canal-measurements', ['work_entry.access']),
    apiGrant('GET', '/v1/patients/{uuid}/lab-orders'),
    apiGrant('GET', '/v1/clinic/staff-references', ['staff.reference.read']),
    apiGrant('GET', '/v1/treatment-protocols', ['treatment_protocols.reference.read']),
    apiGrant('GET', '/v1/clinic/suppliers', ['lab_tracker.access'], 'lab-suppliers'),
    apiGrant('POST', '/v1/patient-notes'),
    apiGrant('POST', '/v1/patient-notes/{uuid}/withdraw'),
    apiGrant('POST', '/v1/prescriptions'),
    apiGrant('POST', '/v1/prescriptions/{uuid}/correct'),
    apiGrant('POST', '/v1/prescriptions/{uuid}/withdraw'),
    apiGrant('POST', '/v1/follow-ups'),
    apiGrant('POST', '/v1/patients/{uuid}/payments', ['patient_payments.collect']),
    apiGrant('POST', '/v1/patient-ledger/{uuid}/correct', ['finance.manage']),
    apiGrant('POST', '/v1/patient-ledger/{uuid}/reverse', ['finance.manage']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/status', ['work_entry.access']),
    apiGrant('GET', '/v1/chief-complaints/{uuid}/work-entry', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols/{uuid}/cancel', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols/{uuid}/stages', ['work_entry.access']),
    apiGrant('POST', '/v1/chief-complaints/{uuid}/treatment-protocols/{uuid}/stages/{uuid}/cancel', ['work_entry.access']),
    apiGrant('POST', '/v1/lab-requests', ['lab_requests.create']),
    apiGrant('POST', '/v1/lab-orders/{uuid}/assign', ['lab_tracker.access']),
    apiGrant('PATCH', '/v1/lab-orders/{uuid}', ['lab_tracker.access']),
    apiGrant('POST', '/v1/patient-media/{uuid}/withdraw'),
  ]),
});

const sha256PatternValid = value => typeof value === 'string' && sha256Pattern.test(value);

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every(key => keys.includes(key))
    && keys.every(key => Object.hasOwn(value, key));
}

function isLocalPath(path, pattern, baseOrigin) {
  if (typeof path !== 'string' || !pattern.test(path) || path.includes('..') || path.includes('\\')) return false;
  try {
    const resolved = new URL(path, baseOrigin);
    return resolved.origin === new URL(baseOrigin).origin && resolved.pathname === path
      && !resolved.search && !resolved.hash;
  } catch {
    return false;
  }
}

function compileTemplate(template) {
  if (typeof template !== 'string' || !apiPathPattern.test(template)) return null;
  const segments = template.split('/').map(segment => segment === '{uuid}' ? '[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}' : segment);
  try { return new RegExp(`^${segments.join('/')}$`, 'i'); } catch { return null; }
}

function splitRequestPath(path) {
  if (typeof path !== 'string' || path.length > 1024 || !path.startsWith('/v1/')
    || /[\\#\u0000-\u001f\u007f]/.test(path)) return null;
  const separator = path.indexOf('?');
  if (separator >= 0 && (separator === path.length - 1 || path.indexOf('?', separator + 1) >= 0)) return null;
  const pathname = separator < 0 ? path : path.slice(0, separator);
  const search = separator < 0 ? '' : path.slice(separator + 1);
  if (pathname.includes('%') || pathname.includes('//') || pathname.split('/').some(segment => segment === '.' || segment === '..')) return null;
  try {
    const url = new URL(pathname, 'https://clinic-api.invalid');
    if (url.origin !== 'https://clinic-api.invalid' || url.pathname !== pathname || url.search || url.hash) return null;
  } catch { return null; }
  const params = new URLSearchParams(search);
  const entries = [...params.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return null;
  return { pathname, search, entries };
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
    && new Date(value).toISOString().slice(0, 10) === value;
}

function validQuery(policy, entries) {
  if (!policy) return entries.length === 0;
  const values = new Map(entries);
  if (entries.some(([key]) => !policy.allowed.includes(key))
    || policy.required.some(key => !values.has(key))) return false;
  for (const [key, value] of entries) if (!policy.validators[key]?.(value)) return false;
  if (policy.ordered?.some(([start, end]) => values.has(start) && values.has(end) && values.get(start) > values.get(end))) return false;
  if (policy.combinations && !policy.combinations(entries)) return false;
  return true;
}

const noQuery = Object.freeze({ allowed: Object.freeze([]), required: Object.freeze([]), validators: Object.freeze({}) });
const queryPolicies = Object.freeze({
  'appointment-summary': Object.freeze({
    allowed: Object.freeze(['today']), required: Object.freeze(['today']),
    validators: Object.freeze({ today: validDate }),
  }),
  'appointment-range': Object.freeze({
    allowed: Object.freeze(['date', 'bucket', 'today', 'doctorName']), required: Object.freeze([]),
    validators: Object.freeze({
      date: validDate,
      bucket: value => ['today', 'week', 'upcoming', 'cancelled'].includes(value),
      today: validDate,
      doctorName: value => value.length > 0 && value.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value),
    }),
    combinations: entries => {
      const keys = new Set(entries.map(([key]) => key));
      const dayQuery = keys.has('date') && !keys.has('bucket') && !keys.has('today');
      const bucketQuery = !keys.has('date') && keys.has('bucket') && keys.has('today');
      return dayQuery || bucketQuery;
    },
  }),
  'staff-clinical-work': Object.freeze({
    allowed: Object.freeze(['startDate', 'endDate']), required: Object.freeze([]),
    validators: Object.freeze({ startDate: validDate, endDate: validDate }),
    ordered: Object.freeze([['startDate', 'endDate']]),
    combinations: entries => {
      const keys = new Set(entries.map(([key]) => key));
      return keys.has('startDate') === keys.has('endDate');
    },
  }),
  'work-entry-patient-lookup': Object.freeze({
    allowed: Object.freeze(['q', 'limit']), required: Object.freeze(['q', 'limit']),
    validators: Object.freeze({ q: value => value.trim().length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value), limit: value => value === '8' }),
  }),
  'patient-directory': Object.freeze({
    allowed: Object.freeze(['q', 'cursor', 'limit', 'cohort', 'monthStart', 'monthEnd']), required: Object.freeze(['limit']),
    validators: Object.freeze({
      q: value => value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value),
      cursor: value => value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value),
      limit: value => /^(?:[1-9]|[1-9][0-9]|100)$/.test(value),
      cohort: value => ['all', 'new', 'regular'].includes(value),
      monthStart: validDate, monthEnd: validDate,
    }), ordered: Object.freeze([['monthStart', 'monthEnd']]),
    combinations: entries => {
      const keys = new Set(entries.map(([key]) => key));
      return keys.has('monthStart') === keys.has('monthEnd')
        && !(keys.has('q') && ['cohort', 'monthStart', 'monthEnd'].some(key => keys.has(key)));
    },
  }),
  'patient-ledger': Object.freeze({
    allowed: Object.freeze(['month', 'cursor']), required: Object.freeze([]),
    validators: Object.freeze({ month: value => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value), cursor: value => value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value) }),
  }),
  'patient-media-list': Object.freeze({
    allowed: Object.freeze(['chiefComplaintId']), required: Object.freeze([]),
    validators: Object.freeze({ chiefComplaintId: value => uuidPattern.test(value) }),
  }),
  'follow-up-list': Object.freeze({
    allowed: Object.freeze(['date']), required: Object.freeze([]),
    validators: Object.freeze({ date: validDate }),
  }),
  'lab-suppliers': Object.freeze({
    allowed: Object.freeze(['scope']), required: Object.freeze(['scope']),
    validators: Object.freeze({ scope: value => value === 'lab' }),
  }),
  'finance-date-range': Object.freeze({
    allowed: Object.freeze(['from', 'to']), required: Object.freeze([]),
    validators: Object.freeze({ from: validDate, to: validDate }),
    ordered: Object.freeze([['from', 'to']]),
    combinations: entries => {
      const keys = new Set(entries.map(([key]) => key));
      return keys.has('from') === keys.has('to');
    },
  }),
  'finance-ledger': Object.freeze({
    allowed: Object.freeze(['month', 'cursor']), required: Object.freeze([]),
    validators: Object.freeze({
      month: value => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value),
      cursor: value => value.length >= 1 && value.length <= 512 && !/[\u0000-\u001f\u007f]/.test(value),
    }),
  }),
  'calendar-task-range': Object.freeze({
    allowed: Object.freeze(['from', 'to']), required: Object.freeze(['from', 'to']),
    validators: Object.freeze({ from: validDate, to: validDate }),
    ordered: Object.freeze([['from', 'to']]),
    combinations: entries => {
      const values = new Map(entries);
      const start = Date.parse(`${values.get('from')}T00:00:00.000Z`);
      const end = Date.parse(`${values.get('to')}T00:00:00.000Z`);
      return end >= start && (end - start) / 86_400_000 <= 45;
    },
  }),
});

function grantRequestPolicy(appId, method, pathname, entries) {
  const policy = apiRoutePolicies[appId]?.find(item => item.method === method && compileTemplate(item.path)?.test(pathname));
  if (!policy) return null;
  const query = policy.queryPolicy ? queryPolicies[policy.queryPolicy] : noQuery;
  return validQuery(query, entries) ? policy : null;
}

function sameStringArray(actual, expected) {
  return Array.isArray(actual) && actual.length === expected.length
    && actual.every((value, index) => value === expected[index]);
}

export function isValidAppDescriptor(app, baseOrigin) {
  const descriptorKeys = ['id', 'title', 'icon', 'version', 'capabilities', 'bundle', 'apiGrants', 'mediaGrants'];
  const optionalDescriptorKeys = app?.id === 'finance' ? ['sessionCapabilities'] : [];
  if (!isRecord(app) || descriptorKeys.some(key => !Object.hasOwn(app, key))
    || Object.keys(app).some(key => !descriptorKeys.includes(key) && !optionalDescriptorKeys.includes(key))) return false;
  if (typeof app.id !== 'string' || !appIdPattern.test(app.id)) return false;
  if (typeof app.title !== 'string' || app.title.trim() !== app.title || app.title.length < 1 || app.title.length > 64) return false;
  if (!isLocalPath(app.icon, iconPathPattern, baseOrigin)) return false;
  if (typeof app.version !== 'string' || !appVersionPattern.test(app.version)) return false;
  if (!Array.isArray(app.capabilities) || app.capabilities.length < 1 || app.capabilities.length > 16
    || !app.capabilities.every(capability => typeof capability === 'string' && capabilityPattern.test(capability))
    || new Set(app.capabilities).size !== app.capabilities.length) return false;
  if (app.id === 'finance') {
    if (!Array.isArray(app.sessionCapabilities) || app.sessionCapabilities.length > financeSessionCapabilities.length
      || app.sessionCapabilities.some(capability => !financeSessionCapabilities.includes(capability))
      || new Set(app.sessionCapabilities).size !== app.sessionCapabilities.length) return false;
  } else if (Object.hasOwn(app, 'sessionCapabilities')) return false;
  if (!isRecord(app.bundle)) return false;
  const bundleKeys = Object.keys(app.bundle);
  const requiredBundleKeys = ['entry', 'entrySha256', 'script', 'scriptSha256'];
  if (!requiredBundleKeys.every(key => Object.hasOwn(app.bundle, key))
    || bundleKeys.some(key => ![...requiredBundleKeys, 'style', 'styleSha256'].includes(key))
    || (Object.hasOwn(app.bundle, 'style') !== Object.hasOwn(app.bundle, 'styleSha256'))) return false;
  if (!isLocalPath(app.bundle.entry, appAssetPathPattern, baseOrigin) || !app.bundle.entry.endsWith('.html')) return false;
  if (!isLocalPath(app.bundle.script, appAssetPathPattern, baseOrigin) || !app.bundle.script.endsWith('.js')) return false;
  if (!sha256PatternValid(app.bundle.entrySha256) || !sha256PatternValid(app.bundle.scriptSha256)) return false;
  if (Object.hasOwn(app.bundle, 'style')
    && (!isLocalPath(app.bundle.style, appAssetPathPattern, baseOrigin) || !app.bundle.style.endsWith('.css')
      || !sha256PatternValid(app.bundle.styleSha256))) return false;

  const expectedRoutes = apiRoutePolicies[app.id];
  if (!Array.isArray(expectedRoutes) || !Array.isArray(app.apiGrants) || app.apiGrants.length > 64) return false;
  const seenGrants = new Set();
  for (const grant of app.apiGrants) {
    if (!hasOnlyKeys(grant, ['method', 'path', 'capabilities']) || !['GET', 'POST', 'PUT', 'PATCH'].includes(grant.method)
      || typeof grant.path !== 'string' || !compileTemplate(grant.path)
      || !Array.isArray(grant.capabilities) || grant.capabilities.some(capability => typeof capability !== 'string' || !capabilityPattern.test(capability))
      || new Set(grant.capabilities).size !== grant.capabilities.length) return false;
    const known = expectedRoutes.find(item => item.method === grant.method && item.path === grant.path);
    if (!known || !sameStringArray(grant.capabilities, known.capabilities)) return false;
    const key = `${grant.method} ${grant.path}`;
    if (seenGrants.has(key)) return false;
    seenGrants.add(key);
  }
  const media = knownMediaGrants[app.id];
  if (!Array.isArray(media) || !sameStringArray(app.mediaGrants, media)) return false;
  return true;
}

export function isValidAppCatalog(appCatalog, baseOrigin) {
  if (!Array.isArray(appCatalog) || appCatalog.length < 1 || appCatalog.length > 32) return false;
  const ids = new Set();
  for (const app of appCatalog) {
    if (!isValidAppDescriptor(app, baseOrigin) || ids.has(app.id)) return false;
    ids.add(app.id);
  }
  return true;
}

export function visibleAppsForCapabilities(appCatalog, rawCapabilities) {
  if (!Array.isArray(rawCapabilities)) return [];
  const capabilities = new Set(rawCapabilities.filter(capability => typeof capability === 'string'));
  return appCatalog.filter(app => Array.isArray(app.capabilities)
    && app.capabilities.some(capability => capabilities.has(capability)));
}

export function findAppApiGrant(app, method, path) {
  if (typeof method !== 'string') return null;
  const parsed = splitRequestPath(path);
  if (!parsed || !app || typeof app.id !== 'string') return null;
  const policy = grantRequestPolicy(app.id, method, parsed.pathname, parsed.entries);
  if (!policy) return null;
  return app.apiGrants?.find(grant => grant.method === method && grant.path === policy.path
    && sameStringArray(grant.capabilities, policy.capabilities)) ?? null;
}

export function appApiCapabilitiesForRequest(app, method, path, body = null) {
  const grant = findAppApiGrant(app, method, path);
  if (!grant) return null;
  const capabilities = [...grant.capabilities];
  // Work Entry's source commit contract carries an optional payment alongside
  // clinical work. Keep that field behind the same collection and ledger
  // permissions that gate its UI; this does not grant the separate payments API.
  if (app.id === 'workentry' && method === 'POST' && path === '/v1/work-entry/commit'
    && body?.payment != null) {
    capabilities.push('patient_payments.collect', 'patient_billing_ledger.read');
  }
  return capabilities;
}

export function apiRequestPathIsValid(path) {
  return splitRequestPath(path) !== null;
}

export function appApiGrantsForApp(appId) {
  return Object.freeze((apiRoutePolicies[appId] ?? []).map(({ method, path, capabilities }) => Object.freeze({
    method, path, capabilities,
  })));
}

export function appMediaGrantsForApp(appId) {
  return knownMediaGrants[appId] ?? Object.freeze([]);
}

export function appMediaOperationIsGranted(app, operation) {
  return typeof operation === 'string' && Array.isArray(app?.mediaGrants) && app.mediaGrants.includes(operation);
}
