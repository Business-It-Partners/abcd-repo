/** Host-owned clinic JSON contract v1. Paths never authorize credentials by themselves. */
export const clinicJsonContractVersion = 1;
type Query = Readonly<Record<string, (value: string) => boolean>>;
type Rule = { apps: readonly string[]; method: string; path: string; query: Query; requiredQuery: readonly string[];
  capabilities: readonly string[]; check?: (url: URL) => boolean; pattern: RegExp };
const uuidPart = '[A-Fa-f0-9]{8}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{4}-[A-Fa-f0-9]{12}';
const short = (max: number) => (value: string) => value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
const date = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))
  && new Date(value).toISOString().slice(0, 10) === value;
const identifier = (value: string) => new RegExp('^' + uuidPart + '$').test(value);
const patientQuery: Query = { q: short(120), cursor: short(512), limit: value => /^(?:[1-9]|[1-9][0-9]|100)$/.test(value),
  cohort: value => ['all', 'new', 'regular'].includes(value), monthStart: date, monthEnd: date };
const period: Query = { from: date, to: date };
const ledgerQuery: Query = { month: value => /^\d{4}-(?:0[1-9]|1[0-2])$/.test(value), cursor: short(512) };
const rules: Rule[] = [];
function route(apps: string[], methods: string[], path: string, query: Query = {}, capabilities: string[] = [], requiredQuery: string[] = [], check?: Rule['check']) {
  const pattern = new RegExp('^' + path.split('/').map(segment => segment.startsWith(':') ? uuidPart
    : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('/') + '$');
  for (const method of methods) rules.push({ apps, method, path, query, capabilities, requiredQuery, check, pattern });
}
const patient = ['patient-record'], work = ['work-entry'], finance = ['finance'], staff = ['staff'];
const care = ['patient-record', 'work-entry'];
route(['followups'], ['GET'], '/v1/follow-ups', { date });
route(['followups', ...patient], ['POST'], '/v1/follow-ups');
route(['followups'], ['PATCH'], '/v1/follow-ups/:id/toggle');
route(['followups'], ['PATCH'], '/v1/follow-ups/:id/schedule');
const lookupApps = ['followups', 'appointments', 'work-entry', 'treatment-progress', 'patient-payments', 'finance'];
route(lookupApps, ['GET'], '/v1/patients', { q: value => short(120)(value) && !!value.trim(), limit: value => value === '8' }, [], ['q', 'limit']);
route(patient, ['GET'], '/v1/patients', patientQuery);
route(['followups', 'appointments', ...care, 'lab-tracker', 'finance', 'staff', 'calendar'], ['GET'], '/v1/clinic/staff-references', {}, ['staff.reference.read']);
route(['appointments', 'calendar'], ['GET'], '/v1/appointments', { date, doctorName: short(160), bucket: value => ['today', 'week', 'upcoming', 'cancelled'].includes(value), today: date }, ['appointments.access'], [],
  url => url.searchParams.has('bucket') ? url.searchParams.has('today') && !url.searchParams.has('date') : url.searchParams.has('date') && !url.searchParams.has('today'));
route(['appointments'], ['GET'], '/v1/appointments/summary', { today: date }, ['appointments.access'], ['today']);
route(['appointments'], ['POST'], '/v1/appointments');
route(['appointments'], ['PATCH'], '/v1/appointments/:id');
route(['appointments'], ['POST'], '/v1/appointments/:id/status');
route(patient, ['GET'], '/v1/patient-intakes/context');
route(patient, ['POST'], '/v1/patient-intakes');
route([...care, 'treatment-progress', 'finance', 'patient-payments'], ['GET'], '/v1/patients/:id/core');
route(patient, ['PUT'], '/v1/patients/:id/profile');
for (const action of ['complaints', 'cases']) route(care, ['POST'], '/v1/patients/:id/' + action, {}, ['work_entry.access']);
for (const action of ['treatment-plans', 'timeline', 'notes', 'prescriptions', 'follow-ups']) route(patient, ['GET'], '/v1/patients/:id/' + action);
route(patient, ['POST'], '/v1/patient-notes');
route(patient, ['POST'], '/v1/patient-notes/:id/withdraw');
route(patient, ['POST'], '/v1/prescriptions');
for (const action of ['correct', 'withdraw']) route(patient, ['POST'], '/v1/prescriptions/:id/' + action);
route(['patient-record', 'finance', 'patient-payments'], ['GET'], '/v1/patients/:id/ledger', ledgerQuery, ['patient_billing_ledger.read']);
route(['patient-record', 'finance', 'patient-payments'], ['POST'], '/v1/patients/:id/payments', {}, ['patient_payments.collect']);
route(['finance', 'patient-payments'], ['GET'], '/v1/patient-payments', period, ['patient_payments.outstanding.read']);
for (const action of ['correct', 'reverse']) route(['patient-record', 'finance'], ['POST'], '/v1/patient-ledger/:id/' + action, {}, ['finance.manage']);
for (const chart of ['odontogram', 'periodontal-chart']) route(care, ['GET', 'PUT'], '/v1/patients/:id/' + chart, {}, ['work_entry.access']);
route(care, ['GET', 'POST'], '/v1/patients/:id/canal-measurements', {}, ['work_entry.access']);
route(care, ['GET'], '/v1/patients/:id/media', { chiefComplaintId: identifier });
// Upload intents/content/finalise and private binary views require the separate media contract.
route(patient, ['POST'], '/v1/patient-media/:id/withdraw');
route(['patient-record', 'lab-tracker'], ['GET'], '/v1/patients/:id/lab-orders');
route(['patient-record', 'work-entry', 'lab-tracker'], ['GET'], '/v1/lab-orders');
route(patient, ['POST'], '/v1/lab-orders', {}, ['lab_tracker.access']);
route(care, ['POST'], '/v1/lab-requests', {}, ['lab_requests.create']);
route(['patient-record', 'lab-tracker'], ['POST'], '/v1/lab-orders/:id/assign', {}, ['lab_tracker.access']);
route(['patient-record', 'lab-tracker'], ['PATCH'], '/v1/lab-orders/:id', {}, ['lab_tracker.access']);
route(['patient-record', 'work-entry', 'lab-tracker'], ['GET'], '/v1/clinic/suppliers', { scope: value => value === 'lab' }, ['lab_tracker.access'], ['scope']);
route(finance, ['GET'], '/v1/clinic/suppliers', {}, ['finance.manage']);
route(patient, ['GET'], '/v1/clinic/suppliers', {}, ['finance.manage']);
route(['lab-tracker'], ['GET'], '/v1/clinic/suppliers/:id/statement', { scope: value => value === 'lab' }, ['lab_tracker.access'], ['scope']);
route(finance, ['GET'], '/v1/clinic/suppliers/:id/statement', {}, ['finance.manage']);
route(['lab-tracker', 'finance'], ['POST'], '/v1/clinic/suppliers');
route(['lab-tracker', 'finance'], ['PATCH'], '/v1/clinic/suppliers/:id');
route(work, ['GET'], '/v1/work-entry/cases');
route(care, ['GET', 'PUT'], '/v1/chief-complaints/:id/work-entry', {}, ['work_entry.access']);
route(care, ['POST'], '/v1/chief-complaints/:id/treatment-protocols', {}, ['work_entry.access']);
for (const action of ['reopen', 'complete', 'status']) route(care, ['POST'], '/v1/chief-complaints/:id/' + action, {}, ['work_entry.access']);
route(care, ['POST'], '/v1/chief-complaints/:id/treatment-protocols/:id/cancel', {}, ['work_entry.access']);
route(care, ['POST'], '/v1/chief-complaints/:id/treatment-protocols/:id/stages', {}, ['work_entry.access']);
route(care, ['POST'], '/v1/chief-complaints/:id/treatment-protocols/:id/stages/:id/cancel', {}, ['work_entry.access']);
for (const path of ['/v1/clinical-work/finalise', '/v1/work-entry/commit']) route(care, ['POST'], path, {}, ['work_entry.access']);
route(['treatment-progress'], ['GET'], '/v1/treatment-progress');
route(['patient-record', 'work-entry', 'treatment-progress', 'treatment-protocols'], ['GET'], '/v1/treatment-protocols', {}, ['treatment_protocols.reference.read']);
route(['treatment-protocols'], ['POST'], '/v1/treatment-protocols');
route(['treatment-protocols'], ['PUT'], '/v1/treatment-protocols/:id');
for (const collection of ['operating-expenses', 'purchases', 'salary-payouts', 'supplier-payments']) {
  route(finance, ['GET', 'POST'], '/v1/clinic/' + collection, {}, ['finance.manage']);
  for (const action of ['void', 'correct']) route(finance, ['POST'], '/v1/clinic/' + collection + '/:id/' + action, {}, ['finance.manage']);
}
route(finance, ['GET', 'POST'], '/v1/clinic/products', {}, ['finance.manage']);
route(finance, ['PATCH'], '/v1/clinic/products/:id', {}, ['finance.manage']);
route(finance, ['GET'], '/v1/clinic/transaction-record', period, ['finance.manage']);
route(['staff', 'finance'], ['GET'], '/v1/clinic/staff', {}, ['staff.manage']);
route(staff, ['GET'], '/v1/clinic/salary-payouts', {}, ['finance.manage']);
route(staff, ['POST'], '/v1/clinic/staff');
route(staff, ['GET', 'PATCH'], '/v1/clinic/staff/:id');
route(staff, ['GET'], '/v1/clinic/staff/:id/clinical-work', { startDate: date, endDate: date });
route(staff, ['GET'], '/v1/clinic/staff/:id/documents');
route(staff, ['POST'], '/v1/clinic/staff/:id/documents/:id/withdraw');
route(['calendar'], ['GET'], '/v1/calendar-tasks', period, [], ['from', 'to'],
  url => (Date.parse(url.searchParams.get('to')!) - Date.parse(url.searchParams.get('from')!)) / 86_400_000 <= 45);
route(['calendar'], ['POST'], '/v1/calendar-tasks');
route(['calendar'], ['PATCH'], '/v1/calendar-tasks/:id');
route(['calendar'], ['POST'], '/v1/calendar-tasks/:id/archive');

export function resolveClinicJsonRoute(appId: string, path: string, method: string): Readonly<Pick<Rule, 'path' | 'method' | 'capabilities'>> | undefined {
  if (!path.startsWith('/v1/') || path.length > 1024 || /[\\#\u0000-\u001f\u007f]/.test(path)) return;
  const rawPath = path.split('?', 1)[0];
  if (rawPath.includes('%') || rawPath.includes('//') || rawPath.split('/').some(part => part === '.' || part === '..')) return;
  let url: URL; try { url = new URL(path, 'https://clinic-api.invalid'); } catch { return; }
  if (url.origin !== 'https://clinic-api.invalid' || url.pathname !== rawPath) return;
  const entries = [...url.searchParams.entries()];
  if (new Set(entries.map(([key]) => key)).size !== entries.length) return;
  for (const rule of rules) {
    if (!rule.apps.some(app => appId === 'company.dental.' + app) || method !== rule.method || !rule.pattern.test(rawPath)) continue;
    if (entries.some(([name, value]) => !Object.hasOwn(rule.query, name) || !rule.query[name](value))
      || rule.requiredQuery.some(name => !url.searchParams.has(name)) || rule.check?.(url) === false) continue;
    let valid = true;
    for (const [from, to] of [['from', 'to'], ['startDate', 'endDate'], ['monthStart', 'monthEnd']]) {
      const a = url.searchParams.get(from), b = url.searchParams.get(to);
      if (a && b && a > b) valid = false;
    }
    if (valid) return rule;
  }
}
