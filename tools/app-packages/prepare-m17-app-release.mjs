// Prepare one M17 app first release or immutable version update locally. Never uploads or activates it.
// node tools/app-packages/prepare-m17-app-release.mjs --staging-only <external-m17-key> <higher-sequence> <m17-app-id> <new-output-dir> <prior-catalogue> <prior-update-policy> [--retire-finance-1.7.0]
import fs from 'node:fs';
import path from 'node:path';
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  buildPackage, canonical, parseCanonical, sha256, verifyPackage, limits, maxCompanyAppCount,
} = require('../../dist-electron/packages/format.js');
const { compareVersion: compareVersionStrings, noWatermark, verifyCatalogue } = require('../../dist-electron/distribution/catalogue.js');
const {
  verifyUpdatePolicy, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue,
} = require('../../dist-electron/distribution/updatePolicy.js');
const { apiOperations } = require('../../dist-electron/sdk/contracts.js');
const { stagingDistribution, m17StagingKeyId } = require('../../dist-electron/distribution/staging.js');

const M17_FINGERPRINT = 'e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709';
// Keep this release-window limit aligned with updatePolicy.ts. Older package signatures remain immutable,
// but only the newest seven exact-release API grants can stay active in the signed policy.
const maxRetainedReleaseGrants = 7;
const definitions = {
  'company.dental.followups.m17': { title: 'Follow-ups', moduleIds: ['followups'], family: 'clinic.app.followups' },
  'company.dental.work-entry.m17': { title: 'Work Entry', moduleIds: ['work-entry'], family: 'clinic.app.work-entry' },
  'company.dental.patient-record.m17': { title: 'Patient Record', moduleIds: ['patient-record'], family: 'clinic.app.patient-record' },
  'company.dental.m17.treatment-protocols': { title: 'Treatment Protocols', moduleIds: ['treatment-protocols'], family: 'clinic.app.treatment-protocols' },
  'company.dental.appointments.m17': { title: 'Appointments', moduleIds: ['appointments'], family: 'clinic.app.appointments' },
  'company.dental.calendar.m17': { title: 'Calendar', moduleIds: ['calendar'], family: 'clinic.app.calendar' },
  'company.dental.treatment-progress.m17': { title: 'Treatment Progress', moduleIds: ['treatment-progress'], family: 'clinic.app.treatment-progress' },
  'company.dental.finance.m17': {
    title: 'Finance',
    moduleIds: ['transaction-record', 'patient-payments', 'general-expenses', 'salary-payments', 'product-list', 'purchases', 'supplier-list', 'supplier-payments'],
    family: 'clinic.app.finance',
    initialVersion: '1.7.0',
  },
  'company.dental.lab-tracker.m17': { title: 'Lab Tracker', moduleIds: ['lab-tracker', 'lab-suppliers'], family: 'clinic.app.lab-tracker' },
  'company.dental.staff.m17': { title: 'Staff', moduleIds: ['staff'], family: 'clinic.app.staff' },
};
const [guard, keyInput, rawSequence, appId, outputInput, catalogueInput, policyInput, retirementMode] = process.argv.slice(2);
const sequence = Number(rawSequence);
const retireFinance170 = retirementMode === '--retire-finance-1.7.0';
if (guard !== '--staging-only' || process.argv.length !== (retirementMode ? 10 : 9)
  || retirementMode && !retireFinance170 || !Number.isSafeInteger(sequence) || sequence < 1 || !definitions[appId]) {
  throw Error('Expected --staging-only <external-m17-key> <higher-sequence> <m17-app-id> <new-output-dir> <prior-catalogue> <prior-update-policy> [--retire-finance-1.7.0]');
}

const checkout = path.resolve(import.meta.dirname, '../..');
const [keyPath, output, cataloguePath, policyPath] = [keyInput, outputInput, catalogueInput, policyInput].map(value => path.resolve(value));
function requireExternal(file) {
  const resolved = path.resolve(file);
  const parent = fs.realpathSync(path.dirname(resolved));
  if (resolved === checkout || resolved.startsWith(checkout + path.sep) || parent === checkout || parent.startsWith(checkout + path.sep)) {
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
    const relative = path.posix.join(prefix, item.name);
    const full = path.join(directory, relative);
    const info = fs.lstatSync(full);
    if (info.isSymbolicLink()) throw Error('App package cannot contain symbolic links');
    if (item.isDirectory()) {
      for (const [name, bytes] of collectFiles(directory, relative)) files.set(name, bytes);
    } else if (info.isFile()) {
      files.set(relative, readRegular(full, limits.file));
    } else {
      throw Error('Unsupported app package file');
    }
  }
  return files;
}
function writeNew(file, bytes) {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  fs.writeFileSync(file, bytes, { flag: 'wx', mode: 0o600 });
}
function signerKeyId(envelope, kind) {
  if (!envelope || typeof envelope.keyId !== 'string' || !Object.hasOwn(stagingDistribution.policy.keys, envelope.keyId)) {
    throw Error('Prior ' + kind + ' signer is not pinned');
  }
  return envelope.keyId;
}

const keyInfo = fs.lstatSync(keyPath);
if (!keyInfo.isFile() || keyInfo.isSymbolicLink() || keyInfo.nlink !== 1 || keyInfo.size > 4096
  || process.platform !== 'win32' && (keyInfo.mode & 0o077) !== 0) {
  throw Error('Unsafe M17 staging signer input');
}
const privateKey = createPrivateKey(readRegular(keyPath, 4096));
const publicKey = createPublicKey(privateKey);
const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const fingerprint = createHash('sha256').update(publicKey.export({ type: 'spki', format: 'der' })).digest('hex');
if (fingerprint !== M17_FINGERPRINT || publicPem !== stagingDistribution.policy.keys[m17StagingKeyId]?.publicKey) {
  throw Error('Signer does not match the pinned M17 key ID and fingerprint');
}

const priorCatalogueBytes = readRegular(cataloguePath, 65_536);
const priorPolicyBytes = readRegular(policyPath, 65_536);
const priorCatalogueEnvelope = parseCanonical(priorCatalogueBytes);
const priorPolicyEnvelope = parseCanonical(priorPolicyBytes);
const priorCatalogueKeyId = signerKeyId(priorCatalogueEnvelope, 'catalogue');
const priorPolicyKeyId = signerKeyId(priorPolicyEnvelope, 'update policy');
const now = Date.now();
const priorCatalogue = verifyCatalogue(priorCatalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
const priorPolicy = verifyUpdatePolicy(priorPolicyBytes, stagingDistribution.policy, noWatermark, now).policy;
if (priorCatalogue.sequence !== priorPolicy.sequence || priorCatalogue.issuedAt !== priorPolicy.issuedAt
  || priorCatalogue.expiresAt !== priorPolicy.expiresAt || sequence <= priorCatalogue.sequence || sequence <= priorPolicy.sequence) {
  throw Error('Prior signed metadata is inconsistent, stale, or sequence did not increase');
}

const catalogueIds = priorCatalogue.releases.map(release => release.id);
const policyIds = priorPolicy.apps.map(app => app.id);
if (new Set(catalogueIds).size !== catalogueIds.length || new Set(policyIds).size !== policyIds.length
  || catalogueIds.length !== policyIds.length || catalogueIds.some(id => !policyIds.includes(id))
  || policyIds.some(id => !catalogueIds.includes(id))) {
  throw Error('Prior catalogue and update-policy identities differ');
}
const priorRelease = priorCatalogue.releases.find(release => release.id === appId);
const priorAppPolicy = priorPolicy.apps.find(app => app.id === appId);
if (Boolean(priorRelease) !== Boolean(priorAppPolicy)) throw Error('Existing M17 catalogue and update-policy identity do not match');
if (!priorRelease && (priorCatalogue.releases.length >= maxCompanyAppCount || priorPolicy.apps.length >= maxCompanyAppCount)) throw Error('Signed staging app limit would be exceeded');
if (priorPolicy.revokedKeys.includes(m17StagingKeyId)) throw Error('M17 staging signer is revoked');

const checkoutRoot = path.resolve(import.meta.dirname, '../..');
const appRoot = path.join(checkoutRoot, 'apps/dental-apps', appId);
const definition = definitions[appId];
const initialVersion = definition.initialVersion ?? '1.0.0';
const packageMetadata = JSON.parse(readRegular(path.join(appRoot, 'package.json'), 65_536).toString('utf8'));
const manifest = JSON.parse(readRegular(path.join(appRoot, 'app.manifest.json'), 65_536).toString('utf8'));
const appMetadata = JSON.parse(readRegular(path.join(appRoot, 'app.json'), 65_536).toString('utf8'));
const expectedModuleIds = definition.moduleIds;
const version = packageMetadata.version;
const parseVersion = value => {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(value ?? '');
  return match ? match.slice(1).map(Number) : null;
};
const compareVersion = (left, right) => {
  for (let i = 0; i < 3; i++) if (left[i] !== right[i]) return left[i] - right[i];
  return 0;
};
const parsedVersion = parseVersion(version);
const previousVersion = priorRelease?.version ?? null;
const parsedPreviousVersion = previousVersion ? parseVersion(previousVersion) : null;
const releaseKind = priorRelease ? 'update' : 'new';
const retiredVersions = retireFinance170 ? ['1.7.0'] : [];
if (retireFinance170 && (appId !== 'company.dental.finance.m17' || version !== '1.7.7'
  || previousVersion !== '1.7.6' || priorRelease?.minimumVersion !== '1.7.0'
  || priorAppPolicy?.minimumVersion !== '1.7.0'
  || !priorAppPolicy.releases.some(entry => entry.version === '1.7.0')
  || priorAppPolicy.releases.length !== 7
  || !priorAppPolicy.releases.some(entry => entry.version === previousVersion))) {
  throw Error('The scoped Finance 1.7.0 retirement does not match the reviewed sequence-84 release state');
}
const minimumVersion = retireFinance170 ? '1.7.1' : priorRelease?.minimumVersion ?? initialVersion;
if (!parsedVersion || packageMetadata.name !== appId || manifest.appId !== appId || manifest.publisher !== 'company' || manifest.version !== version
  || manifest.entry !== 'index.html' || manifest.sdkMajor !== 1 || manifest.apiMajor !== 1
  || !Array.isArray(manifest.capabilities) || !manifest.capabilities.includes('clinic.api.request')
  || manifest.capabilities.filter(capability => typeof capability === 'string' && capability.startsWith('clinic.app.')).join() !== definition.family
  || !manifest.capabilities.every(capability => stagingDistribution.policy.companyApps.capabilities.includes(capability))) {
  throw Error('M17 manifest exceeds approved company capability ceiling or has an unexpected identity');
}
if (releaseKind === 'new' && version !== initialVersion) throw Error('A new M17 app identity must start at its configured first release version');
if (releaseKind === 'update' && (!parsedPreviousVersion || compareVersion(parsedVersion, parsedPreviousVersion) <= 0)) {
  throw Error('M17 update version must be greater than the currently published app version');
}
if (appMetadata.appId !== appId || appMetadata.title !== definition.title
  || !Array.isArray(appMetadata.modules)
  || JSON.stringify(appMetadata.modules.map(module => module?.id)) !== JSON.stringify(expectedModuleIds)) {
  throw Error('Unexpected M17 app metadata');
}
if (releaseKind === 'update') {
  if (!priorAppPolicy.capabilities.every(value => manifest.capabilities.includes(value))
    || !manifest.capabilities.every(value => priorAppPolicy.capabilities.includes(value))) throw Error('M17 app update cannot change its signed capability grants');
  const priorGrant = priorAppPolicy.releases?.find(entry => entry.version === priorRelease.version);
  if (priorPolicy.format === 2 && (!priorGrant || priorGrant.packageSha256 !== priorRelease.packageSha256
    || priorGrant.payloadDigest !== priorRelease.payloadDigest)) throw Error('Current package grant does not match the signed prior catalogue');
  if (priorAppPolicy.revokedDigests.includes(priorRelease.payloadDigest)) throw Error('Current M17 package is revoked and cannot receive an update');
}

const files = collectFiles(path.join(appRoot, 'dist'));
if (!files.has(manifest.entry) || !files.has('app.json') || !files.has(appMetadata.icon)) throw Error('M17 package is missing entry, metadata, or icon');
const artworkBytes = files.get(appMetadata.icon);
const pngMagic = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
if (!appMetadata.icon.endsWith('.png') || artworkBytes.length < 8 || artworkBytes.length > 2 * 1024 * 1024 || !artworkBytes.subarray(0, 8).equals(pngMagic)) {
  throw Error('M17 Store artwork must be a bounded PNG from the signed app package');
}
const artworkSha256 = sha256(artworkBytes);
const artworkObjectKey = `artwork/${appId}/${version}/${artworkSha256}.png`;
const packageBytes = buildPackage(manifest, files, m17StagingKeyId, privateKey);
const verifiedPackage = verifyPackage(packageBytes, stagingDistribution.policy);
if (verifiedPackage.release.keyId !== m17StagingKeyId || verifiedPackage.manifest.appId !== appId || verifiedPackage.manifest.version !== version) {
  throw Error('M17 signed package identity verification failed');
}
const packageSha256 = sha256(packageBytes);
const payloadDigest = verifiedPackage.release.digest;
const objectKey = 'releases/' + appId + '/' + version + '/' + packageSha256 + '.dentalpkg';
const apiOps = manifest.capabilities.filter(operation => apiOperations.includes(operation));
if (!apiOps.length) throw Error('M17 app has no package-bound API operations');
const grant = { version, packageSha256, payloadDigest, apiOperations: apiOps };
const release = {
  id: appId,
  title: appMetadata.title,
  description: appMetadata.description,
  version,
  notes: releaseKind === 'new' ? 'M17 first-party ' + definition.title + ' package.' : 'M17 ' + definition.title + ' app update.',
  capabilities: [...manifest.capabilities],
  platforms: ['linux', 'win32'],
  sdkMajor: 1,
  apiMajor: 1,
  objectKey,
  packageSha256,
  packageBytes: packageBytes.length,
  payloadDigest,
  status: 'approved',
  minimumVersion,
  icon: { objectKey: artworkObjectKey, sha256: artworkSha256, bytes: artworkBytes.length, mime: 'image/png' },
};
const catalogueReleases = priorRelease
  ? priorCatalogue.releases.map(row => row.id === appId ? release : row)
  : [...priorCatalogue.releases, release];
const nextCatalogue = {
  format: 1,
  environment: 'cloudfare-staging',
  channel: 'staging',
  sequence,
  issuedAt: now,
  expiresAt: now + 86_400_000,
  releases: catalogueReleases,
};
const catalogueBytes = Buffer.from(canonical({
  catalogue: nextCatalogue,
  keyId: m17StagingKeyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId: m17StagingKeyId, catalogue: nextCatalogue })), privateKey).toString('base64'),
}));
verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now);

let nextApps;
let retiredReleaseGrants = [];
if (priorPolicy.format === 2) {
  nextApps = priorPolicy.apps.map(app => ({ ...app, releases: app.releases.map(entry => ({ ...entry, apiOperations: [...entry.apiOperations] })) }));
} else {
  nextApps = priorPolicy.apps.map(app => {
    const current = priorCatalogue.releases.find(releaseRow => releaseRow.id === app.id);
    if (!current) throw Error('Prior policy app is missing from the signed catalogue');
    const currentApiOps = current.capabilities.filter(operation => apiOperations.includes(operation) && app.capabilities.includes(operation));
    if (current.capabilities.some(operation => apiOperations.includes(operation) && !app.capabilities.includes(operation))) {
      throw Error('Prior catalogue and policy API capabilities differ');
    }
    const releases = currentApiOps.length
      ? [{ version: current.version, packageSha256: current.packageSha256, payloadDigest: current.payloadDigest, apiOperations: currentApiOps }]
      : [];
    return { ...app, releases };
  });
}
if (priorAppPolicy) {
  const target = nextApps.find(app => app.id === appId);
  if (!target) throw Error('Existing M17 update-policy app disappeared');
  if (target.releases.some(entry => entry.version === version || entry.packageSha256 === packageSha256)) {
    throw Error('M17 update version or package digest already exists in signed update policy');
  }
  if (retireFinance170) {
    target.releases = target.releases.filter(entry => !retiredVersions.includes(entry.version));
    target.minimumVersion = minimumVersion;
  }
  target.releases.push(grant);
  target.releases.sort((left, right) => compareVersionStrings(left.version, right.version));
  if (target.releases.length > maxRetainedReleaseGrants) {
    retiredReleaseGrants = target.releases.splice(0, target.releases.length - maxRetainedReleaseGrants);
    if (target.rollback && retiredReleaseGrants.some(entry => [target.rollback.from, target.rollback.to].includes(entry.payloadDigest))) {
      throw Error('Cannot retire a release grant referenced by rollback policy');
    }
  }
} else {
  nextApps.push({
    id: appId,
    capabilities: [...manifest.capabilities],
    minimumVersion: initialVersion,
    revokedDigests: [],
    rollback: null,
    releases: [grant],
  });
}
if (nextApps.length > maxCompanyAppCount) throw Error('Signed staging app limit would be exceeded');
const nextPolicy = {
  ...priorPolicy,
  format: 2,
  sequence,
  issuedAt: now,
  expiresAt: now + 86_400_000,
  apps: nextApps,
};
const policyBytes = Buffer.from(canonical({
  policy: nextPolicy,
  keyId: m17StagingKeyId,
  signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId: m17StagingKeyId, policy: nextPolicy })), privateKey).toString('base64'),
}));
verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now);
if (!apiReleaseGrantForPackage(verifiedPackage, nextPolicy, now)
  || !apiReleaseGrantMatchesCatalogue(appId, grant, nextCatalogue)) {
  throw Error('Exact M17 API grant failed signed metadata verification');
}

fs.mkdirSync(output, { recursive: true, mode: 0o700 });
const packagePath = path.join(output, objectKey);
writeNew(packagePath, packageBytes);
writeNew(path.join(output, 'catalogue/staging.json'), catalogueBytes);
writeNew(path.join(output, 'update-policy/staging.json'), policyBytes);
writeNew(path.join(output, 'baseline/catalogue/staging.json'), priorCatalogueBytes);
writeNew(path.join(output, 'baseline/update-policy/staging.json'), priorPolicyBytes);
writeNew(path.join(output, 'artwork.png'), artworkBytes);
const releaseInfo = {
  environment: 'cloudfare-staging',
  localOnly: true,
  uploaded: false,
  published: false,
  activated: false,
  deployed: false,
  sequence,
  priorSequence: priorCatalogue.sequence,
  priorCatalogueKeyId,
  priorUpdatePolicyKeyId: priorPolicyKeyId,
  keyId: m17StagingKeyId,
  publicKeySha256: fingerprint,
  appId,
  releaseKind,
  previousVersion,
  previousPackageSha256: priorRelease?.packageSha256 ?? null,
  version,
  minimumVersion,
  retiredVersions,
  objectKey,
  packageSha256,
  packageBytes: packageBytes.length,
  payloadDigest,
  artworkObjectKey,
  artworkSha256,
  artworkBytes: artworkBytes.length,
  catalogueSha256: sha256(catalogueBytes),
  updatePolicySha256: sha256(policyBytes),
  priorCatalogueSha256: sha256(priorCatalogueBytes),
  priorUpdatePolicySha256: sha256(priorPolicyBytes),
  updatePolicyFormat: nextPolicy.format,
  exactApiOperations: grant.apiOperations,
  retiredReleaseGrants,
};
writeNew(path.join(output, 'release.json'), Buffer.from(JSON.stringify(releaseInfo, null, 2) + '\n'));
console.log(JSON.stringify({ prepared: true, ...releaseInfo, assetCount: files.size, output }, null, 2));
