// Bounded real process-exit journal/lock recovery; no Electron/display needed.
import fs from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { operations } = require('../dist-electron/sdk/contracts.js');
const root = path.resolve(import.meta.dirname, '..'), fixture = path.join(root, 'fixtures/packages');
const policy = { keys: { 'test-only-m06': { publicKey: fs.readFileSync(path.join(fixture, 'public-key.txt'), 'utf8'), publisher: 'company' } }, apps: { 'company.sample.alpha': { publisher: 'company', capabilities: operations } } };
const base = fs.mkdtempSync(path.join(tmpdir(), 'dental-package-crash-')), checks = [];
const child = `const fs=require('node:fs');const {PackageRegistry}=require(process.argv[1]);const r=new PackageRegistry(process.argv[2],JSON.parse(process.argv[3]),undefined,p=>{if(p===process.argv[4])process.exit(73)});r.initialize();if(process.argv[5]==='install')r.install(fs.readFileSync(process.argv[6]));else r.uninstall('company.sample.alpha');`;
try {
 for (const [kind, phases] of [['install', ['journal', 'asset-write', 'extracted', 'published', 'committed']], ['uninstall', ['journal', 'committed', 'removed']]]) {
  for (const phase of phases) {
   const dir = path.join(base, `${kind}-${phase}`), r = new PackageRegistry(dir, policy); r.initialize();
   if (kind === 'uninstall') r.install(fs.readFileSync(path.join(fixture, 'alpha.dentalpkg')));
   const result = spawnSync(process.execPath, ['-e', child, path.join(root, 'dist-electron/packages/registry.js'), dir, JSON.stringify(policy), phase, kind, path.join(fixture, 'alpha.dentalpkg')], { timeout: 15000, encoding: 'utf8' });
   assert.equal(result.status, 73, result.stderr); assert.ok(fs.existsSync(path.join(dir, 'operation.lock')));
   const next = new PackageRegistry(dir, policy); next.initialize();
   assert.equal(!!next.inspect().apps['company.sample.alpha'], kind === 'install' ? phase === 'committed' : phase === 'journal');
   assert.ok(!fs.existsSync(path.join(dir, 'operation.json'))); assert.ok(!fs.existsSync(path.join(dir, 'operation.lock')));
   if (next.inspect().apps['company.sample.alpha']) { const lease = next.launch('company.sample.alpha'); lease.releaseLease(); }
   checks.push(`${kind} process exit at ${phase}: dead-owner lock and journal reconciled`); console.log('PASS', checks.at(-1));
  }
 }
} finally {
 fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
 fs.writeFileSync(path.join(root, 'artifacts', `${process.platform}-packages-crash.json`), JSON.stringify({ checks, platform: process.platform, sha: process.env.GITHUB_SHA ?? null }, null, 2));
 fs.rmSync(base, { recursive: true, force: true });
}
