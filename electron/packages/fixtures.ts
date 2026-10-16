/** Called ONLY after bootstrap verifies its private-display/Windows CI fixture guard. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { operations } from '../sdk/contracts';
import { PackageRegistry } from './registry';
import type { TrustPolicy } from './format';
export function fixtureRegistry(root: string, fixtureRoot: string) {
  const publicKey = readFileSync(path.join(fixtureRoot, 'public-key.txt'), 'utf8');
  const policy: TrustPolicy = { keys: { 'test-only-m06': { publicKey, publisher: 'company' } }, apps: {
    'company.sample.alpha': { publisher: 'company', capabilities: operations },
    'company.sample.beta': { publisher: 'company', capabilities: operations.filter(op => op !== 'appointments.setStatus') },
  } };
  const registry = new PackageRegistry(root, policy); registry.initialize();
  for (const host of ['alpha', 'beta']) registry.install(readFileSync(path.join(fixtureRoot, `${host}.dentalpkg`)));
  return registry;
}
