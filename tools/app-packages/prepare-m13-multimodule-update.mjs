// Prepare a signed staging patch for the shared multi-module window contract.
// Package bytes and signatures stay outside the checkout; publication is separate.
import fs from 'node:fs';
import path from 'node:path';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { appInfo, parseDentalAppMetadata } = require('../../dist-electron/packages/appMetadata.js');
const { buildPackage, canonical, parseCanonical, sha256, verifyPackage, limits } = require('../../dist-electron/packages/format.js');
const { noWatermark, verifyCatalogue } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy } = require('../../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');

const EXPECTED_KEY_ID = 'company-staging-m08-20261016';
const APPS = [
  { id: 'company.dental.finance', title: 'Finance', version: '1.0.1', modules: ['Transaction Record', 'Patient payments', 'General expenses', 'Salary payments', 'Product list', 'Purchases', 'Supplier list', 'Supplier payments'] },
  { id: 'company.dental.lab-tracker', title: 'Lab Tracker', version: '1.0.1', modules: ['Lab Tracker', 'Lab supplier record'] },
];
const [guard, keyInput, rawSequence, outputInput, catalogueInput, policyInput] = process.argv.slice(2);
const sequence = Number(rawSequence);
if (guard !== '--staging-only' || process.argv.length !== 8 || !Number.isSafeInteger(sequence) || sequence < 1) {
  throw new Error('Expected --staging-only <external-key> <increasing-sequence> <new-output> <prior-catalogue.json> <prior-update-policy.json>');
}

const checkout = path.resolve(import.meta.dirname, '../..');
const [keyPath, output, cataloguePath, policyPath] = [keyInput, outputInput, catalogueInput, policyInput].map(value => path.resolve(value));
function requireExternal(file) {
  const parent = fs.realpathSync(path.dirname(file));
  if (file === checkout || file.startsWith(checkout + path.sep) || parent === checkout || parent.startsWith(checkout + path.sep)) {
    throw new Error('Signing key, prior metadata and output must stay outside the source checkout');
  }
}
for (const file of [keyPath, output, cataloguePath, policyPath]) requireExternal(file);
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

const releaseUpdates = new Map();
const signedPackages = [];
for (const app of APPS) {
  const prior = previousCatalogue.releases.filter(release => release.id === app.id);
  const policyEntries = previousPolicy.apps.filter(entry => entry.id === app.id);
  if (prior.length !== 1 || prior[0].version !== '1.0.0' || policyEntries.length !== 1) throw new Error(`Expected one published 1.0.0 entry for ${app.id}`);
  const appRoot = path.join(checkout, 'apps/dental-apps', app.id);
  const input = JSON.parse(readAppFile(appRoot, 'app.manifest.json', 65536).toString('utf8'));
  const packageJson = JSON.parse(readAppFile(appRoot, 'package.json', 65536).toString('utf8'));
  const appMetadata = JSON.parse(readAppFile(appRoot, 'app.json', 65536).toString('utf8'));
  if (packageJson.version !== app.version || input.appId !== app.id || input.publisher !== 'company' || input.version !== app.version || input.entry !== 'src/index.html' || input.sdkMajor !== 1 || input.apiMajor !== 1 || JSON.stringify(input.capabilities) !== '[]') {
    throw new Error(`Invalid patch package manifest for ${app.id}`);
  }
  if (appMetadata.appId !== app.id || appMetadata.title !== app.title || JSON.stringify(appMetadata.modules?.map(module => module.label)) !== JSON.stringify(app.modules)) {
    throw new Error(`Invalid module metadata for ${app.id}`);
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
  if (!trustedMetadata || !appInfo(verified, trustedMetadata, 'admin', trustedMetadata.modules.map(module => module.capability))) {
    throw new Error(`Signed app metadata failed OS validation for ${app.id}`);
  }
  const digest = sha256(packageBytes);
  const objectKey = `releases/${app.id}/${app.version}/${digest}.dentalpkg`;
  const release = {
    ...prior[0],
    version: app.version,
    notes: 'M13 shared multi-module window contract update.',
    objectKey,
    packageSha256: digest,
    packageBytes: packageBytes.length,
    payloadDigest: verified.release.digest,
    status: 'approved',
  };
  releaseUpdates.set(app.id, release);
  signedPackages.push({ objectKey, bytes: packageBytes });
}

const issuedAt = Date.now();
const expiresAt = issuedAt + 86400000;
const catalogue = {
  ...previousCatalogue,
  sequence,
  issuedAt,
  expiresAt,
  releases: previousCatalogue.releases.map(release => releaseUpdates.get(release.id) ?? release),
};
const catalogueBytes = Buffer.from(canonical({
  catalogue,
  keyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId, catalogue })), privateKey).toString('base64'),
}));
verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, issuedAt);

const policy = { ...previousPolicy, sequence, issuedAt, expiresAt };
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
  batch: 'm13-multimodule-ui-contract-update',
  sequence,
  expiresAt,
  catalogueSha256: sha256(catalogueBytes),
  updatePolicySha256: sha256(policyBytes),
  releases: [...releaseUpdates.values()].map(({ id, version, objectKey, packageSha256, packageBytes }) => ({ id, version, objectKey, packageSha256, packageBytes })),
}, null, 2) + '\n'));
console.log(`Prepared ${releaseUpdates.size} signed M13 shared-window updates at sequence ${sequence}; all other release and policy entries were preserved.`);
