import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

export type BatteryStatus = {
  percentage: number;
  charging: boolean;
  state: 'charging' | 'discharging' | 'full' | 'not-charging' | 'unknown';
};

export type BatteryDeviceReading = {
  type?: string;
  capacity?: string;
  status?: string;
  energyNow?: string;
  energyFull?: string;
  chargeNow?: string;
  chargeFull?: string;
};

function finiteNumber(value: string | undefined) {
  if (value === undefined || value.trim() === '') return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function percentageFor(device: BatteryDeviceReading) {
  const capacity = finiteNumber(device.capacity);
  if (capacity !== undefined && capacity >= 0 && capacity <= 100) return capacity;
  const energyNow = finiteNumber(device.energyNow);
  const energyFull = finiteNumber(device.energyFull);
  const chargeNow = finiteNumber(device.chargeNow);
  const chargeFull = finiteNumber(device.chargeFull);
  const [now, full] = energyNow !== undefined && energyFull !== undefined
    ? [energyNow, energyFull]
    : [chargeNow, chargeFull];
  if (now === undefined || full === undefined || full <= 0 || now < 0) return undefined;
  const percentage = now / full * 100;
  return Number.isFinite(percentage) ? Math.max(0, Math.min(100, percentage)) : undefined;
}

export function summarizeBatteryDevices(devices: readonly BatteryDeviceReading[]): BatteryStatus | undefined {
  const batteries = devices.filter(device => device.type?.trim() === 'Battery');
  const readings = batteries.map(device => ({ device, percentage: percentageFor(device) }))
    .filter((reading): reading is { device: BatteryDeviceReading; percentage: number } => reading.percentage !== undefined);
  if (!readings.length) return undefined;

  const energyWeights = readings.map(({ device }) => finiteNumber(device.energyFull));
  const chargeWeights = readings.map(({ device }) => finiteNumber(device.chargeFull));
  const weights = energyWeights.every(value => value !== undefined && value > 0)
    ? energyWeights as number[]
    : chargeWeights.every(value => value !== undefined && value > 0)
      ? chargeWeights as number[]
      : undefined;
  const percentage = Math.round(weights
    ? readings.reduce((sum, reading, index) => sum + reading.percentage * weights[index], 0) / weights.reduce((sum, weight) => sum + weight, 0)
    : readings.reduce((sum, reading) => sum + reading.percentage, 0) / readings.length);

  const statuses = readings.map(({ device }) => device.status?.trim().toLowerCase());
  const state: BatteryStatus['state'] = statuses.includes('charging')
    ? 'charging'
    : statuses.length > 0 && statuses.every(status => status === 'full')
      ? 'full'
      : statuses.includes('discharging')
        ? 'discharging'
        : statuses.includes('not charging')
          ? 'not-charging'
          : 'unknown';
  return { percentage, charging: state === 'charging', state };
}

async function readField(devicePath: string, field: string) {
  try {
    return (await readFile(path.join(devicePath, field), 'utf8')).trim();
  } catch {
    return undefined;
  }
}

/** Reads Linux's read-only power-supply interface; unsupported devices simply have no status item. */
export async function readBatteryStatus(powerSupplyRoot = '/sys/class/power_supply'): Promise<BatteryStatus | undefined> {
  if (process.platform !== 'linux') return undefined;
  try {
    const entries = await readdir(powerSupplyRoot, { withFileTypes: true });
    const devices = await Promise.all(entries.filter(entry => entry.isDirectory() || entry.isSymbolicLink()).map(async entry => {
      const devicePath = path.join(powerSupplyRoot, entry.name);
      const [type, capacity, status, energyNow, energyFull, chargeNow, chargeFull] = await Promise.all([
        readField(devicePath, 'type'), readField(devicePath, 'capacity'), readField(devicePath, 'status'),
        readField(devicePath, 'energy_now'), readField(devicePath, 'energy_full'),
        readField(devicePath, 'charge_now'), readField(devicePath, 'charge_full'),
      ]);
      return { type, capacity, status, energyNow, energyFull, chargeNow, chargeFull };
    }));
    return summarizeBatteryDevices(devices);
  } catch {
    return undefined;
  }
}
