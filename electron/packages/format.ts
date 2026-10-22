/** dentalpkg/1 wire format. Node-only deterministic tooling; no Electron authority. */
import { createHash, createPublicKey, sign, verify, type KeyObject } from 'node:crypto';
import { operations, type Operation } from '../sdk/contracts';
export const limits = Object.freeze({ wire: 16 * 1024 * 1024, expanded: 8 * 1024 * 1024, file: 2 * 1024 * 1024, count: 128, path: 160 });
export const maxCompanyAppCount = 64;
export type Manifest = { format: 1; appId: string; publisher: string; version: string; entry: string; sdkMajor: 1; apiMajor: 1; capabilities: Operation[]; assets: { path: string; size: number; sha256: string }[] };
export type Release = { format: 1; appId: string; publisher: string; version: string; digest: string; keyId: string };
export type AppTrust = Readonly<{ publisher: string; capabilities: readonly Operation[] }>;
export type TrustPolicy = Readonly<{
  keys: Readonly<Record<string, { publicKey: string; publisher: string }>>;
  /** Explicit entries remain useful for local fixtures. Production first-party IDs are authorized by signed catalogue/policy metadata, within this platform ceiling. */
  apps: Readonly<Record<string, AppTrust>>;
  companyApps?: AppTrust;
}>;
export type VerifiedPackage = Readonly<{
  manifest: Manifest;
  release: Release;
  /** SHA-256 of the complete dentalpkg wire bytes, distinct from release.digest over the payload. */
  packageSha256: string;
  files: ReadonlyMap<string, Buffer>;
  capabilities: readonly Operation[];
}>;
const hashPattern = /^[a-f0-9]{64}$/;
export function isCompanyAppId(value: unknown): value is string { return typeof value === 'string' && /^company\.[a-z][a-z0-9.-]{1,70}$/.test(value); }
export function appTrust(policy: TrustPolicy, id: string): AppTrust | undefined {
  return Object.hasOwn(policy.apps, id) ? policy.apps[id] : isCompanyAppId(id) ? policy.companyApps : undefined;
}
export function sha256(bytes: Uint8Array) { return createHash('sha256').update(bytes).digest('hex'); }
export function canonical(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return String(value);
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonical((value as Record<string, unknown>)[k])).join(',') + '}';
  throw new Error('Noncanonical value');
}
function object(value: unknown, keys: string[]): asserts value is Record<string, any> {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== keys.sort().join(',')) throw new Error('Invalid schema');
}
export function validPath(value: unknown): asserts value is string {
  // Portable lowercase paths avoid Windows device names, ADS, case aliases and trailing-dot ambiguity.
  if (typeof value !== 'string' || value.length > limits.path || value.split('/').length > 8 || !/^[a-z0-9][a-z0-9._/-]*$/.test(value) || !/\.(html|js|css|json|svg|png|jpg|jpeg|webp|woff2)$/.test(value)) throw new Error('Invalid asset path');
  for (const part of value.split('/')) if (!part || part === '.' || part === '..' || part.endsWith('.') || /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/.test(part)) throw new Error('Invalid asset path');
}
function base64(value: unknown, max: number): Buffer {
  if (typeof value !== 'string' || value.length > Math.ceil(max / 3) * 4 || value.length % 4 !== 0) throw new Error('Invalid base64');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0, bodyLength = value.length - padding;
  // Scan long package payloads without a large backtracking regex (which can overflow the
  // JavaScript regexp stack on otherwise valid multi-megabyte signed web apps).
  for (let i = 0; i < bodyLength; i++) {
    const code = value.charCodeAt(i);
    if (!(code >= 65 && code <= 90 || code >= 97 && code <= 122 || code >= 48 && code <= 57 || code === 43 || code === 47)) throw new Error('Invalid base64');
  }
  for (let i = bodyLength; i < value.length; i++) if (value.charCodeAt(i) !== 61) throw new Error('Invalid base64');
  const bytes = Buffer.from(value, 'base64'); if (bytes.length > max || bytes.toString('base64') !== value) throw new Error('Invalid base64'); return bytes;
}
export function parseCanonical(bytes: Buffer): any {
  const text = bytes.toString('utf8'), value: unknown = JSON.parse(text);
  if (!Buffer.from(canonical(value), 'utf8').equals(bytes)) throw new Error('Noncanonical encoding'); return value;
}
function manifest(value: unknown): asserts value is Manifest {
  object(value, ['format', 'appId', 'publisher', 'version', 'entry', 'sdkMajor', 'apiMajor', 'capabilities', 'assets']);
  if (value.format !== 1 || typeof value.appId !== 'string' || !/^company\.[a-z][a-z0-9.-]{1,70}$/.test(value.appId) || value.publisher !== 'company' || typeof value.version !== 'string' || !/^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/.test(value.version) || value.sdkMajor !== 1 || value.apiMajor !== 1) throw new Error('Incompatible manifest');
  validPath(value.entry); if (!value.entry.endsWith('.html')) throw new Error('Invalid entry');
  if (!Array.isArray(value.capabilities) || value.capabilities.length > operations.length || new Set(value.capabilities).size !== value.capabilities.length || value.capabilities.some((v: Operation) => !operations.includes(v))) throw new Error('Invalid capabilities');
  // A signed company package may select one existing clinic app contract, never combine app families.
  if (value.capabilities.filter((v: Operation) => v.startsWith('clinic.app.')).length > 1) throw new Error('Multiple clinic app families');
  if (!Array.isArray(value.assets) || !value.assets.length || value.assets.length > limits.count) throw new Error('Asset count');
  let total = 0, previous = '';
  for (const asset of value.assets) {
    object(asset, ['path', 'size', 'sha256']); validPath(asset.path);
    if (asset.path <= previous || !Number.isSafeInteger(asset.size) || asset.size < 0 || asset.size > limits.file || typeof asset.sha256 !== 'string' || !hashPattern.test(asset.sha256)) throw new Error('Invalid inventory');
    previous = asset.path; total += asset.size;
  }
  if (total > limits.expanded || !value.assets.some((a: {path: string}) => a.path === value.entry)) throw new Error('Invalid inventory');
  // Disallow a file that is also the parent of another file.
  const names = new Set(value.assets.map((a: {path: string}) => a.path));
  for (const name of names) for (let i = name.indexOf('/'); i >= 0; i = name.indexOf('/', i + 1)) if (names.has(name.slice(0, i))) throw new Error('Conflicting paths');
}
export function verifyPackage(bytes: Buffer, policy: TrustPolicy): VerifiedPackage {
  if (!bytes.length || bytes.length > limits.wire) throw new Error('Package size');
  const envelope = parseCanonical(bytes); object(envelope, ['payload', 'release', 'signature']);
  const release = envelope.release; object(release, ['format', 'appId', 'publisher', 'version', 'digest', 'keyId']);
  if (release.format !== 1 || typeof release.keyId !== 'string' || !/^[a-z0-9-]{1,48}$/.test(release.keyId) || typeof release.digest !== 'string' || !hashPattern.test(release.digest)) throw new Error('Invalid release');
  const key = Object.hasOwn(policy.keys, release.keyId) ? policy.keys[release.keyId] : undefined;
  const app = appTrust(policy, release.appId);
  if (!key || !app || key.publisher !== release.publisher || app.publisher !== release.publisher) throw new Error('Untrusted release');
  const publicKey = createPublicKey(key.publicKey);
  if (publicKey.asymmetricKeyType !== 'ed25519' || !verify(null, Buffer.from(canonical(release)), publicKey, base64(envelope.signature, 64))) throw new Error('Invalid signature');
  const payload = base64(envelope.payload, 12 * 1024 * 1024);
  if (sha256(payload) !== release.digest) throw new Error('Payload digest');
  const body = parseCanonical(payload); object(body, ['manifest', 'files']); manifest(body.manifest);
  const m = body.manifest;
  if (m.appId !== release.appId || m.publisher !== release.publisher || m.version !== release.version) throw new Error('Identity mismatch');
  if (!Array.isArray(body.files) || body.files.length !== m.assets.length) throw new Error('Inventory mismatch');
  const files = new Map<string, Buffer>();
  for (let i = 0; i < m.assets.length; i++) {
    const a = m.assets[i], f = body.files[i]; object(f, ['path', 'data']);
    const data = base64(f.data, limits.file);
    if (f.path !== a.path || data.length !== a.size || sha256(data) !== a.sha256) throw new Error('Asset integrity');
    files.set(a.path, data);
  }
  if (m.capabilities.some(op => !app.capabilities.includes(op))) throw new Error('Capability exceeds platform policy');
  return { manifest: m, release: release as Release, packageSha256: sha256(bytes), files, capabilities: [...m.capabilities] };
}
export function buildPackage(input: Omit<Manifest, 'format' | 'assets'>, files: ReadonlyMap<string, Buffer>, keyId: string, privateKey: KeyObject): Buffer {
  if (privateKey.asymmetricKeyType !== 'ed25519') throw new Error('Ed25519 required');
  const ordered = [...files].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
  const m: Manifest = { ...input, format: 1, assets: ordered.map(([path, data]) => ({ path, size: data.length, sha256: sha256(data) })) }; manifest(m);
  const payload = Buffer.from(canonical({ manifest: m, files: ordered.map(([path, data]) => ({ path, data: data.toString('base64') })) }));
  const release: Release = { format: 1, appId: m.appId, publisher: m.publisher, version: m.version, digest: sha256(payload), keyId };
  const bytes = Buffer.from(canonical({ payload: payload.toString('base64'), release, signature: sign(null, Buffer.from(canonical(release)), privateKey).toString('base64') }));
  if (bytes.length > limits.wire) throw new Error('Package size'); return bytes;
}
/** Normal platform ships no test key. Approved release keys arrive through platform releases. */
export const productionTrust: TrustPolicy = Object.freeze({ keys: Object.freeze({}), apps: Object.freeze({}) });
