import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { SDK, parseRequest } from '../electron/sdk/contracts';
import { ApiBroker, type Identity } from '../electron/sdk/broker';
import { staging } from '../electron/sdk/environment';
import { FilePickerCoordinator, FilePickerCancelled } from '../electron/host/filePicker';
import { validPickInput, validPickerPrompt, validPickerResponse } from '../electron/host/filePickerContract';
import { LocalFileService, type FileRecipient } from '../electron/host/localFiles';
import { dialog, type BrowserWindow } from 'electron';

vi.mock('electron',()=>({dialog:{showOpenDialog:vi.fn()}}));
const dirs:string[]=[];
const services:LocalFileService[]=[];
function fixture(){
 const root=mkdtempSync(path.join(tmpdir(),'m16-4-picker-'));dirs.push(root);
 mkdirSync(path.join(root,'images'));writeFileSync(path.join(root,'images','sample.png'),'not-clinical');
 const files=new LocalFileService([{label:'Synthetic',path:root}]);services.push(files);
 const folder=files.list(files.roots()[0].id).entries.find(x=>x.kind==='directory')!;
 const file=files.list(folder.id).entries.find(x=>x.kind==='file')!;
 const events:{event:string;value:unknown}[]=[];
 const win={isDestroyed:()=>false,webContents:{send:(event:string,value:unknown)=>{events.push({event,value});}}} as unknown as BrowserWindow;
 const coordinator=new FilePickerCoordinator(win,files,()=>1,()=>true);
 const owner:FileRecipient={sender:{},frame:{},appId:'company.dental.patient-record',appVersion:'1.0.0',windowId:'records',generation:1,requestId:'request_1234',authorized:()=>true};
 return {root,files,folder,file,events,coordinator,owner};
}
const opts={purpose:'patient-attachment' as const,fileTypes:'medical-images' as const,maxSelections:2};
afterEach(()=>{vi.clearAllMocks();for(const s of services.splice(0))s.dispose();for(const d of dirs.splice(0))rmSync(d,{recursive:true,force:true});});

describe('M16.4 local SDK and signed selection boundary',()=>{
 it('validates closed SDK 1.5 picker shape without local paths, native flags or arbitrary IDs',()=>{
  expect(SDK.minor).toBe(5);
  expect(validPickInput(opts)).toBe(true);
  const envelope={version:1,connection:'11111111-1111-4111-8111-111111111111',generation:1,requestId:'request_1234',operation:'local.files.pick',input:opts};
  expect(parseRequest(envelope)).toBeDefined();
  for(const input of [{...opts,path:'/etc/passwd'},{...opts,appId:'company.malicious'},
   {...opts,maxSelections:0},{...opts,maxSelections:11},{...opts,maxSelections:1.5},
   {...opts,fileTypes:'executable'},{...opts,purpose:'read-all'},null,{},[]])
   expect(validPickInput(input)).toBe(false);
  expect(parseRequest({...envelope,input:{...opts,path:'C:\\'}})).toBeUndefined();
 });
 it('rejects response forgery, extra keys, path and wrong selection count',()=>{
  const base={requestId:'11111111-1111-4111-8111-111111111111',generation:1};
  expect(validPickerResponse({...base,action:'choose',fileIds:['22222222-2222-4222-8222-222222222222']})).toBe(true);
  for(const response of [{...base,action:'choose',fileIds:['/etc/passwd']},
   {...base,action:'choose',fileIds:[]},{...base,action:'choose',fileIds:Array(11).fill('x')},
   {...base,action:'native',filePath:'C:\\secrets'}, {...base,generation:0,action:'cancel'},
   {...base,action:'choose',fileIds:['22222222-2222-4222-8222-222222222222','22222222-2222-4222-8222-222222222222']}])
    expect(validPickerResponse(response)).toBe(false);
 });
 it('requires separate local capability, never accepts the clinic API grant alone',async()=>{
  let gen=1;
  const identity:Identity={snapshot:()=>({generation:gen,active:true,userLabel:'test',clinicLabel:'test'}),credential:async()=>{throw Error('no remote access');}};
  const broker=new ApiBroker(staging,identity);
  const sender={},frame={},origin='dental-fixture://alpha/index.html';
  const register=(allow:boolean)=>broker.register({sender,frame,origin,appId:'company.sample.alpha',appVersion:'1.0.0',
    capabilities:['local.files.pick','clinic.api.request'],authorizeApiOperation:()=>true,
    authorizeLocalPick:()=>allow,pickLocal:async()=>({selectionId:'opaque',files:[],expiresAt:0}),report:()=>{}});
  register(false);
  const caller={sender,frame,url:origin};
  let conn=broker.connect(caller,{major:1,minor:0});
  if(!conn.ok)throw Error('connect');
  expect(conn.value.capabilities).not.toContain('local.files.pick');
  const req=(connection:string)=>({version:1,connection,generation:gen,requestId:'request_1234',operation:'local.files.pick',input:opts});
  const denied=await broker.request(caller,req(conn.value.connection));
  expect(denied.ok).toBe(false);
  if(!denied.ok)expect(denied.error.code).toBe('FORBIDDEN');
  register(true);conn=broker.connect(caller,{major:1,minor:0});
  if(!conn.ok)throw Error('connect');
  expect(conn.value.capabilities).toContain('local.files.pick');
  const allowed=await broker.request(caller,req(conn.value.connection));
  expect(allowed.ok).toBe(true);
  broker.dispose();
 });
});
describe('M16.4 main-only coordinator',()=>{
 it('requires OS-owned confirmation and returns opaque single-recipient metadata',async()=>{
  const {coordinator,owner,events,file,root,files}=fixture();
  const abort=new AbortController();
  const pending=coordinator.pick(opts,owner,'Dental Records',abort.signal);
  const prompt=events[0].value;
  expect(validPickerPrompt(prompt)).toBe(true);
  const p=prompt as {requestId:string;generation:number};
  expect(await coordinator.respond({requestId:p.requestId,generation:p.generation,action:'choose',fileIds:[file.id]})).toBe(true);
  const result=await pending;
  expect(result.files[0].name).toBe('sample.png');
  expect(JSON.stringify(result)).not.toContain(root);
  expect(files.inspect(result.selectionId,result.files[0].receiptId,owner)).toEqual(result.files[0]);
  expect(()=>files.inspect(result.selectionId,result.files[0].receiptId,{...owner,sender:{}})).toThrow();
 });
 it('denies forged request IDs, missing confirmation and invalid selected count',async()=>{
  const {coordinator,owner,events,file}=fixture();
  const abort=new AbortController();
  const pending=coordinator.pick({...opts,maxSelections:1},owner,'Dental Records',abort.signal);
  const p=events[0].value as {requestId:string;generation:number};
  expect(await coordinator.respond({requestId:'22222222-2222-4222-8222-222222222222',generation:1,action:'choose',fileIds:[file.id]})).toBe(false);
  expect(await coordinator.respond({requestId:p.requestId,generation:1,action:'choose',fileIds:[file.id,file.id]})).toBe(false);
  expect(await coordinator.respond({requestId:p.requestId,generation:1,action:'cancel'})).toBe(true);
  await expect(pending).rejects.toMatchObject({code:'CANCELLED'});
 });
 it('native picker grants only a human-approved individual file outside browsing root',async()=>{
  const {coordinator,owner,events,root}=fixture();
  const outside=mkdtempSync(path.join(tmpdir(),'m16-native-other-'));dirs.push(outside);
  const filePath=path.join(outside,'outside.png');writeFileSync(filePath,'synthetic');
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({canceled:false,filePaths:[filePath]});
  const pending=coordinator.pick({...opts,maxSelections:1},owner,'Dental Records',new AbortController().signal);
  const p=events[0].value as {requestId:string;generation:number};
  expect(await coordinator.respond({requestId:p.requestId,generation:1,action:'native'})).toBe(true);
  const result=await pending;
  expect(result.files.map(x=>x.name)).toEqual(['outside.png']);
  expect(JSON.stringify(result)).not.toContain(root);
  expect(JSON.stringify(result)).not.toContain(outside);
  expect(vi.mocked(dialog.showOpenDialog)).toHaveBeenCalledOnce();
 });
 it('aborts pending choice and revokes recipient without sending paths',async()=>{
  const {coordinator,owner}=fixture();
  const abort=new AbortController();
  const pending=coordinator.pick(opts,owner,'Dental Records',abort.signal);
  coordinator.cancelRecipient(owner.sender);
  await expect(pending).rejects.toBeInstanceOf(FilePickerCancelled);
  expect(await coordinator.respond({requestId:'11111111-1111-4111-8111-111111111111',generation:1,action:'cancel'})).toBe(false);
 });
 it('rejects native symlink selections and retains the old directory privilege limit',async()=>{
  if(process.platform==='win32')return;
  const {coordinator,owner,events}=fixture();
  const outside=mkdtempSync(path.join(tmpdir(),'m16-native-outside-'));dirs.push(outside);
  writeFileSync(path.join(outside,'secret.png'),'secret');
  const link=path.join(outside,'linked.png');symlinkSync(path.join(outside,'secret.png'),link);
  vi.mocked(dialog.showOpenDialog).mockResolvedValue({canceled:false,filePaths:[link]});
  const pending=coordinator.pick({...opts,maxSelections:1},owner,'Dental Records',new AbortController().signal);
  const p=events[0].value as {requestId:string;generation:number};
  expect(await coordinator.respond({requestId:p.requestId,generation:1,action:'native'})).toBe(false);
  await expect(pending).rejects.toMatchObject({code:'UNAVAILABLE'});
 });
});
