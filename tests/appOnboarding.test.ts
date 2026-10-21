import {describe,it,expect} from 'vitest';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {canonical,buildPackage,sha256,verifyPackage,type TrustPolicy} from '../electron/packages/format';
import {PackageRegistry} from '../electron/packages/registry';
import {DistributionService} from '../electron/distribution/service';
import {CatalogueStore} from '../electron/distribution/storage';
import {noWatermark,verifyCatalogue,type Catalogue,type Release} from '../electron/distribution/catalogue';
import {verifyUpdatePolicy,type UpdatePolicy} from '../electron/distribution/updatePolicy';

const id='company.sample.preview';
const packageKey=generateKeyPairSync('ed25519'),metadataKey=generateKeyPairSync('ed25519');
const untrustedPackageKey=generateKeyPairSync('ed25519');
const now=1800000000000;
const trust:TrustPolicy={keys:{
  publisher:{publicKey:packageKey.publicKey.export({type:'spki',format:'pem'}).toString(),publisher:'company'},
  catalogue:{publicKey:metadataKey.publicKey.export({type:'spki',format:'pem'}).toString(),publisher:'company'},
},apps:{},companyApps:{publisher:'company',capabilities:[]}};
const packages=new Map<string,Buffer>();
for(const [version,content] of [
  ['1.0.0','Coming soon'],
  ['1.1.0','Your workspace is ready'],
  ['1.2.0','Release history'],
] as const)packages.set(version,buildPackage({appId:id,publisher:'company',version,entry:'index.html',sdkMajor:1,apiMajor:1,capabilities:[]},new Map([['index.html',Buffer.from(`<h1>${content}</h1>`)] ]),'publisher',packageKey.privateKey));

function release(version:string):Release{
  const bytes=packages.get(version)!;
  const envelope=JSON.parse(bytes.toString());
  const hash=sha256(bytes);
  return{id,title:'Dental Workspace Preview',description:'A first-party app update test.',version,notes:`Visible preview for ${version}.`,capabilities:[],platforms:['linux','win32'],sdkMajor:1,apiMajor:1,objectKey:`releases/${id}/${version}/${hash}.dentalpkg`,packageSha256:hash,packageBytes:bytes.length,payloadDigest:envelope.release.digest,status:'approved',minimumVersion:'1.0.0'};
}
function signed(field:'catalogue'|'policy',value:unknown){
  const purpose=field==='catalogue'?'dental-os-catalogue':'dental-os-update-policy';
  return Buffer.from(canonical({[field]:value,keyId:'catalogue',signature:sign(null,Buffer.from(canonical({purpose,keyId:'catalogue',[field]:value})),metadataKey.privateKey).toString('base64')}));
}

describe('generic first-party app onboarding and isolated app releases',()=>{
 it('installs a catalogue-authorized app and safely advances it through three independent versions',async()=>{
  const root=mkdtempSync(path.join(tmpdir(),'dental-onboarding-'));
  let version='1.0.0',sequence=1;
  const metadata=()=>{
    const issuedAt=now;
    const catalogue:Catalogue={format:1,environment:'cloudfare-staging',channel:'staging',sequence,issuedAt,expiresAt:now+3600000,releases:[release(version)]};
    const update:UpdatePolicy={format:1,environment:'cloudfare-staging',channel:'staging',sequence,issuedAt,expiresAt:now+3600000,revokedKeys:[],apps:[{id,capabilities:[],minimumVersion:'1.0.0',revokedDigests:[],rollback:null}]};
    return{catalogue:signed('catalogue',catalogue),policy:signed('policy',update)};
  };
  const registry=new PackageRegistry(path.join(root,'packages'),trust);registry.initialize();
  const identity={snapshot:()=>({active:true,generation:1,userLabel:'',clinicLabel:''}),credential:async()=> 'synthetic'};
  const api='https://api.fixture.invalid',origin='https://releases.fixture.invalid/';
  const transport:typeof fetch=async(input,init)=>{
    const url=String(input);
    if(url===api+'/v1/dental-os/install-policy')return Response.json({environment:'cloudfare-staging',canInstall:true});
    if(url===api+'/v1/dental-os/catalogue')return new Response(new Uint8Array(metadata().catalogue),{headers:{'x-dental-os-time':String(now)}});
    if(url===api+'/v1/dental-os/update-policy')return new Response(new Uint8Array(metadata().policy),{headers:{'x-dental-os-time':String(now)}});
    if(url.startsWith(origin)){expect(new Headers(init?.headers).has('authorization')).toBe(false);return new Response(new Uint8Array(packages.get(version)!));}
    return new Response(null,{status:404});
  };
  const service=new DistributionService({apiBase:api,publicBase:origin,policy:trust,updates:true},registry,identity,new CatalogueStore(path.join(root,'distribution')),transport,()=>now,'linux',500);
  try{
    const initial=metadata();
    expect(()=>verifyCatalogue(initial.catalogue,trust,noWatermark,now)).not.toThrow();
    expect(()=>verifyUpdatePolicy(initial.policy,trust,noWatermark,now)).not.toThrow();
    expect(()=>verifyPackage(packages.get(version)!,trust)).not.toThrow();
    const installed=await service.install(id);
    expect(installed.ok,service.view().message).toBe(true);
    expect(service.view().apps).toMatchObject([{id,title:'Dental Workspace Preview',installedVersion:'1.0.0'}]);
    const first=registry.launch(id);expect(first.manifest.version).toBe('1.0.0');registry.markHealthy(id,first.release.digest);first.releaseLease();
    for(const next of ['1.1.0','1.2.0']){
      version=next;sequence++;
      await service.checkUpdates();
      expect(service.view().apps[0].pendingVersion).toBe(next);
      let running='';
      expect((await service.updateNow(id,appId=>{const lease=registry.launch(appId);running=lease.manifest.version;registry.markHealthy(appId,lease.release.digest);lease.releaseLease();})).ok).toBe(true);
      expect(running).toBe('');
      expect(registry.describe(id)).toMatchObject({activeVersion:version==='1.1.0'?'1.0.0':'1.1.0',pendingVersion:next,trialVersion:null});
      const trial=registry.launch(id);expect(trial.manifest.version).toBe(next);registry.markHealthy(id,trial.release.digest);trial.releaseLease();
      expect(registry.describe(id).version).toBe(next);
      const current=registry.launch(id);expect(current.manifest.version).toBe(next);current.releaseLease();
    }
    expect(Object.keys(registry.inspect().apps)).toEqual([id]);
  }finally{service.dispose();rmSync(root,{recursive:true,force:true});}
 });
 it('accepts only a signed first-party ID within the platform capability ceiling',()=>{
  const bytes=buildPackage({appId:id,publisher:'company',version:'1.0.0',entry:'index.html',sdkMajor:1,apiMajor:1,capabilities:[]},new Map([['index.html',Buffer.from('<h1>Ready</h1>')]]),'publisher',packageKey.privateKey);
  expect(()=>verifyPackage(bytes,trust)).not.toThrow();
  const overGrant=buildPackage({appId:id,publisher:'company',version:'1.0.0',entry:'index.html',sdkMajor:1,apiMajor:1,capabilities:['appointments.list']},new Map([['index.html',Buffer.from('<h1>Ready</h1>')]]),'publisher',packageKey.privateKey);
  expect(()=>verifyPackage(overGrant,trust)).toThrow('Capability exceeds platform policy');
  const untrusted=buildPackage({appId:id,publisher:'company',version:'1.0.0',entry:'index.html',sdkMajor:1,apiMajor:1,capabilities:[]},new Map([['index.html',Buffer.from('<h1>Ready</h1>')]]),'untrusted-publisher',untrustedPackageKey.privateKey);
  expect(()=>verifyPackage(untrusted,trust)).toThrow('Untrusted release');
 });
});
