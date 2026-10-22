// Prepare one exact signed M17.1 Follow-ups successor. This is local-only;
// publication is a separate, staging-only operation.
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildPackage, canonical, parseCanonical, sha256, verifyPackage, limits } = require('../../dist-electron/packages/format.js');
const { noWatermark, verifyCatalogue, compareVersion } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../../dist-electron/distribution/updatePolicy.js');
const { apiOperations } = require('../../dist-electron/sdk/contracts.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');

const EXPECTED_KEY_ID = 'company-staging-m08-20261016';
const appId = 'company.dental.followups';
const [guard, keyInput, rawSequence, outputInput, catalogueInput, policyInput] = process.argv.slice(2);
const sequence = Number(rawSequence);
if (guard !== '--staging-only' || process.argv.length !== 8 || !Number.isSafeInteger(sequence) || sequence < 1) {
  throw Error('Expected --staging-only <external-m08-key> <higher-sequence> <new-output-dir> <prior-catalogue> <prior-policy>');
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
if (keyId !== EXPECTED_KEY_ID) throw Error('Signer is not the pinned M08 staging key');

const priorCatalogueBytes = readRegular(cataloguePath, 65_536), priorPolicyBytes = readRegular(policyPath, 65_536);
const catalogueEnvelope = parseCanonical(priorCatalogueBytes), policyEnvelope = parseCanonical(priorPolicyBytes);
if (catalogueEnvelope.keyId !== keyId || policyEnvelope.keyId !== keyId) throw Error('Prior metadata must use the pinned M08 staging signer');
const now = Date.now();
const priorCatalogue = verifyCatalogue(priorCatalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
const priorPolicy = verifyUpdatePolicy(priorPolicyBytes, stagingDistribution.policy, noWatermark, now).policy;
if (priorCatalogue.sequence !== priorPolicy.sequence || priorCatalogue.issuedAt !== priorPolicy.issuedAt || priorCatalogue.expiresAt !== priorPolicy.expiresAt || sequence <= priorCatalogue.sequence) {
  throw Error('Prior signed metadata is inconsistent or sequence did not increase');
}
if (priorCatalogue.releases.length !== priorPolicy.apps.length || priorCatalogue.releases.some(release => !priorPolicy.apps.some(app => app.id === release.id))) {
  throw Error('Prior catalogue and update-policy identities differ');
}

const appRoot = path.resolve(import.meta.dirname, '../..', 'apps/dental-apps', appId);
const manifest = JSON.parse(readRegular(path.join(appRoot, 'app.manifest.json'), 65_536).toString('utf8'));
const appMetadata = JSON.parse(readRegular(path.join(appRoot, 'app.json'), 65_536).toString('utf8'));
if (manifest.appId !== appId || manifest.publisher !== 'company' || manifest.entry !== 'index.html' || manifest.sdkMajor !== 1 || manifest.apiMajor !== 1 || !Array.isArray(manifest.capabilities) || !manifest.capabilities.includes('clinic.api.request') || !manifest.capabilities.every(capability => stagingDistribution.policy.companyApps.capabilities.includes(capability))) {
  throw Error('Follow-ups package manifest exceeds the approved company capability ceiling');
}
if (appMetadata.appId !== appId || appMetadata.title !== 'Follow-ups' || appMetadata.modules?.length !== 1 || appMetadata.modules[0]?.id !== 'followups') throw Error('Unexpected Follow-ups app metadata');
const oldCatalogueRow = priorCatalogue.releases.find(release => release.id === appId);
const oldPolicyRow = priorPolicy.apps.find(app => app.id === appId);
if (!oldCatalogueRow || !oldPolicyRow || compareVersion(manifest.version, oldCatalogueRow.version) <= 0) throw Error('Follow-ups release must strictly increase its installed catalogue version');
if (priorCatalogue.releases.length > 16 || priorPolicy.apps.length > 16) throw Error('Signed staging app limit would be exceeded');

const files = collectFiles(path.join(appRoot, 'dist'));
if (!files.has(manifest.entry) || !files.has('app.json') || !files.has(appMetadata.icon)) throw Error('Follow-ups package is missing its entry, metadata, or icon');
const packageBytes = buildPackage(manifest, files, keyId, privateKey);
const verifiedPackage = verifyPackage(packageBytes, stagingDistribution.policy);
const packageSha256 = sha256(packageBytes), payloadDigest = verifiedPackage.release.digest;
const objectKey = `releases/${appId}/${manifest.version}/${packageSha256}.dentalpkg`;
const grant = { version: manifest.version, packageSha256, payloadDigest, apiOperations: ['clinic.api.request'] };

const release = {
  id: appId,
  title: appMetadata.title,
  description: appMetadata.description,
  version: manifest.version,
  notes: 'M17.1 Follow-ups functional app release.',
  capabilities: [...manifest.capabilities],
  platforms: ['linux', 'win32'],
  sdkMajor: 1,
  apiMajor: 1,
  objectKey,
  packageSha256,
  packageBytes: packageBytes.length,
  payloadDigest,
  status: 'approved',
  minimumVersion: oldCatalogueRow.minimumVersion,
};
const nextCatalogue = {
  format: 1,
  environment: 'cloudfare-staging',
  channel: 'staging',
  sequence,
  issuedAt: now,
  expiresAt: now + 86_400_000,
  releases: [...priorCatalogue.releases.filter(item => item.id !== appId), release],
};
const catalogueBytes = Buffer.from(canonical({
  catalogue: nextCatalogue,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId, catalogue: nextCatalogue })), privateKey).toString('base64'),
}));
verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now);

// Convert the legacy v1 policy without dropping current package-scoped API
// authority. Existing active API capabilities are bound to their exact current
// catalogue bytes before adding the Follow-ups 1.1.0 grant.
const nextApps = priorPolicy.apps.map(app => {
  const current = priorCatalogue.releases.find(releaseRow => releaseRow.id === app.id);
  if (!current) throw Error('Prior policy app is missing from the signed catalogue');
  const apiOps = current.capabilities.filter(operation => apiOperations.includes(operation) && app.capabilities.includes(operation));
  if (current.capabilities.some(operation => apiOperations.includes(operation) && !app.capabilities.includes(operation))) throw Error('Prior catalogue and policy API capabilities differ');
  const releases = apiOps.length ? [{ version: current.version, packageSha256: current.packageSha256, payloadDigest: current.payloadDigest, apiOperations: apiOps }] : [];
  return { ...app, releases };
});
const target = nextApps.find(app => app.id === appId);
if (!target || !target.capabilities.includes('clinic.api.request')) throw Error('Existing Follow-ups policy does not permit the required API request capability');
target.releases.push(grant);
if (target.releases.length > 3) throw Error('Follow-ups package-scoped grant limit would be exceeded');
const nextPolicy = { ...priorPolicy, format: 2, sequence, issuedAt: now, expiresAt: now + 86_400_000, apps: nextApps };
const policyBytes = Buffer.from(canonical({
  policy: nextPolicy,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId, policy: nextPolicy })), privateKey).toString('base64'),
}));
verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now);
if (!apiReleaseGrantForPackage(verifiedPackage, nextPolicy, now) || !apiReleaseGrantMatchesCatalogue(appId, grant, nextCatalogue)) throw Error('Exact Follow-ups API grant failed signed metadata verification');

function writeNew(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
}
fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const packagePath = path.join(output, objectKey);
writeNew(packagePath, packageBytes);
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
  releases: [{ id: appId, version: manifest.version, objectKey, packageSha256, packageBytes: packageBytes.length, payloadDigest }],
};
writeNew(path.join(output, 'publication.json'), Buffer.from(JSON.stringify(publication, null, 2) + '\n'));
writeNew(path.join(output, 'baseline/catalogue/staging.json'), priorCatalogueBytes);
writeNew(path.join(output, 'baseline/update-policy/staging.json'), priorPolicyBytes);
console.log(JSON.stringify({ prepared: true, appId, version: manifest.version, sequence, keyId, packageSha256, payloadDigest, packageBytes: packageBytes.length, assetCount: files.size, priorSequence: priorCatalogue.sequence, priorCatalogueSha256: publication.priorCatalogueSha256, priorPolicySha256: publication.priorPolicySha256, updatePolicyFormat: nextPolicy.format, exactApiOperations: grant.apiOperations, output }, null, 2));
