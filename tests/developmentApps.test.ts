import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { DevelopmentAppService } from '../electron/developmentApps';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const appIds = [
  ['company.dental.followups.m17', 'assets/followups.png'],
  ['company.dental.appointments.m17', 'assets/appointments.png'],
  ['company.dental.work-entry.m17', 'assets/workentry.png'],
  ['company.dental.patient-record.m17', 'assets/patients.png'],
  ['company.dental.treatment-progress.m17', 'assets/treatment.png'],
  ['company.dental.lab-tracker.m17', 'assets/lab.png'],
  ['company.dental.finance.m17', 'assets/finance.png'],
  ['company.dental.staff.m17', 'assets/staff.png'],
  ['company.dental.m17.treatment-protocols', 'assets/protocols.png'],
  ['company.dental.calendar.m17', 'assets/calendar.png'],
] as const;
const tempRoots: string[] = [];

afterEach(() => {
  for (const tempRoot of tempRoots.splice(0)) rmSync(tempRoot, { recursive: true, force: true });
});

describe('DevelopmentAppService', () => {
  it('imports the real locally built app output without writing to release storage', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'dental-dev-real-build-'));
    tempRoots.push(tempRoot);
    const profileRoot = path.join(tempRoot, 'profile');
    const storageRoot = path.join(profileRoot, 'development-apps');
    const releaseRoot = path.join(profileRoot, 'packages');
    const service = new DevelopmentAppService(root, storageRoot, true);

    const build = service.getBuiltApp('company.dental.followups.m17');
    expect(build).toBeDefined();
    expect(build?.manifest.version).toBe('1.0.3');
    expect(build?.files.get('index.html')?.toString()).toContain('./assets/app.js');
    expect(build?.files.has('assets/followups.png')).toBe(true);
    expect(existsSync(path.join(storageRoot, 'apps', 'company.dental.followups.m17', build!.buildId, 'payload', 'assets', 'app.js'))).toBe(true);
    expect(existsSync(releaseRoot)).toBe(false);
  });

  it('stores immutable local builds and registry separately from released packages, independent of release version', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'dental-dev-apps-'));
    tempRoots.push(tempRoot);
    const sourceRoot = path.join(tempRoot, 'checkout');
    const profileRoot = path.join(tempRoot, 'profile');
    const storageRoot = path.join(profileRoot, 'development-apps');
    const releaseRoot = path.join(profileRoot, 'packages');

    for (const [appId, iconPath] of appIds) {
      const source = path.join(root, 'apps', 'dental-apps', appId);
      const destination = path.join(sourceRoot, 'apps', 'dental-apps', appId);
      mkdirSync(path.join(destination, 'assets'), { recursive: true });
      copyFileSync(path.join(source, iconPath), path.join(destination, iconPath));
      if (appId === 'company.dental.followups.m17') {
        copyFileSync(path.join(source, 'package.json'), path.join(destination, 'package.json'));
        copyFileSync(path.join(source, 'app.manifest.json'), path.join(destination, 'app.manifest.json'));
        const dist = path.join(destination, 'dist');
        mkdirSync(dist);
        copyFileSync(path.join(source, 'app.json'), path.join(dist, 'app.json'));
        writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>build one</title>');
      }
    }

    mkdirSync(releaseRoot, { recursive: true });
    writeFileSync(path.join(releaseRoot, 'release-registry.json'), '{"release":"1.0.0"}');
    const service = new DevelopmentAppService(sourceRoot, storageRoot, true);
    const view = service.view();
    expect(view.apps).toHaveLength(10);
    expect(view.apps.every(app => app.thumbnail.startsWith('data:image/png;base64,'))).toBe(true);
    expect(service.getBuiltApp('company.dental.patient-record.m17')).toBeUndefined();

    const appId = 'company.dental.followups.m17';
    const dist = path.join(sourceRoot, 'apps/dental-apps', appId, 'dist');
    const first = service.getBuiltApp(appId)!;
    expect(first.manifest.version).toBe('1.0.3');
    expect(first.files.get('index.html')?.toString()).toContain('build one');
    expect(first.buildId).toMatch(/^[a-f0-9]{64}$/);
    expect(storageRoot).not.toBe(releaseRoot);
    expect(storageRoot.startsWith(`${releaseRoot}${path.sep}`)).toBe(false);
    expect(releaseRoot.startsWith(`${storageRoot}${path.sep}`)).toBe(false);
    expect(readFileSync(path.join(releaseRoot, 'release-registry.json'), 'utf8')).toContain('1.0.0');
    expect(existsSync(path.join(storageRoot, 'registry.json'))).toBe(true);

    // A local source version can advance without a matching signed release install.
    const packagePath = path.join(sourceRoot, 'apps/dental-apps', appId, 'package.json');
    const manifestPath = path.join(sourceRoot, 'apps/dental-apps', appId, 'app.manifest.json');
    const packageValue = JSON.parse(readFileSync(packagePath, 'utf8'));
    const manifestValue = JSON.parse(readFileSync(manifestPath, 'utf8'));
    packageValue.version = '9.8.7';
    manifestValue.version = '9.8.7';
    writeFileSync(packagePath, JSON.stringify(packageValue));
    writeFileSync(manifestPath, JSON.stringify(manifestValue));
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>build two</title>');

    const second = service.getBuiltApp(appId)!;
    expect(second.manifest.version).toBe('9.8.7');
    expect(second.buildId).not.toBe(first.buildId);
    expect(second.files.get('index.html')?.toString()).toContain('build two');
    expect(readFileSync(path.join(storageRoot, 'apps', appId, second.buildId, 'payload', 'index.html'), 'utf8')).toContain('build two');
    expect(readFileSync(path.join(storageRoot, 'apps', appId, first.buildId, 'payload', 'index.html'), 'utf8')).toContain('build one');

    // The running snapshot remains immutable if the editable project output changes afterward.
    writeFileSync(path.join(dist, 'index.html'), '<!doctype html><title>build three</title>');
    expect(second.files.get('index.html')?.toString()).toContain('build two');
    expect(readFileSync(path.join(releaseRoot, 'release-registry.json'), 'utf8')).toContain('1.0.0');
  });

  it('rejects a local manifest that asks outside the development app permission grant', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'dental-dev-caps-'));
    tempRoots.push(tempRoot);
    const sourceRoot = path.join(tempRoot, 'checkout');
    const profileRoot = path.join(tempRoot, 'profile');
    for (const [appId, iconPath] of appIds) {
      const source = path.join(root, 'apps', 'dental-apps', appId);
      const destination = path.join(sourceRoot, 'apps', 'dental-apps', appId);
      mkdirSync(path.join(destination, 'assets'), { recursive: true });
      copyFileSync(path.join(source, iconPath), path.join(destination, iconPath));
      if (appId === 'company.dental.followups.m17') {
        copyFileSync(path.join(source, 'package.json'), path.join(destination, 'package.json'));
        const manifest = JSON.parse(readFileSync(path.join(source, 'app.manifest.json'), 'utf8'));
        manifest.capabilities.push('clinic.app.staff');
        writeFileSync(path.join(destination, 'app.manifest.json'), JSON.stringify(manifest));
        mkdirSync(path.join(destination, 'dist'));
        writeFileSync(path.join(destination, 'dist', 'app.json'), JSON.stringify({ format: 1, appId, title: 'Follow-ups', description: 'test', icon: 'assets/followups.png', anyCapabilities: ['followups.access'], excludedRoles: [], allowedRoles: [], modules: [{ id: 'followups', label: 'Follow-ups', tab: 'followups', capability: 'followups.access' }] }));
        writeFileSync(path.join(destination, 'dist', 'index.html'), '<!doctype html><title>test</title>');
      }
    }
    const service = new DevelopmentAppService(sourceRoot, path.join(profileRoot, 'development-apps'), true);
    expect(service.getBuiltApp('company.dental.followups.m17')).toBeUndefined();
  });

  it('uses the private UI fixture build even when the checkout has a source dist directory', () => {
    const tempRoot = mkdtempSync(path.join(tmpdir(), 'dental-dev-fixture-'));
    tempRoots.push(tempRoot);
    const sourceRoot = path.join(tempRoot, 'checkout');
    const storageRoot = path.join(tempRoot, 'profile', 'development-apps');
    for (const [appId, iconPath] of appIds) {
      const source = path.join(root, 'apps', 'dental-apps', appId);
      const destination = path.join(sourceRoot, 'apps', 'dental-apps', appId);
      mkdirSync(path.join(destination, 'assets'), { recursive: true });
      copyFileSync(path.join(source, iconPath), path.join(destination, iconPath));
      if (appId === 'company.dental.followups.m17') {
        copyFileSync(path.join(source, 'package.json'), path.join(destination, 'package.json'));
        copyFileSync(path.join(source, 'app.manifest.json'), path.join(destination, 'app.manifest.json'));
        mkdirSync(path.join(destination, 'dist'), { recursive: true });
        writeFileSync(path.join(destination, 'dist', 'index.html'), '<html>unrelated checkout output</html>');
      }
    }

    const service = new DevelopmentAppService(sourceRoot, storageRoot, true, true);
    const build = service.getBuiltApp('company.dental.followups.m17');
    expect(build).toBeDefined();
    expect(build?.files.get('index.html')?.toString()).toContain('Follow-ups development preview');
    expect(service.isAuthorizedBuild(build!)).toBe(true);
  });
});
