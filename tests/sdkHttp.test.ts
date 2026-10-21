import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import { ApiBroker } from '../electron/sdk/broker';
import { staging } from '../electron/sdk/environment';
import { sampleAppointment } from '../electron/sdk/fixtures';
import type { Connection } from '../electron/sdk/contracts';
let server: Server, origin='',mode='ok',writes=0;
const receipts=new Map<string,unknown>(), received:{path:string;method:string;key?:string;body:string;auth?:string}[]=[];
beforeAll(async()=>{
 server=createServer(async(req,res)=>{
  let body='';for await(const chunk of req)body+=chunk;
  const key=req.headers['idempotency-key'] as string|undefined;received.push({path:req.url!,method:req.method!,key,body,auth:req.headers.authorization});
  if(mode==='redirect'){res.writeHead(302,{location:'https://outside.invalid/steal'});res.end();return;}
  if(mode==='hang'){res.writeHead(200,{'content-type':'application/json'});res.write('{');return;}
  if(req.method==='POST'){
   let result=receipts.get(key!);
   if(!result){writes++;result={appointment:{...sampleAppointment,status:'arrived',rowVersion:2}};receipts.set(key!,result);}
   if(mode==='lost-write'){req.socket.destroy();return;}
   res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify(result));return;
  }
  res.writeHead(200,{'content-type':'application/json'});res.end(JSON.stringify({appointments:[sampleAppointment]}));
 });
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const address=server.address();if(!address||typeof address==='string')throw new Error('No test port');origin=`http://127.0.0.1:${address.port}`;
});
afterAll(async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));});
function client(){
 const sender={},frame={},caller={sender,frame,url:'dental-fixture://alpha/index.html'};
 // Trusted TEST adapter only: preserve broker's expected staging destination proof,
 // then deliver synthetic traffic to an ephemeral loopback server. Never reach SaaS.
 const broker=new ApiBroker(staging,{snapshot:()=>({generation:1,active:true,userLabel:'Fixture',clinicLabel:'Fixture'}),credential:async()=> 'http-fixture-secret'},async(url,init)=>{
  const u=new URL(url);expect(u.origin).toBe(staging.apiBase);
  const response=await fetch(origin+u.pathname+u.search,init);
  return new Response(response.body,{status:response.status,headers:response.headers});
 },{timeoutMs:300,responseBytes:4096,perApp:2,total:2,operationKeys:8});
 broker.register({sender,frame,origin:caller.url,appId:'company.sample.alpha',appVersion:'1.0.0',capabilities:['appointments.list','appointments.setStatus'],authorizeApiOperation:()=>true,report:()=>{}});
 const c=broker.connect(caller,{major:1,minor:0});if(!c.ok)throw new Error(c.error.code);const connection:Connection=c.value;let n=0;
 return {broker,caller,request:(operation='appointments.list',input:Record<string,unknown>={date:'2026-10-16'})=>({version:1,connection:connection.connection,generation:1,requestId:`http_test_${++n}`,operation,input})};
}
describe('actual loopback HTTP transport fixtures',()=>{
 it('delivers exact existing route, host auth and request identity',async()=>{
  mode='ok';const h=client();try{const r=await h.broker.request(h.caller,h.request());expect(r.ok).toBe(true);expect(received.at(-1)).toMatchObject({path:'/v1/appointments?date=2026-10-16',method:'GET',auth:'Bearer http-fixture-secret'});expect(JSON.stringify(r)).not.toContain('http-fixture-secret');}finally{h.broker.dispose();}
 });
 it('stops redirects and times out an incomplete streamed body',async()=>{
  const h=client();try{mode='redirect';const before=received.length;const redirect=await h.broker.request(h.caller,h.request());expect(redirect.ok?null:redirect.error.code).toBe('REDIRECT_DENIED');expect(received.length-before).toBe(1);mode='hang';const timeout=await h.broker.request(h.caller,h.request());expect(timeout.ok?null:timeout.error.code).toBe('TIMEOUT');}finally{h.broker.dispose();mode='ok';}
 });
 it('reconciles a committed-but-disconnected synthetic write with the ORIGINAL key/revision',async()=>{
  const h=client();const input={appointmentId:sampleAppointment.appointmentId,status:'arrived',expectedRowVersion:1,idempotencyKey:'http_receipt_0001'};
  try{mode='lost-write';const lost=await h.broker.request(h.caller,h.request('appointments.setStatus',input));expect(lost.ok?null:lost.error.code).toBe('UNKNOWN_OUTCOME');expect(writes).toBe(1);
   mode='ok';const replay=await h.broker.request(h.caller,h.request('appointments.setStatus',input));expect(replay.ok).toBe(true);expect(writes).toBe(1);
   const sent=received.filter(v=>v.key===input.idempotencyKey);expect(sent).toHaveLength(2);expect(sent[0].body).toBe(sent[1].body);expect(JSON.parse(sent[1].body)).toEqual({status:'arrived',expectedRowVersion:1});
  }finally{h.broker.dispose();mode='ok';}
 });
});
