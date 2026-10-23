import { ClinicClient, ClinicError, type ClinicCommand } from '../../../../packages/app-sdk/src/clinicClient';

export type CalendarTaskCategory = 'clinical' | 'lab' | 'admin';
export type CalendarTaskStatus = 'open' | 'completed' | 'archived';
export type CalendarTask = {
  id: string;
  date: string;
  title: string;
  category: CalendarTaskCategory;
  status: CalendarTaskStatus;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
};
export type CalendarTaskReceipt = { calendarTask: CalendarTask };

const categories: CalendarTaskCategory[] = ['clinical', 'lab', 'admin'];
const statuses: CalendarTaskStatus[] = ['open', 'completed', 'archived'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isoDate = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(`${value}T00:00:00Z`))
  && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function fromApi(value: unknown): CalendarTask | null {
  if (!record(value) || typeof value.calendarTaskId !== 'string' || !uuid.test(value.calendarTaskId)
    || !isoDate(value.taskDate) || typeof value.title !== 'string' || value.title.length < 1 || value.title.length > 180
    || !categories.includes(value.category as CalendarTaskCategory) || !statuses.includes(value.status as CalendarTaskStatus)
    || !(value.completedAt === null || typeof value.completedAt === 'string')
    || typeof value.createdAt !== 'string' || typeof value.updatedAt !== 'string'
    || !Number.isSafeInteger(value.rowVersion) || (value.rowVersion as number) < 1) return null;
  return {
    id: value.calendarTaskId,
    date: value.taskDate,
    title: value.title,
    category: value.category as CalendarTaskCategory,
    status: value.status as CalendarTaskStatus,
    completedAt: value.completedAt as string | null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    rowVersion: value.rowVersion as number,
  };
}

function receipt(value: unknown): value is CalendarTaskReceipt {
  return record(value) && !!fromApi(value.calendarTask);
}

/** Current Dental SaaS Calendar contract, called only through the host's credential broker. */
export class CalendarTasksApi {
  constructor(private readonly client: ClinicClient) {}

  async list(from: string, to: string): Promise<CalendarTask[]> {
    if (!isoDate(from) || !isoDate(to) || from > to || (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000 > 45) {
      throw new ClinicError('INVALID_REQUEST', 'The calendar date range is invalid.');
    }
    const value: unknown = await this.client.read(`/v1/calendar-tasks?${new URLSearchParams({ from, to })}`);
    if (!record(value) || !Array.isArray(value.calendarTasks) || value.calendarTasks.length > 1000) {
      throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid calendar task list.');
    }
    const tasks = value.calendarTasks.map(fromApi);
    if (tasks.some(task => !task || task.status === 'archived')) {
      throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid calendar task.');
    }
    return tasks as CalendarTask[];
  }

  create(input: { date: string; title: string; category: CalendarTaskCategory }): ClinicCommand<CalendarTaskReceipt> {
    if (!isoDate(input.date) || !input.title.trim() || input.title.trim().length > 180 || !categories.includes(input.category)) {
      throw new ClinicError('INVALID_REQUEST', 'Enter a valid calendar task.');
    }
    return this.client.command('POST', '/v1/calendar-tasks', {
      taskDate: input.date,
      title: input.title.trim(),
      category: input.category,
    }, receipt);
  }

  setStatus(task: CalendarTask, status: Exclude<CalendarTaskStatus, 'archived'>): ClinicCommand<CalendarTaskReceipt> {
    if (!uuid.test(task.id) || !Number.isSafeInteger(task.rowVersion) || task.rowVersion < 1 || !['open', 'completed'].includes(status)) {
      throw new ClinicError('INVALID_REQUEST', 'The calendar task status change is invalid.');
    }
    return this.client.command('PATCH', `/v1/calendar-tasks/${task.id}`, { status, expectedRowVersion: task.rowVersion }, receipt);
  }

  archive(task: CalendarTask): ClinicCommand<CalendarTaskReceipt> {
    if (!uuid.test(task.id) || !Number.isSafeInteger(task.rowVersion) || task.rowVersion < 1) {
      throw new ClinicError('INVALID_REQUEST', 'The calendar task cannot be archived.');
    }
    return this.client.command('POST', `/v1/calendar-tasks/${task.id}/archive`, { expectedRowVersion: task.rowVersion }, receipt);
  }
}
