import { ClinicClient, ClinicCommand, ClinicError } from '../../../../../../packages/app-sdk/src/clinicClient';
import type { FollowUpCreateInput, FollowUpScheduleInput, FollowUpToggleInput, FollowUpToggleResult, FollowUpWorklistItem, PatientFollowUp, PatientSummary } from '../patients/types';

type WriteState = 'none' | 'saving' | 'unknown';
type Row = Record<string, unknown>;
let client: ClinicClient;
let pending: ClinicCommand<unknown> | undefined;
let writeState: WriteState = 'none';
let notify: (state: WriteState) => void = () => {};
function state(value: WriteState) { writeState = value; notify(value); }
const isRow = (value: unknown): value is Row => !!value && typeof value === 'object' && !Array.isArray(value);
const hasKeys = (row: Row, keys: string[]) => Object.keys(row).sort().join('|') === keys.slice().sort().join('|');
const text = (value: unknown, max: number, nonEmpty = false): value is string => typeof value === 'string' && value.length <= max && (!nonEmpty || value.trim().length > 0) && !/[\u0000-\u001f\u007f]/.test(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const isoDate = (value: unknown): value is string => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const nullableText = (value: unknown, max: number) => value === null || text(value, max);
const nullableDate = (value: unknown) => value === null || isoDate(value);
const nullableTime = (value: unknown) => value === null || (typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value));
const positiveVersion = (value: unknown) => Number.isSafeInteger(value) && (value as number) > 0;
const followUpStatus = (value: unknown) => ['pending', 'caught', 'missed', 'cancelled'].includes(value as string);

function isWorklistItem(value: unknown): boolean {
  if (!isRow(value) || !hasKeys(value, ['followUpId', 'patientId', 'chiefComplaintId', 'dueOn', 'dueTime', 'reason', 'status', 'rowVersion', 'patientNumber', 'patientName', 'patientPhone', 'requestedByStaffName', 'lastVisitOn', 'called', 'noAnswer'])) return false;
  return uuid(value.followUpId) && uuid(value.patientId) && (value.chiefComplaintId === null || uuid(value.chiefComplaintId)) && isoDate(value.dueOn) && nullableTime(value.dueTime) && text(value.reason, 2000) && followUpStatus(value.status) && positiveVersion(value.rowVersion) && text(value.patientNumber, 64, true) && text(value.patientName, 160, true) && nullableText(value.patientPhone, 40) && nullableText(value.requestedByStaffName, 160) && nullableDate(value.lastVisitOn) && typeof value.called === 'boolean' && typeof value.noAnswer === 'boolean';
}

function isPatientSummary(value: unknown): boolean {
  if (!isRow(value) || !hasKeys(value, ['patientId', 'patientNumber', 'fullName', 'dateOfBirth', 'ageYears', 'sex', 'phone', 'status', 'registeredOn', 'rowVersion'])) return false;
  return uuid(value.patientId) && text(value.patientNumber, 64, true) && text(value.fullName, 160, true) && nullableDate(value.dateOfBirth) && (value.ageYears === null || (Number.isSafeInteger(value.ageYears) && (value.ageYears as number) >= 0)) && (value.sex === null || ['female', 'male', 'other', 'not_recorded'].includes(value.sex as string)) && nullableText(value.phone, 40) && ['active', 'inactive'].includes(value.status as string) && isoDate(value.registeredOn) && positiveVersion(value.rowVersion);
}

function isStaffReference(value: unknown): value is Row {
  return isRow(value) && hasKeys(value, ['staffId', 'fullName', 'staffType', 'jobTitle', 'status']) && uuid(value.staffId) && text(value.fullName, 160, true) && ['doctor', 'helper', 'receptionist', 'other'].includes(value.staffType as string) && nullableText(value.jobTitle, 160) && ['active', 'inactive'].includes(value.status as string);
}

function list<T>(value: unknown, key: string, validRow: (row: unknown) => boolean): T[] {
  const rows = value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  if (!Array.isArray(rows) || rows.length > 500 || !rows.every(validRow)) throw new ClinicError('INVALID_RESPONSE', 'The clinic list could not be loaded within the supported limits.');
  return rows as T[];
}

function receipt(value: unknown, validFollowUp: (row: unknown) => boolean): boolean {
  return isRow(value) && hasKeys(value, ['followUp']) && validFollowUp(value.followUp);
}
function isPatientFollowUp(value: unknown): boolean {
  return isRow(value) && hasKeys(value, ['followUpId', 'patientId', 'chiefComplaintId', 'dueOn', 'dueTime', 'reason', 'status']) && uuid(value.followUpId) && uuid(value.patientId) && (value.chiefComplaintId === null || uuid(value.chiefComplaintId)) && isoDate(value.dueOn) && nullableTime(value.dueTime) && text(value.reason, 2000) && followUpStatus(value.status);
}
function isToggleResult(value: unknown): boolean {
  return isRow(value) && hasKeys(value, ['followUpId', 'field', 'checked', 'status', 'rowVersion']) && uuid(value.followUpId) && ['called', 'no_answer', 'caught'].includes(value.field as string) && typeof value.checked === 'boolean' && followUpStatus(value.status) && positiveVersion(value.rowVersion);
}
function isScheduleReceipt(value: unknown): boolean {
  return isRow(value) && hasKeys(value, ['followUpId', 'dueOn', 'dueTime', 'reason', 'rowVersion']) && uuid(value.followUpId) && isoDate(value.dueOn) && nullableTime(value.dueTime) && text(value.reason, 2000) && positiveVersion(value.rowVersion);
}

async function write<T>(method: 'POST' | 'PATCH', path: string, input: unknown): Promise<T> {
  if (writeState === 'saving') throw new ClinicError('BUSY', 'A save is already running.');
  const body = JSON.stringify(input);
  if (pending && (pending.path !== path || pending.method !== method || pending.body !== body)) {
    throw new ClinicError('UNKNOWN_OUTCOME', 'Resolve the earlier save before changing another record.', 'unknown', pending.operationId);
  }
  const valid = path === '/v1/follow-ups' ? (value: unknown) => receipt(value, isPatientFollowUp)
    : path.endsWith('/toggle') ? (value: unknown) => receipt(value, isToggleResult)
    : path.endsWith('/schedule') ? (value: unknown) => receipt(value, isScheduleReceipt)
    : () => false;
  pending ??= client.command<T>(method, path, input, valid);
  return execute<T>();
}
async function execute<T>(): Promise<T> {
  if (!pending) throw new ClinicError('INVALID_REQUEST', 'There is no earlier save to reconcile.');
  state('saving');
  try { const result = await pending.execute() as T; pending = undefined; state('none'); return result; }
  catch (error) {
    if (error instanceof ClinicError && error.outcome !== 'unknown') { pending = undefined; state('none'); }
    else state('unknown');
    throw error;
  }
}
export const followUpsApi = {
  configure(value: ClinicClient, listener: (state: WriteState) => void) { client = value; pending = undefined; notify = listener; state('none'); },
  clear() { pending = undefined; notify = () => {}; writeState = 'none'; },
  reconcile: () => execute<unknown>(),
  listFollowUps: async (signal?: AbortSignal) => list<FollowUpWorklistItem>(await client.read('/v1/follow-ups', signal), 'followUps', isWorklistItem),
  staffReferences: async () => list<Row>(await client.read('/v1/clinic/staff-references'), 'staff', isStaffReference)
    .filter(row => row.staffType === 'doctor' && row.status === 'active')
    .map(({ staffId, fullName }) => ({ staffId: staffId as string, fullName: fullName as string })),
  searchPatients: async (query: string) => {
    const q = query.trim();
    if (!q) return [];
    return list<PatientSummary>(await client.read('/v1/patients?' + new URLSearchParams({ q, limit: '8' })), 'patients', isPatientSummary);
  },
  createFollowUp: async (input: FollowUpCreateInput) => (await write<{ followUp: PatientFollowUp }>('POST', '/v1/follow-ups', input)).followUp,
  toggleFollowUp: async (id: string, input: FollowUpToggleInput) => (await write<{ followUp: FollowUpToggleResult }>('PATCH', `/v1/follow-ups/${id}/toggle`, input)).followUp,
  rescheduleFollowUp: async (id: string, input: FollowUpScheduleInput) => (await write<{ followUp: { rowVersion: number } }>('PATCH', `/v1/follow-ups/${id}/schedule`, input)).followUp,
};
