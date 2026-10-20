/** Called ONLY after bootstrap verifies its private-display/Windows CI fixture guard. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { operations } from '../sdk/contracts';
import { PackageRegistry } from './registry';
import { buildPackage, type TrustPolicy } from './format';
export function fixtureRegistry(root: string, fixtureRoot: string, appCount = 2) {
  if (!Number.isInteger(appCount) || appCount < 2 || appCount > 16) throw new Error('Invalid runtime fixture app count');
  const publicKey = readFileSync(path.join(fixtureRoot, 'public-key.txt'), 'utf8');
  const keys: Record<string, { publicKey: string; publisher: string }> = { 'test-only-m06': { publicKey, publisher: 'company' } };
  const policy: TrustPolicy = { keys, apps: {
    'company.sample.alpha': { publisher: 'company', capabilities: operations },
    'company.sample.beta': { publisher: 'company', capabilities: operations.filter(op => op !== 'appointments.setStatus') },
  }, ...(appCount > 2 ? { companyApps: { publisher: 'company', capabilities: [] } } : {}) };
  const registry = new PackageRegistry(root, policy); registry.initialize();
  for (const host of ['alpha', 'beta']) registry.install(readFileSync(path.join(fixtureRoot, `${host}.dentalpkg`)));
  if (appCount > 2) {
    const pair = generateKeyPairSync('ed25519'), keyId = 'test-resource-runtime';
    keys[keyId] = { publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' };
    const source = Buffer.from('<!doctype html><meta charset="utf-8"><title>Resource fixture</title><main><h1>Resource fixture</h1></main>');
    for (let index = 1; index <= appCount - 2; index++) {
      const appId = `company.resource.app-${String(index).padStart(2, '0')}`;
      registry.install(buildPackage({ appId, publisher: 'company', version: '1.0.0', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: [] }, new Map([['index.html', source]]), keyId, pair.privateKey));
    }
  }
  return registry;
}
