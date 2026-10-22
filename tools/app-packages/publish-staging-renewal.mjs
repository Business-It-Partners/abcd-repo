// Operator-only metadata publication. Uses an existing staging Wrangler login; no package writes.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const [guard, input, backendRoot] = process.argv.slice(2);
if (!['--validate-staging-only', '--apply-staging-metadata-only'].includes(guard) || !input
  || (guard === '--apply-staging-metadata-only' && !backendRoot)) throw Error('Explicit staging metadata validation/publication required');
const require = createRequire(import.meta.url);
const { canonical, sha256 } = require('../../dist-electron/packages/format.js');
const { verifyCatalogue, noWatermark } = require('../../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy } = require('../../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution } = require('../../dist-electron/distribution/staging.js');
const root = path.resolve(input), now = Date.now();
const read = name => {
  const file = path.join(root, name), info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size > 65_536) throw Error('Invalid renewal input');
  return fs.readFileSync(file);
};
const review = JSON.parse(read('renewal-review.json'));
if (review.environment !== 'cloudfare-staging' || review.metadataOnly !== true || review.packageWrites !== 0) throw Error('Wrong renewal scope');
const publication = {};
const semantic = value => Object.fromEntries(Object.entries(value).filter(([name]) => !['sequence', 'issuedAt', 'expiresAt'].includes(name)));
for (const [name, field, objectKey, verifier] of [
  ['catalogue', 'catalogue', 'catalogue/staging.json', verifyCatalogue],
  ['updatePolicy', 'policy', 'update-policy/staging.json', verifyUpdatePolicy],
]) {
  const bytes = read(objectKey), envelope = JSON.parse(bytes), record = review[name];
  if (sha256(bytes) !== record.renewedSha256) throw Error('Reviewed renewal bytes changed');
  verifier(bytes, stagingDistribution.policy, noWatermark, now);
  const response = await fetch(new URL(objectKey, stagingDistribution.publicBase), {
    redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok || !response.body) throw Error('Staging baseline unavailable');
  const serverTime = Date.parse(response.headers.get('date') ?? '');
  if (!Number.isFinite(serverTime) || Math.abs(serverTime - now) > 300_000) throw Error('Untrusted staging clock');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try {
    while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
      if (size > 65_536) throw Error('Staging baseline size'); chunks.push(part.value); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  const priorBytes = Buffer.concat(chunks), priorEnvelope = JSON.parse(priorBytes), prior = priorEnvelope[field], next = envelope[field];
  if (sha256(priorBytes) !== record.previousSha256) throw Error('Staging baseline advanced; prepare a new review');
  verifier(priorBytes, stagingDistribution.policy, noWatermark, Math.min(now, prior.expiresAt - 1));
  if (priorEnvelope.keyId !== envelope.keyId || next.sequence !== record.sequence
    || next.sequence <= Math.max(prior.sequence, record.recordedSequence)
    || canonical(semantic(next)) !== canonical(semantic(prior))
    || sha256(Buffer.from(canonical(semantic(next)))) !== record.semanticSha256) throw Error('Renewal altered reviewed authority');
  publication[name] = { base64: bytes.toString('base64'), sha256: sha256(bytes), previousSha256: sha256(priorBytes) };
}
console.log('PASS staging targets, signatures, current baseline, sequence, expiry and unchanged authority. Package writes: 0.');
if (guard === '--validate-staging-only') process.exit(0);

const account = '03453ad990acaaa56336e5851e24f490';
const bucket = 'dentmitra-dental-os-releases-cloudfare-staging';
const wrangler = path.resolve(backendRoot, 'node_modules/wrangler/bin/wrangler.js');
if (!fs.existsSync(wrangler)) throw Error('Existing backend Wrangler runtime required');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dental-metadata-renewal-')); fs.chmodSync(temp, 0o700);
const name = 'dental-os-renew-staging-' + randomBytes(6).toString('hex');
const nonce = randomBytes(32).toString('hex'), config = path.join(temp, 'wrangler.json');
const source = fs.readFileSync(new URL('./metadata-renewal-worker.mjs', import.meta.url), 'utf8');
fs.writeFileSync(path.join(temp, 'worker.mjs'), source + `\nconst publication=${JSON.stringify(publication)};\nexport default {async fetch(request,env){if(request.headers.get('authorization')!=='Bearer '+env.OPERATOR_NONCE)return new Response(null,{status:404});const pathname=new URL(request.url).pathname;if(request.method==='GET'&&pathname==='/ready')return Response.json({ready:true,metadataOnly:true});if(request.method!=='POST'||pathname!=='/renew')return new Response(null,{status:404});try{const result=await publishMetadataRenewal(env.RELEASES,publication);return Response.json(result,{status:result.published?200:409});}catch{return Response.json({published:false,conflict:true},{status:409});}}};\n`, { mode: 0o600 });
fs.writeFileSync(config, JSON.stringify({ name, account_id: account, main: 'worker.mjs', compatibility_date: '2026-09-25',
  workers_dev: true, r2_buckets: [{ binding: 'RELEASES', bucket_name: bucket }], vars: { OPERATOR_NONCE: nonce } }), { mode: 0o600 });
const run = args => spawnSync(process.execPath, [wrangler, ...args], { encoding: 'utf8', timeout: 120_000,
  env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: account, WRANGLER_SEND_METRICS: 'false' } });
const evidence = { environment: 'cloudfare-staging', bucket, worker: name, packageWrites: 0, published: false, cleanedUp: false };
try {
  const deploy = run(['deploy', '--config', config]); if (deploy.status !== 0) throw Error('Temporary staging renewal deployment failed');
  const url = deploy.stdout.match(/https:\/\/dental-os-renew-staging-[a-f0-9]+\.[a-z0-9-]+\.workers\.dev/)?.[0];
  if (!url || !url.startsWith('https://' + name + '.')) throw Error('Temporary publisher URL mismatch');
  let ready = false;
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const response = await fetch(url + '/ready', { headers: { authorization: 'Bearer ' + nonce }, redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (response.ok) { const value = await response.json(); ready = value.ready === true && value.metadataOnly === true; if (ready) break; }
      else await response.body?.cancel();
    } catch { /* Bounded readiness polling; publication POST is never retried. */ }
    await new Promise(resolve => setTimeout(resolve, 1500));
  }
  if (!ready) throw Error('Temporary staging publisher not ready');
  const denied = await fetch(url + '/renew', { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(10_000) });
  if (denied.status !== 404) throw Error('Anonymous publisher guard failed'); await denied.body?.cancel();
  evidence.anonymousDenied = true;
  const response = await fetch(url + '/renew', { method: 'POST', headers: { authorization: 'Bearer ' + nonce }, redirect: 'error', signal: AbortSignal.timeout(30_000) });
  evidence.result = await response.json(); evidence.published = response.ok && evidence.result.published === true;
  if (!evidence.published) throw Error('Staging renewal conflicted; inspect both metadata pointers before a higher-sequence recovery');
  const replay = await fetch(url + '/renew', { method: 'POST', headers: { authorization: 'Bearer ' + nonce }, redirect: 'error', signal: AbortSignal.timeout(10_000) });
  evidence.replayDenied = replay.status === 409; await replay.body?.cancel();
  if (!evidence.replayDenied) throw Error('Renewal replay guard failed');
} finally {
  const deleted = run(['delete', '--config', config, '--force']); evidence.cleanedUp = deleted.status === 0;
  fs.writeFileSync(path.join(root, 'publication-result.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  if (evidence.cleanedUp) fs.rmSync(temp, { recursive: true, force: true });
  else { console.error('Task-owned staging renewal Worker cleanup requires recovery: ' + name); process.exitCode = 1; }
}
console.log(JSON.stringify(evidence));
