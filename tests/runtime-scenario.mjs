import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifyRuntime(profileArgs, reportName) {
 const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures'],env,timeout:30000});
 const checks=[],errors=[];let topology;const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
 const shell=await app.firstWindow();shell.on('pageerror',e=>errors.push(e.message));
 const state=id=>shell.locator(`[data-runtime="${id}"]`);
 const ready=id=>shell.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',id,{timeout:15000});
 const native=()=>app.evaluate(({webContents,BrowserWindow})=>({shell:BrowserWindow.getAllWindows()[0].webContents.getOSProcessId(),apps:webContents.getAllWebContents().filter(w=>w.getURL().startsWith('dental-fixture:')).map(w=>({id:w.id,url:w.getURL(),pid:w.getOSProcessId(),prefs:{sandbox:w.getLastWebPreferences().sandbox,contextIsolation:w.getLastWebPreferences().contextIsolation,nodeIntegration:w.getLastWebPreferences().nodeIntegration}}))}));
 async function guest(host){for(let n=0;n<60;n++){const p=app.context().pages().find(p=>p.url().startsWith(`dental-fixture://${host}/`));if(p)return p;await new Promise(r=>setTimeout(r,50));}throw new Error('Guest page missing: '+app.context().pages().map(p=>p.url()).join(','));}
 async function shot(name){const image=await shell.evaluate(()=>window.desktop.capture({x:0,y:0,width:innerWidth,height:innerHeight}));await fs.writeFile(path.join(root,'artifacts',name),Buffer.from(image.split(',')[1],'base64'));}
 try {
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await ready('studio');let alpha=await guest('alpha');
  await shell.getByRole('button',{name:'Records',exact:true}).click();await ready('records');const beta=await guest('beta');
  topology=await native();check('two isolated renderer processes and separate shell',topology.apps.length===2&&new Set([topology.shell,...topology.apps.map(w=>w.pid)]).size===3);
  check('sandbox/context isolation and no Node',topology.apps.every(w=>w.prefs.sandbox&&w.prefs.contextIsolation&&!w.prefs.nodeIntegration));
  check('apps have no Node or shell bridge',await beta.evaluate(()=>typeof window.require==='undefined'&&typeof window.desktop==='undefined'&&Object.keys(window.dentalApp).join()==='report'));
  await alpha.evaluate(()=>localStorage.setItem('isolation','alpha-only'));
  check('storage is separated by app',await beta.evaluate(()=>localStorage.getItem('isolation'))===null);
  check('forged report rejected',await beta.evaluate(()=>{try{window.dentalApp.report({dirty:false,modal:false,id:'studio'});return false;}catch{return true;}}));
  check('network and cross-origin fetch denied',await beta.evaluate(async()=>{for(const url of ['http://127.0.0.1:9/','dental-fixture://alpha/app.js','file:///etc/passwd']){try{await fetch(url);return false;}catch{}}return true;}));
  await beta.evaluate(()=>window.open('https://example.com'));check('popup denied',app.context().pages().length===3);
  check('unknown runtime IDs/layouts denied',await shell.evaluate(async()=>{try{await window.desktop.runtime.sync([{id:'forged'}]);return false;}catch{return true;}}));
  await beta.getByLabel('Your draft').fill('beta-kept-in-memory');await shell.waitForFunction(()=>document.querySelector('[data-runtime="records"]').dataset.dirty==='true');
  await beta.getByRole('button',{name:'Open local dialog'}).click();await beta.getByRole('dialog').waitFor();
  check('modal stays in app content',await shell.locator('[data-window-id="records"] .mac-titlebar').evaluate(e=>e.inert));
  await beta.keyboard.press('Tab');check('local modal traps keyboard focus',await beta.evaluate(()=>document.activeElement.id)==='dismiss');
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();
  check('beta-to-alpha switch focuses the native foreground',await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).isFocused()));
  await alpha.getByLabel('Your draft').fill('alpha-independent');
  await shell.getByRole('button',{name:'Records',exact:true}).click();
  check('alpha-to-beta switch focuses the native foreground',await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://beta/')).isFocused()));
  await beta.getByRole('button',{name:'Close dialog'}).click();
  await shell.getByRole('button',{name:'Close Records',exact:true}).click();await shell.getByRole('dialog',{name:'Unsaved sample draft'}).waitFor();
  await shell.getByRole('button',{name:'Keep working',exact:true}).click();check('dirty close cancellation preserves draft',await beta.getByLabel('Your draft').inputValue()==='beta-kept-in-memory');
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();
  const handle=shell.locator('[data-window-id="studio"] [data-resize="se"]'),before=await handle.boundingBox();
  await shell.mouse.move(before.x+before.width/2,before.y+before.height/2);await shell.mouse.down();await shell.mouse.move(before.x+before.width/2+60,before.y+before.height/2+25,{steps:4});await shell.mouse.up();
  await ready('studio');check('resize uses shared manager',await shell.locator('[data-window-id="studio"]').evaluate(e=>e.getBoundingClientRect().width)>760);
  await shot('runtime-overlap.png');
  await alpha.getByLabel('Your draft').click();
  await alpha.keyboard.press('Backquote');await shell.getByRole('dialog',{name:'Open windows'}).waitFor();
  check('overview contains both isolated snapshots',await shell.locator('.overview-card .isolated-mirror').count()===2);
  check('overview clones have no runtime identities',await shell.locator('.overview-card [data-runtime]').count()===0);
  await shell.getByRole('button',{name:'Switch to Records',exact:true}).click();
  await shell.getByRole('button',{name:'Maximize Records',exact:true}).click();
  await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.presentation==='fullscreen');
  const size=await beta.evaluate(()=>({w:innerWidth,h:innerHeight}));await beta.mouse.move(size.w/2,size.h-2);
  await shell.waitForFunction(()=>!document.querySelector('.dock-region').inert);check('native app bottom edge reveals fullscreen dock');
  await shell.getByRole('button',{name:'Restore Records size',exact:true}).click();
  await shell.mouse.move(10,10);
  await shell.getByRole('button',{name:'Minimize Records',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.phase==='minimized');
  check('Genie thumbnail contains captured native app',await shell.locator('[data-preview-app="records"] img').count()>0 || await shell.locator('[aria-label="Restore Records"] img').count()>0);
  await shell.getByRole('button',{name:'Restore Records',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.phase==='visible');
  check('minimize/restore retains isolated draft and process',await beta.getByLabel('Your draft').inputValue()==='beta-kept-in-memory'&&(await native()).apps.find(w=>w.url.includes('beta')).pid===topology.apps.find(w=>w.url.includes('beta')).pid);
  await shell.getByRole('button',{name:'Close Records',exact:true}).click();await shell.getByRole('button',{name:'Discard and close',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.phase==='closed');
  check('discard destroys the app webContents',(await native()).apps.length===1);
  await shell.getByRole('button',{name:'Records',exact:true}).click();await ready('records');const betaNew=await guest('beta');
  check('reopen creates clean workflow state',await betaNew.getByLabel('Your draft').inputValue()==='');
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();
  await alpha.evaluate(()=>{location.href='https://example.com';});await alpha.waitForTimeout(100);check('external navigation denied',alpha.url().startsWith('dental-fixture://alpha/'));
  await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).forcefullyCrashRenderer());
  await shell.locator('[data-runtime="studio"] [role="alert"]').waitFor();
  check('crash is contained to alpha',await betaNew.getByLabel('Your draft').inputValue()===''&&(await shell.evaluate(()=>window.desktop.status())).phase==='ready');
  await shot('runtime-crash.png');
  await shell.getByRole('button',{name:'Restart sample',exact:true}).click();await ready('studio');alpha=await guest('alpha');
  await app.evaluate(({webContents})=>{void webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).executeJavaScript('while(true){}').catch(()=>{});});
  await shell.locator('[data-runtime="studio"] [role="alert"]').waitFor({timeout:10000});
  check('watchdog terminates hung renderer without stopping beta',await shell.locator('[data-runtime="studio"] [role="alert"]').innerText().then(t=>t.includes('unresponsive'))&&await betaNew.getByLabel('Your draft').inputValue()==='');
  for(let i=0;i<3;i++){
   await shell.getByRole('button',{name:'Restart sample',exact:true}).click();await ready('studio');
   await shell.getByRole('button',{name:'Close Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]').dataset.phase==='closed');
   check(`cleanup cycle ${i+1}: no closed sample webContents`,(await native()).apps.length===1);
   if(i<2){await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await ready('studio');await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).forcefullyCrashRenderer());await shell.locator('[data-runtime="studio"] [role="alert"]').waitFor();}
  }
  check('no shell renderer errors',errors.length===0);
  return {checks,topology,errors,platform:process.platform,sha:process.env.GITHUB_SHA??null};
 } finally {await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts',reportName),JSON.stringify({checks,topology,errors,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));await app.close();}
}
