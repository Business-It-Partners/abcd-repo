/** Renderer-safe wire contract. No Electron, credential, filesystem or transport imports. */
export const SDK = { major: 1, minor: 0 } as const;
export const MAX_REQUEST_BYTES = 16_384;
export const operations = ['appointments.list', 'appointments.setStatus', 'session.context', 'platform.status', 'preferences.read', 'preferences.update', 'lifecycle.report', 'notifications.show', 'native.intent'] as const;
export type Operation = typeof operations[number];
export type ErrorCode = 'INVALID_REQUEST' | 'UNKNOWN_CALLER' | 'INCOMPATIBLE_SDK' | 'STALE_SESSION' | 'FORBIDDEN' | 'BUSY' | 'AUTH_REQUIRED' | 'ACCESS_DENIED' | 'CONFLICT' | 'VALIDATION' | 'OFFLINE' | 'MAINTENANCE' | 'TIMEOUT' | 'CANCELLED' | 'UNKNOWN_OUTCOME' | 'INVALID_RESPONSE' | 'REDIRECT_DENIED' | 'UNAVAILABLE';
export type Outcome = 'not_sent' | 'rejected' | 'unknown';
export type Result<T = unknown> = { ok: true; value: T } | { ok: false; error: { code: ErrorCode; message: string; outcome: Outcome; requestId?: string; operationId?: string } };
export type Connection = { connection: string; generation: number; appId: string; appVersion: string; sdk: typeof SDK; capabilities: Operation[] };
export type Request = { version: 1; connection: string; generation: number; requestId: string; operation: Operation; input: Record<string, unknown> };
export type Cancel = Pick<Request, 'version' | 'connection' | 'generation' | 'requestId'>;
export type AppSdk = {
  connect(input: { major: number; minor: number }): Promise<Result<Connection>>;
  request(input: Request): Promise<Result>;
  cancel(input: Cancel): Promise<Result>;
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
    case 'preferences.update': valid = shape(p, ['textScale']) && [0.9, 1, 1.1].includes(p.textScale as number); break;
    case 'lifecycle.report': valid = shape(p, ['dirty', 'modal']) && typeof p.dirty === 'boolean' && typeof p.modal === 'boolean'; break;
    case 'notifications.show': valid = shape(p, ['message']) && text(p.message, 160) && p.message.length > 0; break;
    case 'native.intent': valid = shape(p, ['kind']) && ['print', 'export'].includes(p.kind as string); break;
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
  throw new Error('Invalid API response');
}
