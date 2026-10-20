import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profileArgs } from './profile.mjs';

const id='company.resource.app-01',secondId='company.resource.app-02';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures','--runtime-app-count=4','--module-preview-fixtures','--slow-module-ack-fixtures'],env,timeout:30000});
const checks=[];const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const shell=await app.firstWindow();
const runtimeReady=()=>shell.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',id,{timeout:15000});
const nativeView=(runtimeId=id)=>app.evaluate(({BrowserWindow},id)=>{const view=BrowserWindow.getAllWindows()[0].contentView.children.find(child=>child.webContents?.getURL().startsWith(`dental-fixture://${id}/`));return view?{visible:view.getVisible()}:null;},runtimeId);
async function waitNativeVisible(visible,runtimeId=id){for(let n=0;n<100;n++){const view=await nativeView(runtimeId);if(view?.visible===visible)return;await new Promise(resolve=>setTimeout(resolve,20));}throw new Error(`Module fixture ${runtimeId} native view visibility did not become ${visible}`);}
try{
 const dockApp=shell.locator(`[data-dock-app="${id}"]`);await dockApp.waitFor();await dockApp.click({force:true});
 const explorer=shell.locator('.app-explorer');await explorer.waitFor();
 check('OS explorer discovers Finance modules from its signed app manifest',await explorer.getByRole('button',{name:'Transaction Record',exact:true}).isVisible()&&await explorer.getByRole('button',{name:'Patient payments',exact:true}).isVisible());
 await explorer.getByRole('button',{name:'Patient payments',exact:true}).click();await runtimeReady();
 const guest=app.context().pages().find(page=>page.url().startsWith(`dental-fixture://${id}/`));assert.ok(guest,'module package guest is open');
 await guest.getByRole('heading',{name:'Patient payments',exact:true}).waitFor();await waitNativeVisible(true);
 await shell.locator(`[data-runtime="${id}"] .isolated-mirror`).waitFor();
 check('a 2.2-second module acknowledgement still starts the selected sub-app instead of stopping its app');

 const firstSnapshot=await shell.locator(`[data-runtime="${id}"] .isolated-mirror`).getAttribute('src');
 await dockApp.click({force:true});await explorer.waitFor();await explorer.getByRole('button',{name:'Transaction Record',exact:true}).click();
 await guest.getByRole('heading',{name:'Transaction Record',exact:true}).waitFor();await waitNativeVisible(true);
 await shell.waitForFunction(({id,old})=>{const src=document.querySelector(`[data-runtime="${id}"] .isolated-mirror`)?.getAttribute('src');return !!src&&src!==old;},{id,old:firstSnapshot});
 const transactionSnapshot=await shell.locator(`[data-runtime="${id}"] .isolated-mirror`).getAttribute('src');
 const size=await guest.evaluate(()=>({width:innerWidth,height:innerHeight}));await guest.mouse.move(size.width/2,size.height-2);
 await waitNativeVisible(false);
 await shell.waitForFunction(({id,expected})=>{const image=document.querySelector(`[data-runtime="${id}"] .isolated-mirror`);return !!image?.complete&&image.getAttribute('src')===expected;},{id,expected:transactionSnapshot});
 check('switching Finance sub-apps refreshes the shared mirror before dock-edge preview uses it',await guest.title()==='Transaction Record'&&!!transactionSnapshot);
 await shell.mouse.move(20,20);await waitNativeVisible(true);
 const secondDockApp=shell.locator(`[data-dock-app="${secondId}"]`);await secondDockApp.waitFor();await secondDockApp.click({force:true});
 await explorer.waitFor();
 check('OS explorer discovers Lab Tracker modules from its signed app manifest',await explorer.getByRole('button',{name:'Lab Tracker',exact:true}).isVisible()&&await explorer.getByRole('button',{name:'Lab supplier record',exact:true}).isVisible());
 check('Lab Tracker apps stay in a compact grid at the top left when only two are available',await explorer.locator('.app-explorer-grid').evaluate(grid=>{const box=grid.getBoundingClientRect(),items=[...grid.querySelectorAll('.app-explorer-item')].map(item=>item.getBoundingClientRect());return getComputedStyle(grid).alignContent==='start'&&items.length===2&&items[0].left<=box.left+1&&Math.abs(items[0].top-items[1].top)<1&&items[0].height<=132&&items[0].top-box.top<=24;}));
 await explorer.getByRole('button',{name:'Lab Tracker',exact:true}).click();
 await shell.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',secondId,{timeout:15000});
 const secondGuest=app.context().pages().find(page=>page.url().startsWith(`dental-fixture://${secondId}/`));assert.ok(secondGuest,'second module package guest is open');
 await secondGuest.getByRole('heading',{name:'Lab Tracker',exact:true}).waitFor();
 await waitNativeVisible(true,secondId);
 check('the two signed multi-module apps keep independent native runtimes',!!(await nativeView())&&!!(await nativeView(secondId)));
 await app.evaluate(({webContents},ids)=>{for(const id of ids){const wc=webContents.getAllWebContents().find(item=>item.getURL().startsWith(`dental-fixture://${id}/`));if(!wc)throw Error(`Missing renderer for ${id}`);wc.emit('unresponsive');}},[id,secondId]);
 await shell.waitForFunction(ids=>ids.every(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='unresponsive'),[id,secondId]);
 check('temporary Electron unresponsive notifications show recovery without killing either app',await app.evaluate(({webContents},ids)=>ids.every(id=>{const wc=webContents.getAllWebContents().find(item=>item.getURL().startsWith(`dental-fixture://${id}/`));return !!wc&&!wc.isDestroyed()&&!wc.isCrashed();}),[id,secondId]));
 await app.evaluate(({webContents},ids)=>{for(const id of ids)webContents.getAllWebContents().find(item=>item.getURL().startsWith(`dental-fixture://${id}/`))?.emit('responsive');},[id,secondId]);
 await shell.waitForFunction(ids=>ids.every(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready'),[id,secondId]);
 await app.evaluate(({webContents},ids)=>{for(const id of ids){const wc=webContents.getAllWebContents().find(item=>item.getURL().startsWith(`dental-fixture://${id}/`));if(!wc)throw Error(`Missing renderer for ${id}`);const original=wc.executeJavaScript.bind(wc);let delayed=false;wc.executeJavaScript=(...args)=>{if(!delayed&&String(args[0]).includes('document.readyState')){delayed=true;return new Promise((resolve,reject)=>setTimeout(()=>original(...args).then(resolve,reject),1800));}return original(...args);};}},[id,secondId]);
 await new Promise(resolve=>setTimeout(resolve,4500));
 const delayedPingPhases=await shell.evaluate(ids=>ids.map(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase),[id,secondId]);
 check(`a delayed but successful OS health ping does not stop either app (${delayedPingPhases.join(', ')})`,delayedPingPhases.every(phase=>phase==='ready'));
 for(let pass=0;pass<5;pass++){
  const size=await secondGuest.evaluate(()=>({width:innerWidth,height:innerHeight}));
  await secondGuest.mouse.move(size.width/2,size.height-2);await waitNativeVisible(false,secondId);
  await shell.mouse.move(20,20);await waitNativeVisible(true,secondId);
  await shell.locator(`[data-dock-app="${id}"]`).click({force:true});await explorer.waitFor();
  await explorer.getByRole('button',{name:pass%2?'Transaction Record':'Patient payments',exact:true}).click();
  await waitNativeVisible(true,id);
  await secondDockApp.click({force:true});await explorer.waitFor();
  await explorer.getByRole('button',{name:pass%2?'Lab supplier record':'Lab Tracker',exact:true}).click();
  await waitNativeVisible(true,secondId);
  await shell.waitForFunction(({first,second})=>['ready','ready'].every((phase,index)=>document.querySelector(`[data-runtime="${index===0?first:second}"]`)?.dataset.runtimePhase===phase),{first:id,second:secondId});
 }
 await new Promise(resolve=>setTimeout(resolve,10000));
 const phases=await shell.evaluate(ids=>ids.map(id=>({id,phase:document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase,reason:document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimeReason})),[id,secondId]);
 check(`both module apps remain healthy after repeated dock/window handoffs (${JSON.stringify(phases)})`,phases.every(item=>item.phase==='ready'));
 for(const appId of [secondId,id]){
  await shell.locator(`[data-window-id="${appId}"] .window-control-close`).click({force:true});
  await shell.waitForFunction(id=>document.querySelector(`[data-window-id="${id}"]`)?.dataset.phase==='closed',appId);
 }
 check('closing both synthetic module runtimes releases both native views',!(await nativeView())&&!(await nativeView(secondId)));
}finally{
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts','runtime-module-preview-verification.json'),JSON.stringify({checks,platform:process.platform},null,2));await app.close();
}
