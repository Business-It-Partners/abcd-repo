/** Called ONLY after bootstrap verifies its private-display/Windows CI fixture guard. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync } from 'node:crypto';
import { operations } from '../sdk/contracts';
import { PackageRegistry } from './registry';
import { buildPackage, type TrustPolicy } from './format';
export function fixtureRegistry(root: string, fixtureRoot: string, appCount = 2, modulePreviewFixture = false, slowModuleAckFixture = false) {
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
      const files = new Map([['index.html', source]]);
      if (modulePreviewFixture && index <= 2) {
        const sourceApp = index === 1 ? 'company.dental.finance' : 'company.dental.lab-tracker';
        const sourceRoot = path.resolve(fixtureRoot, '../../apps/dental-apps', sourceApp);
        const metadata = JSON.parse(readFileSync(path.join(sourceRoot, 'app.json'), 'utf8')) as { appId: string; icon: string; anyCapabilities: string[]; modules: { capability: string }[] };
        metadata.appId = appId;
        metadata.anyCapabilities = ['fixture.module-preview'];
        for (const module of metadata.modules) module.capability = 'fixture.module-preview';
        for (const file of ['src/index.html', 'src/app.js', 'src/app.css', metadata.icon]) {
          const source=readFileSync(path.join(sourceRoot,file));
          const delayedAck=slowModuleAckFixture&&file==='src/app.js'?Buffer.from('\nlet firstModuleAck=true;window.dentalApp.onModuleSelected(()=>{if(!firstModuleAck)return;firstModuleAck=false;const deadline=performance.now()+2200;while(performance.now()<deadline){}});\n'):Buffer.alloc(0);
          files.set(file,delayedAck.length?Buffer.concat([source,delayedAck]):source);
        }
        files.set('app.json', Buffer.from(JSON.stringify(metadata)));
      }
      registry.install(buildPackage({ appId, publisher: 'company', version: '1.0.0', entry: modulePreviewFixture && index <= 2 ? 'src/index.html' : 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: [] }, files, keyId, pair.privateKey));
    }
  }
  return registry;
}
