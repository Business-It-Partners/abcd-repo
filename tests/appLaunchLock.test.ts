import { describe, expect, it } from 'vitest';
import { beginAppLaunch } from '../src/appLaunchLock';

describe('per-app dock launch coordination', () => {
  it('allows another app to launch while suppressing a duplicate request for the same app', () => {
    const pending = new Set<string>();
    const releaseAppointments = beginAppLaunch(pending, 'company.dental.appointments');

    expect(releaseAppointments).toBeTypeOf('function');
    expect(beginAppLaunch(pending, 'company.dental.appointments')).toBeUndefined();

    const releaseFollowups = beginAppLaunch(pending, 'company.dental.followups');
    expect(releaseFollowups).toBeTypeOf('function');
    expect(pending).toEqual(new Set(['company.dental.appointments', 'company.dental.followups']));
  });

  it('frees only the completed app launch slot and makes it available again', () => {
    const pending = new Set<string>();
    const releaseAppointments = beginAppLaunch(pending, 'company.dental.appointments')!;
    const releaseFollowups = beginAppLaunch(pending, 'company.dental.followups')!;

    releaseAppointments();
    expect(pending).toEqual(new Set(['company.dental.followups']));
    const reacquired = beginAppLaunch(pending, 'company.dental.appointments');
    expect(reacquired).toBeTypeOf('function');

    releaseAppointments();
    expect(pending).toEqual(new Set(['company.dental.followups', 'company.dental.appointments']));
    reacquired?.();
    releaseFollowups();
    expect(pending).toEqual(new Set());
  });
});
