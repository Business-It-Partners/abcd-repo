// Prepare one signed staging catalogue containing one approved M13 app-shell batch.
// All package bytes, signatures and metadata remain local; publication is a separate operation.
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { appInfo, parseDentalAppMetadata } = require('../../dist-electron/packages/appMetadata.js');
const { buildPackage, canonical, parseCanonical, sha256, verifyPackage, limits } = require('../../dist-electron/packages/format.js');
const { maxStagingAppEntries, noWatermark, verifyCatalogue } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy } = require('../../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');

const EXPECTED_KEY_ID = 'company-staging-m08-20261016';
const RELEASE_BATCHES = {
  'm13-5-7': [
    { id: 'company.dental.treatment-progress', title: 'Treatment Progress', modules: ['Treatment Progress'] },
    { id: 'company.dental.lab-tracker', title: 'Lab Tracker', modules: ['Lab Tracker', 'Lab supplier record'] },
    { id: 'company.dental.finance', title: 'Finance', modules: ['Transaction Record', 'Patient payments', 'General expenses', 'Salary payments', 'Product list', 'Purchases', 'Supplier list', 'Supplier payments'] },
  ],
  'm13-8-10': [
    { id: 'company.dental.patient-payments', title: 'Patient payments', modules: ['Patient payments'] },
    { id: 'company.dental.staff', title: 'Staff', modules: ['Staff'] },
    { id: 'company.dental.treatment-protocols', title: 'Treatment Protocols', modules: ['Treatment Protocols'] },
  ],
  'm13-11': [
    { id: 'company.dental.calendar', title: 'Calendar', modules: ['Calendar'] },
  ],
};
const [guard, batchName, keyInput, rawSequence, outputInput, catalogueInput, policyInput] = process.argv.slice(2);
const APPS = RELEASE_BATCHES[batchName];
const sequence = Number(rawSequence);
if (guard !== '--staging-only' || process.argv.length !== 9 || !APPS || !Number.isSafeInteger(sequence) || sequence < 1) {
  throw new Error('Expected --staging-only <m13-5-7|m13-8-10|m13-11> <external-key> <increasing-sequence> <new-output> <prior-catalogue> <prior-policy>');
}

const checkout = path.resolve(import.meta.dirname, '../..');
const resolved = [keyInput, outputInput, catalogueInput, policyInput].map(value => path.resolve(value));
const [keyPath, output, cataloguePath, policyPath] = resolved;
function requireExternal(file) {
  const parent = fs.realpathSync(path.dirname(file));
  if (file === checkout || file.startsWith(checkout + path.sep) || parent === checkout || parent.startsWith(checkout + path.sep)) {
    throw new Error('Signing key, prior metadata and output must stay outside the source checkout');
  }
}
for (const file of resolved) requireExternal(file);
if (fs.existsSync(output)) throw new Error('Output directory must be new');

function readRegular(file, maxBytes = 65536) {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > maxBytes) throw new Error('Unsafe or oversized release input');
  return fs.readFileSync(file);
}
function readAppFile(appRoot, relative, maxBytes = limits.file) {
  const file = path.join(appRoot, relative), base = fs.realpathSync(appRoot), actual = fs.realpathSync(file);
  if (!actual.startsWith(base + path.sep)) throw new Error('App file escapes its app directory');
  return readRegular(actual, maxBytes);
}
function writeNew(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
}

const keyInfo = fs.lstatSync(keyPath);
if (!keyInfo.isFile() || keyInfo.isSymbolicLink() || keyInfo.nlink !== 1 || keyInfo.size > 4096 || process.platform !== 'win32' && (keyInfo.mode & 0o077) !== 0) {
  throw new Error('Unsafe staging signer input');
}
const privateKey = createPrivateKey(readRegular(keyPath, 4096));
const publicKey = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
const keyId = Object.keys(stagingDistribution.policy.keys).find(id => stagingDistribution.policy.keys[id].publicKey === publicKey);
if (keyId !== EXPECTED_KEY_ID) throw new Error('Signer is not the pinned M08 staging key');

const previousCatalogueBytes = readRegular(cataloguePath);
const previousPolicyBytes = readRegular(policyPath);
const previousCatalogueEnvelope = parseCanonical(previousCatalogueBytes);
const previousPolicyEnvelope = parseCanonical(previousPolicyBytes);
if (previousCatalogueEnvelope.keyId !== keyId || previousPolicyEnvelope.keyId !== keyId) throw new Error('Prior signed metadata must use the pinned staging key');
const previousCatalogue = verifyCatalogue(previousCatalogueBytes, stagingDistribution.policy, noWatermark, previousCatalogueEnvelope.catalogue?.issuedAt).catalogue;
const previousPolicy = verifyUpdatePolicy(previousPolicyBytes, stagingDistribution.policy, noWatermark, previousPolicyEnvelope.policy?.issuedAt).policy;
if (previousCatalogue.sequence !== previousPolicy.sequence || previousCatalogue.issuedAt !== previousPolicy.issuedAt || previousCatalogue.expiresAt !== previousPolicy.expiresAt || sequence <= previousCatalogue.sequence) {
  throw new Error('Prior signed metadata is inconsistent or release sequence did not increase');
}
if (previousCatalogue.releases.length !== previousPolicy.apps.length || previousCatalogue.releases.some(release => !previousPolicy.apps.some(app => app.id === release.id))) {
  throw new Error('Prior catalogue and update-policy identities differ');
}
if (previousCatalogue.releases.length + APPS.length > maxStagingAppEntries || previousPolicy.apps.length + APPS.length > maxStagingAppEntries) throw new Error('Staging app limit would be exceeded');
for (const app of APPS) {
  if (previousCatalogue.releases.some(release => release.id === app.id) || previousPolicy.apps.some(entry => entry.id === app.id)) {
    throw new Error(`App is already in staging; refusing to replace ${app.id}`);
  }
}

const releases = [];
const signedPackages = [];
for (const app of APPS) {
  const appRoot = path.join(checkout, 'apps/dental-apps', app.id);
  const input = JSON.parse(readAppFile(appRoot, 'app.manifest.json', 65536).toString('utf8'));
  const appMetadata = JSON.parse(readAppFile(appRoot, 'app.json', 65536).toString('utf8'));
  if (input.appId !== app.id || input.publisher !== 'company' || input.version !== '1.0.0' || input.entry !== 'src/index.html' || input.sdkMajor !== 1 || input.apiMajor !== 1 || JSON.stringify(input.capabilities) !== '[]') {
    throw new Error(`Invalid M13 package manifest for ${app.id}`);
  }
  if (appMetadata.appId !== app.id || appMetadata.title !== app.title || JSON.stringify(appMetadata.modules?.map(module => module.label)) !== JSON.stringify(app.modules)) {
    throw new Error(`Invalid M13 app metadata for ${app.id}`);
  }
  const files = new Map([
    [input.entry, readAppFile(appRoot, input.entry)],
    ['src/app.css', readAppFile(appRoot, 'src/app.css')],
    ['app.json', readAppFile(appRoot, 'app.json', 65536)],
    [appMetadata.icon, readAppFile(appRoot, appMetadata.icon)],
  ]);
  const appScript = path.join(appRoot, 'src/app.js');
  if (fs.existsSync(appScript)) files.set('src/app.js', readAppFile(appRoot, 'src/app.js'));
  const packageBytes = buildPackage(input, files, keyId, privateKey);
  const verified = verifyPackage(packageBytes, stagingDistribution.policy);
  const trustedMetadata = parseDentalAppMetadata(verified);
  const validationRole = app.id === 'company.dental.patient-payments' ? 'reception' : 'admin';
  if (!trustedMetadata || !appInfo(verified, trustedMetadata, validationRole, trustedMetadata.modules.map(module => module.capability))) {
    throw new Error(`Signed app metadata failed OS validation for ${app.id}`);
  }
  const digest = sha256(packageBytes);
  const objectKey = `releases/${app.id}/1.0.0/${digest}.dentalpkg`;
  const release = {
    id: app.id,
    title: app.title,
    description: appMetadata.description,
    version: '1.0.0',
    notes: 'M13 version 1.0.0 staging preview shell.',
    capabilities: [],
    platforms: ['linux', 'win32'],
    sdkMajor: 1,
    apiMajor: 1,
    objectKey,
    packageSha256: digest,
    packageBytes: packageBytes.length,
    payloadDigest: verified.release.digest,
    status: 'approved',
    minimumVersion: '1.0.0',
  };
  releases.push(release);
  signedPackages.push({ objectKey, bytes: packageBytes });
}

const issuedAt = Date.now();
const expiresAt = issuedAt + 86400000;
const catalogue = {
  format: 1,
  environment: 'cloudfare-staging',
  channel: 'staging',
  sequence,
  issuedAt,
  expiresAt,
  releases: [...previousCatalogue.releases, ...releases],
};
const catalogueBytes = Buffer.from(canonical({
  catalogue,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId, catalogue })), privateKey).toString('base64'),
}));
verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, issuedAt);

const apps = [...previousPolicy.apps, ...releases.map(release => ({
  id: release.id,
  capabilities: [],
  minimumVersion: '1.0.0',
  revokedDigests: [],
  rollback: null,
}))];
const policy = { ...previousPolicy, sequence, issuedAt, expiresAt, apps };
const policyBytes = Buffer.from(canonical({
  policy,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId, policy })), privateKey).toString('base64'),
}));
verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, issuedAt);

fs.mkdirSync(output, { mode: 0o700 });
for (const item of signedPackages) writeNew(path.join(output, item.objectKey), item.bytes);
writeNew(path.join(output, 'catalogue/staging.json'), catalogueBytes);
writeNew(path.join(output, 'update-policy/staging.json'), policyBytes);
writeNew(path.join(output, 'publication.json'), Buffer.from(JSON.stringify({
  environment: 'cloudfare-staging',
  bucket: 'dentmitra-dental-os-releases-cloudfare-staging',
  batch: batchName,
  sequence,
  expiresAt,
  catalogueSha256: sha256(catalogueBytes),
  updatePolicySha256: sha256(policyBytes),
  releases: releases.map(({ id, version, objectKey, packageSha256, packageBytes }) => ({ id, version, objectKey, packageSha256, packageBytes })),
}, null, 2) + '\n'));
console.log(`Prepared ${releases.length} signed M13 staging packages for ${batchName} at sequence ${sequence}; prior signed entries were retained.`);
