import { describe, expect, it } from 'vitest';
import { summarizeBatteryDevices } from '../electron/host/battery';

describe('battery status', () => {
  it('ignores power adapters and devices without a readable battery level', () => {
    expect(summarizeBatteryDevices([{ type: 'Mains', capacity: '100', status: 'Online' }, { type: 'Battery', status: 'Unknown' }])).toBeUndefined();
  });

  it('reports a laptop battery level and charging state', () => {
    expect(summarizeBatteryDevices([{ type: 'Battery', capacity: '55', status: 'Charging' }])).toEqual({ percentage: 55, charging: true, state: 'charging' });
  });

  it('derives the level when the device supplies energy counters instead of capacity', () => {
    expect(summarizeBatteryDevices([{ type: 'Battery', energyNow: '440', energyFull: '800', status: 'Discharging' }])).toEqual({ percentage: 55, charging: false, state: 'discharging' });
  });

  it('combines multiple batteries using their full charge when available', () => {
    expect(summarizeBatteryDevices([
      { type: 'Battery', capacity: '40', chargeFull: '1000', status: 'Discharging' },
      { type: 'Battery', capacity: '80', chargeFull: '3000', status: 'Discharging' },
    ])).toEqual({ percentage: 70, charging: false, state: 'discharging' });
  });

  it('does not trust out-of-range or malformed readings', () => {
    expect(summarizeBatteryDevices([{ type: 'Battery', capacity: '155', energyNow: 'nope', energyFull: '10' }])).toBeUndefined();
  });
});
