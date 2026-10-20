import { describe, expect, it } from 'vitest';
import { adToBs } from 'nepali-date-utils';
import { currentNepaliDate, gregorianMonthGrid, nepaliMonthGrid, shiftNepaliMonth } from '../src/calendar';

describe('desktop calendar data', () => {
  it('converts Gregorian dates to the correct Bikram Sambat date', () => {
    expect(adToBs(new Date(2024, 3, 13))).toEqual({ year: 2081, month: 1, day: 1 });
    expect(currentNepaliDate(new Date(2026, 9, 20))).toEqual({ year: 2083, month: 7, day: 3 });
  });

  it('builds 42-cell Nepali month grids with actual month lengths and weekdays', () => {
    const grid = nepaliMonthGrid({ year: 2083, month: 7 });
    expect(grid.totalDays).toBe(30);
    expect(grid.startDay).toBe(0);
    expect(grid.days).toHaveLength(42);
    expect(grid.days.slice(0, 4)).toEqual([1, 2, 3, 4]);
  });

  it('navigates across Bikram Sambat years and clamps at the supported range', () => {
    expect(shiftNepaliMonth({ year: 2083, month: 1 }, -1)).toEqual({ year: 2082, month: 12 });
    expect(shiftNepaliMonth({ year: 2083, month: 12 }, 1)).toEqual({ year: 2084, month: 1 });
    expect(shiftNepaliMonth({ year: 1970, month: 1 }, -1)).toEqual({ year: 1970, month: 1 });
    expect(shiftNepaliMonth({ year: 2099, month: 12 }, 1)).toEqual({ year: 2099, month: 12 });
  });

  it('builds a Gregorian calendar independently from the Nepali month', () => {
    const grid = gregorianMonthGrid(2026, 10);
    expect(grid.totalDays).toBe(31);
    expect(grid.days).toHaveLength(42);
    expect(grid.days[4]).toBe(1);
  });
});
