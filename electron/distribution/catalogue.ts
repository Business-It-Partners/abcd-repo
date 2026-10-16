import { createPublicKey, verify } from 'node:crypto';
import { parseCanonical, canonical, limits, sha256, type TrustPolicy } from '../packages/format';
import { operations, type Operation } from '../sdk/contracts';
export type Release = { id: string; title: string; description: string; version: string; notes: string; capabilities: Operation[]; platforms: ('linux' | 'win32')[]; sdkMajor: 1; apiMajor: 1; objectKey: string; packageSha256: string; packageBytes: number; payloadDigest: string; status: 'approved' | 'withdrawn'; minimumVersion: string };
export type Catalogue = { format: 1; environment: 'cloudfare-staging'; channel: 'staging'; sequence: number; issuedAt: number; expiresAt: number; releases: Release[] };
export type Watermark = { sequence: number; digest: string; observedAt: number };
export const noWatermark: Watermark = { sequence: 0, digest: '', observedAt: 0 };
const hash = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
const text = (s: unknown, max: number): s is string => typeof s === 'string' && s.length > 0 && s.length <= max && !/[\x00-\x1f\x7f]/.test(s);
const version = (s: unknown): s is string => typeof s === 'string' && /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/.test(s);
export function compareVersion(a: string, b: string) { const aa = a.split('.').map(Number), bb = b.split('.').map(Number); for (let i = 0; i < 3; i++) if (aa[i] !== bb[i]) return aa[i] - bb[i]; return 0; }
function shape(v: any, keys: string[]) { if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join() !== keys.sort().join()) throw new Error('Invalid catalogue schema'); }
export function verifyCatalogue(bytes: Buffer, policy: TrustPolicy, watermark: Watermark, now = Date.now()): { catalogue: Catalogue; watermark: Watermark } {
  if (!bytes.length || bytes.length > 65536) throw new Error('Catalogue size');
  const envelope = parseCanonical(bytes);
  shape(envelope, ['catalogue', 'keyId', 'signature']);
  if (typeof envelope.keyId !== 'string' || !Object.hasOwn(policy.keys, envelope.keyId)) throw new Error('Unknown catalogue key');
  const key = policy.keys[envelope.keyId], publicKey = createPublicKey(key.publicKey);
  if (publicKey.asymmetricKeyType !== 'ed25519' || typeof envelope.signature !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature) || Buffer.from(envelope.signature, 'base64').toString('base64') !== envelope.signature || !verify(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId: envelope.keyId, catalogue: envelope.catalogue })), publicKey, Buffer.from(envelope.signature, 'base64'))) throw new Error('Catalogue signature');
  const c = envelope.catalogue; shape(c, ['format', 'environment', 'channel', 'sequence', 'issuedAt', 'expiresAt', 'releases']);
  if (c.format !== 1 || c.environment !== 'cloudfare-staging' || c.channel !== 'staging' || !Number.isSafeInteger(c.sequence) || c.sequence < 1 || !Number.isSafeInteger(c.issuedAt) || !Number.isSafeInteger(c.expiresAt) || c.issuedAt < 1 || c.issuedAt > now + 300000 || c.expiresAt <= now || c.expiresAt <= c.issuedAt || c.expiresAt - c.issuedAt > 86400000 || now < watermark.observedAt - 300000) throw new Error('Catalogue freshness');
  const digest = sha256(bytes);
  if (c.sequence < watermark.sequence || c.sequence === watermark.sequence && digest !== watermark.digest) throw new Error('Catalogue replay');
  if (!Array.isArray(c.releases) || c.releases.length > 16) throw new Error('Catalogue count');
  const seen = new Set<string>();
  for (const r of c.releases) {
    shape(r, ['id', 'title', 'description', 'version', 'notes', 'capabilities', 'platforms', 'sdkMajor', 'apiMajor', 'objectKey', 'packageSha256', 'packageBytes', 'payloadDigest', 'status', 'minimumVersion']);
    const app = typeof r.id === 'string' && Object.hasOwn(policy.apps, r.id) ? policy.apps[r.id] : undefined;
    if (!app || app.publisher !== key.publisher || seen.has(r.id) || !text(r.title, 80) || !text(r.description, 300) || !text(r.notes, 500) || !version(r.version) || !version(r.minimumVersion) || compareVersion(r.version, r.minimumVersion) < 0 || !hash(r.packageSha256) || !hash(r.payloadDigest) || !Number.isSafeInteger(r.packageBytes) || r.packageBytes < 1 || r.packageBytes > limits.wire || r.objectKey !== `releases/${r.id}/${r.version}/${r.packageSha256}.dentalpkg` || !['approved', 'withdrawn'].includes(r.status)) throw new Error('Invalid company release');
    if (!Array.isArray(r.capabilities) || r.capabilities.length > operations.length || new Set(r.capabilities).size !== r.capabilities.length || r.capabilities.some((op: Operation) => !operations.includes(op) || !app.capabilities.includes(op))) throw new Error('Release grants');
    if (!Array.isArray(r.platforms) || !r.platforms.length || r.platforms.length > 2 || new Set(r.platforms).size !== r.platforms.length || r.platforms.some((p: string) => !['win32', 'linux'].includes(p)) || r.sdkMajor !== 1 || r.apiMajor !== 1) throw new Error('Incompatible release');
    seen.add(r.id);
  }
  return { catalogue: c, watermark: { sequence: c.sequence, digest, observedAt: Math.max(now, watermark.observedAt) } };
}
