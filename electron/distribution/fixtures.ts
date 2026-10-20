/** Private-profile transport fixtures; no request can escape to the network. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonical, sha256, verifyPackage, type TrustPolicy } from '../packages/format';
import { operations, type Operation } from '../sdk/contracts';
import type { Catalogue, Release } from './catalogue';

type FixtureState={version:'1.0.0'|'1.1.0';gammaVersion?:'1.0.0'|'1.1.0'|'1.2.0';offset:number};
type DistributionFixtureOptions={unavailableControlFile?:string;packageDelayMs?:number};
export function distributionFixtures(folder: string, sequence: number, updateControlFile?: string, includeOnboarding=false, options:DistributionFixtureOptions={}) {
 const key = generateKeyPairSync('ed25519');
 const keys:Record<string,{publicKey:string;publisher:string}>={
  'test-only-m06':{publicKey:readFileSync(path.join(folder,'public-key.txt'),'utf8'),publisher:'company'},
  'test-only-catalogue':{publicKey:key.publicKey.export({type:'spki',format:'pem'}).toString(),publisher:'company'},
 };
 if(includeOnboarding)keys['test-only-onboarding']={publicKey:readFileSync(path.join(folder,'onboarding-public-key.txt'),'utf8'),publisher:'company'};
 const policy:TrustPolicy={keys,companyApps:{publisher:'company',capabilities:operations},apps:{
  'company.sample.alpha':{publisher:'company',capabilities:operations},
  'company.sample.beta':{publisher:'company',capabilities:operations.filter(op=>op!=='appointments.setStatus')},
 }};
 const objects=new Map<string,Buffer>(), pool=new Map<string,Release[]>();
 function add(id:string,title:string,description:string,version:string,file:string){
  const bytes=readFileSync(path.join(folder,file)),pkg=verifyPackage(bytes,policy);
  if(pkg.manifest.appId!==id||pkg.manifest.version!==version)throw Error('Fixture package identity mismatch');
  const capabilities=pkg.manifest.capabilities,envelope=JSON.parse(bytes.toString()),digest=sha256(bytes),objectKey=`releases/${id}/${version}/${digest}.dentalpkg`;
  objects.set('/'+objectKey,bytes);
  const release:Release={id,title,description,version,notes:version==='1.0.0'?'Signed first-party staging sample.':`Signed first-party ${version} sample update.`,capabilities:[...capabilities],platforms:['linux','win32'],sdkMajor:1,apiMajor:1,objectKey,packageSha256:digest,packageBytes:bytes.length,payloadDigest:envelope.release.digest,status:'approved',minimumVersion:'1.0.0'};
  pool.set(`${id}:${version}`,[...(pool.get(`${id}:${version}`)??[]),release]);
 }
 const sampleVersions=updateControlFile?['1.0.0','1.1.0']:['1.0.0'];
 for(const host of ['alpha','beta'])for(const version of sampleVersions){
  const id=`company.sample.${host}`,file=`${host}${version==='1.0.0'?'':'-update'}.dentalpkg`;
  add(id,host==='alpha'?'Motion Studio':'Records','Company sample with synthetic in-memory workflows.',version,file);
 }
 if(includeOnboarding)for(const version of ['1.0.0','1.1.0','1.2.0'])add('company.sample.preview','Dental Workspace Preview','A small first-party app used to verify independent app releases.',version,`preview-${version}.dentalpkg`);
 function selected(state:FixtureState){
  const releases:Release[]=[];
  for(const host of ['alpha','beta']){const id=`company.sample.${host}`,release=pool.get(`${id}:${state.version}`)?.[0];if(!release)throw Error('Fixture app version');releases.push(release);}
  if(includeOnboarding){const release=pool.get(`company.sample.preview:${state.gammaVersion??'1.0.0'}`)?.[0];if(!release)throw Error('Fixture onboarding version');releases.push(release);}
  return releases;
 }
 const now=Date.now(),initialState:FixtureState={version:'1.0.0',gammaVersion:'1.0.0',offset:0};
 const catalogue:Catalogue={format:1,environment:'cloudfare-staging',channel:'staging',sequence,issuedAt:now,expiresAt:now+86400000,releases:selected(initialState)};
 const signValue=(purpose:string,field:string,value:unknown)=>Buffer.from(canonical({[field]:value,keyId:'test-only-catalogue',signature:sign(null,Buffer.from(canonical({purpose,keyId:'test-only-catalogue',[field]:value})),key.privateKey).toString('base64')}));
 const body=signValue('dental-os-catalogue','catalogue',catalogue);
 const bodies=new Map<string,{catalogue:Buffer;policy:Buffer}>();
 function current(){
  let state:FixtureState=initialState;
  try{if(updateControlFile)state={...initialState,...JSON.parse(readFileSync(updateControlFile,'utf8'))};}catch{}
  if(!['1.0.0','1.1.0'].includes(state.version)||includeOnboarding&&!['1.0.0','1.1.0','1.2.0'].includes(state.gammaVersion??'1.0.0')||!Number.isSafeInteger(state.offset)||state.offset<0||state.offset>100)throw Error('Fixture state');
  const name=JSON.stringify(state);let cached=bodies.get(name);if(cached)return cached;
  const releases=selected(state),issuedAt=now,sequenceNumber=sequence+state.offset;
  const c:Catalogue={...catalogue,sequence:sequenceNumber,issuedAt,releases};
  const p={format:1 as const,environment:'cloudfare-staging' as const,channel:'staging' as const,sequence:sequenceNumber,issuedAt,expiresAt:now+86400000,revokedKeys:[],apps:releases.map(release=>({id:release.id,capabilities:[...release.capabilities],minimumVersion:'1.0.0',revokedDigests:[],rollback:null}))};
  cached={catalogue:signValue('dental-os-catalogue','catalogue',c),policy:signValue('dental-os-update-policy','policy',p)};bodies.set(name,cached);return cached;
 }
 const transport:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));if(init?.signal?.aborted)throw Error('Cancelled');
  if(options.unavailableControlFile&&existsSync(options.unavailableControlFile)&&url.origin==='https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev')return new Response(null,{status:503});
  if(url.origin==='https://releases.fixture.invalid'){
   if(options.packageDelayMs)await new Promise(resolve=>setTimeout(resolve,options.packageDelayMs));
   if(new Headers(init?.headers).has('authorization'))throw Error('Credential leaked');const data=objects.get(url.pathname);return data?new Response(new Uint8Array(data)):new Response(null,{status:404});
  }
  if(url.origin!=='https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev'||!new Headers(init?.headers).get('authorization'))return new Response(null,{status:403});
  if(url.pathname==='/v1/dental-os/catalogue')return new Response(new Uint8Array(updateControlFile?current().catalogue:body),{headers:{'x-dental-os-time':String(Date.now())}});
  if(updateControlFile&&url.pathname==='/v1/dental-os/update-policy')return new Response(new Uint8Array(current().policy),{headers:{'x-dental-os-time':String(Date.now())}});
  if(url.pathname==='/v1/dental-os/install-policy')return Response.json({environment:'cloudfare-staging',canInstall:true});
  return new Response(null,{status:404});
 };
 return{config:{updates:!!updateControlFile,apiBase:'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev',publicBase:'https://releases.fixture.invalid/',policy},transport,catalogue:body};
}
