import { describe, expect, it } from 'vitest';
import { parseLayout, fixtureAsset, compositePixels, developmentRuntimeIdForPackage, isRuntimeId, packageIdForRuntime, runtimeHost } from '../electron/runtime/contracts';
const layouts=()=>['studio','records'].map(id=>({id,open:true,visible:id==='studio',rect:{x:0,y:43,width:640,height:400}}));
describe('isolated runtime boundary',()=>{
 it('accepts bounded first-party runtime IDs without a fixed two-app layout',()=>{
  expect(parseLayout(layouts())).toHaveLength(2);
  expect(parseLayout([])).toEqual([]);
  const dynamic=['company.sample.preview','company.dental.calendar'].map(id=>({id,open:true,visible:false,rect:{x:0,y:43,width:640,height:400}}));
  expect(parseLayout(dynamic).map(v=>v.id)).toEqual(['company.sample.preview','company.dental.calendar']);
  const edgeLayout=[{id:'company.sample.preview',open:true,visible:true,rect:{x:-448,y:43,width:640,height:400}}];
  expect(parseLayout(edgeLayout)).toEqual(edgeLayout);
  const atLimit=Array.from({length:16},(_,i)=>({id:`company.app${String(i).padStart(2,'0')}`,open:true,visible:false,rect:{x:0,y:43,width:640,height:400}}));
  expect(parseLayout(atLimit)).toHaveLength(16);
  const localId=developmentRuntimeIdForPackage('company.dental.patient-record.m17');
  expect(isRuntimeId(localId)).toBe(true);
  expect(packageIdForRuntime(localId)).toBe('company.dental.patient-record.m17');
  expect(runtimeHost(localId)).toBe('dev-company.dental.patient-record.m17');
  expect(runtimeHost('company.dental.patient-record.m17')).not.toBe(runtimeHost(localId));
  expect(isRuntimeId('dev.company.sample.preview')).toBe(false);
  expect(parseLayout([{id:localId,open:true,visible:false,rect:{x:0,y:43,width:640,height:400}}])).toHaveLength(1);
  const tooMany=Array.from({length:17},(_,i)=>({id:`company.app${String(i).padStart(2,'0')}`,open:false,visible:false,rect:{x:0,y:43,width:640,height:400}}));
  for(const value of [[layouts()[0],layouts()[0]],layouts().map(v=>({...v,identity:'forged'})),layouts().map(v=>({...v,visible:true})),layouts().map(v=>({...v,rect:{...v.rect,width:NaN}})),[{...dynamic[0],id:'company.1bad'}],[{...edgeLayout[0],rect:{...edgeLayout[0].rect,x:-8193}}],tooMany])expect(()=>parseLayout(value)).toThrow();
 });
 it('resolves only exact assets belonging to the registered origin',()=>{
  expect(fixtureAsset('dental-fixture://alpha/app.js','alpha')).toBe('app.js');
  for(const url of ['file:///etc/passwd','https://alpha/app.js','dental-fixture://beta/app.js','dental-fixture://alpha/secret.json','dental-fixture://alpha/app.js?other=1','dental-fixture://alpha/../secret'])expect(fixtureAsset(url,'alpha')).toBeUndefined();
 });
 it('composes captures with clipping, scaling and alpha without touching outside pixels',()=>{
  const base=new Uint8Array(4*4*4).fill(255), layer=new Uint8Array([0,100,200,255]);
  compositePixels(base,4,4,layer,1,1,{x:-1,y:1,width:3,height:2});
  expect([...base.slice(0,4)]).toEqual([255,255,255,255]);expect([...base.slice(16,20)]).toEqual([0,100,200,255]);expect([...base.slice(28,32)]).toEqual([255,255,255,255]);
  expect(()=>compositePixels(base,1,1,layer,1,1,{x:0,y:0,width:1,height:1})).toThrow();
 });
 it('preserves shell corners under a rounded native body capture',()=>{
  const base=new Uint8Array(20*20*4).fill(255), layer=new Uint8Array([0,0,0,255]);
  compositePixels(base,20,20,layer,1,1,{x:0,y:0,width:20,height:20,radius:8});
  expect([...base.slice(0,4)]).toEqual([255,255,255,255]);
  expect([...base.slice((10*20+10)*4,(10*20+10)*4+4)]).toEqual([0,0,0,255]);
  expect([...base.slice(-4)]).toEqual([255,255,255,255]);
 });
});
