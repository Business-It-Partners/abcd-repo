import { describe, expect, it } from 'vitest';
import { classifyResourcePressure, ResourcePressureGate, resourceBudgets } from '../electron/host/resourcePressure';

const gib = 1024 * 1024 * 1024 / 1024;
const sample = (availableGiB: number, rendererGiB = 0, totalGiB = 12) => ({
  totalKiB: totalGiB * gib,
  availableKiB: availableGiB * gib,
  managedRendererWorkingSetKiB: rendererGiB * gib,
});

describe('resource pressure policy', () => {
  it('sets bounded working-set and available-memory budgets for a 12 GiB device', () => {
    const budget = resourceBudgets(12 * gib);
    expect(budget.warningAvailableKiB / gib).toBeCloseTo(1.8);
    expect(budget.criticalAvailableKiB / gib).toBeCloseTo(0.96);
    expect(budget.warningRendererWorkingSetKiB / gib).toBeCloseTo(1.44);
    expect(budget.criticalRendererWorkingSetKiB / gib).toBeCloseTo(2);
  });

  it('classifies system and managed-renderer pressure independently', () => {
    expect(classifyResourcePressure(sample(1.7))).toBe('warning');
    expect(classifyResourcePressure(sample(0.8))).toBe('critical');
    expect(classifyResourcePressure(sample(5, 1.5))).toBe('warning');
    expect(classifyResourcePressure(sample(5, 2.1))).toBe('critical');
    expect(classifyResourcePressure(sample(5, 0, 1))).toBe('normal');
  });

  it('requires two ordinary pressure samples before reclaiming resources', () => {
    const gate = new ResourcePressureGate();
    expect(gate.observe(sample(1.7))).toBeUndefined();
    expect(gate.observe(sample(1.7))).toBe('warning');
    expect(gate.observe(sample(1.6))).toBeUndefined();
  });

  it('escalates a sustained warning to critical after two critical samples', () => {
    const gate = new ResourcePressureGate();
    expect(gate.observe(sample(1.7))).toBeUndefined();
    expect(gate.observe(sample(1.7))).toBe('warning');
    expect(gate.observe(sample(0.8))).toBeUndefined();
    expect(gate.currentLevel).toBe('warning');
    expect(gate.observe(sample(0.8))).toBe('critical');
  });

  it('responds to severe pressure immediately and escalates without downgrading early', () => {
    const gate = new ResourcePressureGate();
    expect(gate.observe(sample(0.4))).toBe('critical');
    expect(gate.observe(sample(1.7))).toBeUndefined();
    expect(gate.observe(sample(5))).toBeUndefined();
    expect(gate.observe(sample(5))).toBeUndefined();
    expect(gate.observe(sample(5))).toBeUndefined();
    expect(gate.observe(sample(1.7))).toBeUndefined();
    expect(gate.observe(sample(1.7))).toBe('warning');
  });

  it('ignores invalid measurements instead of reclaiming on bad telemetry', () => {
    expect(classifyResourcePressure({ totalKiB: 0, availableKiB: 0, managedRendererWorkingSetKiB: 0 })).toBe('normal');
    expect(classifyResourcePressure({ totalKiB: 10, availableKiB: Number.NaN, managedRendererWorkingSetKiB: 0 })).toBe('normal');
  });
});
