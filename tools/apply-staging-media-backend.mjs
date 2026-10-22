// Apply only a prepared exact-source staging snapshot. Credentials and clinical payloads are never logged.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { target } from './staging-backend/target.mjs';
const [guard, backendInput, reviewInput] = process.argv.slice(2);
if (guard !== '--apply-reviewed-staging-only' || !backendInput || !reviewInput || process.argv.length !== 5) throw Error('Explicit reviewed staging apply required');
const backend = path.resolve(backendInput), root = path.resolve(reviewInput), digest = bytes => createHash('sha256').update(bytes).digest('hex');
const reviewFile = path.join(root, 'review.json'), stat = fs.lstatSync(reviewFile);
if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw Error('Protected review file required');
const review = JSON.parse(fs.readFileSync(reviewFile, 'utf8'));
if (review.environment !== 'cloudfare-staging' || JSON.stringify(review.target) !== JSON.stringify(target) || !review.dryRunPassed || review.cloudWrites !== false || review.uncommittedInputsIncluded !== false || !review.previousDeployment || !/^[a-f0-9]{40}$/.test(review.source)) throw Error('Invalid staging review');
const git = args => execFileSync('git', args, { cwd: backend, encoding: 'utf8' }).trim();
if (git(['rev-parse', 'HEAD']) !== review.source || git(['branch', '--show-current']) !== 'codex/sys-0010-staging-media-probe') throw Error('Reviewed backend source moved');
const remote = git(['ls-remote', 'origin', 'refs/heads/cloudfare-staging']).split(/\s+/)[0];
if (remote !== review.stagingBase) throw Error('Staging branch advanced; review required');
if (path.resolve(review.snapshot) !== path.join(root, 'snapshot') || path.resolve(review.configFile) !== path.join(root, 'snapshot/apps/platform-worker/.m15-staging.wrangler.json')) throw Error('Unexpected snapshot path');
if (digest(fs.readFileSync(review.configFile)) !== review.configSha256) throw Error('Reviewed target config changed');
const config = JSON.parse(fs.readFileSync(review.configFile, 'utf8'));
if (config.name !== target.worker || config.account_id !== target.account || config.vars?.APP_ENV !== 'cloudfare-staging' || config.vars?.FIREBASE_PROJECT_ID !== target.project || config.main !== 'src/index.ts') throw Error('Staging target mismatch');
if (fs.readlinkSync(path.join(review.snapshot, 'node_modules')) !== path.join(backend, 'node_modules')) throw Error('Unreviewed dependency runtime');
// Compare every archived tracked blob with its Git object before using the snapshot.
const tree = execFileSync('git', ['ls-tree', '-rz', review.source], { cwd: backend }).toString('utf8').split('\0').filter(Boolean);
for (const row of tree) {
  const [, mode, type, expected, name] = row.match(/^(\S+) (\S+) (\S+)\t(.+)$/) ?? [];
  if (type !== 'blob') throw Error('Unsupported source object');
  const file = path.join(review.snapshot, name), info = fs.lstatSync(file);
  const bytes = mode === '120000' && info.isSymbolicLink() ? Buffer.from(fs.readlinkSync(file)) : info.isFile() && !info.isSymbolicLink() ? fs.readFileSync(file) : undefined;
  if (!bytes || createHash('sha1').update(Buffer.from('blob ' + bytes.length + '\0')).update(bytes).digest('hex') !== expected) throw Error('Archived source differs from reviewed commit');
}
const token = fs.readFileSync('/home/master-x/.config/.wrangler/config/default.toml', 'utf8').match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw Error('Existing staging Wrangler session required');
const cloud = async suffix => {
  if (!['settings', 'deployments'].includes(suffix)) throw Error('Staging read fence');
  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${target.account}/workers/scripts/${target.worker}/${suffix}`, { headers: { authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(20_000) });
  const body = await response.json(); if (!response.ok || !body.success) throw Error('Staging state unavailable'); return body.result;
};
const before = await cloud('settings'), deployment = await cloud('deployments');
if (digest(JSON.stringify(before.bindings)) !== review.bindingsSha256 || deployment.deployments?.[0]?.id !== review.previousDeployment) throw Error('Staging changed after preparation');
const evidenceFile = path.join(root, 'apply.json');
if (fs.existsSync(evidenceFile)) throw Error('Apply already attempted; inspect retained outcome before retrying');
const evidence = { environment: 'cloudfare-staging', source: review.source, stagingBase: review.stagingBase, worker: target.worker, previousDeployment: review.previousDeployment, previousVersions: review.previousVersions, configSha256: review.configSha256, applyAttempted: true, deployed: false, outcome: 'unknown', snapshotFilesVerified: tree.length, uncommittedInputsIncluded: false, productionRequests: false };
const save = () => fs.writeFileSync(evidenceFile, JSON.stringify(evidence, null, 2) + '\n', { mode: 0o600 }); save();
try {
  const deployed = spawnSync(process.execPath, [path.join(backend, 'node_modules/wrangler/bin/wrangler.js'), 'deploy', '--config', review.configFile, '--keep-vars', '--message', 'M15 reviewed media lifecycle ' + review.source], { cwd: path.dirname(review.configFile), encoding: 'utf8', timeout: 90_000, maxBuffer: 2 * 1024 * 1024, env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: target.account, WRANGLER_SEND_METRICS: 'false', CI: 'true' } });
  evidence.cliExit = deployed.status;
  if (deployed.status !== 0) throw Error('Staging deployment outcome requires inspection');
  const version = deployed.stdout.match(/Current Version ID:\s*([a-f0-9-]{36})/i)?.[1];
  const after = await cloud('settings'), next = await cloud('deployments');
  const normalize = bindings => bindings.map(binding => Object.fromEntries(Object.entries(binding).sort(([a], [b]) => a.localeCompare(b)))).sort((a, b) => a.name.localeCompare(b.name));
  evidence.bindingsPreserved = digest(JSON.stringify(normalize(before.bindings))) === digest(JSON.stringify(normalize(after.bindings)));
  evidence.secretNamesPreserved = JSON.stringify(before.bindings.filter(b => b.type === 'secret_text').map(b => b.name).sort()) === JSON.stringify(after.bindings.filter(b => b.type === 'secret_text').map(b => b.name).sort());
  evidence.deployment = next.deployments?.[0]?.id; evidence.version = version ?? null;
  evidence.versionMatches = !!version && next.deployments?.[0]?.versions?.some(item => item.version_id === version && item.percentage === 100);
  evidence.deployed = true; evidence.outcome = 'deployed-awaiting-acceptance';
  if (!evidence.bindingsPreserved || !evidence.secretNamesPreserved || !evidence.versionMatches) throw Error('Staging post-deploy identity/binding verification requires inspection');
  const health = await fetch(target.base + '/health', { redirect: 'error', signal: AbortSignal.timeout(15_000) });
  const body = await health.json(); evidence.healthPassed = health.status === 200 && body.environment === 'cloudfare-staging' && body.status === 'ok';
  if (!evidence.healthPassed) throw Error('Staging health requires inspection');
  evidence.outcome = 'deployed-health-and-bindings-verified'; save();
  console.log(JSON.stringify({ deployed: true, source: review.source, bindingsPreserved: true, secretNamesPreserved: true, healthPassed: true, version }));
} finally { save(); }
