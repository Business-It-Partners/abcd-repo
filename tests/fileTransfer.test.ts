import {afterEach,describe,it,expect} from 'vitest';
import {mkdtempSync,mkdirSync,rmSync,writeFileSync,renameSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {LocalFileService,type FileRecipient} from '../electron/host/localFiles';
import {FileTransferCoordinator,parseShellTransfer,validTransferNotice} from '../electron/host/fileTransfer';

const roots:string[]=[];const services:LocalFileService[]=[];
function setup(){
 const root=mkdtempSync(path.join(tmpdir(),'m16-transfer-'));roots.push(root);
 mkdirSync(path.join(root,'xray'));writeFileSync(path.join(root,'xray','synthetic-xray.png'),'fake');
 const files=new LocalFileService([{label:'Synthetic',path:root}]);services.push(files);
 const folder=files.list(files.roots()[0].id).entries[0];
 const file=files.list(folder.id).entries[0];
 let allowed=true;
 const owner:FileRecipient={sender:{},frame:{},appId:'company.dental.patient-record',appVersion:'1.0.0',
  windowId:'company.dental.patient-record',generation:1,requestId:'host-transfer-only',authorized:()=>allowed};
 return {root,files,file,owner,setAllowed:(value:boolean)=>{allowed=value;}};
}
afterEach(()=>{for(const f of services.splice(0))f.dispose();for(const r of roots.splice(0))rmSync(r,{recursive:true,force:true});});
describe('M16.5 shell-to-signed-recipient handoff',()=>{
 it('rejects forged destination IDs, extra fields, empty and duplicate file choices',()=>{
  const id='11111111-1111-4111-8111-111111111111';
  expect(parseShellTransfer({generation:1,fileIds:[id]})).toEqual({generation:1,fileIds:[id]});
  for(const request of [{generation:1,fileIds:[id],targetApp:'company.dental.patient-record'},
   {generation:1,fileIds:[id],path:'/etc/passwd'},{generation:0,fileIds:[id]},
   {generation:1,fileIds:[]},{generation:1,fileIds:[id,id]},{generation:1,fileIds:Array(11).fill(id)}])
   expect(parseShellTransfer(request)).toBeNull();
 });
 it('delivers only opaque metadata, and requires an exact recipient ack',async()=>{
  const {root,file,owner,files}=setup(),coordinator=new FileTransferCoordinator(files,300);
  let notice:any;
  const pending=coordinator.send([file.id],owner,payload=>{notice=payload;});
  expect(validTransferNotice(notice)).toBe(true);
  expect(JSON.stringify(notice)).not.toContain(root);
  expect(notice.selection.files[0].name).toBe('synthetic-xray.png');
  expect(coordinator.acknowledge({},owner.frame,notice.transferId,true)).toBe(false);
  expect(coordinator.acknowledge(owner.sender,{},notice.transferId,true)).toBe(false);
  expect(coordinator.acknowledge(owner.sender,owner.frame,'other',true)).toBe(false);
  expect(coordinator.busy).toBe(true);
  expect(coordinator.acknowledge(owner.sender,owner.frame,notice.transferId,true)).toBe(true);
  const receipt=await pending;
  expect(files.inspect(receipt.selectionId,receipt.files[0].receiptId,owner).name).toBe('synthetic-xray.png');
  expect(()=>files.inspect(receipt.selectionId,receipt.files[0].receiptId,{...owner,windowId:'different'})).toThrow();
 });
 it('revokes on receiver rejection, revocation, and recipient closure',async()=>{
  const {file,owner,files,setAllowed}=setup(),c=new FileTransferCoordinator(files,100);
  let notice:any;
  const p=c.send([file.id],owner,value=>{notice=value;});
  expect(c.acknowledge(owner.sender,owner.frame,notice.transferId,false)).toBe(true);
  await expect(p).rejects.toMatchObject({code:'CANCELLED'});
  expect(()=>files.inspect(notice.selection.selectionId,notice.selection.files[0].receiptId,owner)).toThrow();
  const p2=c.send([file.id],owner,value=>{notice=value;});
  setAllowed(false);
  expect(c.acknowledge(owner.sender,owner.frame,notice.transferId,true)).toBe(false);
  await expect(p2).rejects.toMatchObject({code:'STALE_SELECTION'});
  setAllowed(true);
  // Re-grant must not resurrect a lease created before revocation.
  expect(()=>files.inspect(notice.selection.selectionId,notice.selection.files[0].receiptId,owner)).toThrow();
  const p3=c.send([file.id],owner,value=>{notice=value;});
  c.cancelRecipient(owner.sender);
  await expect(p3).rejects.toMatchObject({code:'CANCELLED'});
 });
 it('rejects a changed file at ACK and cannot transfer from another session',async()=>{
  const {file,owner,files,root}=setup(),c=new FileTransferCoordinator(files,100);
  let notice:any;
  const p=c.send([file.id],owner,value=>{notice=value;});
  renameSync(path.join(root,'xray','synthetic-xray.png'),path.join(root,'xray','moved.png'));
  expect(c.acknowledge(owner.sender,owner.frame,notice.transferId,true)).toBe(false);
  await expect(p).rejects.toMatchObject({code:'STALE_SELECTION'});
  expect(()=>c.send([file.id],{...owner,generation:2,authorized:()=>false},()=>{})).toThrow();
 });
 it('times out without an app acknowledgement; no stale lease remains',async()=>{
  const {files,file,owner}=setup(),c=new FileTransferCoordinator(files,8);
  let notice:any;
  const p=c.send([file.id],owner,value=>{notice=value;});
  await expect(p).rejects.toMatchObject({code:'UNAVAILABLE'});
  expect(()=>files.inspect(notice.selection.selectionId,notice.selection.files[0].receiptId,owner)).toThrow();
 });
});
