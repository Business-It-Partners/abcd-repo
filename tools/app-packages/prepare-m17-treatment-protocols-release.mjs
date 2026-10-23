// Prepare one fresh M17.10 Treatment Protocols package and signed feed update.
// It writes only to a new, private release directory outside this checkout.
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPackage, canonical, parseCanonical, sha256, verifyPackage, limits, maxCompanyAppCount } = require('../../dist-electron/packages/format.js');
const { noWatermark, verifyCatalogue } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');

const EXPECTED_KEY_ID = 'company-staging-m17-20261022';
const appId = 'company.dental.m17.treatment-protocols';
const version = '1.0.0';
const [guard, keyInput, rawSequence, outputInput, catalogueInput, policyInput] = process.argv.slice(2);
const sequence = Number(rawSequence);
if (guard !== '--staging-only' || process.argv.length !== 8 || !Number.isSafeInteger(sequence) || sequence < 1) {
  throw Error('Expected --staging-only <external-m17-key> <next-sequence> <new-output-dir> <prior-catalogue> <prior-policy>');
}

const checkout = path.resolve(import.meta.dirname, '../..');
const [keyPath, output, cataloguePath, policyPath] = [keyInput, outputInput, catalogueInput, policyInput].map(value => path.resolve(value));
function requireExternal(file) {
  const parent = fs.realpathSync(path.dirname(file));
  if (file === checkout || file.startsWith(checkout + path.sep) || parent === checkout || parent.startsWith(checkout + path.sep)) {
    throw Error('Signer, prior metadata, and output must remain outside the source checkout');
  }
}
for (const file of [keyPath, output, cataloguePath, policyPath]) requireExternal(file);
if (fs.existsSync(output)) throw Error('Output directory must be new');

function readRegular(file, maxBytes) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > maxBytes) throw Error('Unsafe or oversized release input');
  return fs.readFileSync(file);
}
function collectFiles(directory, prefix = '') {
  const files = new Map();
  for (const item of fs.readdirSync(path.join(directory, prefix), { withFileTypes: true })) {
    const relative = path.posix.join(prefix, item.name), full = path.join(directory, relative), info = fs.lstatSync(full);
    if (info.isSymbolicLink()) throw Error('App package cannot contain symbolic links');
    if (item.isDirectory()) for (const [name, bytes] of collectFiles(directory, relative)) files.set(name, bytes);
    else if (info.isFile()) files.set(relative, readRegular(full, limits.file));
    else throw Error('Unsupported app package file');
  }
  return files;
}

const keyInfo = fs.lstatSync(keyPath);
if (!keyInfo.isFile() || keyInfo.isSymbolicLink() || keyInfo.nlink !== 1 || keyInfo.size > 4096 || process.platform !== 'win32' && (keyInfo.mode & 0o077) !== 0) {
  throw Error('Unsafe staging signer input');
}
const privateKey = createPrivateKey(readRegular(keyPath, 4096));
const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
const keyId = Object.keys(stagingDistribution.policy.keys).find(id => stagingDistribution.policy.keys[id].publicKey === publicKey);
if (keyId !== EXPECTED_KEY_ID) throw Error('Signer is not the pinned M17 staging key');

const priorCatalogueBytes = readRegular(cataloguePath, 65_536), priorPolicyBytes = readRegular(policyPath, 65_536);
const catalogueEnvelope = parseCanonical(priorCatalogueBytes), policyEnvelope = parseCanonical(priorPolicyBytes);
if (catalogueEnvelope.keyId !== keyId || policyEnvelope.keyId !== keyId) throw Error('Prior metadata must use the pinned M17 suite signer');
const now = Date.now();
const priorCatalogue = verifyCatalogue(priorCatalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
const priorPolicy = verifyUpdatePolicy(priorPolicyBytes, stagingDistribution.policy, noWatermark, now).policy;
if (priorCatalogue.sequence !== priorPolicy.sequence || priorCatalogue.issuedAt !== priorPolicy.issuedAt || priorCatalogue.expiresAt !== priorPolicy.expiresAt
  || sequence !== priorCatalogue.sequence + 1 || sequence !== priorPolicy.sequence + 1) {
  throw Error('Prior signed metadata is inconsistent or new sequence is not the immediate successor');
}
if (priorPolicy.format !== 2 || priorCatalogue.releases.length !== priorPolicy.apps.length
  || priorCatalogue.releases.some(release => !priorPolicy.apps.some(app => app.id === release.id))) {
  throw Error('Prior catalogue and v2 update-policy identities differ');
}
if (priorCatalogue.releases.length >= maxCompanyAppCount || priorPolicy.apps.length >= maxCompanyAppCount) throw Error('Signed staging app limit would be exceeded');
if (priorCatalogue.releases.some(release => release.id === appId) || priorPolicy.apps.some(app => app.id === appId)) throw Error('M17 Treatment Protocols ID already exists; refusing replacement');

const appRoot = path.resolve(import.meta.dirname, '../..', 'apps/dental-apps', appId);
const manifest = JSON.parse(readRegular(path.join(appRoot, 'app.manifest.json'), 65_536).toString('utf8'));
const appMetadata = JSON.parse(readRegular(path.join(appRoot, 'app.json'), 65_536).toString('utf8'));
if (manifest.appId !== appId || manifest.version !== version || manifest.publisher !== 'company' || manifest.entry !== 'index.html'
  || manifest.sdkMajor !== 1 || manifest.apiMajor !== 1 || !Array.isArray(manifest.capabilities)
  || !manifest.capabilities.includes('clinic.app.treatment-protocols') || !manifest.capabilities.includes('clinic.api.request')
  || !manifest.capabilities.every(capability => stagingDistribution.policy.companyApps.capabilities.includes(capability))) {
  throw Error('Treatment Protocols manifest exceeds the approved company capability ceiling');
}
if (appMetadata.appId !== appId || appMetadata.title !== 'Treatment Protocols' || appMetadata.modules?.length !== 1
  || appMetadata.modules[0]?.id !== 'treatment-protocols') throw Error('Unexpected Treatment Protocols app metadata');

const files = collectFiles(path.join(appRoot, 'dist'));
if (!files.has(manifest.entry) || !files.has('app.json') || !files.has(appMetadata.icon)) throw Error('Treatment Protocols package is missing its entry, metadata, or icon');
const packageBytes = buildPackage(manifest, files, keyId, privateKey);
const verifiedPackage = verifyPackage(packageBytes, stagingDistribution.policy);
const packageSha256 = sha256(packageBytes), payloadDigest = verifiedPackage.release.digest;
const objectKey = `releases/${appId}/${version}/${packageSha256}.dentalpkg`;
const grant = { version, packageSha256, payloadDigest, apiOperations: ['clinic.api.request'] };
const release = {
  id: appId,
  title: appMetadata.title,
  description: appMetadata.description,
  version,
  notes: 'M17.10 Treatment Protocols first-party app release.',
  capabilities: [...manifest.capabilities],
  platforms: ['linux', 'win32'],
  sdkMajor: 1,
  apiMajor: 1,
  objectKey,
  packageSha256,
  packageBytes: packageBytes.length,
  payloadDigest,
  status: 'approved',
  minimumVersion: version,
};
const nextCatalogue = {
  format: 1,
  environment: 'cloudfare-staging',
  channel: 'staging',
  sequence,
  issuedAt: now,
  expiresAt: now + 86_400_000,
  releases: [...priorCatalogue.releases, release],
};
const catalogueBytes = Buffer.from(canonical({
  catalogue: nextCatalogue,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId, catalogue: nextCatalogue })), privateKey).toString('base64'),
}));
verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now);

const nextPolicy = {
  ...priorPolicy,
  sequence,
  issuedAt: now,
  expiresAt: now + 86_400_000,
  apps: [...priorPolicy.apps, {
    id: appId,
    capabilities: [...manifest.capabilities],
    minimumVersion: version,
    revokedDigests: [],
    rollback: null,
    releases: [grant],
  }],
};
const policyBytes = Buffer.from(canonical({
  policy: nextPolicy,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId, policy: nextPolicy })), privateKey).toString('base64'),
}));
verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now);
if (!apiReleaseGrantForPackage(verifiedPackage, nextPolicy, now) || !apiReleaseGrantMatchesCatalogue(appId, grant, nextCatalogue)) {
  throw Error('Exact Treatment Protocols API grant failed signed metadata verification');
}

function writeNew(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
}
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
writeNew(path.join(output, objectKey), packageBytes);
writeNew(path.join(output, 'catalogue/staging.json'), catalogueBytes);
writeNew(path.join(output, 'update-policy/staging.json'), policyBytes);
const publication = {
  environment: 'cloudfare-staging',
  bucket: 'dentmitra-dental-os-releases-cloudfare-staging',
  sequence,
  issuedAt: now,
  expiresAt: nextCatalogue.expiresAt,
  catalogueSha256: sha256(catalogueBytes),
  updatePolicySha256: sha256(policyBytes),
  priorCatalogueSha256: sha256(priorCatalogueBytes),
  priorPolicySha256: sha256(priorPolicyBytes),
  priorSequence: priorCatalogue.sequence,
  keyId,
  releases: [{ id: appId, version, objectKey, packageSha256, packageBytes: packageBytes.length, payloadDigest }],
};
writeNew(path.join(output, 'publication.json'), Buffer.from(JSON.stringify(publication, null, 2) + '\n'));
writeNew(path.join(output, 'baseline/catalogue/staging.json'), priorCatalogueBytes);
writeNew(path.join(output, 'baseline/update-policy/staging.json'), priorPolicyBytes);
console.log(JSON.stringify({ prepared: true, appId, version, sequence, keyId, packageSha256, payloadDigest,
  packageBytes: packageBytes.length, assetCount: files.size, priorSequence: priorCatalogue.sequence,
  priorCatalogueSha256: publication.priorCatalogueSha256, priorPolicySha256: publication.priorPolicySha256,
  exactApiOperations: grant.apiOperations, output }, null, 2));
