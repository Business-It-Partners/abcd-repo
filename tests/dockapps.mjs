import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const allApps=['company.dental.followups','company.dental.appointments','company.dental.work-entry','company.dental.patient-record','company.dental.treatment-progress','company.dental.lab-tracker','company.dental.finance','company.dental.patient-payments','company.dental.staff','company.dental.treatment-protocols','company.dental.calendar'];
const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures','--launch-feedback-fixtures'],env}),page=await app.firstWindow();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const phase=(id,value)=>page.waitForFunction(({id,value})=>document.querySelector('[data-window-id="'+id+'"]').dataset.phase===value,{id,value});
async function fits(){return page.locator('.dock-pill').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=11&&r.right<=innerWidth-11&&Math.abs(r.bottom-innerHeight)<1;});}
try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 await page.waitForFunction(ids=>ids.every(id=>document.querySelector(`[data-dock-app="${id}"]`)),allApps);
 await page.waitForFunction(()=>{const images=[...document.querySelectorAll('[data-dock-app^="company.dental."] img')];return images.length===11&&images.every(image=>image.complete&&image.naturalWidth>0);});
 check('V1 omits the in-house Files Explorer, Image Viewer, and shell file-transfer surface',await page.evaluate(()=>!document.querySelector('[data-dock-app="files"]')&&!document.querySelector('[data-window-id="files"]')&&!document.querySelector('[data-window-id="image-viewer"]')&&!('files' in window.desktop)));
 check('All eleven dental app launchers use loaded raster artwork, with the shared Finance icon reused',await page.locator('[data-dock-app^="company.dental."] img').evaluateAll(images=>images.length===11&&new Set(images.map(i=>i.src)).size===10&&images.every(i=>i.complete&&i.naturalWidth>0&&i.src.includes('.png'))&&images.find(i=>i.closest('[data-dock-app="company.dental.finance"]'))?.src===images.find(i=>i.closest('[data-dock-app="company.dental.patient-payments"]'))?.src));
 check('Normal dock excludes prototype demo launchers',await page.getByRole('button',{name:'Motion Studio',exact:true}).count()===0&&await page.getByRole('button',{name:'Records',exact:true}).count()===0);
 check('Removed nonfunctional Playground and Settings placeholders',await page.getByRole('button',{name:/visual placeholder/}).count()===0);

 const apps=[['company.dental.appointments','Appointments'],['company.dental.followups','Follow-ups']];
 for(const [id,name] of apps){
   await page.locator('[data-dock-app="'+id+'"]').click();await phase(id,'visible');
   await page.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',id);
   const frame=page.getByTestId(id+'-window');
   const guest=app.context().pages().find(candidate=>candidate.url().startsWith(`dental-fixture://${id}/`));
   const content=!!guest&&await guest.getByRole('heading',{name,exact:true}).count()===1;
   const resizeCount=await frame.locator('[data-resize]').count();
   check(name+' opens its correct managed window with shared resize controls',content&&resizeCount===8);
 }
 check('V1 keeps exactly two app windows open',await page.locator('[data-window-id]:not([data-phase="closed"])').count()===2);
 await page.locator('[data-dock-app="company.dental.appointments"]').click();
 await page.waitForFunction(()=>document.querySelector('[data-window-id="company.dental.appointments"]')?.dataset.active==='true');
 check('Clicking an open dock app activates its existing window without creating a duplicate',await page.getByTestId('company.dental.appointments-window').getAttribute('data-active')==='true'&&await page.locator('[data-window-id="company.dental.appointments"]').count()===1);
 await page.mouse.move(20,20);await page.waitForTimeout(250);check('Dock fits with two managed app windows open',await fits());

 for(const [id,name] of apps){
   await page.locator(`[data-dock-app="${id}"]`).click();await phase(id,'visible');
   const frame=page.getByTestId(id+'-window'),before=await frame.boundingBox();
   await page.getByRole('button',{name:'Maximize '+name,exact:true}).click();
   await phase(id,'visible');
   check(name+' maximizes within the desktop work area',await frame.getAttribute('data-presentation')==='fullscreen');
   await page.getByRole('button',{name:'Restore '+name+' size',exact:true}).click();
   assert.deepEqual(await frame.boundingBox(),before);
   await page.getByRole('button',{name:'Minimize '+name,exact:true}).click();await phase(id,'minimized');
   check(name+' minimizes to a captured dock thumbnail',await page.getByAltText(name+' snapshot',{exact:true}).isVisible());
   await page.getByRole('button',{name:'Restore '+name,exact:true}).click();await phase(id,'visible');
   assert.deepEqual(await frame.boundingBox(),before);
   await page.getByRole('button',{name:'Close '+name,exact:true}).click();await phase(id,'closed');
   await page.locator('[data-dock-app="'+id+'"]').click();await phase(id,'visible');
   await page.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',id);
   check(name+' closes and reopens through the shared window manager',true);
 }
 await page.getByRole('button',{name:'Close Follow-ups',exact:true}).click();await phase('company.dental.followups','closed');
 await page.getByRole('button',{name:'Follow-ups',exact:true}).click();await phase('company.dental.followups','visible');
 await page.waitForFunction(()=>document.querySelector('[data-runtime="company.dental.followups"]')?.dataset.runtimePhase==='ready');
 check('Follow-ups reopens with its app page intact',await app.context().pages().some(candidate=>candidate.url().startsWith('dental-fixture://company.dental.followups/')));
 await page.getByRole('button',{name:'Close Follow-ups',exact:true}).click();await phase('company.dental.followups','closed');
 await page.getByRole('button',{name:'Close Appointments',exact:true}).click();await phase('company.dental.appointments','closed');

 const cdp=await page.context().newCDPSession(page);
 for(const width of [800]){
   await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:600,deviceScaleFactor:1,mobile:false});await page.mouse.move(20,20);await page.waitForTimeout(250);
   check('Dock fits a '+width+'px display',await fits());
 }
 await cdp.send('Emulation.clearDeviceMetricsOverride');await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 check('No renderer errors',errors.length===0);
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'artifacts/m19-dockapps-verification.json'),JSON.stringify({checks,errors},null,2));
}finally{
 const closed=app.waitForEvent('close',{timeout:5000}).then(()=>true,()=>false);
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
 if(!await closed&&app.process().exitCode===null)app.process().kill('SIGTERM');
}
