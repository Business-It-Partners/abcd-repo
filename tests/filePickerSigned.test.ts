import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fixtureRegistry } from '../electron/packages/fixtures';
import type { PackageRegistry } from '../electron/packages/registry';

const directories:string[]=[];
afterEach(()=>{for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});});
describe('M16 signed isolated company file-picker fixture',()=>{
  it('verifies installed signed dental release against separate signed local capability policy',()=>{
    const root=mkdtempSync(path.join(tmpdir(),'m16-signed-test-'));directories.push(root);
    const fixtures=path.join(process.cwd(),'fixtures','packages');
    const registry:PackageRegistry=fixtureRegistry(root,fixtures,2,false,false,false,true);
    const lease=registry.launch('company.dental.patient-record');
    try{
      expect(lease.manifest.publisher).toBe('company');
      expect(lease.manifest.appId).toBe('company.dental.patient-record');
      expect(lease.manifest.capabilities).toContain('local.files.pick');
      expect(lease.manifest.capabilities).toContain('clinic.app.patient-record');
      expect(registry.authorizeLocalPick(lease)).toBe(true);
      expect(lease.files.has('index.html')).toBe(true);
      expect(lease.files.has('app.json')).toBe(true);
      expect(lease.files.get('index.html')?.toString().includes('window.dentalApp.request')).toBe(true);
    }finally{lease.releaseLease();}
    const denied=registry.launch('company.sample.beta');
    try{expect(registry.authorizeLocalPick(denied)).toBe(false);}finally{denied.releaseLease();}
  });
});
