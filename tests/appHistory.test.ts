import { describe, expect, it, vi } from 'vitest';
import { AppHistory } from '../packages/app-sdk/src/appHistory';
import { appNavigationSnapshot, type AppSdk } from '../electron/sdk/contracts';

function bridge() {
  const listeners = new Set<Parameters<AppSdk['navigation']['onRequest']>[0]>();
  const report = vi.fn();
  const value = {
    navigation: {
      report,
      onRequest(listener: Parameters<AppSdk['navigation']['onRequest']>[0]) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    },
  } as Pick<AppSdk, 'navigation'>;
  return { value, report, request: (direction: 'back' | 'forward', entry: string, preserveDraft = false) => {
    for (const listener of listeners) listener({ direction, entry, ...(preserveDraft ? { preserveDraft: true } : {}) });
  } };
}

describe('SDK 1.6 app page history', () => {
  it('mirrors opaque IDs and follows window back/forward requests without exposing route data', () => {
    const host = bridge();
    const history = new AppHistory<{ page: string; patientId?: string }>(host.value, { page: 'directory' });
    history.push({ page: 'patient-detail', patientId: 'patient-secret-id' });
    const detailKey = host.report.mock.lastCall?.[0].entries[1];
    expect(detailKey).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.stringify(host.report.mock.calls)).not.toContain('patient-secret-id');

    const listKey = host.report.mock.lastCall?.[0].entries[0];
    host.request('back', listKey);
    expect(history.current()).toEqual({ page: 'directory' });
    host.request('forward', detailKey);
    expect(history.current()).toEqual({ page: 'patient-detail', patientId: 'patient-secret-id' });
    history.dispose();
  });

  it('drops the forward branch when an app opens a new page after Back', () => {
    const host = bridge();
    const history = new AppHistory(host.value, 'list');
    history.push('detail-a');
    const firstDetail = host.report.mock.lastCall?.[0].entries[1];
    host.request('back', host.report.mock.lastCall?.[0].entries[0]);
    history.push('detail-b');
    expect(history.current()).toBe('detail-b');
    expect(host.report.mock.lastCall?.[0].entries).toHaveLength(2);
    host.request('forward', firstDetail);
    expect(history.current()).toBe('detail-b');
    history.dispose();
  });

  it('validates bounded UUID snapshots and lets an app guard a dirty page', () => {
    const key = 'd53a8d68-67bb-4c77-bbcb-2d9b8c8a2db1';
    expect(appNavigationSnapshot({ entries: [key], index: 0 })).toBe(true);
    expect(appNavigationSnapshot({ entries: ['/patients/123'], index: 0 })).toBe(false);
    expect(appNavigationSnapshot({ entries: [key, key], index: 1 })).toBe(false);
    expect(appNavigationSnapshot({ entries: [key], index: 1 })).toBe(false);

    let dirty = false;
    const host = bridge();
    const history = new AppHistory(host.value, 'list', () => !dirty);
    history.push('detail');
    const listKey = host.report.mock.lastCall?.[0].entries[0];
    dirty = true;
    host.request('back', listKey);
    expect(history.current()).toBe('detail');
    dirty = false;
    host.request('back', listKey);
    expect(history.current()).toBe('list');
    history.dispose();
  });

  it('allows an explicitly draft-preserving Back and retains the forward route', () => {
    let dirty = false;
    const host = bridge();
    const history = new AppHistory(host.value, 'purchases', () => !dirty, page => page === 'purchase-review');
    history.push('purchase-form');
    history.push('purchase-review');
    const report = host.report.mock.lastCall?.[0];
    const formEntry = report?.entries[1];
    const reviewEntry = report?.entries[2];
    expect(report?.backPreservesDraft).toBe(true);
    expect(appNavigationSnapshot(report)).toBe(true);
    dirty = true;
    host.request('back', formEntry!, true);
    expect(history.current()).toBe('purchase-form');
    expect(host.report.mock.lastCall?.[0]).toMatchObject({ entries: [report!.entries[0], formEntry, reviewEntry], index: 1 });
    expect(host.report.mock.lastCall?.[0].backPreservesDraft).toBeUndefined();
    history.push('purchase-review-again');
    expect(host.report.mock.lastCall?.[0].entries).toHaveLength(3);
    expect(host.report.mock.lastCall?.[0].entries).not.toContain(reviewEntry);
    history.dispose();
  });

  it('preserves a draft only when Back stays inside the same case', () => {
    const host = bridge();
    const history = new AppHistory<{ caseId?: string; step: number }>(
      host.value,
      { step: 0 },
      () => false,
      (current, previous) => Boolean(current.caseId && current.caseId === previous?.caseId),
    );
    history.push({ caseId: 'case-a', step: 1 });
    history.push({ caseId: 'case-a', step: 2 });
    expect(host.report.mock.lastCall?.[0].backPreservesDraft).toBe(true);
    const stepOne = host.report.mock.lastCall?.[0].entries[1];
    const stepTwo = host.report.mock.lastCall?.[0].entries[2];
    host.request('back', stepOne!, true);
    expect(history.current()).toEqual({ caseId: 'case-a', step: 1 });
    expect(host.report.mock.lastCall?.[0].backPreservesDraft).toBeUndefined();
    host.request('back', host.report.mock.lastCall?.[0].entries[0], true);
    expect(history.current()).toEqual({ caseId: 'case-a', step: 1 });
    expect(host.report.mock.lastCall?.[0].entries[2]).toBe(stepTwo);
    history.dispose();
  });

  it('ignores unknown navigation IDs safely', () => {
    const host = bridge();
    const history = new AppHistory(host.value, 'list');
    expect(() => host.request('back', 'not-a-page-id')).not.toThrow();
    expect(history.current()).toBe('list');
    history.dispose();
  });
});
