import {
  closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync,
  readdirSync, realpathSync, renameSync, rmSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import path from 'node:path';
import { apiOperations, operations, type ApiOperationId, type Operation } from './sdk/contracts';
import { canonical, limits, sha256, validPath, type Manifest } from './packages/format';

const appDefinitions = [
  ['company.dental.followups.m17', 'Follow-ups', 'assets/followups.png', ['clinic.app.followups', 'clinic.api.request', 'session.context']],
  ['company.dental.appointments.m17', 'Appointments', 'assets/appointments.png', ['clinic.app.appointments', 'clinic.api.request', 'session.context']],
  ['company.dental.work-entry.m17', 'Work Entry', 'assets/workentry.png', ['clinic.app.work-entry', 'clinic.api.request', 'clinic.media.read', 'clinic.media.upload', 'session.context']],
  ['company.dental.patient-record.m17', 'Patient Record', 'assets/patients.png', ['clinic.app.patient-record', 'clinic.api.request', 'session.context', 'clinic.media.read', 'clinic.media.upload']],
  ['company.dental.treatment-progress.m17', 'Treatment Progress', 'assets/treatment.png', ['clinic.app.treatment-progress', 'clinic.api.request', 'session.context']],
  ['company.dental.lab-tracker.m17', 'Lab Tracker', 'assets/lab.png', ['clinic.app.lab-tracker', 'clinic.api.request', 'session.context']],
  ['company.dental.finance.m17', 'Finance', 'assets/finance.png', ['clinic.app.finance', 'clinic.api.request', 'session.context']],
  ['company.dental.staff.m17', 'Staff', 'assets/staff.png', ['clinic.app.staff', 'clinic.api.request', 'session.context', 'clinic.media.read', 'clinic.media.upload']],
  ['company.dental.m17.treatment-protocols', 'Treatment Protocols', 'assets/protocols.png', ['clinic.app.treatment-protocols', 'clinic.api.request', 'session.context']],
  ['company.dental.calendar.m17', 'Calendar', 'assets/calendar.png', ['clinic.app.calendar', 'clinic.api.request', 'session.context']],
] as const satisfies readonly (readonly [string, string, string, readonly Operation[]])[];

const maxBuildFileBytes = limits.file;
const maxBuildBytes = limits.expanded;
const maxThumbnailBytes = 512 * 1024;
const appIdPattern = /^company\.dental\.[a-z0-9.-]+\.m17$|^company\.dental\.m17\.treatment-protocols$/;
const digestPattern = /^[a-f0-9]{64}$/;
const versionPattern = /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/;

export type DevelopmentAppItem = Readonly<{ id: string; title: string; thumbnail: string }>;
export type DevelopmentAppView = Readonly<{ enabled: boolean; apps: readonly DevelopmentAppItem[] }>;
export type DevelopmentAppBuild = Readonly<{
  appId: string;
  buildId: string;
  manifest: Manifest;
  capabilities: readonly Operation[];
  files: ReadonlyMap<string, Buffer>;
}>;

type Definition = {
  id: string;
  title: string;
  sourceRoot: string;
  thumbnail: string;
  capabilities: readonly Operation[];
};
type BuildPointer = { active: string; previous: string | null };
type Registry = { format: 1; apps: Record<string, BuildPointer> };

function readRegular(file: string, maxBytes: number) {
  const stat = lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > maxBytes) throw new Error('Unsafe development app file');
  return readFileSync(file);
}

function safeJson(file: string, maxBytes: number): any {
  return JSON.parse(readRegular(file, maxBytes).toString('utf8'));
}

function isWithin(root: string, candidate: string) {
  const relative = path.relative(root, candidate);
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function ensureDirectoryTree(directory: string) {
  const absolute = path.resolve(directory);
  let cursor = path.parse(absolute).root;
  for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try {
      const stat = lstatSync(cursor);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe development app directory');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      mkdirSync(cursor, { mode: 0o700 });
      const stat = lstatSync(cursor);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe development app directory');
    }
  }
}

function sortedCapabilities(value: unknown): value is Operation[] {
  return Array.isArray(value) && value.length <= operations.length
    && new Set(value).size === value.length
    && value.every(capability => typeof capability === 'string' && operations.includes(capability as Operation));
}

function validDirectoryPath(value: string) {
  if (value.length > limits.path || value.split('/').length > 8 || !/^[a-z0-9][a-z0-9._/-]*$/.test(value)) throw new Error('Invalid development build directory');
  for (const part of value.split('/')) {
    if (!part || part === '.' || part === '..' || part.endsWith('.') || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/.test(part)) {
      throw new Error('Invalid development build directory');
    }
  }
}

function buildDigest(manifest: Manifest, files: ReadonlyMap<string, Buffer>) {
  const hash = createHash('sha256');
  hash.update(canonical(manifest));
  for (const [name, bytes] of [...files].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)) {
    hash.update('\0');
    hash.update(name);
    hash.update('\0');
    hash.update(bytes);
  }
  return hash.digest('hex');
}

function waitBriefly(milliseconds: number) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function acquireRegistryLock(storageRoot: string) {
  const lockPath = path.join(storageRoot, '.registry.lock');
  const token = randomUUID();
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15_000) {
    let fd: number | undefined;
    let created = false;
    try {
      fd = openSync(lockPath, 'wx', 0o600);
      created = true;
      writeFileSync(fd, JSON.stringify({ pid: process.pid, createdAt: Date.now(), token }));
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
      return () => {
        try {
          const lock = safeJson(lockPath, 1024);
          if (lock?.pid === process.pid && lock?.token === token) unlinkSync(lockPath);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        }
      };
    } catch (error) {
      if (fd !== undefined) try { closeSync(fd); } catch {}
      if (created) try { unlinkSync(lockPath); } catch {}
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      try {
        const info = lstatSync(lockPath);
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 1024) throw new Error('Unsafe development app registry lock');
        const lock = safeJson(lockPath, 1024);
        const age = Date.now() - Number(lock?.createdAt);
        let ownerAlive = false;
        if (Number.isSafeInteger(lock?.pid) && lock.pid > 0) {
          try { process.kill(lock.pid, 0); ownerAlive = true; }
          catch (probeError) { ownerAlive = (probeError as NodeJS.ErrnoException).code === 'EPERM'; }
        }
        if (!ownerAlive && age > 2_000) unlinkSync(lockPath);
      } catch (lockError) {
        if ((lockError as NodeJS.ErrnoException).code !== 'ENOENT') throw lockError;
      }
      waitBriefly(50);
    }
  }
  throw new Error('Timed out waiting for the shared development app bucket');
}

/** Source-only first-party app lane with its own on-disk registry and immutable build snapshots. */
export class DevelopmentAppService {
  private definitions = new Map<string, Definition>();
  private verifiedBuilds = new WeakSet<object>();
  private sourceRoot: string;
  private storageRoot: string;
  private fixtureBuilds: boolean;

  constructor(sourceRoot: string, storageRoot: string, readonly enabled: boolean, fixtureBuilds = false) {
    this.sourceRoot = path.resolve(sourceRoot);
    this.storageRoot = path.resolve(storageRoot);
    this.fixtureBuilds = fixtureBuilds;
    if (!enabled) return;

    const realRoot = realpathSync(this.sourceRoot);
    const resolvedStorage = path.resolve(this.storageRoot);
    if (isWithin(realRoot, resolvedStorage) || isWithin(resolvedStorage, realRoot)) throw new Error('Development app storage must be separate from app source');
    ensureDirectoryTree(this.storageRoot);
    for (const [id, title, iconPath, capabilities] of appDefinitions) {
      if (!appIdPattern.test(id)) throw new Error('Invalid development app catalog');
      const source = path.join(realRoot, 'apps', 'dental-apps', id);
      const realSource = realpathSync(source);
      if (!isWithin(realRoot, realSource) || !lstatSync(source).isDirectory() || lstatSync(source).isSymbolicLink()) throw new Error('Unsafe development source root');
      const icon = path.join(realSource, iconPath);
      const realIcon = realpathSync(icon);
      if (!isWithin(realSource, realIcon) || !lstatSync(icon).isFile() || lstatSync(icon).isSymbolicLink()) throw new Error('Unsafe development app thumbnail');
      const bytes = readRegular(realIcon, maxThumbnailBytes);
      this.definitions.set(id, { id, title, sourceRoot: realSource, thumbnail: `data:image/png;base64,${bytes.toString('base64')}`, capabilities });
    }
    this.readRegistry();
    if (fixtureBuilds) this.seedFixtureBuild();
  }

  view(): DevelopmentAppView {
    return { enabled: this.enabled, apps: [...this.definitions.values()].map(({ id, title, thumbnail }) => ({ id, title, thumbnail })) };
  }

  /** Reads the active immutable snapshot from the development-only store. */
  getBuiltApp(appId: string): DevelopmentAppBuild | undefined {
    if (!this.enabled) return undefined;
    const definition = this.definitions.get(appId);
    if (!definition) return undefined;
    try {
      // Private UI fixtures use their seeded snapshot even when a developer's
      // checkout happens to contain an unrelated or incomplete dist directory.
      if (this.fixtureBuilds) {
        const fixture = this.readRegistry().apps[appId]?.active;
        if (!fixture) return undefined;
        const build = this.readSnapshot(appId, fixture);
        this.verifiedBuilds.add(build);
        return build;
      }
      const active = this.readRegistry().apps[appId]?.active;
      if (!active) return undefined;
      const build = this.readSnapshot(appId, active);
      this.verifiedBuilds.add(build);
      return build;
    } catch {
      return undefined;
    }
  }

  /** Validates this checkout's built output and publishes one immutable snapshot to the shared device bucket. */
  publishBuild(appId: string): Readonly<{ appId: string; buildId: string; version: string }> {
    if (!this.enabled) throw new Error('Development app publishing is available only in the local OS source run');
    const definition = this.definitions.get(appId);
    if (!definition) throw new Error('Unknown first-party development app');
    const build = this.loadSourceBuild(definition);
    this.persistBuild(build);
    return { appId, buildId: build.buildId, version: build.manifest.version };
  }

  isAuthorizedBuild(build: DevelopmentAppBuild): boolean {
    return this.enabled && this.verifiedBuilds.has(build)
      && this.definitions.has(build.appId)
      && build.manifest.appId === build.appId
      && build.manifest.publisher === 'company';
  }

  allowsCapability(build: DevelopmentAppBuild, capability: Operation): boolean {
    const definition = this.definitions.get(build.appId);
    return this.isAuthorizedBuild(build)
      && !!definition?.capabilities.includes(capability)
      && build.capabilities.includes(capability);
  }

  allowsApiOperation(build: DevelopmentAppBuild, operation: ApiOperationId): boolean {
    return apiOperations.includes(operation) && this.allowsCapability(build, operation);
  }

  allowsLocalFilePick(build: DevelopmentAppBuild): boolean {
    return this.allowsCapability(build, 'local.files.pick');
  }

  private loadSourceBuild(definition: Definition): DevelopmentAppBuild {
    const pkg = safeJson(path.join(definition.sourceRoot, 'package.json'), 64 * 1024);
    const sourceManifest = safeJson(path.join(definition.sourceRoot, 'app.manifest.json'), 64 * 1024) as Omit<Manifest, 'format' | 'assets'>;
    if (!pkg || pkg.name !== definition.id || !versionPattern.test(pkg.version)
      || Object.keys(sourceManifest ?? {}).sort().join() !== 'apiMajor,appId,capabilities,entry,publisher,sdkMajor,version'
      || !sourceManifest || sourceManifest.appId !== definition.id || sourceManifest.publisher !== 'company'
      || sourceManifest.version !== pkg.version || !versionPattern.test(sourceManifest.version)
      || sourceManifest.entry !== 'index.html' || sourceManifest.sdkMajor !== 1 || sourceManifest.apiMajor !== 1
      || !sortedCapabilities(sourceManifest.capabilities)
      || sourceManifest.capabilities.some(capability => !definition.capabilities.includes(capability))) throw new Error('Development app manifest is outside its local permission grant');

    const dist = path.join(definition.sourceRoot, 'dist');
    const realDist = realpathSync(dist);
    if (!isWithin(definition.sourceRoot, realDist) || !lstatSync(dist).isDirectory() || lstatSync(dist).isSymbolicLink()) throw new Error('Unsafe development build output');
    const files = this.readBuildFiles(dist);
    const metadata = JSON.parse(files.get('app.json')!.toString('utf8'));
    if (!metadata || metadata.appId !== definition.id || metadata.format !== 1) throw new Error('Development app metadata identity does not match');
    const assets = [...files].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([file, bytes]) => ({ path: file, size: bytes.length, sha256: sha256(bytes) }));
    if (assets.length > limits.count || !assets.some(asset => asset.path === sourceManifest.entry)) throw new Error('Development app inventory is incomplete');
    const manifest: Manifest = { format: 1, ...sourceManifest, capabilities: [...sourceManifest.capabilities], assets };
    return { appId: definition.id, buildId: buildDigest(manifest, files), manifest, capabilities: manifest.capabilities, files };
  }

  private persistBuild(build: DevelopmentAppBuild) {
    const releaseLock = acquireRegistryLock(this.storageRoot);
    try {
      const registry = this.readRegistry();
      const previous = registry.apps[build.appId];
      if (previous?.active === build.buildId) return;
      this.writeSnapshot(build.appId, build.buildId, build.manifest, build.files);
      registry.apps[build.appId] = { active: build.buildId, previous: previous?.active ?? null };
      this.writeRegistry(registry);
      this.pruneSnapshots(build.appId, registry.apps[build.appId]);
    } finally { releaseLock(); }
  }

  /** A synthetic local build used only by the guarded private UI fixture. */
  private seedFixtureBuild() {
    const definition = this.definitions.get('company.dental.followups.m17');
    if (!definition) throw new Error('Development app fixture is unavailable');
    const pkg = safeJson(path.join(definition.sourceRoot, 'package.json'), 64 * 1024);
    const sourceManifest = safeJson(path.join(definition.sourceRoot, 'app.manifest.json'), 64 * 1024) as Omit<Manifest, 'format' | 'assets'>;
    const files = new Map<string, Buffer>([
      ['index.html', Buffer.from('<!doctype html><html><head><title>Follow-ups development preview</title></head><body><main><h1>Follow-ups development preview</h1></main></body></html>')],
      ['app.json', Buffer.from(JSON.stringify({
        format: 1, appId: definition.id, title: 'Follow-ups', description: 'Private local development preview.', icon: 'assets/followups.png',
        anyCapabilities: ['followups.access'], excludedRoles: [], allowedRoles: [],
        modules: [{ id: 'followups', label: 'Follow-ups', tab: 'followups', capability: 'followups.access' }],
      }))],
      ['assets/followups.png', readRegular(path.join(definition.sourceRoot, 'assets/followups.png'), maxThumbnailBytes)],
    ]);
    const assets = [...files].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0).map(([file, bytes]) => ({ path: file, size: bytes.length, sha256: sha256(bytes) }));
    const manifest: Manifest = { format: 1, ...sourceManifest, version: pkg.version, capabilities: [...sourceManifest.capabilities], assets };
    const build: DevelopmentAppBuild = { appId: definition.id, buildId: buildDigest(manifest, files), manifest, capabilities: manifest.capabilities, files };
    this.persistBuild(build);
  }

  private readBuildFiles(root: string) {
    const files = new Map<string, Buffer>();
    let total = 0;
    const walk = (folder: string, prefix = '', depth = 0) => {
      if (depth > 12) throw new Error('Development build is too deeply nested');
      const folderInfo = lstatSync(folder);
      if (!folderInfo.isDirectory() || folderInfo.isSymbolicLink()) throw new Error('Unsafe development build directory');
      for (const entry of readdirSync(folder, { withFileTypes: true })) {
        const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
        const file = path.join(folder, entry.name);
        const info = lstatSync(file);
        if (info.isSymbolicLink()) throw new Error('Linked development assets are not allowed');
        if (info.isDirectory()) {
          validDirectoryPath(relative);
          walk(file, relative, depth + 1);
        }
        else {
          validPath(relative);
          if (!info.isFile() || files.size >= limits.count || info.size > maxBuildFileBytes) throw new Error('Development build file limit');
          const bytes = readRegular(file, maxBuildFileBytes);
          total += bytes.length;
          if (total > maxBuildBytes) throw new Error('Development build exceeds the 8 MiB limit');
          files.set(relative, bytes);
        }
      }
    };
    walk(root);
    if (!files.has('index.html') || !files.has('app.json')) throw new Error('Build output is incomplete');
    return files;
  }

  private readRegistry(): Registry {
    const registryPath = path.join(this.storageRoot, 'registry.json');
    let raw: Buffer;
    try { raw = readRegular(registryPath, 64 * 1024); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { format: 1, apps: {} };
      throw error;
    }
    const value = JSON.parse(raw.toString('utf8')) as Registry;
    if (!value || Object.keys(value).sort().join() !== 'apps,format' || value.format !== 1
      || !value.apps || typeof value.apps !== 'object' || Array.isArray(value.apps)
      || Object.keys(value.apps).length > appDefinitions.length) throw new Error('Development app registry needs recovery');
    for (const [id, pointer] of Object.entries(value.apps)) {
      if (!this.definitions.has(id) || !pointer || Object.keys(pointer).sort().join() !== 'active,previous'
        || typeof pointer.active !== 'string' || !digestPattern.test(pointer.active)
        || !(pointer.previous === null || typeof pointer.previous === 'string' && digestPattern.test(pointer.previous))) throw new Error('Development app registry needs recovery');
    }
    return value;
  }

  private writeRegistry(registry: Registry) {
    this.writeAtomic(path.join(this.storageRoot, 'registry.json'), Buffer.from(canonical(registry)));
  }

  private writeAtomic(target: string, bytes: Buffer) {
    const temporary = path.join(path.dirname(target), `.write-${randomUUID()}`);
    let fd: number | undefined;
    try {
      fd = openSync(temporary, 'wx', 0o600);
      writeFileSync(fd, bytes);
      fsyncSync(fd);
      closeSync(fd);
      fd = undefined;
      renameSync(temporary, target);
      this.syncDirectory(path.dirname(target));
    } finally {
      if (fd !== undefined) closeSync(fd);
      try { unlinkSync(temporary); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    }
  }

  private syncDirectory(directory: string) {
    if (process.platform !== 'win32') {
      const fd = openSync(directory, 'r');
      try { fsyncSync(fd); } finally { closeSync(fd); }
    }
  }

  private ensureStoredDirectory(directory: string) {
    const relative = path.relative(this.storageRoot, directory);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Development app path escaped its store');
    let current = this.storageRoot;
    for (const part of relative.split(path.sep).filter(Boolean)) {
      current = path.join(current, part);
      try {
        const stat = lstatSync(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe development app store directory');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        mkdirSync(current, { mode: 0o700 });
        const stat = lstatSync(current);
        if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe development app store directory');
      }
    }
  }

  private writeSnapshot(appId: string, buildId: string, manifest: Manifest, files: ReadonlyMap<string, Buffer>) {
    const appDirectory = path.join(this.storageRoot, 'apps', appId);
    this.ensureStoredDirectory(appDirectory);
    const destination = path.join(appDirectory, buildId);
    if (existsSync(destination)) {
      const existing = this.readSnapshot(appId, buildId);
      if (existing.buildId !== buildId) throw new Error('Development app snapshot collision');
      return;
    }
    const temporary = path.join(appDirectory, `.stage-${randomUUID()}`);
    mkdirSync(temporary, { mode: 0o700 });
    try {
      const payload = path.join(temporary, 'payload');
      this.ensureStoredDirectory(payload);
      for (const [name, bytes] of files) {
        const target = path.join(payload, ...name.split('/'));
        this.ensureStoredDirectory(path.dirname(target));
        const fd = openSync(target, 'wx', 0o600);
        try { writeFileSync(fd, bytes); fsyncSync(fd); } finally { closeSync(fd); }
      }
      const manifestPath = path.join(temporary, 'build.json');
      const fd = openSync(manifestPath, 'wx', 0o600);
      try { writeFileSync(fd, Buffer.from(canonical(manifest))); fsyncSync(fd); } finally { closeSync(fd); }
      this.syncDirectory(payload);
      renameSync(temporary, destination);
      this.syncDirectory(appDirectory);
    } catch (error) {
      rmSync(temporary, { recursive: true, force: true });
      throw error;
    }
  }

  private readSnapshot(appId: string, buildId: string): DevelopmentAppBuild {
    const definition = this.definitions.get(appId);
    if (!definition || !digestPattern.test(buildId)) throw new Error('Unknown development app snapshot');
    const folder = path.join(this.storageRoot, 'apps', appId, buildId);
    const folderInfo = lstatSync(folder);
    if (!folderInfo.isDirectory() || folderInfo.isSymbolicLink()) throw new Error('Unsafe development app snapshot');
    const manifest = safeJson(path.join(folder, 'build.json'), 256 * 1024) as Manifest;
    if (!manifest || Object.keys(manifest).sort().join() !== 'apiMajor,appId,assets,capabilities,entry,format,publisher,sdkMajor,version'
      || manifest.format !== 1 || manifest.appId !== appId || manifest.publisher !== 'company'
      || !versionPattern.test(manifest.version) || manifest.entry !== 'index.html'
      || manifest.sdkMajor !== 1 || manifest.apiMajor !== 1 || !sortedCapabilities(manifest.capabilities)
      || manifest.capabilities.some(capability => !definition.capabilities.includes(capability))
      || !Array.isArray(manifest.assets) || manifest.assets.length > limits.count) throw new Error('Invalid development app snapshot manifest');
    const payload = path.join(folder, 'payload');
    const files = this.readBuildFiles(payload);
    if (manifest.assets.length !== files.size) throw new Error('Development app snapshot inventory mismatch');
    for (let index = 0; index < manifest.assets.length; index++) {
      const asset = manifest.assets[index];
      const [name, bytes] = [...files].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)[index];
      if (!asset || Object.keys(asset).sort().join() !== 'path,sha256,size' || asset.path !== name || asset.size !== bytes.length || asset.sha256 !== sha256(bytes)) throw new Error('Development app snapshot integrity check failed');
    }
    const actualBuildId = buildDigest(manifest, files);
    if (actualBuildId !== buildId) throw new Error('Development app snapshot digest mismatch');
    return { appId, buildId, manifest, capabilities: manifest.capabilities, files };
  }

  private pruneSnapshots(appId: string, pointer: BuildPointer) {
    const directory = path.join(this.storageRoot, 'apps', appId);
    const keep = new Set([pointer.active, pointer.previous].filter((value): value is string => !!value));
    for (const name of readdirSync(directory)) {
      if (!digestPattern.test(name) || keep.has(name)) continue;
      const target = path.join(directory, name);
      const stat = lstatSync(target);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Unsafe old development app snapshot');
      rmSync(target, { recursive: true, force: false });
    }
  }
}
