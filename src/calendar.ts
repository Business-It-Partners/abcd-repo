import {
  adToBs,
  getMonthData,
  MAX_BS_YEAR,
  MIN_BS_YEAR,
  NEPALI_MONTHS,
} from 'nepali-date-utils';

export type CalendarMonth = { year: number; month: number };
export type CalendarCell = number | null;

export const nepaliMonthName = (month: number) => NEPALI_MONTHS[month - 1] ?? '';
export const currentNepaliDate = (date: Date) => adToBs(date);

export function nepaliMonthGrid({ year, month }: CalendarMonth) {
  const data = getMonthData(year, month);
  if (year < MIN_BS_YEAR || year > MAX_BS_YEAR || data.startDay === undefined || data.totalDays === undefined) {
    throw new RangeError(`Nepali calendar supports Bikram Sambat ${MIN_BS_YEAR}–${MAX_BS_YEAR}.`);
  }
  const days: CalendarCell[] = [...Array(data.startDay).fill(null), ...Array.from({ length: data.totalDays }, (_, index) => index + 1)];
  while (days.length < 42) days.push(null);
  return { year, month, totalDays: data.totalDays, startDay: data.startDay, days };
}

export function shiftNepaliMonth({ year, month }: CalendarMonth, delta: number): CalendarMonth {
  const index = (year - MIN_BS_YEAR) * 12 + month - 1 + delta;
  const clamped = Math.max(0, Math.min((MAX_BS_YEAR - MIN_BS_YEAR + 1) * 12 - 1, index));
  return { year: MIN_BS_YEAR + Math.floor(clamped / 12), month: clamped % 12 + 1 };
}

export function gregorianMonthGrid(year: number, month: number) {
  const first = new Date(year, month - 1, 1);
  const startDay = first.getDay();
  const totalDays = new Date(year, month, 0).getDate();
  const days: CalendarCell[] = [...Array(startDay).fill(null), ...Array.from({ length: totalDays }, (_, index) => index + 1)];
  while (days.length < 42) days.push(null);
  return { year, month, totalDays, startDay, days };
}
