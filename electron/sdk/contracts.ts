import { validMediaUpload } from './mediaUploadContract';
import { validPickInput } from '../host/filePickerContract';
/** Renderer-safe wire contract. No Electron, credential, filesystem or transport imports. */
export const SDK = { major: 1, minor: 5 } as const;
export const MAX_REQUEST_BYTES = 16_384;
export const operations = [
  'appointments.list', 'appointments.setStatus', 'clinic.api.request', 'clinic.api.blob.read', 'clinic.media.read', 'clinic.media.upload',
  'clinic.app.followups', 'clinic.app.appointments', 'clinic.app.work-entry', 'clinic.app.patient-record',
  'clinic.app.treatment-progress', 'clinic.app.lab-tracker', 'clinic.app.finance', 'clinic.app.patient-payments',
  'clinic.app.staff', 'clinic.app.treatment-protocols', 'clinic.app.calendar',
  'session.context', 'platform.status', 'preferences.read', 'preferences.update', 'lifecycle.report', 'notifications.show', 'native.intent', 'local.files.pick',
] as const;
export type Operation = typeof operations[number];
/** Closed host API contracts that update-policy v2 may grant to an exact app release. */
export const apiOperations = ['appointments.list', 'appointments.setStatus', 'clinic.api.request', 'clinic.media.read', 'clinic.media.upload'] as const;
export type ApiOperationId = typeof apiOperations[number];
export type ErrorCode = 'INVALID_REQUEST' | 'UNKNOWN_CALLER' | 'INCOMPATIBLE_SDK' | 'STALE_SESSION' | 'FORBIDDEN' | 'BUSY' | 'AUTH_REQUIRED' | 'ACCESS_DENIED' | 'CONFLICT' | 'VALIDATION' | 'OFFLINE' | 'MAINTENANCE' | 'TIMEOUT' | 'CANCELLED' | 'UNKNOWN_OUTCOME' | 'INVALID_RESPONSE' | 'REDIRECT_DENIED' | 'UNAVAILABLE';
export type Outcome = 'not_sent' | 'rejected' | 'unknown';
export type Result<T = unknown> = { ok: true; value: T } | { ok: false; error: { code: ErrorCode; message: string; outcome: Outcome; requestId?: string; operationId?: string } };
export type Connection = { connection: string; generation: number; appId: string; appVersion: string; sdk: typeof SDK; capabilities: Operation[] };
/** Safe clinic display context serialized by the host; never includes credentials. */
export type ClinicSessionContext = {
  clinicUser: { clinicUserId: string; displayName: string; role: 'admin' | 'doctor' | 'reception'; capabilities: string[] };
  clinic: { tenantId: string; displayName: string; timezone: string; currency: string; defaultBranchId: string | null; hasActiveTrial: boolean };
  branches: Array<{ branchId: string; branchCode: string; name: string }>;
};
export type RuntimeAppInfo = { appId: string; title: string; description: string; iconDataUrl: string; modules: readonly { id: string; label: string; tab: string; capability: string }[] };
export type Request = { version: 1; connection: string; generation: number; requestId: string; operation: Operation; input: Record<string, unknown> };
export type Cancel = Pick<Request, 'version' | 'connection' | 'generation' | 'requestId'>;
export type AppSdk = {
  connect(input: { major: number; minor: number }): Promise<Result<Connection>>;
  request(input: Request): Promise<Result>;
  cancel(input: Cancel): Promise<Result>;
  getAppInfo(): Promise<Result<RuntimeAppInfo>>;
  openAppExplorer(): Promise<Result>;
  onModuleSelected(listener: (value: { moduleId: string }) => void): () => void;
  /** Local Files metadata delivered by the trusted OS, never file bytes or paths. */
  onFilesReceived(listener: (selection: import('../host/localFiles').FileSelection) => void): () => void;
  report(input: { dirty: boolean; modal: boolean }): void;
};
export function shape(value: unknown, keys: string[]): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join() === keys.slice().sort().join();
}
export const id = (v: unknown): v is string => typeof v === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(v);
export const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const integer = (v: unknown) => Number.isSafeInteger(v) && (v as number) > 0;
export const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max && !/[\u0000-\u001f\u007f]/.test(v);
export function bounded(value: unknown, max = MAX_REQUEST_BYTES) {
  try { const s = JSON.stringify(value); return s !== undefined && new TextEncoder().encode(s).length <= max; } catch { return false; }
}
export function handshake(value: unknown): boolean {
  return shape(value, ['major', 'minor']) && value.major === SDK.major && Number.isSafeInteger(value.minor) && (value.minor as number) >= 0 && (value.minor as number) <= SDK.minor;
}
export function cancelRequest(value: unknown): value is Cancel {
  return shape(value, ['version', 'connection', 'generation', 'requestId']) && value.version === 1 && uuid(value.connection) && integer(value.generation) && id(value.requestId);
}
export function parseRequest(value: unknown): Request | undefined {
  if (!bounded(value) || !shape(value, ['version', 'connection', 'generation', 'requestId', 'operation', 'input'])) return;
  const { version, connection, generation, requestId, operation, input: p } = value;
  if (version !== 1 || !uuid(connection) || !integer(generation) || !id(requestId) || !operations.includes(operation as Operation)) return;
  let valid = false;
  switch (operation as Operation) {
    case 'appointments.list':
      valid = shape(p, ['date']) && typeof p.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(p.date) && !Number.isNaN(Date.parse(p.date)) && new Date(p.date).toISOString().slice(0, 10) === p.date; break;
    case 'appointments.setStatus':
      valid = shape(p, ['appointmentId', 'status', 'expectedRowVersion', 'idempotencyKey']) && uuid(p.appointmentId) && ['booked', 'arrived', 'cancelled', 'no_show'].includes(p.status as string) && integer(p.expectedRowVersion) && id(p.idempotencyKey); break;
    case 'clinic.api.request': {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
      const candidate = p && typeof p === 'object' && !Array.isArray(p) ? p as Record<string, unknown> : undefined;
      const method = candidate?.method;
      const read = method === 'GET';
      valid = !!candidate && shape(candidate, ['path', 'method', 'body', 'idempotencyKey']) && text(candidate.path, 1024) && candidate.path.startsWith('/v1/') && !/[\\\u0000-\u001f\u007f#]/.test(candidate.path) && methods.includes(method as string) && (candidate.body === null || text(candidate.body, 12_000)) && (candidate.idempotencyKey === null || id(candidate.idempotencyKey)) && (read ? candidate.body === null && candidate.idempotencyKey === null : candidate.idempotencyKey !== null);
      if (valid && candidate!.body !== null) {
        try { const body = JSON.parse(candidate!.body as string); valid = !!body && typeof body === 'object' && !Array.isArray(body) && bounded(body, 12_000); }
        catch { valid = false; }
      }
      break;
    }
    case 'clinic.media.upload': valid = validMediaUpload(p); break;
    case 'clinic.media.read': valid = shape(p, ['kind', 'recordId', 'assetId']) && ['patient_media', 'staff_document'].includes(p.kind as string) && uuid(p.recordId) && uuid(p.assetId); break;
    case 'clinic.api.blob.read': valid = shape(p, ['path']) && text(p.path, 1024) && p.path.startsWith('/v1/') && !/[\\\u0000-\u001f\u007f#]/.test(p.path); break;
    case 'preferences.update': valid = shape(p, ['textScale']) && [0.9, 1, 1.1].includes(p.textScale as number); break;
    case 'lifecycle.report': valid = shape(p, ['dirty', 'modal']) && typeof p.dirty === 'boolean' && typeof p.modal === 'boolean'; break;
    case 'notifications.show': valid = shape(p, ['message']) && text(p.message, 160) && p.message.length > 0; break;
    case 'native.intent': valid = shape(p, ['kind']) && ['print', 'export'].includes(p.kind as string); break;
    case 'local.files.pick': valid = validPickInput(p); break;
    default: valid = shape(p, []);
  }
  return valid ? value as Request : undefined;
}
export function appointment(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return uuid(v.appointmentId) && text(v.patientName, 160) && (v.contactPhone === null || text(v.contactPhone, 40)) && text(v.doctorName, 160) && text(v.appointmentDate, 10) && Number.isSafeInteger(v.startMinute) && (v.startMinute as number) >= 0 && (v.startMinute as number) < 1440 && integer(v.durationMinutes) && (v.durationMinutes as number) <= 1440 && text(v.reason, 2000) && ['booked', 'arrived', 'cancelled', 'no_show'].includes(v.status as string) && text(v.createdAt, 40) && text(v.updatedAt, 40) && integer(v.rowVersion);
}
const appointmentFields = ['appointmentId', 'patientName', 'contactPhone', 'doctorName', 'appointmentDate', 'startMinute', 'durationMinutes', 'reason', 'status', 'createdAt', 'updatedAt', 'rowVersion'];
const projectAppointment = (v: Record<string, unknown>) => Object.fromEntries(appointmentFields.map(k => [k, v[k]]));
export function apiResponse(operation: Operation, value: unknown): unknown {
  if (operation === 'appointments.list' && shape(value, ['appointments']) && Array.isArray(value.appointments) && value.appointments.length <= 200 && value.appointments.every(appointment)) return { appointments: value.appointments.map(projectAppointment) };
  if (operation === 'appointments.setStatus' && shape(value, ['appointment']) && appointment(value.appointment)) return { appointment: projectAppointment(value.appointment) };
  if (operation === 'clinic.api.request' && shape(value, ['status', 'body']) && Number.isInteger(value.status) && (value.status as number) >= 200 && (value.status as number) <= 599 && (value.body === null || bounded(value.body, 262_144))) return value;
  if (operation === 'clinic.api.blob.read' && shape(value, ['status', 'contentType', 'body']) && value.status === 200 && typeof value.contentType === 'string' && ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(value.contentType) && value.body instanceof Uint8Array && value.body.byteLength <= 8 * 1024 * 1024) return value;
  throw new Error('Invalid API response');
}
