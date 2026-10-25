import { describe,it,expect } from 'vitest';
import { mkdtemp,readFile,writeFile,mkdir,rm,symlink,stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createCipheriv,createDecipheriv,randomBytes } from 'node:crypto';
import { CredentialStore,adequateStorage,type SecretProvider } from '../electron/identity/storage';
import { SessionManager } from '../electron/identity/session';
import { AuthFailure,FirebaseClient,type AuthClient,type Clinic,type Tokens } from '../electron/identity/client';
import { staging } from '../electron/sdk/environment';
import { ApiBroker } from '../electron/sdk/broker';
const clinic:Clinic={userLabel:'Synthetic doctor',clinicLabel:'Fixture clinic',role:'doctor',tenantId:'tenant-fixture',clinicUserId:'user-fixture',capabilities:['appointments.access']};
const token=(uid='fixture-user',n=1):Tokens=>({uid,idToken:`fixture-id-${uid}-${n}`,refreshToken:`fixture-refresh-${uid}-${n}`,expiresAt:Date.now()+3600_000});
function encryptedProvider(available=true):SecretProvider{
 const key=randomBytes(32);
 return{available:()=>available,encrypt:async value=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(value),c.final(),c.getAuthTag()]);},decrypt:async value=>{const d=createDecipheriv('aes-256-gcm',key,value.subarray(0,12));d.setAuthTag(value.subarray(-16));return Buffer.concat([d.update(value.subarray(12,-16)),d.final()]).toString();}};
}
async function harness(clientOverride?:Partial<AuthClient>,available=true,timeout=100,diagnostic?:(value:{stage:string;outcome:string})=>void){
 const root=await mkdtemp(path.join(tmpdir(),'dental-identity-unit-'));let invalidated=0,refreshes=0;
 const store=new CredentialStore(path.join(root,'identity'),encryptedProvider(available));
 const client:AuthClient={signIn:async email=>token(email),refresh:async()=>token('user@fixture.invalid',++refreshes+1),resolve:async()=>clinic,...clientOverride};
 const session=new SessionManager(client,store,()=>invalidated++,'fixture',Date.now,timeout,diagnostic);
 await session.restore();
 return{session,client,store,root,invalidated:()=>invalidated,refreshes:()=>refreshes,close:async()=>{session.dispose();await session.flush();await rm(root,{recursive:true,force:true});}};
}
const input={email:'user@fixture.invalid',password:'fixture-pass'};
describe('protected credential storage',()=>{
 it('rejects basic_text, unknown and unavailable Linux storage with no plaintext fallback',async()=>{
  expect(adequateStorage('linux',true,'basic_text')).toBe(false);expect(adequateStorage('linux',true,'unknown')).toBe(false);expect(adequateStorage('linux',false,'gnome_libsecret')).toBe(false);expect(adequateStorage('linux',true,'gnome_libsecret')).toBe(true);expect(adequateStorage('win32',true,'os-protected')).toBe(true);
  const h=await harness(undefined,false);try{expect(await h.session.login(input)).toEqual({ok:true});expect(h.session.view()).toMatchObject({phase:'ready',rememberAvailable:false,remembered:false});expect(h.session.view().message).toContain('session-only');await expect(readFile(path.join(h.root,'identity/refresh.enc'))).rejects.toMatchObject({code:'ENOENT'});}finally{await h.close();}
 });
 it('persists only ciphertext, rotates remembered token and clears on logout',async()=>{
  const h=await harness();try{await h.session.login(input);const file=path.join(h.root,'identity/refresh.enc'),bytes=await readFile(file);expect(bytes.toString()).not.toContain('fixture-refresh');expect(bytes.toString()).not.toContain('fixture-pass');expect(await h.store.load()).toBe('fixture-refresh-user@fixture.invalid-1');expect(h.session.view().remembered).toBe(true);if(process.platform!=='win32')expect((await stat(file)).mode&0o777).toBe(0o600);
   await h.session.refreshNow();expect(await h.store.load()).toBe('fixture-refresh-user@fixture.invalid-2');await h.session.logout();await expect(readFile(file)).rejects.toMatchObject({code:'ENOENT'});
  }finally{await h.close();}
 });
 it('restores the saved session after the app session manager is recreated',async()=>{
  const h=await harness();let reopened:SessionManager|undefined;
  try{
   expect(await h.session.login(input)).toEqual({ok:true});
   await h.session.flush();h.session.dispose();
   reopened=new SessionManager(h.client,h.store,()=>{},'fixture');
   expect(reopened.view().phase).toBe('restoring');
   expect(await reopened.restore()).toEqual({ok:true});
   expect(reopened.view()).toMatchObject({phase:'ready',userLabel:clinic.userLabel,clinicLabel:clinic.clinicLabel,remembered:true});
   expect(h.refreshes()).toBe(1);
   expect(await h.store.load()).toBe('fixture-refresh-user@fixture.invalid-2');
   await reopened.logout();await reopened.flush();
  }finally{reopened?.dispose();await h.close();}
 });
 it('keeps the encrypted saved credential during a service outage and retries restoration',async()=>{
  const h=await harness(undefined,true,25);let reopened:SessionManager|undefined;
  try{
   expect(await h.session.login(input)).toEqual({ok:true});await h.session.flush();
   const saved=await h.store.load();expect(saved).toBeTruthy();
   h.client.refresh=async()=>{throw new AuthFailure('unavailable');};
   reopened=new SessionManager(h.client,h.store,()=>{},'fixture');
   expect(await reopened.restore()).toEqual({ok:false,code:'UNAVAILABLE'});
   expect(reopened.view()).toMatchObject({phase:'unavailable',remembered:false});
   expect(reopened.view().message).toContain('It has been kept');
   expect(await h.store.load()).toBe(saved);
   h.client.refresh=(_token,signal)=>new Promise<Tokens>((_resolve,reject)=>signal.addEventListener('abort',()=>reject(new AuthFailure('unavailable')),{once:true}));
   expect(await reopened.restore()).toEqual({ok:false,code:'UNAVAILABLE'});
   expect(reopened.view()).toMatchObject({phase:'unavailable',restoreAvailable:true});
   expect(await h.store.load()).toBe(saved);
   h.client.refresh=async()=>token(input.email,3);
   expect(await reopened.restore()).toEqual({ok:true});
   expect(reopened.view()).toMatchObject({phase:'ready',remembered:true});
   expect(await h.store.load()).toBe('fixture-refresh-user@fixture.invalid-3');
  }finally{reopened?.dispose();await h.close();}
 });
 it('clears a saved credential only when refresh confirms it is invalid or revoked',async()=>{
  const h=await harness();let reopened:SessionManager|undefined;
  try{
   expect(await h.session.login(input)).toEqual({ok:true});await h.session.flush();
   h.client.refresh=async()=>{throw new AuthFailure('denied',true);};
   reopened=new SessionManager(h.client,h.store,()=>{},'fixture');
   expect(await reopened.restore()).toEqual({ok:false,code:'DENIED'});
   expect(reopened.view()).toMatchObject({phase:'expired',remembered:false});
   expect(await h.store.load()).toBeNull();
  }finally{reopened?.dispose();await h.close();}
 });
 it('keeps an existing saved credential if a new manual sign-in hits an outage',async()=>{
  const h=await harness();
  try{
   expect(await h.session.login(input)).toEqual({ok:true});
   const saved=await h.store.load();expect(saved).toBeTruthy();
   h.client.signIn=async()=>{throw new AuthFailure('unavailable');};
   expect(await h.session.login({...input,email:'second@fixture.invalid'})).toEqual({ok:false,code:'UNAVAILABLE'});
   expect(h.session.view()).toMatchObject({phase:'unavailable',restoreAvailable:true});
   expect(await h.store.load()).toBe(saved);
  }finally{await h.close();}
 });
 it('refuses symlink/corrupt credentials and preserves unrelated target files',async()=>{
  const h=await harness();try{const outside=path.join(h.root,'unrelated');await writeFile(outside,'preserve');const file=path.join(h.root,'identity/refresh.enc');await mkdir(path.dirname(file),{recursive:true,mode:0o700});
   if(process.platform!=='win32'){await symlink(outside,file);await expect(h.store.load()).rejects.toThrow();await expect(h.store.save('new')).rejects.toThrow();expect(await readFile(outside,'utf8')).toBe('preserve');await rm(file);}
   await writeFile(file,'corrupt',{mode:0o600});await expect(h.store.load()).rejects.toThrow();expect(await readFile(file,'utf8')).toBe('corrupt');
  }finally{await h.close();}
 });
 it('uses session-only mode when protected storage fails and never reports a saved session',async()=>{
  const h=await harness();try{const provider={available:()=>true,encrypt:async()=>{throw new Error('provider locked');},decrypt:async()=>{throw new Error('provider locked');}};const store=new CredentialStore(path.join(h.root,'failing'),provider);const s=new SessionManager(h.client,store,()=>{},'fixture');await s.restore();expect(await s.login(input)).toEqual({ok:true});expect(s.view()).toMatchObject({remembered:false,phase:'ready'});expect(s.view().message).toContain('session-only');s.dispose();await s.flush();}finally{await h.close();}
 });
});
describe('single platform session',()=>{
 it('reports only the failed authentication stage through an opt-in diagnostic observer',async()=>{
  const reports:{stage:string;outcome:string}[]=[];const h=await harness({signIn:async()=>{throw new AuthFailure('denied');}},true,100,value=>reports.push(value));
  try{
   expect(await h.session.login(input)).toMatchObject({ok:false,code:'DENIED'});
   expect(reports).toEqual([{stage:'firebase-sign-in',outcome:'started'},{stage:'firebase-sign-in',outcome:'denied'}]);
   h.client.signIn=async()=>token(input.email);
   h.client.resolve=async()=>{throw new AuthFailure('unavailable');};
   expect(await h.session.login(input)).toMatchObject({ok:false,code:'UNAVAILABLE'});
   expect(reports.slice(2)).toEqual([{stage:'firebase-sign-in',outcome:'started'},{stage:'clinic-session-resolve',outcome:'started'},{stage:'clinic-session-resolve',outcome:'unavailable'}]);
   expect(JSON.stringify(reports)).not.toContain(input.email);expect(JSON.stringify(reports)).not.toContain(input.password);
  }finally{await h.close();}
 });
 it('does not become ready before Worker clinic access and gives apps no credentials',async()=>{
  let resolve!:(v:Clinic)=>void;const h=await harness({resolve:()=>new Promise(r=>resolve=r)});try{const login=h.session.login(input);await new Promise(r=>setTimeout(r,5));expect(h.session.view().phase).toBe('signing-in');expect(h.session.snapshot().active).toBe(false);resolve(clinic);expect(await login).toEqual({ok:true});expect(h.session.allowed('appointments.list')).toBe(true);expect(JSON.stringify(h.session.view())).not.toContain('fixture-id');expect(JSON.stringify(h.session.view())).not.toContain('fixture-refresh');}finally{await h.close();}
 });
 it('denies disabled/missing clinic or Super Admin-only shapes and handles unavailable service',async()=>{
  for(const failure of ['denied','unavailable'] as const){const h=await harness({resolve:async()=>{throw new AuthFailure(failure);}});try{expect((await h.session.login(input)).ok).toBe(false);expect(h.session.snapshot().active).toBe(false);expect(h.session.view().phase).toBe(failure==='denied'?'signed-out':'unavailable');}finally{await h.close();}}
 });
 it('serializes refresh and expires revoked sessions, without a business-write retry',async()=>{
  let count=0;const h=await harness({refresh:async()=>{count++;await new Promise(r=>setTimeout(r,5));return token(input.email,2);}});try{await h.session.login(input);const epoch=h.session.view().generation;const results=await Promise.all([h.session.refreshNow(),h.session.refreshNow(),h.session.credential(epoch,new AbortController().signal)]);expect(count).toBe(1);expect(results[0]).toBe(results[1]);h.client.refresh=async()=>{throw new AuthFailure('denied',true);};await expect(h.session.refreshNow()).rejects.toThrow();expect(h.session.view().phase).toBe('expired');expect(h.session.view().generation).toBeGreaterThan(epoch);expect(await h.store.load()).toBeNull();}finally{await h.close();}
 });
 it('rejects malformed/concurrent login and bounded hangs, and destroys authority on lock',async()=>{
  const h=await harness({signIn:()=>new Promise(()=>{})},true,25);try{expect(await h.session.login({...input,token:'forged'})).toEqual({ok:false,code:'INVALID_INPUT'});const login=h.session.login(input);expect(await h.session.login(input)).toEqual({ok:false,code:'BUSY'});expect(await login).toEqual({ok:false,code:'UNAVAILABLE'});expect(h.session.snapshot().active).toBe(false);}finally{await h.close();}
  const good=await harness();try{await good.session.login(input);const old=good.session.view().generation;good.session.lock();expect(good.session.view()).toMatchObject({phase:'locked',userLabel:'',clinicLabel:''});expect(good.session.view().generation).toBeGreaterThan(old);await good.session.flush();expect(await good.store.load()).toBeNull();await expect(good.session.credential(old,new AbortController().signal)).rejects.toThrow();}finally{await good.close();}
 });
 it('rechecks operation denial without logging out valid users, then expires revoked membership',async()=>{
  const h=await harness();try{await h.session.login(input);await Promise.all([h.session.rejected(403),h.session.rejected(403)]);expect(h.session.view().phase).toBe('ready');const saved=await h.store.load();h.client.resolve=async()=>{throw new AuthFailure('denied');};await h.session.rejected(403);expect(h.session.view().phase).toBe('unavailable');expect(await h.store.load()).toBe(saved);}finally{await h.close();}
 });
 it('prevents a late sign-in from resurrecting a logged-out session',async()=>{
  let finish!:(v:Tokens)=>void;const h=await harness({signIn:()=>new Promise(r=>finish=r)});try{const login=h.session.login(input);await new Promise(r=>setTimeout(r,5));await h.session.logout();finish(token(input.email));expect((await login).ok).toBe(false);expect(h.session.view().phase).toBe('signed-out');expect(await h.store.load()).toBeNull();}finally{await h.close();}
 });
 it('binds Worker capabilities and revokes old response/write authority during account switch',async()=>{
  const h=await harness();const sender={},frame={},caller={sender,frame,url:'dental-fixture://alpha/index.html'};let release!:(r:Response)=>void;
  const broker=new ApiBroker(staging,h.session,()=>new Promise(r=>release=r),{timeoutMs:150,responseBytes:4096,perApp:2,total:2,operationKeys:4});
  try{await h.session.login(input);broker.register({sender,frame,origin:caller.url,appId:'company.sample.alpha',appVersion:'1.0.0',capabilities:['appointments.setStatus'],authorizeApiOperation:()=>true,report:()=>{}});const connected=broker.connect(caller,{major:1,minor:0});if(!connected.ok)throw new Error('connect');const c=connected.value;
   const pending=broker.request(caller,{version:1,connection:c.connection,generation:c.generation,requestId:'session_write_1',operation:'appointments.setStatus',input:{appointmentId:'11111111-1111-4111-8111-111111111111',status:'arrived',expectedRowVersion:1,idempotencyKey:'session_op_1'}});await new Promise(r=>setTimeout(r,5));await h.session.logout();await h.session.login({...input,email:'other@fixture.invalid'});release(Response.json({appointment:{}}));const result=await pending;expect(result.ok?null:result.error).toMatchObject({code:'STALE_SESSION',outcome:'unknown'});
   h.client.refresh=async()=>token('other@fixture.invalid',3);h.client.resolve=async()=>({...clinic,capabilities:[]});await h.session.refreshNow().catch(()=>{});expect(h.session.allowed('appointments.list')).toBe(false);
  }finally{broker.dispose();await h.close();}
 });
});
describe('session-scoped media upload gate',()=>{
 it('authorizes only the matching first-party app and media kind from trusted clinic claims',async()=>{
  const h=await harness({resolve:async()=>({...clinic,role:'admin',capabilities:['patient_record.access','work_entry.access','staff.manage']})});
  try{
   expect(h.session.allowedMediaUpload('clinic.app.patient-record','patient_media')).toBe(false);
   expect((await h.session.login(input)).ok).toBe(true);
   expect(h.session.allowedMediaUpload('clinic.app.patient-record','patient_media')).toBe(true);
   expect(h.session.allowedMediaUpload('clinic.app.patient-record','staff_document')).toBe(false);
   expect(h.session.allowedMediaUpload('clinic.app.staff','staff_document')).toBe(true);
   expect(h.session.allowedMediaUpload('clinic.app.staff','patient_media')).toBe(false);
   expect(h.session.allowedMediaUpload('clinic.app.work-entry','patient_media')).toBe(true);
   expect(h.session.allowedMediaUpload('clinic.app.calendar','patient_media')).toBe(false);
   h.session.lock();
   expect(h.session.allowedMediaUpload('clinic.app.patient-record','patient_media')).toBe(false);
   expect(h.session.allowedMediaUpload('clinic.app.staff','staff_document')).toBe(false);
  }finally{await h.close();}
 });
 it('denies uploads when the clinic session lacks the owning app capability',async()=>{
  const h=await harness({resolve:async()=>({...clinic,role:'admin',capabilities:['appointments.access']})});
  try{
   expect((await h.session.login(input)).ok).toBe(true);
   expect(h.session.allowedMediaUpload('clinic.app.patient-record','patient_media')).toBe(false);
   expect(h.session.allowedMediaUpload('clinic.app.staff','staff_document')).toBe(false);
  }finally{await h.close();}
 });
 it('advertises upload to the host broker only for an authorized session and exact signed operation grant',async()=>{
  const h=await harness({resolve:async()=>({...clinic,role:'admin',capabilities:['patient_record.access']})});
  const broker=new ApiBroker(staging,h.session),trustedSender={},trustedFrame={},trustedUrl='dental-fixture://patient-record/index.html';
  const trustedCaller={sender:trustedSender,frame:trustedFrame,url:trustedUrl};
  const deniedSender={},deniedFrame={},deniedUrl='dental-fixture://ungranted-patient-record/index.html';
  try{
   expect((await h.session.login(input)).ok).toBe(true);
   broker.register({sender:trustedSender,frame:trustedFrame,origin:trustedUrl,appId:'company.dental.patient-record',appVersion:'1.0.0',capabilities:['clinic.app.patient-record','clinic.media.upload'],authorizeApiOperation:operation=>operation==='clinic.media.upload',report(){}});
   const trusted=broker.connect(trustedCaller,{major:1,minor:4});
   expect(trusted.ok).toBe(true);
   if(trusted.ok)expect(trusted.value.capabilities).toContain('clinic.media.upload');
   broker.register({sender:deniedSender,frame:deniedFrame,origin:deniedUrl,appId:'company.dental.patient-record',appVersion:'1.0.0',capabilities:['clinic.app.patient-record','clinic.media.upload'],authorizeApiOperation:()=>false,report(){}});
   const denied=broker.connect({sender:deniedSender,frame:deniedFrame,url:deniedUrl},{major:1,minor:4});
   expect(denied.ok).toBe(true);
   if(denied.ok)expect(denied.value.capabilities).not.toContain('clinic.media.upload');
  }finally{broker.dispose();await h.close();}
 });
 it('loads the private clinic logo once per session and clears the cached image on logout',async()=>{
  const dataUrl='data:image/png;base64,c3ludGhldGlj';let logoReads=0;
  const h=await harness({clinicLogo:async()=>{logoReads++;return dataUrl;}});
  try{
   expect(await h.session.clinicLogo()).toBeUndefined();expect(logoReads).toBe(0);
   expect((await h.session.login(input)).ok).toBe(true);
   const [first,second]=await Promise.all([h.session.clinicLogo(),h.session.clinicLogo()]);
   expect(first).toBe(dataUrl);expect(second).toBe(dataUrl);expect(logoReads).toBe(1);
   await h.session.logout();expect(await h.session.clinicLogo()).toBeUndefined();expect(logoReads).toBe(1);
  }finally{await h.close();}
 });
 it('drops a pending clinic-logo result when the session is cleared',async()=>{
  let finish!:(value:string|undefined)=>void;let reads=0;
  const h=await harness({clinicLogo:async()=>{reads++;return new Promise(resolve=>finish=resolve);}});
  try{
   expect((await h.session.login(input)).ok).toBe(true);
   const pending=h.session.clinicLogo();await new Promise(resolve=>setTimeout(resolve,0));expect(reads).toBe(1);
   await h.session.logout();finish('data:image/png;base64,stale');
   expect(await pending).toBeUndefined();expect(await h.session.clinicLogo()).toBeUndefined();
  }finally{await h.close();}
 });
});
describe('Firebase/Worker fixed-endpoint contract',()=>{
 const jwt=(project=staging.firebaseProject)=>`header.${Buffer.from(JSON.stringify({aud:project,iss:`https://securetoken.google.com/${project}`,sub:'fixture-user',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')}.signature`;
 it('keeps email/password and refresh token in host transport and checks /v1/me shape',async()=>{
  const sent:{url:string;init:RequestInit}[]=[];const client=new FirebaseClient(async(url,init)=>{sent.push({url:String(url),init:init!});return Response.json(String(url).includes('/v1/me')?{session:{clinicUser:{clinicUserId:'user',displayName:'Doctor',role:'doctor',capabilities:['appointments.access']},clinic:{tenantId:'tenant',displayName:'Clinic'}}}:String(url).includes('securetoken.googleapis.com')?{id_token:jwt(),refresh_token:'refresh-rotated',user_id:'fixture-user',expires_in:'3600'}:{idToken:jwt(),refreshToken:'refresh-original',localId:'fixture-user',expiresIn:'3600'});});
  const signal=new AbortController().signal,t=await client.signIn(input.email,input.password,signal);await client.resolve(t.idToken,signal);const renewed=await client.refresh(t.refreshToken,signal);expect(renewed.refreshToken).toBe('refresh-rotated');expect(sent[0].url).toContain('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword');expect(JSON.parse(sent[0].init.body as string)).toMatchObject({email:input.email,password:input.password});expect(sent[1].url).toBe(staging.apiBase+'/v1/me');expect(sent[2].init.body).toBe('grant_type=refresh_token&refresh_token=refresh-original');expect(sent.every(v=>v.init.redirect==='manual'&&v.init.cache==='no-store')).toBe(true);
 });
 it('rejects production tokens, redirects, malformed/oversized responses and wrong authority shape',async()=>{
  const responses=[Response.json({idToken:jwt('production' as typeof staging.firebaseProject),refreshToken:'r',localId:'fixture-user',expiresIn:'3600'}),new Response(null,{status:302,headers:{location:'https://evil.invalid'}}),Response.json({token:'bad'}),new Response('x'.repeat(66000),{headers:{'content-type':'application/json'}})];
  for(const response of responses){const c=new FirebaseClient(async()=>response);await expect(c.signIn(input.email,input.password,new AbortController().signal)).rejects.toThrow(AuthFailure);}
  const c=new FirebaseClient(async()=>Response.json({session:{platformAdmin:{role:'admin'}}}));await expect(c.resolve('fixture',new AbortController().signal)).rejects.toThrow(AuthFailure);
 });
 it('classifies only explicit invalid credentials as clearable and keeps temporary/access failures retryable',async()=>{
  const response=(status:number,error:Record<string,unknown>)=>new Response(JSON.stringify({error}),{status,headers:{'content-type':'application/json'}});
  const invalidRefresh=new FirebaseClient(async()=>response(400,{message:'INVALID_REFRESH_TOKEN'}));
  await expect(invalidRefresh.refresh('stored-refresh-token',new AbortController().signal)).rejects.toMatchObject({kind:'denied',credentialInvalid:true});
  const expiredRefresh=new FirebaseClient(async()=>response(400,{message:'TOKEN_EXPIRED'}));
  await expect(expiredRefresh.refresh('stored-refresh-token',new AbortController().signal)).rejects.toMatchObject({kind:'denied',credentialInvalid:true});
  const configFailure=new FirebaseClient(async()=>response(400,{message:'PROJECT_NUMBER_MISMATCH'}));
  await expect(configFailure.refresh('stored-refresh-token',new AbortController().signal)).rejects.toMatchObject({kind:'unavailable',credentialInvalid:false});
  const serviceFailure=new FirebaseClient(async()=>response(503,{message:'SERVICE_UNAVAILABLE'}));
  await expect(serviceFailure.refresh('stored-refresh-token',new AbortController().signal)).rejects.toMatchObject({kind:'unavailable',credentialInvalid:false});
  const clinicDenied=new FirebaseClient(async()=>response(403,{code:'clinic_access_denied'}));
  await expect(clinicDenied.resolve('id-token',new AbortController().signal)).rejects.toMatchObject({kind:'denied',credentialInvalid:false});
  const clinicRevoked=new FirebaseClient(async()=>response(401,{code:'clinic_auth_required'}));
  await expect(clinicRevoked.resolve('id-token',new AbortController().signal)).rejects.toMatchObject({kind:'denied',credentialInvalid:true});
 });
 it('fetches only the authenticated clinic logo from the private branding endpoint',async()=>{
  const sent:{url:string;init:RequestInit}[]=[];const png=Uint8Array.from([137,80,78,71,13,10,26,10]);
  const client=new FirebaseClient(async(url,init)=>{sent.push({url:String(url),init:init!});return new Response(png,{headers:{'content-type':'image/png'}});});
  const value=await client.clinicLogo('host-held-id-token',new AbortController().signal);
  expect(value).toBe(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
  expect(sent).toHaveLength(1);expect(sent[0].url).toBe(staging.apiBase+'/v1/clinic/branding/logo/view');
  expect(sent[0].init).toMatchObject({method:'POST',redirect:'manual',credentials:'omit',cache:'no-store'});
  expect(new Headers(sent[0].init.headers).get('authorization')).toBe('Bearer host-held-id-token');
  expect(sent[0].init.body).toBeUndefined();
 });
 it('uses the initials fallback for absent, unsupported, or oversized clinic logos',async()=>{
  const signal=new AbortController().signal;
  const absent=new FirebaseClient(async()=>new Response(null,{status:404}));
  const unsupported=new FirebaseClient(async()=>new Response('<svg/>',{headers:{'content-type':'image/svg+xml'}}));
  let oversizedBodyRead=false;const oversizedHeaderResponse=new Response(new Uint8Array([1]),{headers:{'content-type':'image/png','content-length':'2000001'}});
  Object.defineProperty(oversizedHeaderResponse.body,'getReader',{value:()=>{oversizedBodyRead=true;throw new Error('oversized response should not be read');}});
  const oversizedHeader=new FirebaseClient(async()=>oversizedHeaderResponse);
  const oversizedStream=new FirebaseClient(async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(2_000_001));}}),{headers:{'content-type':'image/png'}}));
  await expect(absent.clinicLogo('token',signal)).resolves.toBeUndefined();
  await expect(unsupported.clinicLogo('token',signal)).resolves.toBeUndefined();
  await expect(oversizedHeader.clinicLogo('token',signal)).resolves.toBeUndefined();
  expect(oversizedBodyRead).toBe(false);
  await expect(oversizedStream.clinicLogo('token',signal)).resolves.toBeUndefined();
 });
});
