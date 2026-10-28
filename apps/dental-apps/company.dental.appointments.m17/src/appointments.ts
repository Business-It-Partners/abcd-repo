import { ClinicClient, ClinicError, type ClinicCommand } from '../../../../packages/app-sdk/src/clinicClient';

export type AppointmentStatus = 'booked' | 'arrived' | 'cancelled' | 'no_show';
export type AppointmentBucket = 'today' | 'week' | 'upcoming' | 'cancelled';
export type Appointment = {
  appointmentId: string;
  patientName: string;
  contactPhone: string | null;
  doctorName: string;
  appointmentDate: string;
  startMinute: number;
  durationMinutes: number;
  reason: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
};
export type AppointmentInput = Omit<Appointment, 'appointmentId' | 'status' | 'createdAt' | 'updatedAt' | 'rowVersion'>;
// Keep these response keys for older Worker clients; date totals include every status.
export type AppointmentSummary = { todayBooked: number; thisWeekBooked: number; upcomingBooked: number; cancelled: number };
export type StaffReference = { staffId: string; fullName: string; staffType: string; jobTitle: string | null; status: string };
export type AppointmentReceipt = { appointment: Appointment };

const statuses: AppointmentStatus[] = ['booked', 'arrived', 'cancelled', 'no_show'];
const buckets: AppointmentBucket[] = ['today', 'week', 'upcoming', 'cancelled'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDate = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function isAppointment(value: unknown): value is Appointment {
  if (!record(value)) return false;
  return typeof value.appointmentId === 'string' && uuid.test(value.appointmentId)
    && typeof value.patientName === 'string' && value.patientName.length <= 160
    && (value.contactPhone === null || typeof value.contactPhone === 'string' && value.contactPhone.length <= 40)
    && typeof value.doctorName === 'string' && value.doctorName.length <= 160
    && isoDate(value.appointmentDate)
    && Number.isSafeInteger(value.startMinute) && (value.startMinute as number) >= 0 && (value.startMinute as number) < 1440
    && Number.isSafeInteger(value.durationMinutes) && (value.durationMinutes as number) > 0 && (value.durationMinutes as number) <= 720
    && typeof value.reason === 'string' && value.reason.length <= 2000
    && statuses.includes(value.status as AppointmentStatus)
    && typeof value.createdAt === 'string' && typeof value.updatedAt === 'string'
    && Number.isSafeInteger(value.rowVersion) && (value.rowVersion as number) > 0;
}

function appointmentList(value: unknown): value is { appointments: Appointment[] } {
  return record(value) && Array.isArray(value.appointments) && value.appointments.length <= 200 && value.appointments.every(isAppointment);
}
function appointmentReceipt(value: unknown): value is AppointmentReceipt {
  return record(value) && isAppointment(value.appointment);
}
function summary(value: unknown): value is AppointmentSummary {
  return record(value) && ['todayBooked', 'thisWeekBooked', 'upcomingBooked', 'cancelled'].every(key => Number.isSafeInteger(value[key]) && (value[key] as number) >= 0);
}
function staffRows(value: unknown): value is { staff: StaffReference[] } {
  return record(value) && Array.isArray(value.staff) && value.staff.length <= 500 && value.staff.every(item => record(item)
    && typeof item.staffId === 'string' && item.staffId.length <= 64
    && typeof item.fullName === 'string' && item.fullName.length > 0 && item.fullName.length <= 160
    && typeof item.staffType === 'string' && (item.jobTitle === null || typeof item.jobTitle === 'string')
    && typeof item.status === 'string');
}
function validResult(value: unknown): boolean { return appointmentReceipt(value); }

/** Appointment SaaS endpoints accessed only through Dental OS's brokered SDK. */
export class AppointmentsApi {
  constructor(private client: ClinicClient) {}

  async doctors(): Promise<StaffReference[]> {
    const value: unknown = await this.client.read('/v1/clinic/staff-references');
    if (!staffRows(value)) throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid doctor list.');
    return value.staff.filter(item => item.status === 'active' && item.staffType === 'doctor');
  }

  async summary(today: string): Promise<AppointmentSummary> {
    const value: unknown = await this.client.read(`/v1/appointments/summary?${new URLSearchParams({ today })}`);
    if (!record(value) || !summary(value.summary)) throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid appointment summary.');
    return value.summary;
  }

  async list(date: string, doctorName: string | null): Promise<Appointment[]> {
    const params = new URLSearchParams({ date });
    if (doctorName) params.set('doctorName', doctorName);
    const value: unknown = await this.client.read(`/v1/appointments?${params}`);
    if (!appointmentList(value)) throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid appointment list.');
    return value.appointments;
  }

  async listBucket(bucket: AppointmentBucket, today: string, doctorName: string | null): Promise<Appointment[]> {
    if (!buckets.includes(bucket)) throw new ClinicError('INVALID_REQUEST', 'The appointment range is invalid.');
    const params = new URLSearchParams({ bucket, today });
    if (doctorName) params.set('doctorName', doctorName);
    const value: unknown = await this.client.read(`/v1/appointments?${params}`);
    if (!appointmentList(value)) throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid appointment list.');
    return value.appointments;
  }

  create(input: AppointmentInput): ClinicCommand<AppointmentReceipt> {
    return this.client.command('POST', '/v1/appointments', input, validResult);
  }

  update(appointmentId: string, input: AppointmentInput, expectedRowVersion: number): ClinicCommand<AppointmentReceipt> {
    if (!uuid.test(appointmentId)) throw new ClinicError('INVALID_REQUEST', 'The appointment identifier is invalid.');
    return this.client.command('PATCH', `/v1/appointments/${appointmentId}`, { ...input, expectedRowVersion }, validResult);
  }

  setStatus(appointmentId: string, status: AppointmentStatus, expectedRowVersion: number): ClinicCommand<AppointmentReceipt> {
    if (!uuid.test(appointmentId) || !statuses.includes(status) || !Number.isSafeInteger(expectedRowVersion) || expectedRowVersion < 1) {
      throw new ClinicError('INVALID_REQUEST', 'The appointment status change is invalid.');
    }
    return this.client.command('POST', `/v1/appointments/${appointmentId}/status`, { status, expectedRowVersion }, validResult);
  }
}

export function clinicToday(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const pick = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${pick('year')}-${pick('month')}-${pick('day')}`;
}

export function minuteLabel(value: number): string {
  const hour24 = Math.floor(value / 60), minute = value % 60;
  return `${String(hour24 % 12 || 12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${hour24 < 12 ? 'AM' : 'PM'}`;
}

export function parseTime(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]), minute = Number(match[2]);
  return hour < 24 && minute < 60 ? hour * 60 + minute : null;
}

export function timeValue(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

export function openOverlap(candidate: Pick<Appointment, 'appointmentDate' | 'startMinute' | 'durationMinutes' | 'doctorName'>, rows: Appointment[], ignoreId?: string): Appointment[] {
  const end = candidate.startMinute + candidate.durationMinutes;
  return rows.filter(row => row.appointmentId !== ignoreId && row.appointmentDate === candidate.appointmentDate
    && row.doctorName === candidate.doctorName && (row.status === 'booked' || row.status === 'arrived')
    && candidate.startMinute < row.startMinute + row.durationMinutes && row.startMinute < end);
}
