// Explicit read-only identity acceptance. No user provisioning, revocation or business write.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { FirebaseClient } from '../dist-electron/identity/client.js';
import { SessionManager } from '../dist-electron/identity/session.js';
import { CredentialStore } from '../dist-electron/identity/storage.js';
import { staging } from '../dist-electron/sdk/environment.js';
if(!process.argv.includes('--staging-identity-readonly'))throw new Error('Explicit staging identity acceptance flag required');
let email=process.env.DENTMITRA_STAGING_TEST_EMAIL,password=process.env.DENTMITRA_STAGING_TEST_PASSWORD;
const file=process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
if(file){const s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.size>4096||(process.platform!=='win32'&&(s.mode&0o077)!==0))throw new Error('Unsafe credential input file');const v=JSON.parse(await fs.readFile(file,'utf8'));email=v.email;password=v.password;}
if(!email||!password)throw new Error('Approved staging credentials are required; values are never printed');
const checks=[];let phase='health',session,root;const check=(name,value)=>{if(!value)throw new Error('Acceptance case failed');checks.push(name);console.log('PASS',name);};
const deadline=()=>AbortSignal.timeout(8000);
let passed=false;
try{
 const health=await fetch(staging.apiBase+'/health',{signal:deadline(),redirect:'error',cache:'no-store'});const h=await health.json();check('live Worker identifies the mapped staging environment',health.ok&&h.environment===staging.environment&&h.status==='ok');
 phase='sign-in-and-clinic-resolution';root=await fs.mkdtemp(path.join(os.tmpdir(),'dental-live-identity-'));
 const store=new CredentialStore(path.join(root,'identity'),{available:()=>false,encrypt:async()=>{throw new Error('No persistence');},decrypt:async()=>{throw new Error('No persistence');}});
 const client=new FirebaseClient();let refreshedUid='';
 const proxy={signIn:(...args)=>client.signIn(...args),resolve:(...args)=>client.resolve(...args),refresh:async(...args)=>{const v=await client.refresh(...args);refreshedUid=v.uid;return v;}};
 session=new SessionManager(proxy,store,()=>{},'staging');await session.restore();const signed=await session.login({email,password,remember:false});password=undefined;
 check('approved staging Firebase login and Worker /v1/me establish clinic readiness',signed.ok&&session.view().phase==='ready');
 const generation=session.view().generation,before=session.snapshot();const token=await session.credential(generation,deadline());
 phase='refresh';const renewed=await session.refreshNow();check('live refresh and fresh Worker access resolution retain the same clinic session',!!renewed&&!!refreshedUid&&session.snapshot().generation===before.generation&&session.snapshot().clinicLabel===before.clinicLabel);
 phase='denial';const invalid=await fetch(staging.apiBase+'/v1/me',{headers:{authorization:'Bearer invalid-synthetic-token'},signal:deadline(),redirect:'manual'});check('live Worker rejects an invalid identity token',[401,403].includes(invalid.status));await invalid.body?.cancel();
 const denied=await fetch(staging.apiBase+'/v1/platform/tenants',{headers:{authorization:`Bearer ${token}`},signal:deadline(),redirect:'manual'});check('clinic identity does not grant Super Admin tenant access',denied.status===403);await denied.body?.cancel();await session.rejected(403);check('operation-level denial revalidates clinic access without granting platform authority',session.view().phase==='ready'&&session.view().generation===generation);
 let refused=false;try{await client.refresh('invalid-synthetic-refresh-token',deadline());}catch{refused=true;}check('live Firebase refuses an invalid refresh grant',refused);
 phase='logout';await session.logout();check('local sign-out clears authority and persisted credentials',!session.snapshot().active&&await store.load()===null);let stale=false;try{await session.credential(generation,deadline());}catch{stale=true;}check('signed-out generation cannot obtain a credential',stale);
 passed=true;
}finally{
 session?.dispose();await session?.flush();if(root)await fs.rm(root,{recursive:true,force:true});
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/identity-staging.json',JSON.stringify({passed,phase,checks,environment:staging.environment,apiBase:staging.apiBase,firebaseProject:staging.firebaseProject,source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Approved staging account, identity-only; no business writes/user mutations/global revocation; denied/disabled/outage state transitions additionally covered by controlled fixtures.'},null,2));
}
