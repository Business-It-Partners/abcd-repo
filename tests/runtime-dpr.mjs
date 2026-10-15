import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[process.cwd(),...profileArgs,'--runtime-fixtures','--force-device-scale-factor=2'],env});
try{
 const shell=await app.firstWindow();await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]').dataset.runtimePhase==='ready');
 const alpha=app.context().pages().find(p=>p.url().startsWith('dental-fixture://alpha/'));await alpha.getByLabel('Your draft').fill('DPR two sample');await alpha.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const result=await shell.evaluate(async()=>{const r=document.querySelector('[data-window-id="studio"]').getBoundingClientRect();const data=await window.desktop.capture({x:r.x,y:r.y,width:r.width,height:r.height});const image=new Image();image.src=data;await image.decode();return {width:image.width,height:image.height,dpr:devicePixelRatio,logicalWidth:r.width,data};});
 assert.equal(result.dpr,2);assert.ok(result.width>=result.logicalWidth);assert.ok(result.width/result.height>1);
 await fs.writeFile('artifacts/runtime-dpr.png',Buffer.from(result.data.split(',')[1],'base64'));
 await fs.writeFile('artifacts/runtime-dpr.json',JSON.stringify({...result,data:undefined},null,2));console.log('PASS isolated capture at DPR 2',result.width,result.height);
}finally{await app.close();}
