// Assemble one capability-free company preview release and a successor signed
// catalogue/policy. Inputs and output stay outside the source checkout.
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, createPublicKey, sign, verify as verifySignature } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPackage, canonical, parseCanonical, sha256, verifyPackage, maxCompanyAppCount } = require('../../dist-electron/packages/format.js');
const { compareVersion, verifyCatalogue, noWatermark } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy } = require('../../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');

const [guard, keyPath, rawSequence, outputPath, priorCataloguePath, priorPolicyPath, version] = process.argv.slice(2);
const sequence = Number(rawSequence), appId = 'company.sample.preview';
const semver = /^(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})\.(0|[1-9][0-9]{0,3})$/;
if (guard !== '--staging-only' || process.argv.length !== 9 || !semver.test(version ?? '') || !Number.isSafeInteger(sequence) || sequence < 1)
  throw Error('Explicit staging flag, external key, increasing sequence, prior signed metadata, version and new output directory required');

const checkout = path.resolve(import.meta.dirname, '../..');
const absoluteKey = path.resolve(keyPath), output = path.resolve(outputPath);
if (absoluteKey.startsWith(checkout + path.sep) || output.startsWith(checkout + path.sep)) throw Error('Signing key and output must remain outside checkout');
const keyInfo = fs.lstatSync(absoluteKey);
if (!keyInfo.isFile() || keyInfo.isSymbolicLink() || keyInfo.nlink !== 1 || keyInfo.size > 4096 || process.platform !== 'win32' && (keyInfo.mode & 0o077) !== 0) throw Error('Unsafe staging key input');
if (fs.existsSync(output)) throw Error('Output directory must be new');

function readSignedFile(file) {
  const absolute = path.resolve(file), info = fs.lstatSync(absolute);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 65536) throw Error('Unsafe prior metadata file');
  return fs.readFileSync(absolute);
}
const privateKey = createPrivateKey(fs.readFileSync(absoluteKey));
const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
const keyId = Object.keys(stagingDistribution.policy.keys).find(id => stagingDistribution.policy.keys[id].publicKey === publicKey);
if (!keyId || keyId !== 'company-staging-m08-20261016') throw Error('Key does not match the active pinned M08 staging signer');

const previousCatalogueBytes = readSignedFile(priorCataloguePath), previousPolicyBytes = readSignedFile(priorPolicyPath);
const previousCatalogueEnvelope = JSON.parse(previousCatalogueBytes), previousPolicyEnvelope = JSON.parse(previousPolicyBytes);
if (previousCatalogueEnvelope.keyId !== keyId || previousPolicyEnvelope.keyId !== keyId) throw Error('Prior metadata must use the active staging signer');
const priorCatalogueTime = previousCatalogueEnvelope.catalogue?.issuedAt;
const priorPolicyTime = previousPolicyEnvelope.policy?.issuedAt;
if (!Number.isSafeInteger(priorCatalogueTime) || !Number.isSafeInteger(priorPolicyTime)) throw Error('Invalid prior metadata time');
const priorCatalogue = verifyCatalogue(previousCatalogueBytes, stagingDistribution.policy, noWatermark, priorCatalogueTime).catalogue;
let priorPolicy;
try {
  priorPolicy = verifyUpdatePolicy(previousPolicyBytes, stagingDistribution.policy, noWatermark, priorPolicyTime).policy;
} catch {
  // Sequence 11 predates per-app capability grants. Verify its original signer
  // and exact legacy schema, then derive grants only from that signer's already
  // verified catalogue entries before signing the current policy format.
  const envelope = parseCanonical(previousPolicyBytes), legacy = envelope.policy;
  if (Object.keys(envelope).sort().join() !== 'keyId,policy,signature' || envelope.keyId !== keyId || typeof envelope.signature !== 'string') throw Error('Prior update policy signature');
  const signer = createPublicKey(stagingDistribution.policy.keys[keyId].publicKey);
  if (!verifySignature(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId, policy: legacy })), signer, Buffer.from(envelope.signature, 'base64'))) throw Error('Prior update policy signature');
  const oldPolicyKeys = ['channel', 'environment', 'expiresAt', 'format', 'issuedAt', 'revokedKeys', 'sequence', 'apps'];
  if (!legacy || Object.keys(legacy).sort().join() !== oldPolicyKeys.sort().join() || legacy.format !== 1 || legacy.environment !== 'cloudfare-staging' || legacy.channel !== 'staging' || legacy.sequence !== previousCatalogueEnvelope.catalogue.sequence || legacy.issuedAt !== priorPolicyTime || legacy.expiresAt !== previousCatalogueEnvelope.catalogue.expiresAt || !Array.isArray(legacy.revokedKeys) || !Array.isArray(legacy.apps) || legacy.apps.length < 1 || legacy.apps.length > maxCompanyAppCount) throw Error('Prior update policy schema');
  const releases = new Map(priorCatalogue.releases.map(release => [release.id, release]));
  const seen = new Set();
  const migratedApps = legacy.apps.map(app => {
    if (!app || Object.keys(app).sort().join() !== ['id', 'minimumVersion', 'revokedDigests', 'rollback'].sort().join() || typeof app.id !== 'string' || seen.has(app.id)) throw Error('Prior update policy app schema');
    const release = releases.get(app.id), trust = stagingDistribution.policy.apps[app.id] ?? stagingDistribution.policy.companyApps;
    if (!release || !trust || trust.publisher !== 'company' || !semver.test(app.minimumVersion) || !Array.isArray(app.revokedDigests)) throw Error('Prior update policy app binding');
    seen.add(app.id);
    return { ...app, capabilities: [...release.capabilities] };
  });
  if (migratedApps.length !== priorCatalogue.releases.length || priorCatalogue.releases.some(release => !seen.has(release.id))) throw Error('Prior update policy identities differ');
  priorPolicy = { ...legacy, apps: migratedApps };
}
if (priorCatalogue.sequence !== priorPolicy.sequence || priorCatalogue.issuedAt !== priorPolicy.issuedAt || priorCatalogue.expiresAt !== priorPolicy.expiresAt || sequence <= priorCatalogue.sequence)
  throw Error('Prior signed metadata is inconsistent or the new sequence does not increase');
if (priorCatalogue.releases.length !== priorPolicy.apps.length || priorCatalogue.releases.some(release => !priorPolicy.apps.some(app => app.id === release.id)))
  throw Error('Prior catalogue and update policy identities differ');

const oldRelease = priorCatalogue.releases.find(release => release.id === appId);
const oldPolicy = priorPolicy.apps.find(app => app.id === appId);
if (!!oldRelease !== !!oldPolicy) throw Error('Prior app metadata is inconsistent');
if (oldRelease && compareVersion(version, oldRelease.version) <= 0) throw Error('App version must strictly increase');
if (!oldRelease && version !== '1.0.0') throw Error('First onboarding release must be 1.0.0');
const appTrust = stagingDistribution.policy.companyApps;
if (!appTrust || appTrust.publisher !== 'company') throw Error('First-party company app policy is unavailable');

const assets = path.join(checkout, 'fixtures/runtime-apps/onboarding', version);
const files = new Map(['index.html', 'app.css'].map(name => [name, fs.readFileSync(path.join(assets, name))]));
const packageBytes = buildPackage({ appId, publisher: 'company', version, entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: [] }, files, keyId, privateKey);
const verifiedPackage = verifyPackage(packageBytes, stagingDistribution.policy);
const digest = sha256(packageBytes), objectKey = `releases/${appId}/${version}/${digest}.dentalpkg`;
const now = Date.now(), expiresAt = now + 86400000;
const release = {
  id: appId,
  title: 'Dental Workspace Preview',
  description: 'A synthetic first-party app for verifying independent app delivery.',
  version,
  notes: version === '1.0.0' ? 'Coming Soon preview.' : version === '1.1.0' ? 'Adds a workspace welcome and install guide.' : version === '1.2.0' ? 'Adds a version history panel.' : 'Adds an independent app update status panel.',
  capabilities: [],
  platforms: ['linux', 'win32'],
  sdkMajor: 1,
  apiMajor: 1,
  objectKey,
  packageSha256: digest,
  packageBytes: packageBytes.length,
  payloadDigest: verifiedPackage.release.digest,
  status: 'approved',
  minimumVersion: '1.0.0',
};
const catalogue = {
  format: 1,
  environment: 'cloudfare-staging',
  channel: 'staging',
  sequence,
  issuedAt: now,
  expiresAt,
  releases: [...priorCatalogue.releases.filter(item => item.id !== appId), release],
};
if (catalogue.releases.length > maxCompanyAppCount) throw Error('Catalogue app limit');
const catalogueBytes = Buffer.from(canonical({
  catalogue,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId, catalogue })), privateKey).toString('base64'),
}));
verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now);

const apps = priorPolicy.apps.filter(item => item.id !== appId);
apps.push(oldPolicy ?? { id: appId, capabilities: [], minimumVersion: '1.0.0', revokedDigests: [], rollback: null });
const policy = { ...priorPolicy, sequence, issuedAt: now, expiresAt, apps };
const policyBytes = Buffer.from(canonical({
  policy,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId, policy })), privateKey).toString('base64'),
}));
verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now);

fs.mkdirSync(output, { mode: 0o700 });
const packagePath = path.join(output, objectKey);
fs.mkdirSync(path.dirname(packagePath), { recursive: true, mode: 0o700 });
fs.writeFileSync(packagePath, packageBytes, { flag: 'wx', mode: 0o600 });
fs.mkdirSync(path.join(output, 'catalogue'), { mode: 0o700 });
fs.mkdirSync(path.join(output, 'update-policy'), { mode: 0o700 });
fs.writeFileSync(path.join(output, 'catalogue/staging.json'), catalogueBytes, { flag: 'wx', mode: 0o600 });
fs.writeFileSync(path.join(output, 'update-policy/staging.json'), policyBytes, { flag: 'wx', mode: 0o600 });
fs.writeFileSync(path.join(output, 'publication.json'), JSON.stringify({
  environment: 'cloudfare-staging',
  bucket: 'dentmitra-dental-os-releases-cloudfare-staging',
  sequence,
  expiresAt,
  catalogueSha256: sha256(catalogueBytes),
  updatePolicySha256: sha256(policyBytes),
  releases: [{ id: appId, version, objectKey, packageSha256: digest, packageBytes: packageBytes.length }],
}, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
console.log(`Prepared signed ${appId} ${version} staging release at sequence ${sequence}; prior company entries were retained.`);
