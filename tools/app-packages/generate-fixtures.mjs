// Explicit test-fixture maintenance only. Discards the ephemeral signing private key.
import fs from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { buildPackage } = require('../../dist-electron/packages/format.js');
const { operations } = require('../../dist-electron/sdk/contracts.js');
if (process.argv[2] !== '--test-only') throw new Error('Use --test-only; never creates a production release key');
const root = path.resolve(import.meta.dirname, '../..'), out = path.join(root, 'fixtures/packages');
fs.mkdirSync(out, { recursive: true });
const { publicKey, privateKey } = generateKeyPairSync('ed25519');
fs.writeFileSync(path.join(out, 'public-key.txt'), publicKey.export({ type: 'spki', format: 'pem' }));
const files = new Map(['index.html', 'app.js', 'app.css'].map(name => [name, fs.readFileSync(path.join(root, 'fixtures/runtime-apps', name))]));
for (const host of ['alpha', 'beta']) {
 const meta = { appId: `company.sample.${host}`, publisher: 'company', version: '1.0.0', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: operations.filter(op => host === 'alpha' || op !== 'appointments.setStatus') };
 fs.writeFileSync(path.join(out, `${host}.dentalpkg`), buildPackage(meta, files, 'test-only-m06', privateKey));
}
console.log('Regenerated TEST ONLY packages and public key; no signing private key saved.');
