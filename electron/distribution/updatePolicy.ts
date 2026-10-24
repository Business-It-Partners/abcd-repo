import { createPublicKey, verify } from 'node:crypto';
import { apiOperations, operations, type ApiOperationId, type Operation } from '../sdk/contracts';
import { parseCanonical, canonical, maxCompanyAppCount, sha256, appTrust, isCompanyAppId, type TrustPolicy, type VerifiedPackage } from '../packages/format';
import { compareVersion, type Catalogue, type Watermark } from './catalogue';

type AppUpdatePolicyBase = {
  id: string;
  capabilities: Operation[];
  minimumVersion: string;
  revokedDigests: string[];
  rollback: null | { from: string; to: string };
};

export type ApiReleaseGrant = {
  version: string;
  packageSha256: string;
  payloadDigest: string;
  apiOperations: ApiOperationId[];
};
export type AppUpdatePolicyV1 = AppUpdatePolicyBase;
export type AppUpdatePolicyV2 = AppUpdatePolicyBase & { releases: ApiReleaseGrant[] };
export type AppUpdatePolicy = AppUpdatePolicyV1 | AppUpdatePolicyV2;

type UpdatePolicyBase = {
  environment: 'cloudfare-staging';
  channel: 'staging';
  sequence: number;
  issuedAt: number;
  expiresAt: number;
  revokedKeys: string[];
};
export type UpdatePolicyV1 = UpdatePolicyBase & { format: 1; apps: AppUpdatePolicyV1[] };
export type UpdatePolicyV2 = UpdatePolicyBase & { format: 2; apps: AppUpdatePolicyV2[] };
export type UpdatePolicy = UpdatePolicyV1 | UpdatePolicyV2;

const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const version = (value: unknown): value is string => typeof value === 'string' && /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/.test(value);
const maxRetainedReleaseGrantsPerApp = 7;
const hasExactKeys = (value: unknown, expected: string[]) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return Object.keys(value).sort().join() === expected.slice().sort().join();
};
const requireKeys = (value: unknown, expected: string[]) => {
  if (!hasExactKeys(value, expected)) throw Error('Update policy schema');
};

function validateReleaseGrants(app: AppUpdatePolicyV2, trust: TrustPolicy) {
  if (!Array.isArray(app.releases) || app.releases.length > maxRetainedReleaseGrantsPerApp) throw Error('Update policy release grants');
  const releaseVersions = new Set<string>(), packageHashes = new Set<string>(), payloadDigests = new Set<string>();
  const ceiling = appTrust(trust, app.id);
  for (const release of app.releases) {
    requireKeys(release, ['version', 'packageSha256', 'payloadDigest', 'apiOperations']);
    if (!version(release.version)
      || compareVersion(release.version, app.minimumVersion) < 0
      || !hash(release.packageSha256)
      || !hash(release.payloadDigest)
      || !Array.isArray(release.apiOperations)
      || release.apiOperations.length > apiOperations.length
      || new Set(release.apiOperations).size !== release.apiOperations.length
      || release.apiOperations.some((operation: unknown) => !apiOperations.includes(operation as ApiOperationId)
        || !app.capabilities.includes(operation as Operation)
        || !ceiling?.capabilities.includes(operation as Operation))) {
      throw Error('Update policy release grant');
    }
    if (releaseVersions.has(release.version) || packageHashes.has(release.packageSha256) || payloadDigests.has(release.payloadDigest)) {
      throw Error('Duplicate update policy release grant');
    }
    releaseVersions.add(release.version);
    packageHashes.add(release.packageSha256);
    payloadDigests.add(release.payloadDigest);
  }
}

export function verifyUpdatePolicy(bytes: Buffer, trust: TrustPolicy, watermark: Watermark, now = Date.now()) {
  if (!bytes.length || bytes.length > 65_536) throw Error('Update policy size');
  const envelope = parseCanonical(bytes);
  requireKeys(envelope, ['policy', 'keyId', 'signature']);
  if (typeof envelope.keyId !== 'string'
    || !Object.hasOwn(trust.keys, envelope.keyId)
    || typeof envelope.signature !== 'string'
    || !/^[A-Za-z0-9+/]{86}==$/.test(envelope.signature)
    || Buffer.from(envelope.signature, 'base64').toString('base64') !== envelope.signature) {
    throw Error('Update policy key');
  }
  const companyKey = trust.keys[envelope.keyId];
  const publicKey = createPublicKey(companyKey.publicKey);
  if (publicKey.asymmetricKeyType !== 'ed25519'
    || !verify(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId: envelope.keyId, policy: envelope.policy })), publicKey, Buffer.from(envelope.signature, 'base64'))) {
    throw Error('Update policy signature');
  }

  const policy = envelope.policy;
  requireKeys(policy, ['format', 'environment', 'channel', 'sequence', 'issuedAt', 'expiresAt', 'revokedKeys', 'apps']);
  if ((policy.format !== 1 && policy.format !== 2)
    || policy.environment !== 'cloudfare-staging'
    || policy.channel !== 'staging'
    || !Number.isSafeInteger(policy.sequence)
    || policy.sequence < 1
    || !Number.isSafeInteger(policy.issuedAt)
    || policy.issuedAt < 1
    || !Number.isSafeInteger(policy.expiresAt)
    || policy.issuedAt > now + 300_000
    || policy.expiresAt <= now
    || policy.expiresAt <= policy.issuedAt
    || policy.expiresAt - policy.issuedAt > 86_400_000
    || now < watermark.observedAt - 300_000) {
    throw Error('Update policy freshness');
  }

  const digest = sha256(bytes);
  if (policy.sequence < watermark.sequence || policy.sequence === watermark.sequence && digest !== watermark.digest) {
    throw Error('Update policy replay');
  }
  if (!Array.isArray(policy.revokedKeys)
    || policy.revokedKeys.length > 16
    || new Set(policy.revokedKeys).size !== policy.revokedKeys.length
    || policy.revokedKeys.some((key: unknown) => typeof key !== 'string' || !Object.hasOwn(trust.keys, key))
    || policy.revokedKeys.includes(envelope.keyId)) {
    throw Error('Update policy revocation');
  }
  if (!Array.isArray(policy.apps) || policy.apps.length < 1 || policy.apps.length > maxCompanyAppCount) throw Error('Update policy app count');

  const seenApps = new Set<string>();
  for (const app of policy.apps) {
    requireKeys(app, policy.format === 1
      ? ['id', 'capabilities', 'minimumVersion', 'revokedDigests', 'rollback']
      : ['id', 'capabilities', 'minimumVersion', 'revokedDigests', 'rollback', 'releases']);
    const ceiling = typeof app.id === 'string' ? appTrust(trust, app.id) : undefined;
    if (!isCompanyAppId(app.id)
      || !ceiling
      || seenApps.has(app.id)
      || ceiling.publisher !== companyKey.publisher
      || !version(app.minimumVersion)
      || !Array.isArray(app.capabilities)
      || app.capabilities.length > operations.length
      || new Set(app.capabilities).size !== app.capabilities.length
      || app.capabilities.some((operation: Operation) => !operations.includes(operation) || !ceiling.capabilities.includes(operation))
      || !Array.isArray(app.revokedDigests)
      || app.revokedDigests.length > 16
      || new Set(app.revokedDigests).size !== app.revokedDigests.length
      || !app.revokedDigests.every(hash)) {
      throw Error('Update policy app');
    }
    if (app.rollback !== null) {
      requireKeys(app.rollback, ['from', 'to']);
      if (!hash(app.rollback.from)
        || !hash(app.rollback.to)
        || app.rollback.from === app.rollback.to
        || app.revokedDigests.includes(app.rollback.to)) {
        throw Error('Update policy rollback');
      }
    }
    if (policy.format === 2) validateReleaseGrants(app as AppUpdatePolicyV2, trust);
    seenApps.add(app.id);
  }

  return {
    policy: policy as UpdatePolicy,
    watermark: { sequence: policy.sequence, digest, observedAt: Math.max(now, watermark.observedAt) },
  };
}

/** Find a release record only when the verified package identity exactly matches signed v2 metadata. */
export function apiReleaseGrantForPackage(value: VerifiedPackage, policy: UpdatePolicy | undefined, now = Date.now()): ApiReleaseGrant | undefined {
  if (!policy
    || policy.format !== 2
    || policy.expiresAt <= now
    || policy.issuedAt > now + 300_000
    || value.manifest.publisher !== 'company'
    || value.release.publisher !== 'company'
    || value.manifest.appId !== value.release.appId
    || value.manifest.version !== value.release.version) return;

  const app = policy.apps.find(candidate => candidate.id === value.manifest.appId);
  if (!app
    || app.revokedDigests.includes(value.release.digest)
    || policy.revokedKeys.includes(value.release.keyId)
    || compareVersion(value.manifest.version, app.minimumVersion) < 0) return;

  return app.releases.find(release => release.version === value.manifest.version
    && release.packageSha256 === value.packageSha256
    && release.payloadDigest === value.release.digest);
}

/** Return a release's v2 API grants only when its verified identity exactly matches the signed record. */
export function apiOperationsForPackage(value: VerifiedPackage, policy: UpdatePolicy | undefined, now = Date.now()): ApiOperationId[] {
  const app = policy?.apps.find(candidate => candidate.id === value.manifest.appId);
  const grant = apiReleaseGrantForPackage(value, policy, now);
  return grant && app
    ? grant.apiOperations.filter(operation => value.capabilities.includes(operation) && app.capabilities.includes(operation))
    : [];
}

/** Older retained grants may not appear in the single-row catalogue; a matching current version must agree exactly. */
export function apiReleaseGrantMatchesCatalogue(appId: string, grant: ApiReleaseGrant, catalogue: Catalogue | undefined): boolean {
  if (!catalogue) return true;
  const current = catalogue.releases.find(release => release.id === appId);
  if (!current || current.version !== grant.version) return true;
  return current.version === grant.version
    && current.packageSha256 === grant.packageSha256
    && current.payloadDigest === grant.payloadDigest;
}

export function allowUpdatedPackage(value: VerifiedPackage, policy: UpdatePolicy | undefined, catalogue: Catalogue | undefined, now = Date.now()) {
  const id = value.manifest.appId;
  const app = policy?.apps.find(candidate => candidate.id === id);
  const release = catalogue?.releases.find(candidate => candidate.id === id);
  if (!policy
    || !catalogue
    || policy.expiresAt <= now
    || catalogue.expiresAt <= now
    || now < policy.issuedAt - 300_000
    || now < catalogue.issuedAt - 300_000
    || !app
    || !release
    || release.status !== 'approved'
    || !release.platforms.includes(process.platform as 'linux' | 'win32')
    || policy.revokedKeys.includes(value.release.keyId)
    || app.revokedDigests.includes(value.release.digest)
    || value.capabilities.some(operation => !app.capabilities.includes(operation))
    || release.capabilities.some(operation => !app.capabilities.includes(operation))
    || compareVersion(value.manifest.version, app.minimumVersion) < 0
    || compareVersion(value.manifest.version, release.minimumVersion) < 0) {
    throw Error('App needs a current safe update policy');
  }
}
