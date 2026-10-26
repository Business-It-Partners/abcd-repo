import { describe, it, expect } from 'vitest';
import { ApiBroker, type Identity, type Transport, type Caller } from '../electron/sdk/broker';
import { SDK, operations, parseRequest, type Connection, type Result } from '../electron/sdk/contracts';
import { staging, bindEnvironment } from '../electron/sdk/environment';
import { sampleAppointment } from '../electron/sdk/fixtures';
const limits = { timeoutMs: 150, credentialTimeoutMs: 150, reportTimeoutMs: 250, responseBytes: 4096, perApp: 2, total: 3, operationKeys: 4 };
function harness(transport: Transport = async () => Response.json({ appointments: [sampleAppointment] }), options = limits,activity:(appId:string)=>void=()=>{}) {
 let generation=1, active=true, credentialCalls=0;
 const identity: Identity = { snapshot:()=>({generation,active,userLabel:'Synthetic user',clinicLabel:'Synthetic clinic'}), credential:async()=>{credentialCalls++;return 'fixture-secret';} };
 const sender={},frame={},caller:Caller={sender,frame,url:'dental-fixture://alpha/index.html'};
 const reports:unknown[]=[];
 const broker=new ApiBroker(staging,identity,transport,options,activity);
 const register=(s=sender,f=frame,capabilities=[...operations])=>broker.register({sender:s,frame:f,origin:caller.url,appId:'company.sample.alpha',appVersion:'1.0.0',capabilities,authorizeApiOperation:()=>true,report:v=>reports.push(v)});
 register();
 const connect=(who=caller)=>{const result=broker.connect(who,{major:1,minor:0});if(!result.ok)throw new Error(result.error.code);return result.value;};
 const connection=connect(); let sequence=0;
 const request=(operation='appointments.list',input:Record<string,unknown>={date:'2026-10-16'},c=connection)=>({version:1,...{connection:c.connection,generation:c.generation},requestId:`request_${++sequence}`,operation,input});
 return {broker,caller,connection,request,identity,connect,register,reports,credentialCalls:()=>credentialCalls,change:()=>{generation++;broker.invalidateSession();},logout:()=>{active=false;broker.invalidateSession();}};
}
const code=(v:Result)=>v.ok?'OK':v.error.code;
const writeInput={appointmentId:sampleAppointment.appointmentId,status:'arrived',expectedRowVersion:1,idempotencyKey:'operation_0001'};
describe('SDK registration and request boundary',()=>{
 it('negotiates supported version and binds identity without caller-selected fields',()=>{
  const h=harness();expect(h.connection.appId).toBe('company.sample.alpha');expect(h.connect()).toEqual(h.connection);
  for(const input of [{major:2,minor:0},{major:1,minor:SDK.minor+1},{major:1,minor:-1},{major:1,minor:0,appId:'other'},'1.0'])expect(code(h.broker.connect(h.caller,input))).toBe('INCOMPATIBLE_SDK');h.broker.dispose();
 });
 it('denies unregistered sender, subframes and changed origin at the host boundary',async()=>{
  const h=harness();for(const caller of [{...h.caller,sender:{}},{...h.caller,frame:{}},{...h.caller,frame:null},{...h.caller,url:'dental-fixture://beta/index.html'}]){
   expect(code(h.broker.connect(caller,{major:1,minor:0}))).toBe('UNKNOWN_CALLER');expect(code(await h.broker.request(caller,h.request()))).toBe('UNKNOWN_CALLER');expect(code(h.broker.cancel(caller,{}))).toBe('UNKNOWN_CALLER');
  }h.broker.dispose();
 });
 it('keeps the registered app frame bound when it changes only its local route query',async()=>{
  const h=harness();
  const routed={...h.caller,url:h.caller.url+'?tab=work-entry&caseId=11111111-1111-4111-8111-111111111111'};
  expect(await h.broker.request(routed,h.request('preferences.read',{}))).toEqual({ok:true,value:{textScale:1}});
  for(const url of ['dental-fixture://beta/index.html?tab=work-entry','dental-fixture://alpha/other.html?tab=work-entry','dental-fixture://alpha/index.html#external']){
   expect(code(await h.broker.request({...h.caller,url},h.request('preferences.read',{})))).toBe('UNKNOWN_CALLER');
  }
  h.broker.dispose();
 });
 it('rejects arbitrary URLs, headers, channels, operation names and malformed/oversized input',async()=>{
  const h=harness();const good=h.request();const cycle:Record<string,unknown>={};cycle.self=cycle;
  for(const input of [{...good,url:'https://evil.test'},{...good,headers:{Authorization:'fake'}},{...good,channel:'window:control'},{...good,appId:'beta'},{...good,operation:'fetch'},{...good,version:2},{...good,input:{date:'2026-02-30'}},{...good,input:{date:'x'.repeat(20000)}},{...good,requestId:'bad\n'},cycle,null])expect(code(await h.broker.request(h.caller,input))).toBe('INVALID_REQUEST');
  expect(parseRequest({...good,input:{date:'2026-10-16',extra:true}})).toBeUndefined();h.broker.dispose();
 });
 it('rejects missing/forged connections, stale generations and ungranted capability',async()=>{
  const h=harness();expect(code(await h.broker.request(h.caller,{...h.request(),connection:'00000000-0000-4000-8000-000000000000'}))).toBe('STALE_SESSION');
  expect(code(await h.broker.request(h.caller,{...h.request(),generation:2}))).toBe('STALE_SESSION');
  h.register(h.caller.sender,h.caller.frame!,['appointments.list']);const c=h.connect();expect(code(await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput,c)))).toBe('FORBIDDEN');h.broker.dispose();
 });
 it('fails closed without a release API authorizer before credential or transport access',async()=>{
  const h=harness();h.broker.register({sender:h.caller.sender,frame:h.caller.frame!,origin:h.caller.url,appId:'company.sample.alpha',appVersion:'1.0.0',capabilities:[...operations],report:()=>{}});const c=h.connect();
  expect(c.capabilities).not.toContain('appointments.list');expect(c.capabilities).not.toContain('clinic.api.request');
  const before=h.credentialCalls();expect(code(await h.broker.request(h.caller,h.request('appointments.list',{date:'2026-10-16'},c)))).toBe('FORBIDDEN');
  expect(code(await h.broker.request(h.caller,h.request('clinic.api.request',{path:'/v1/appointments',method:'GET',body:null,idempotencyKey:null},c)))).toBe('FORBIDDEN');
  expect(h.credentialCalls()).toBe(before);h.broker.dispose();
 });
 it('provides scoped lifecycle, memory preferences, display context and explicit unsupported intent',async()=>{
  const h=harness();expect(await h.broker.request(h.caller,h.request('lifecycle.report',{dirty:true,modal:false}))).toEqual({ok:true,value:{accepted:true}});expect(h.reports).toEqual([{dirty:true,modal:false}]);
  await h.broker.request(h.caller,h.request('preferences.update',{textScale:1.1}));expect(await h.broker.request(h.caller,h.request('preferences.read',{}))).toEqual({ok:true,value:{textScale:1.1}});
  expect(code(await h.broker.request(h.caller,h.request('preferences.update',{textScale:10})))).toBe('INVALID_REQUEST');
  const context=await h.broker.request(h.caller,h.request('session.context',{}));expect(JSON.stringify(context)).not.toContain('fixture-secret');expect(code(context)).toBe('OK');
  expect(code(await h.broker.request(h.caller,h.request('notifications.show',{message:'Saved synthetic work'})))).toBe('OK');expect(code(await h.broker.request(h.caller,h.request('native.intent',{kind:'print'})))).toBe('UNAVAILABLE');
  const sender={},frame={};h.register(sender,frame);const other={sender,frame,url:h.caller.url},c=h.connect(other);expect(await h.broker.request(other,h.request('preferences.read',{},c))).toEqual({ok:true,value:{textScale:1}});h.broker.dispose();
 });
 it('rejects mixed/production and unconfigured catalogue/download destinations',()=>{
  expect(bindEnvironment({...staging})).toBe(staging);
  for(const input of [{...staging,apiBase:'https://production.test'},{...staging,firebaseProject:'production'},{...staging,environment:'production'},{...staging,catalogue:'https://evil.test'},{...staging,downloads:'https://evil.test'},{...staging,extra:true}])expect(()=>bindEnvironment(input)).toThrow('Unmapped');
 });
});
describe('SDK transport, cancellation and operation identity',()=>{
 it('uses exact staging business route and host-only auth; strips unknown response fields',async()=>{
  let url='',init:RequestInit={};const h=harness(async(u,i)=>{url=u;init=i;return Response.json({appointments:[{...sampleAppointment,token:'must-not-escape'}]});});
  const result=await h.broker.request(h.caller,h.request());expect(url).toBe(staging.apiBase+'/v1/appointments?date=2026-10-16');expect(init.redirect).toBe('manual');expect(init.credentials).toBe('omit');expect(init.cache).toBe('no-store');expect(new Headers(init.headers).get('authorization')).toBe('Bearer fixture-secret');expect(JSON.stringify(result)).not.toContain('must-not-escape');h.broker.dispose();
 });
 it.each([[401,'AUTH_REQUIRED'],[403,'ACCESS_DENIED'],[409,'CONFLICT'],[422,'VALIDATION'],[503,'MAINTENANCE']] as const)('maps HTTP %i without exposing server body',async(status,expected)=>{
  const h=harness(async()=>Response.json({secret:'never expose'},{status}));const result=await h.broker.request(h.caller,h.request());expect(code(result)).toBe(expected);expect(JSON.stringify(result)).not.toContain('never expose');h.broker.dispose();
 });
 it('denies redirects without forwarding credentials and rejects malformed/oversized streamed responses',async()=>{
  for(const response of [new Response(null,{status:302,headers:{location:'https://evil.test'}}),new Response('<html>',{headers:{'content-type':'text/html'}}),Response.json({appointments:'wrong'}),new Response('{',{headers:{'content-type':'application/json'}}),new Response('x'.repeat(5000),{headers:{'content-type':'application/json'}}),new Response('{}',{headers:{'content-type':'application/json','content-length':'99999'}})]){
   let calls=0;const redirect=response.status===302;const h=harness(async()=>{calls++;return response;});const result=await h.broker.request(h.caller,h.request());expect(code(result)).toBe(redirect?'REDIRECT_DENIED':'INVALID_RESPONSE');expect(calls).toBe(1);h.broker.dispose();
  }
 });
 it('bounds hung transport and classifies read network failure',async()=>{
  const h=harness(()=>new Promise(()=>{}),{...limits,timeoutMs:25});expect(code(await h.broker.request(h.caller,h.request()))).toBe('TIMEOUT');h.broker.dispose();
  const off=harness(async()=>{throw new Error('private network detail');});const result=await off.broker.request(off.caller,off.request());expect(code(result)).toBe('OFFLINE');expect(JSON.stringify(result)).not.toContain('private network');off.broker.dispose();
 });
 it('starts the API deadline after credentials resolve while retaining a separate credential cap',async()=>{
  const h=harness(async()=>{await new Promise(resolve=>setTimeout(resolve,20));return Response.json({appointments:[]});},{...limits,timeoutMs:25,credentialTimeoutMs:40});
  h.identity.credential=async()=>{await new Promise(resolve=>setTimeout(resolve,20));return 'fixture-secret';};
  expect((await h.broker.request(h.caller,h.request())).ok).toBe(true);h.broker.dispose();
  const stalled=harness(async()=>Response.json({appointments:[]}),{...limits,timeoutMs:100,credentialTimeoutMs:25});stalled.identity.credential=()=>new Promise(()=>{});
  expect(code(await stalled.broker.request(stalled.caller,stalled.request()))).toBe('TIMEOUT');stalled.broker.dispose();
 });
 it('preserves idempotency/revision, refuses changed-key reuse and never automatically retries writes',async()=>{
  const sent:{url:string;init:RequestInit}[]=[];let calls=0;
  const h=harness(async(url,init)=>{sent.push({url,init});calls++;if(calls===1)throw new Error('socket lost after commit');return Response.json({appointment:{...sampleAppointment,status:'arrived',rowVersion:2}});});
  const first=await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput));expect(code(first)).toBe('UNKNOWN_OUTCOME');expect(first.ok?null:first.error.operationId).toBe(writeInput.idempotencyKey);expect(calls).toBe(1);
  expect(code(await h.broker.request(h.caller,h.request('appointments.setStatus',{...writeInput,status:'cancelled'})))).toBe('CONFLICT');expect(calls).toBe(1);
  expect(code(await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput)))).toBe('OK');expect(calls).toBe(2);
  expect(sent[0].url).toBe(staging.apiBase+`/v1/appointments/${sampleAppointment.appointmentId}/status`);
  expect(new Headers(sent[0].init.headers).get('idempotency-key')).toBe(new Headers(sent[1].init.headers).get('idempotency-key'));
  expect(JSON.parse(sent[0].init.body as string)).toEqual({status:'arrived',expectedRowVersion:1});expect(sent[1].init.body).toBe(sent[0].init.body);h.broker.dispose();
 });
 it('keeps writes uncertain after timeout, malformed success or 503, but reports definitive 409',async()=>{
  for(const [transport,expected] of [[()=>new Promise<Response>(()=>{}),'UNKNOWN_OUTCOME'],[async()=>Response.json({bad:true}),'UNKNOWN_OUTCOME'],[async()=>Response.json({},{status:503}),'UNKNOWN_OUTCOME'],[async()=>Response.json({},{status:409}),'CONFLICT']] as const){
   const h=harness(transport,{...limits,timeoutMs:25});const result=await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput));expect(code(result)).toBe(expected);h.broker.dispose();
  }
 });
 it('cancels only the owning connection/request and keeps dispatched writes uncertain',async()=>{
  const h=harness(()=>new Promise(()=>{}));const request=h.request('appointments.setStatus',writeInput),promise=h.broker.request(h.caller,request);await new Promise(r=>setTimeout(r,5));
  expect(code(h.broker.cancel({...h.caller,sender:{}},{version:1,connection:request.connection,generation:request.generation,requestId:request.requestId}))).toBe('UNKNOWN_CALLER');
  expect(code(h.broker.cancel(h.caller,{version:1,connection:request.connection,generation:request.generation,requestId:request.requestId}))).toBe('OK');expect(code(await promise)).toBe('UNKNOWN_OUTCOME');h.broker.dispose();
 });
 it('enforces per-app/global concurrency and single-flight credential acquisition',async()=>{
  let release!:()=>void;const waiting=new Promise<void>(r=>release=r);const h=harness(async()=>{await waiting;return Response.json({appointments:[]});});let credentials=0;
  h.identity.credential=async()=>{credentials++;await new Promise(r=>setTimeout(r,5));return 'fixture-secret';};
  const a=h.broker.request(h.caller,h.request()),b=h.broker.request(h.caller,h.request());expect(code(await h.broker.request(h.caller,h.request()))).toBe('BUSY');
  const sender={},frame={};h.register(sender,frame);const caller={sender,frame,url:h.caller.url},c=h.connect(caller);const other=h.broker.request(caller,h.request('appointments.list',{date:'2026-10-16'},c));expect(code(await h.broker.request(caller,h.request('appointments.list',{date:'2026-10-16'},c)))).toBe('BUSY');
  await new Promise(r=>setTimeout(r,10));expect(credentials).toBe(1);release();expect((await Promise.all([a,b,other])).every(v=>v.ok)).toBe(true);h.broker.dispose();
 });
 it('drops old-session results and unregisters pending work on close',async()=>{
  let release!:(v:Response)=>void;const h=harness(()=>new Promise(r=>release=r));const promise=h.broker.request(h.caller,h.request());await new Promise(r=>setTimeout(r,5));h.change();release(Response.json({appointments:[sampleAppointment]}));expect(code(await promise)).toBe('STALE_SESSION');
  expect(code(await h.broker.request(h.caller,h.request()))).toBe('STALE_SESSION');h.connect();h.broker.unregister(h.caller.sender);expect(code(await h.broker.request(h.caller,h.request()))).toBe('UNKNOWN_CALLER');h.broker.dispose();
 });
 it('bounds a stalled credential provider and blocks logged-out requests',async()=>{
  let sent=0;const h=harness(async()=>{sent++;return Response.json({appointments:[]});},{...limits,timeoutMs:25});h.identity.credential=()=>new Promise(()=>{});
  expect(code(await h.broker.request(h.caller,h.request()))).toBe('TIMEOUT');expect(sent).toBe(0);h.logout();expect(code(h.broker.connect(h.caller,{major:1,minor:0}))).toBe('AUTH_REQUIRED');h.broker.dispose();
 });
 it('does not dispatch duplicate concurrent writes or evict operation safety records',async()=>{
  const h=harness(()=>new Promise(()=>{}),{...limits,timeoutMs:25,operationKeys:1});const p=h.broker.request(h.caller,h.request('appointments.setStatus',writeInput));expect(code(await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput)))).toBe('BUSY');await p;
  expect(code(await h.broker.request(h.caller,h.request('appointments.setStatus',{...writeInput,idempotencyKey:'operation_0002'})))).toBe('BUSY');h.broker.dispose();
 });
});

describe('safe-update broker coordination',()=>{
 it('tracks pending and uncertain writes until original-key reconciliation, including app close',async()=>{
  let lost=true;const h=harness(async()=>{if(lost)throw Error('lost response');return Response.json({appointment:sampleAppointment});});
  const pending=h.broker.request(h.caller,h.request('appointments.setStatus',writeInput));expect(h.broker.hasUnsafeWrites('company.sample.alpha')).toBe(true);await pending;expect(h.broker.hasUnsafeWrites('company.sample.alpha')).toBe(true);
  h.broker.unregister(h.caller.sender);expect(h.broker.hasUnsafeWrites('company.sample.alpha')).toBe(true);h.register();const connection=h.connect();lost=false;expect(code(await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput,connection)))).toBe('OK');expect(h.broker.hasUnsafeWrites('company.sample.alpha')).toBe(false);h.broker.dispose();
 });
 it('session reset clears uncertain state and new revocation guard refuses dispatch',async()=>{
  let calls=0;const h=harness(async()=>{calls++;throw Error('lost');});await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput));expect(h.broker.hasUnsafeWrites('company.sample.alpha')).toBe(true);h.change();expect(h.broker.hasUnsafeWrites('company.sample.alpha')).toBe(false);
  let allowed=true;h.broker.register({sender:h.caller.sender,frame:h.caller.frame!,origin:h.caller.url,appId:'company.sample.alpha',appVersion:'1.0.0',capabilities:[...operations],report:()=>{},authorize:()=>allowed,authorizeApiOperation:()=>true});const connection=h.connect();allowed=false;expect(code(await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput,connection)))).toBe('ACCESS_DENIED');expect(calls).toBe(1);h.broker.dispose();
 });
});

describe('trusted write-state projection',()=>{it('reports pending then unknown independently of app reports, and clears only after same-key outcome',async()=>{const states:string[]=[];let lost=true;const h=harness(async()=>{if(lost)throw Error('lost');return Response.json({appointment:sampleAppointment});},limits,id=>states.push(h.broker.writeState(id)));await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput));expect(states).toEqual(['pending','unknown']);h.broker.register({sender:h.caller.sender,frame:h.caller.frame!,origin:h.caller.url,appId:'company.sample.alpha',appVersion:'1.0.0',capabilities:[...operations],authorizeApiOperation:()=>true,report:()=>{}});expect(h.broker.writeState('company.sample.alpha')).toBe('unknown');const c=h.connect();lost=false;await h.broker.request(h.caller,h.request('appointments.setStatus',writeInput,c));expect(states.slice(-2)).toEqual(['pending','none']);h.broker.dispose();});});
