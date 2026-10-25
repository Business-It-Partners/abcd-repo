export type ResourcePressureLevel = 'warning' | 'critical';
export type SystemMemorySample = {
  totalKiB: number;
  availableKiB: number;
  managedRendererWorkingSetKiB: number;
};

const MiB = 1024;
const GiB = 1024 * MiB;

export function resourceBudgets(totalKiB: number) {
  const total = Math.max(0, totalKiB);
  return {
    warningAvailableKiB: Math.min(total * 0.25, Math.max(768 * MiB, total * 0.15)),
    criticalAvailableKiB: Math.min(total * 0.12, Math.max(384 * MiB, total * 0.08)),
    warningRendererWorkingSetKiB: Math.min(1536 * MiB, Math.max(512 * MiB, total * 0.12)),
    criticalRendererWorkingSetKiB: Math.min(2 * GiB, Math.max(768 * MiB, total * 0.2)),
  };
}

export function classifyResourcePressure(sample: SystemMemorySample): ResourcePressureLevel | 'normal' {
  if (![sample.totalKiB, sample.availableKiB, sample.managedRendererWorkingSetKiB].every(Number.isFinite) || sample.totalKiB <= 0) return 'normal';
  const budget = resourceBudgets(sample.totalKiB);
  if (sample.availableKiB <= budget.criticalAvailableKiB || sample.managedRendererWorkingSetKiB >= budget.criticalRendererWorkingSetKiB) return 'critical';
  if (sample.availableKiB <= budget.warningAvailableKiB || sample.managedRendererWorkingSetKiB >= budget.warningRendererWorkingSetKiB) return 'warning';
  return 'normal';
}

/** Debounces ordinary pressure, escalates severe pressure immediately, and requires recovery before rearming. */
export class ResourcePressureGate {
  private level: ResourcePressureLevel | 'normal' = 'normal';
  private pressureSamples = 0;
  private recoverySamples = 0;

  get currentLevel() { return this.level; }

  observe(sample: SystemMemorySample): ResourcePressureLevel | undefined {
    const next = classifyResourcePressure(sample);
    if (next === 'normal') {
      this.pressureSamples = 0;
      if (this.level !== 'normal' && ++this.recoverySamples >= 3) {
        this.level = 'normal';
        this.recoverySamples = 0;
      }
      return undefined;
    }

    this.recoverySamples = 0;
    if (this.level === 'critical' || this.level === next) return undefined;
    const budget = resourceBudgets(sample.totalKiB);
    const severe = next === 'critical' && (
      sample.availableKiB <= budget.criticalAvailableKiB * 0.6 ||
      sample.managedRendererWorkingSetKiB >= budget.criticalRendererWorkingSetKiB * 1.25
    );
    this.pressureSamples++;
    if (!severe && this.pressureSamples < 2) return undefined;
    this.level = next;
    this.pressureSamples = 0;
    return next;
  }
}
