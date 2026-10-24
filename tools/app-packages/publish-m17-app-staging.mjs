// Publish one prepared M17 app release to Cloudflare staging.
// Uses a short-lived, nonce-protected Worker and conditional R2 writes. Never targets production.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const [guard, inputDir, backendRootInput] = process.argv.slice(2);
if (!['--validate-staging-only', '--apply-staging-only'].includes(guard) || process.argv.length !== 5 || !inputDir || !backendRootInput) {
  throw Error('Expected --validate-staging-only or --apply-staging-only <prepared-release-dir> <existing-wrangler-runtime-root>');
}

const require = createRequire(import.meta.url);
const { canonical, sha256, verifyPackage, parseCanonical } = require('../../dist-electron/packages/format.js');
const { verifyCatalogue, noWatermark } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution, m17StagingKeyId } = require('../../dist-electron/distribution/staging.js');
const { apiOperations } = require('../../dist-electron/sdk/contracts.js');
const root = path.resolve(inputDir);
const backendRoot = path.resolve(backendRootInput);
const checkout = path.resolve(import.meta.dirname, '../..');
const external = value => value !== checkout && !value.startsWith(checkout + path.sep);
if (!external(root) || !external(backendRoot)) throw Error('Prepared material and Wrangler runtime must remain outside the active checkout');
const rootInfo = fs.lstatSync(root);
if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || process.platform !== 'win32' && (rootInfo.mode & 0o077) !== 0) {
  throw Error('Prepared release directory must be private and non-symlinked');
}
if (stagingDistribution.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev'
  || stagingDistribution.publicBase !== 'https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev') throw Error('Pinned staging distribution fence');

const definitions = {
  'company.dental.followups.m17': { title: 'Follow-ups' },
  'company.dental.work-entry.m17': { title: 'Work Entry' },
  'company.dental.patient-record.m17': { title: 'Patient Record' },
  'company.dental.m17.treatment-protocols': { title: 'Treatment Protocols' },
  'company.dental.appointments.m17': { title: 'Appointments' },
  'company.dental.calendar.m17': { title: 'Calendar' },
  'company.dental.treatment-progress.m17': { title: 'Treatment Progress' },
  'company.dental.finance.m17': { title: 'Finance', initialVersion: '1.7.0' },
  'company.dental.lab-tracker.m17': { title: 'Lab Tracker' },
  'company.dental.staff.m17': { title: 'Staff' },
};
function read(name, max = 2_097_152) {
  const file = path.join(root, name), info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > max) throw Error(`Invalid prepared file: ${name}`);
  return fs.readFileSync(file);
}
const release = JSON.parse(read('release.json', 65_536).toString('utf8'));
const appId = release.appId;
const expectedInitialVersion = definitions[appId]?.initialVersion ?? '1.0.0';
const versionParts = typeof release.version === 'string' ? /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.exec(release.version) : null;
if (!Object.hasOwn(definitions, appId) || release.environment !== 'cloudfare-staging' || release.localOnly !== true
  || release.keyId !== m17StagingKeyId || release.publicKeySha256 !== 'e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709'
  || !versionParts || !['new', 'update'].includes(release.releaseKind)
  || release.uploaded !== false || release.published !== false || release.activated !== false || release.deployed !== false) {
  throw Error('Wrong M17 release identity, version, signer, or local-only release state');
}
if (!/^[a-f0-9]{64}$/.test(release.packageSha256)
  || release.objectKey !== `releases/${appId}/${release.version}/${release.packageSha256}.dentalpkg`) {
  throw Error('Unexpected package object key or release scope');
}
const packageBytes = read(release.objectKey);
const artworkBytes = read('artwork.png', 2_097_152);
const catalogueBytes = read('catalogue/staging.json', 65_536);
const policyBytes = read('update-policy/staging.json', 65_536);
const priorCatalogueBytes = read('baseline/catalogue/staging.json', 65_536);
const priorPolicyBytes = read('baseline/update-policy/staging.json', 65_536);
for (const [bytes, expected, name] of [
  [packageBytes, release.packageSha256, 'package'], [catalogueBytes, release.catalogueSha256, 'catalogue'],
  [policyBytes, release.updatePolicySha256, 'update policy'], [priorCatalogueBytes, release.priorCatalogueSha256, 'prior catalogue'],
  [priorPolicyBytes, release.priorUpdatePolicySha256, 'prior update policy'],
]) if (sha256(bytes) !== expected) throw Error(`${name} bytes changed after package preparation`);
if (!/^[a-f0-9]{64}$/.test(release.artworkSha256) || !Number.isSafeInteger(release.artworkBytes)
  || release.artworkBytes !== artworkBytes.length || release.artworkBytes < 8 || release.artworkBytes > 2 * 1024 * 1024
  || !artworkBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  || sha256(artworkBytes) !== release.artworkSha256
  || release.artworkObjectKey !== `artwork/${appId}/${release.version}/${release.artworkSha256}.png`) {
  throw Error('Unexpected app artwork bytes or object key');
}

const now = Date.now();
const priorCatalogueEnvelope = parseCanonical(priorCatalogueBytes);
const priorPolicyEnvelope = parseCanonical(priorPolicyBytes);
if (priorCatalogueEnvelope.keyId !== release.priorCatalogueKeyId || priorPolicyEnvelope.keyId !== release.priorUpdatePolicyKeyId) {
  throw Error('Prior metadata signer identity changed after preparation');
}
const priorCatalogue = verifyCatalogue(priorCatalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
const priorPolicy = verifyUpdatePolicy(priorPolicyBytes, stagingDistribution.policy, noWatermark, now).policy;
const catalogueEnvelope = parseCanonical(catalogueBytes);
const policyEnvelope = parseCanonical(policyBytes);
const catalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
const policy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy;
const verifiedPackage = verifyPackage(packageBytes, stagingDistribution.policy);
const releaseRow = catalogue.releases.find(row => row.id === appId);
const appPolicy = policy.apps.find(row => row.id === appId);
const grant = appPolicy?.releases?.find(row => row.version === release.version);
const priorReleaseRow = priorCatalogue.releases.find(row => row.id === appId);
const priorAppPolicy = priorPolicy.apps.find(row => row.id === appId);
const priorCurrentGrant = priorReleaseRow && priorAppPolicy?.releases?.find(row => row.version === priorReleaseRow.version);
const packageInfo = verifiedPackage.manifest;
const artworkRef = releaseRow?.icon;
if (!artworkRef || artworkRef.objectKey !== release.artworkObjectKey || artworkRef.sha256 !== release.artworkSha256
  || artworkRef.bytes !== release.artworkBytes || artworkRef.mime !== 'image/png') throw Error('Signed artwork metadata does not match prepared artwork bytes');
const versionIsNewer = (next, prior) => {
  const a = next.split('.').map(Number), b = prior.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] > b[i];
  return false;
};
const updateShapeValid = release.releaseKind === 'new'
  ? !priorReleaseRow && !priorAppPolicy && release.version === expectedInitialVersion
    && catalogue.releases.length === priorCatalogue.releases.length + 1 && policy.apps.length === priorPolicy.apps.length + 1
  : !!priorReleaseRow && !!priorAppPolicy && priorReleaseRow.version === release.previousVersion
    && priorReleaseRow.packageSha256 === release.previousPackageSha256
    && versionIsNewer(release.version, release.previousVersion)
    && !!priorCurrentGrant && priorCurrentGrant.packageSha256 === priorReleaseRow.packageSha256
    && priorCurrentGrant.payloadDigest === priorReleaseRow.payloadDigest
    && !priorAppPolicy.revokedDigests.includes(priorReleaseRow.payloadDigest)
    && catalogue.releases.length === priorCatalogue.releases.length && policy.apps.length === priorPolicy.apps.length;
const maxRetainedReleaseGrants = 7;
const compareVersion = (left, right) => {
  const a = left.split('.').map(Number), b = right.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
};
const legacyCurrentApiOperations = priorPolicy.format === 1 && priorReleaseRow
  ? priorReleaseRow.capabilities.filter(operation => apiOperations.includes(operation) && priorAppPolicy?.capabilities.includes(operation))
  : [];
const legacyCurrentGrant = legacyCurrentApiOperations.length ? [{
  version: priorReleaseRow.version,
  packageSha256: priorReleaseRow.packageSha256,
  payloadDigest: priorReleaseRow.payloadDigest,
  apiOperations: legacyCurrentApiOperations,
}] : [];
const sourcePriorGrants = priorPolicy.format === 2 ? (priorAppPolicy?.releases ?? []) : legacyCurrentGrant;
const sortedPriorGrants = [...sourcePriorGrants].sort((left, right) => compareVersion(left.version, right.version));
const retiredCount = Math.max(0, sortedPriorGrants.length + 1 - maxRetainedReleaseGrants);
const expectedRetiredReleaseGrants = sortedPriorGrants.slice(0, retiredCount);
const expectedRetainedPriorGrants = sortedPriorGrants.slice(retiredCount);
const expectedReleaseGrants = [...expectedRetainedPriorGrants, {
  version: release.version,
  packageSha256: release.packageSha256,
  payloadDigest: release.payloadDigest,
  apiOperations: verifiedPackage.manifest.capabilities.filter(operation => apiOperations.includes(operation)),
}];
const retiredVersions = release.retiredVersions ?? [];
const removedGrantVersions = (priorAppPolicy?.releases ?? [])
  .filter(previous => !appPolicy?.releases?.some(next => next.version === previous.version))
  .map(previous => previous.version)
  .sort();
const expectedRetiredVersions = expectedRetiredReleaseGrants.map(previous => previous.version).sort();
const financeMinimumVersionRetirement = appId === 'company.dental.finance.m17'
  && release.version === '1.7.7'
  && canonical(retiredVersions) === canonical(['1.7.0'])
  && priorReleaseRow?.minimumVersion === '1.7.0'
  && priorAppPolicy?.minimumVersion === '1.7.0'
  && release.minimumVersion === '1.7.1'
  && appPolicy?.minimumVersion === '1.7.1'
  && (priorAppPolicy?.releases.length ?? 0) === 7;
const exactGrantRetirement = canonical(removedGrantVersions) === canonical(expectedRetiredVersions)
  && (release.releaseKind === 'new'
    ? retiredVersions.length === 0 && expectedRetiredVersions.length === 0 && release.minimumVersion === releaseRow?.minimumVersion
    : retiredVersions.length === 0
      ? release.minimumVersion === priorReleaseRow?.minimumVersion
        && appPolicy?.minimumVersion === priorAppPolicy?.minimumVersion
      : financeMinimumVersionRetirement);
const unchangedCatalogueRows = priorCatalogue.releases.filter(row => row.id !== appId).every(previous => {
  const next = catalogue.releases.find(row => row.id === previous.id);
  return !!next && canonical(next) === canonical(previous);
});
const unchangedPolicyApps = priorPolicy.apps.filter(row => row.id !== appId).every(previous => {
  const next = policy.apps.find(row => row.id === previous.id);
  return !!next && canonical(next) === canonical(previous);
});
const priorGrantsPreserved = expectedRetainedPriorGrants.every(previous =>
  appPolicy?.releases?.some(next => canonical(next) === canonical(previous)));
const retiredGrantWindowValid = Array.isArray(release.retiredReleaseGrants)
  && canonical(release.retiredReleaseGrants) === canonical(expectedRetiredReleaseGrants)
  && canonical(appPolicy?.releases ?? []) === canonical(expectedReleaseGrants)
  && !expectedRetiredReleaseGrants.some(previous => priorAppPolicy?.rollback
    && [priorAppPolicy.rollback.from, priorAppPolicy.rollback.to].includes(previous.payloadDigest));
const sameTargetPolicy = !priorAppPolicy || (() => {
  const { releases: _priorReleases, minimumVersion: _priorMinimumVersion, ...priorFields } = priorAppPolicy;
  const { releases: _nextReleases, minimumVersion: _nextMinimumVersion, ...nextFields } = appPolicy ?? {};
  return canonical(priorFields) === canonical(nextFields);
})();
if (priorCatalogue.sequence !== release.priorSequence || priorPolicy.sequence !== release.priorSequence
  || catalogue.sequence !== release.sequence || policy.sequence !== release.sequence
  || catalogue.sequence <= priorCatalogue.sequence || policy.sequence <= priorPolicy.sequence
  || catalogue.issuedAt !== policy.issuedAt || catalogue.expiresAt !== policy.expiresAt
  || catalogueEnvelope.keyId !== m17StagingKeyId || policyEnvelope.keyId !== m17StagingKeyId
  || catalogue.environment !== 'cloudfare-staging' || policy.environment !== 'cloudfare-staging'
  || catalogue.channel !== 'staging' || policy.channel !== 'staging'
  || !updateShapeValid || !exactGrantRetirement || !unchangedCatalogueRows || !unchangedPolicyApps || !priorGrantsPreserved || !retiredGrantWindowValid || !sameTargetPolicy
  || packageInfo.appId !== appId || packageInfo.version !== release.version || verifiedPackage.release.keyId !== m17StagingKeyId
  || verifiedPackage.release.digest !== release.payloadDigest || !releaseRow || releaseRow.version !== release.version
  || releaseRow.minimumVersion !== release.minimumVersion
  || releaseRow.packageSha256 !== release.packageSha256 || releaseRow.objectKey !== release.objectKey
  || releaseRow.payloadDigest !== release.payloadDigest || !grant || grant.packageSha256 !== release.packageSha256
  || grant.payloadDigest !== release.payloadDigest || canonical(grant.apiOperations) !== canonical(verifiedPackage.manifest.capabilities.filter(operation => apiOperations.includes(operation)))
  || !apiReleaseGrantForPackage(verifiedPackage, policy, now) || !apiReleaseGrantMatchesCatalogue(appId, grant, catalogue)) {
  throw Error('Signed M17 package, sequence, catalogue, update policy, or exact API grant did not verify');
}
const exactApiOperations = verifiedPackage.manifest.capabilities.filter(operation => apiOperations.includes(operation));
if (release.packageBytes !== packageBytes.length || canonical(release.exactApiOperations) !== canonical(exactApiOperations)) {
  throw Error('Unexpected package object key or release scope');
}

// Re-read public feed bytes immediately before publishing so we do not publish against a stale snapshot.
for (const [key, expected] of [
  ['catalogue/staging.json', release.priorCatalogueSha256], ['update-policy/staging.json', release.priorUpdatePolicySha256],
]) {
  const response = await fetch(new URL(key, stagingDistribution.publicBase), { redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Error('Current public staging metadata unavailable');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (sha256(bytes) !== expected) throw Error('Staging metadata advanced; prepare fresh higher-sequence outputs');
}

const publication = {
  environment: 'cloudfare-staging', bucket: 'dentmitra-dental-os-releases-cloudfare-staging', appId,
  version: release.version, sequence: release.sequence, priorSequence: release.priorSequence, keyId: m17StagingKeyId,
  packageSha256: release.packageSha256, packageBytes: release.packageBytes, payloadDigest: release.payloadDigest,
  artworkObjectKey: release.artworkObjectKey, artworkSha256: release.artworkSha256, artworkBytes: release.artworkBytes,
  apiOperations: [...release.exactApiOperations],
  objectKey: release.objectKey, catalogueSha256: release.catalogueSha256, updatePolicySha256: release.updatePolicySha256,
  priorCatalogueSha256: release.priorCatalogueSha256, priorUpdatePolicySha256: release.priorUpdatePolicySha256,
  baseline: { 'catalogue/staging.json': release.priorCatalogueSha256, 'update-policy/staging.json': release.priorUpdatePolicySha256 },
};
console.log(JSON.stringify({ validated: true, ...publication }));
if (guard === '--validate-staging-only') process.exit(0);

const account = '03453ad990acaaa56336e5851e24f490';
const bucket = 'dentmitra-dental-os-releases-cloudfare-staging';
const wrangler = path.resolve(backendRoot, 'node_modules/wrangler/bin/wrangler.js');
if (!fs.existsSync(wrangler)) throw Error('Existing Wrangler runtime unavailable');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dental-os-m17-app-staging-'));
fs.chmodSync(temp, 0o700);
const workerName = 'dental-os-m17-app-' + randomBytes(6).toString('hex');
const nonce = randomBytes(32).toString('hex');
const configPath = path.join(temp, 'wrangler.json');
const workerSource = fs.readFileSync(new URL('./m17-app-staging-worker.mjs', import.meta.url), 'utf8')
  + `\nconst expected=${JSON.stringify(publication)};\nconst state={used:false};\nexport default {fetch(request,env){return stagingPublisher(request,env.RELEASES,expected,env.OPERATOR_NONCE,state)}};\n`;
fs.writeFileSync(path.join(temp, 'worker.mjs'), workerSource, { flag: 'wx', mode: 0o600 });
fs.writeFileSync(configPath, JSON.stringify({
  name: workerName, account_id: account, main: 'worker.mjs', compatibility_date: '2026-09-25', workers_dev: true,
  r2_buckets: [{ binding: 'RELEASES', bucket_name: bucket }], vars: { OPERATOR_NONCE: nonce },
}), { flag: 'wx', mode: 0o600 });
const run = args => spawnSync(process.execPath, [wrangler, ...args], {
  cwd: temp, encoding: 'utf8', timeout: 120_000,
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account, WRANGLER_SEND_METRICS: 'false' },
});
const evidence = { ...publication, worker: workerName, packageWritten: false, published: false, advanced: [], cleanedUp: false };
let failure;
try {
  const deployed = run(['deploy', '--config', configPath]);
  if (deployed.status !== 0) {
    evidence.workerDeployExitCode = deployed.status;
    const diagnostic = String(deployed.error?.message ?? deployed.stderr ?? deployed.stdout ?? 'no Wrangler diagnostic');
    evidence.workerDeployDiagnostic = diagnostic.replace(/(?:Bearer\s+)[A-Za-z0-9._-]+/gi, 'Bearer [redacted]').slice(-1600);
    throw Error('temporary-worker-deploy');
  }
  const url = deployed.stdout.match(new RegExp(`https://${workerName.replaceAll('-', '\\-')}\\.[a-z0-9-]+\\.workers\\.dev`))?.[0];
  if (!url || !url.startsWith(`https://${workerName}.`)) throw Error('temporary-worker-url');
  evidence.workerUrlVerified = true;
  let ready = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch(url + '/ready', { headers: { authorization: `Bearer ${nonce}` }, redirect: 'error', signal: AbortSignal.timeout(8_000) });
      if (response.ok) { const value = await response.json(); ready = value.ready === true && value.environment === 'cloudfare-staging'; }
      else await response.body?.cancel();
      if (ready) break;
    } catch { /* Bounded readiness check. The publishing POST is sent at most once. */ }
    await new Promise(resolve => setTimeout(resolve, 1_500));
  }
  if (!ready) throw Error('temporary-worker-not-ready');
  evidence.ready = true;
  const anonymous = await fetch(url + '/publish', { method: 'POST', body: '{}', redirect: 'error', signal: AbortSignal.timeout(8_000) });
  evidence.anonymousDenied = anonymous.status === 404;
  await anonymous.body?.cancel();
  if (!evidence.anonymousDenied) throw Error('anonymous-publish-guard');
  const body = JSON.stringify({ artwork: artworkBytes.toString('base64'), package: packageBytes.toString('base64'), catalogue: catalogueBytes.toString('base64'), policy: policyBytes.toString('base64') });
  let response;
  try {
    response = await fetch(url + '/publish', {
      method: 'POST', headers: { authorization: `Bearer ${nonce}`, 'content-type': 'application/json' }, body,
      redirect: 'error', signal: AbortSignal.timeout(90_000),
    });
  } catch {
    evidence.publicationOutcome = 'unknown-after-single-attempt';
    throw Error('publish-transport-unknown');
  }
  const result = await response.json();
  evidence.publicationOutcome = response.status;
  evidence.packageWritten = result.packageWritten === true;
  evidence.artworkWritten = result.artworkWritten === true;
  evidence.advanced = Array.isArray(result.advanced) ? result.advanced : [];
  evidence.published = response.ok && result.published === true && evidence.packageWritten && evidence.artworkWritten && evidence.advanced.length === 2
    && evidence.advanced[0].key === 'catalogue/staging.json' && evidence.advanced[0].sequence === release.sequence
    && evidence.advanced[1].key === 'update-policy/staging.json' && evidence.advanced[1].sequence === release.sequence;
  if (!evidence.published) throw Error('publish-conflict-or-partial-write');
  const replay = await fetch(url + '/publish', {
    method: 'POST', headers: { authorization: `Bearer ${nonce}`, 'content-type': 'application/json' }, body,
    redirect: 'error', signal: AbortSignal.timeout(15_000),
  });
  evidence.replayDenied = replay.status === 409;
  await replay.body?.cancel();
  if (!evidence.replayDenied) throw Error('replay-guard');
} catch (error) {
  failure = error;
  evidence.failureStage = String(error?.message ?? 'unknown').slice(0, 48);
} finally {
  const deleted = run(['delete', '--config', configPath, '--force']);
  evidence.cleanedUp = deleted.status === 0;
  fs.writeFileSync(path.join(root, 'publication-result.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  if (evidence.cleanedUp) fs.rmSync(temp, { recursive: true, force: true });
}
if (!evidence.cleanedUp) throw Error(`Temporary staging publisher cleanup failed; recover exact Worker ${workerName}`);
if (failure) throw failure;
if (!evidence.published) throw Error('Staging publication was not confirmed');
console.log(JSON.stringify(evidence));
