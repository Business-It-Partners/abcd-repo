// Publish one locally prepared M17.1 release into the pinned Cloudflare
// staging bucket through a short-lived, nonce-protected Worker.
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
const { sha256, verifyPackage } = require('../../dist-electron/packages/format.js');
const { verifyCatalogue, noWatermark } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');
const root = path.resolve(inputDir);
const backendRoot = path.resolve(backendRootInput);
const checkout = path.resolve(import.meta.dirname, '../..');
const external = value => value !== checkout && !value.startsWith(checkout + path.sep);
if (!external(root) || !external(backendRoot)) throw Error('Prepared material and Wrangler runtime must remain outside the active checkout');
const rootInfo = fs.lstatSync(root);
if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() || process.platform !== 'win32' && (rootInfo.mode & 0o077) !== 0) throw Error('Prepared release directory must be private');
if (stagingDistribution.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev'
  || stagingDistribution.publicBase !== 'https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev') throw Error('Pinned staging distribution fence');

function read(name, max = 65_536) {
  const file = path.join(root, name), info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > max) throw Error(`Invalid prepared file: ${name}`);
  return fs.readFileSync(file);
}
const publication = JSON.parse(read('publication.json').toString('utf8'));
const packageRow = publication.releases?.length === 1 ? publication.releases[0] : null;
if (publication.environment !== 'cloudfare-staging' || publication.bucket !== 'dentmitra-dental-os-releases-cloudfare-staging'
  || publication.sequence !== 23 || publication.keyId !== 'company-staging-m08-20261016'
  || !packageRow || packageRow.id !== 'company.dental.followups' || packageRow.version !== '1.1.0') throw Error('Wrong M17.1 staging release identity');
const packageBytes = read(packageRow.objectKey, 2_097_152);
const catalogueBytes = read('catalogue/staging.json');
const policyBytes = read('update-policy/staging.json');
const priorCatalogueBytes = read('baseline/catalogue/staging.json');
const priorPolicyBytes = read('baseline/update-policy/staging.json');
if (sha256(packageBytes) !== packageRow.packageSha256 || packageBytes.length !== packageRow.packageBytes
  || sha256(catalogueBytes) !== publication.catalogueSha256 || sha256(policyBytes) !== publication.updatePolicySha256
  || sha256(priorCatalogueBytes) !== publication.priorCatalogueSha256 || sha256(priorPolicyBytes) !== publication.priorPolicySha256) throw Error('Prepared bytes do not match the release ledger');
const now = Date.now();
const priorCatalogue = verifyCatalogue(priorCatalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
const priorPolicy = verifyUpdatePolicy(priorPolicyBytes, stagingDistribution.policy, noWatermark, now).policy;
const nextCatalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
const nextPolicy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy;
const verifiedPackage = verifyPackage(packageBytes, stagingDistribution.policy);
if (priorCatalogue.sequence !== 22 || priorPolicy.sequence !== 22 || priorCatalogue.expiresAt <= now
  || nextCatalogue.sequence !== 23 || nextPolicy.sequence !== 23 || nextCatalogue.expiresAt <= now
  || nextCatalogue.issuedAt !== nextPolicy.issuedAt || nextCatalogue.expiresAt !== nextPolicy.expiresAt
  || JSON.parse(catalogueBytes).keyId !== publication.keyId || JSON.parse(policyBytes).keyId !== publication.keyId) throw Error('Signed staging sequence or package validation failed');
const targetGrant = nextPolicy.apps.find(app => app.id === packageRow.id)?.releases?.find(grant => grant.version === packageRow.version);
if (verifiedPackage.manifest.appId !== packageRow.id || verifiedPackage.manifest.version !== packageRow.version
  || verifiedPackage.release.digest !== packageRow.payloadDigest
  || !apiReleaseGrantForPackage(verifiedPackage, nextPolicy, now)
  || !targetGrant || targetGrant.apiOperations.length !== 1 || targetGrant.apiOperations[0] !== 'clinic.api.request'
  || !apiReleaseGrantMatchesCatalogue(packageRow.id, targetGrant, nextCatalogue)) {
  throw Error('Package-bound API grant or catalogue does not match');
}
for (const [key, field, value, next] of [
  ['baseline/catalogue/staging.json', 'catalogue', priorCatalogue, nextCatalogue],
  ['baseline/update-policy/staging.json', 'policy', priorPolicy, nextPolicy],
]) {
  if (next.sequence <= value.sequence || JSON.parse(read(key).toString('utf8'))[field].sequence !== value.sequence) throw Error('Metadata sequence did not advance');
}
console.log(JSON.stringify({ validated: true, environment: publication.environment, bucket: publication.bucket,
  appId: packageRow.id, version: packageRow.version, sequence: publication.sequence, keyId: publication.keyId,
  packageSha256: packageRow.packageSha256, catalogueSha256: publication.catalogueSha256,
  updatePolicySha256: publication.updatePolicySha256, exactApiOperations: targetGrant.apiOperations }));
if (guard === '--validate-staging-only') process.exit(0);

const account = '03453ad990acaaa56336e5851e24f490';
const bucket = 'dentmitra-dental-os-releases-cloudfare-staging';
const wrangler = path.resolve(backendRoot, 'node_modules/wrangler/bin/wrangler.js');
if (!fs.existsSync(wrangler)) throw Error('Existing Wrangler runtime unavailable');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dental-os-m17-followups-'));
fs.chmodSync(temp, 0o700);
const workerName = 'dental-os-m17-followups-' + randomBytes(6).toString('hex');
const nonce = randomBytes(32).toString('hex');
const configPath = path.join(temp, 'wrangler.json');
const expected = {
  packageSha256: packageRow.packageSha256,
  packageBytes: packageRow.packageBytes,
  catalogueSha256: publication.catalogueSha256,
  updatePolicySha256: publication.updatePolicySha256,
  priorSequence: publication.priorSequence,
  sequence: publication.sequence,
  keyId: publication.keyId,
  version: packageRow.version,
  payloadDigest: packageRow.payloadDigest,
  objectKey: packageRow.objectKey,
  baseline: {
    'catalogue/staging.json': publication.priorCatalogueSha256,
    'update-policy/staging.json': publication.priorPolicySha256,
  },
};
const workerSource = fs.readFileSync(new URL('./m17-followups-staging-worker.mjs', import.meta.url), 'utf8')
  + `\nconst expected=${JSON.stringify(expected)};\nconst state={used:false};\nexport default {fetch(request,env){return stagingPublisher(request,env.RELEASES,expected,env.OPERATOR_NONCE,state)}};\n`;
fs.writeFileSync(path.join(temp, 'worker.mjs'), workerSource, { flag: 'wx', mode: 0o600 });
fs.writeFileSync(configPath, JSON.stringify({
  name: workerName,
  account_id: account,
  main: 'worker.mjs',
  compatibility_date: '2026-09-25',
  workers_dev: true,
  r2_buckets: [{ binding: 'RELEASES', bucket_name: bucket }],
  vars: { OPERATOR_NONCE: nonce },
}), { flag: 'wx', mode: 0o600 });
const run = args => spawnSync(process.execPath, [wrangler, ...args], {
  cwd: temp,
  encoding: 'utf8',
  timeout: 120_000,
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account, WRANGLER_SEND_METRICS: 'false' },
});
const evidence = {
  environment: 'cloudfare-staging', bucket, appId: packageRow.id, version: packageRow.version,
  sequence: publication.sequence, keyId: publication.keyId, packageSha256: packageRow.packageSha256,
  catalogueSha256: publication.catalogueSha256, updatePolicySha256: publication.updatePolicySha256,
  worker: workerName, packageWritten: false, published: false, advanced: [], cleanedUp: false,
};
let failure;
try {
  const deployed = run(['deploy', '--config', configPath]);
  if (deployed.status !== 0) throw Error('deploy');
  const url = deployed.stdout.match(new RegExp(`https://${workerName.replaceAll('-', '\\-')}\\.[a-z0-9-]+\\.workers\\.dev`))?.[0];
  if (!url) throw Error('worker-url');
  evidence.workerUrlVerified = true;
  let ready = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch(url + '/ready', { headers: { authorization: `Bearer ${nonce}` }, redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (response.ok) { const result = await response.json(); ready = result.ready === true && result.environment === 'cloudfare-staging'; }
      else await response.body?.cancel();
      if (ready) break;
    } catch { /* bounded readiness polling; the publishing POST is sent once */ }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (!ready) throw Error('worker-ready');
  evidence.ready = true;
  const anonymous = await fetch(url + '/publish', { method: 'POST', body: '{}', redirect: 'error', signal: AbortSignal.timeout(8000) });
  evidence.anonymousDenied = anonymous.status === 404;
  await anonymous.body?.cancel();
  if (!evidence.anonymousDenied) throw Error('anonymous-guard');
  const requestBody = JSON.stringify({
    package: packageBytes.toString('base64'),
    catalogue: catalogueBytes.toString('base64'),
    policy: policyBytes.toString('base64'),
  });
  let response;
  try {
    response = await fetch(url + '/publish', {
      method: 'POST',
      headers: { authorization: `Bearer ${nonce}`, 'content-type': 'application/json' },
      body: requestBody,
      redirect: 'error',
      signal: AbortSignal.timeout(90_000),
    });
  } catch {
    evidence.publicationOutcome = 'unknown-after-single-attempt';
    throw Error('publish-transport');
  }
  const result = await response.json();
  evidence.publicationOutcome = response.status;
  evidence.packageWritten = result.packageWritten === true;
  evidence.advanced = Array.isArray(result.advanced) ? result.advanced : [];
  evidence.published = response.ok && result.published === true
    && evidence.advanced.length === 2
    && evidence.advanced[0].key === 'catalogue/staging.json'
    && evidence.advanced[1].key === 'update-policy/staging.json';
  if (!evidence.published) throw Error('publish-conflict');
  const replay = await fetch(url + '/publish', {
    method: 'POST',
    headers: { authorization: `Bearer ${nonce}`, 'content-type': 'application/json' },
    body: requestBody,
    redirect: 'error',
    signal: AbortSignal.timeout(15_000),
  });
  evidence.replayDenied = replay.status === 409;
  await replay.body?.cancel();
  if (!evidence.replayDenied) throw Error('replay-guard');
} catch (error) {
  failure = error;
  evidence.failureStage = String(error?.message ?? 'unknown').slice(0, 40);
} finally {
  const deleted = run(['delete', '--config', configPath, '--force']);
  evidence.cleanedUp = deleted.status === 0;
  const resultFile = path.join(root, 'publication-result.json');
  fs.writeFileSync(resultFile, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  if (evidence.cleanedUp) fs.rmSync(temp, { recursive: true, force: true });
}
if (!evidence.cleanedUp) throw Error(`Short-lived staging Worker cleanup failed; recover exact Worker ${workerName}`);
if (failure) throw failure;
console.log(JSON.stringify(evidence));
