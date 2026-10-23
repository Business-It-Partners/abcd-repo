import { createHash, createPublicKey } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { stagingDistribution, m17StagingKeyId, stagingKeyId } from '../electron/distribution/staging';
import { allowedClinicApiPath, appAllowed, clinicAppFamily } from '../electron/sdk/appPolicy';
import { isCompanyAppId } from '../electron/packages/format';

const root = path.resolve(import.meta.dirname, '..');
const followupsId = 'company.dental.followups.m17';
const appointmentsId = 'company.dental.appointments.m17';
const calendarId = 'company.dental.calendar.m17';

describe('M17 app identities and signing trust', () => {
  it('assigns unique first-release identities without changing the preview IDs', () => {
    const entries = readdirSync(path.join(root, 'apps/dental-apps'), { withFileTypes: true }).filter(entry => entry.isDirectory());
    const ids = entries.map(entry => {
      const manifestPath = path.join(root, 'apps/dental-apps', entry.name, 'app.manifest.json');
      return JSON.parse(readFileSync(manifestPath, 'utf8')).appId;
    });
    const packageNames = entries.map(entry => {
      const packagePath = path.join(root, 'apps/dental-apps', entry.name, 'package.json');
      return JSON.parse(readFileSync(packagePath, 'utf8')).name;
    });
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(packageNames).size).toBe(packageNames.length);
    for (const id of [followupsId, appointmentsId, calendarId]) {
      const expectedVersion = id === appointmentsId ? '1.0.1' : '1.0.0';
      const folder = path.join(root, 'apps/dental-apps', id);
      const pkg = JSON.parse(readFileSync(path.join(folder, 'package.json'), 'utf8'));
      const manifest = JSON.parse(readFileSync(path.join(folder, 'app.manifest.json'), 'utf8'));
      expect(isCompanyAppId(id)).toBe(true);
      expect(pkg.name).toBe(id);
      expect(pkg.version).toBe(expectedVersion);
      expect(manifest.appId).toBe(id);
      expect(manifest.version).toBe(expectedVersion);
    }
    expect(ids).toContain('company.dental.followups');
    expect(ids).toContain('company.dental.appointments');
    expect(ids).toContain('company.dental.calendar');
  });

  it('pins the supplied M17 signer while preserving the M07 and M08 trust entries', () => {
    const keys = stagingDistribution.policy.keys;
    expect(m17StagingKeyId).toBe('company-staging-m17-20261022');
    expect(Object.keys(keys)).toEqual(expect.arrayContaining([m17StagingKeyId, stagingKeyId, 'company-staging-m08-20261016']));
    const der = createPublicKey(keys[m17StagingKeyId].publicKey).export({ type: 'spki', format: 'der' });
    expect(createHash('sha256').update(der).digest('hex')).toBe('e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709');
  });

  it('selects each app family from its manifest without registering app IDs in host policy', () => {
    const cases = [
      [followupsId, 'clinic.app.followups', 'followups.access', '/v1/follow-ups?date=2026-10-23', 'GET', '/v1/appointments'],
      [appointmentsId, 'clinic.app.appointments', 'appointments.access', '/v1/appointments?date=2026-10-23', 'GET', '/v1/follow-ups'],
      [calendarId, 'clinic.app.calendar', 'calendar.access', '/v1/calendar-tasks?from=2026-10-01&to=2026-10-31', 'GET', '/v1/appointments'],
    ] as const;
    for (const [id, familyName, sessionCapability, allowedPath, method, deniedPath] of cases) {
      const manifest = JSON.parse(readFileSync(path.join(root, 'apps/dental-apps', id, 'app.manifest.json'), 'utf8'));
      const family = clinicAppFamily(manifest.capabilities);
      expect(family).toBe(familyName);
      expect(appAllowed(family, 'admin', [sessionCapability])).toBe(true);
      expect(allowedClinicApiPath(family, allowedPath, method)).toBe(true);
      expect(allowedClinicApiPath(family, deniedPath, 'GET')).toBe(false);
    }
    const calendar = clinicAppFamily(JSON.parse(readFileSync(path.join(root, 'apps/dental-apps', calendarId, 'app.manifest.json'), 'utf8')).capabilities);
    expect(allowedClinicApiPath(calendar, '/v1/calendar-tasks/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/archive', 'POST')).toBe(true);
    expect(allowedClinicApiPath(calendar, '/v1/calendar-tasks', 'DELETE')).toBe(false);
  });
});
