import { installDemoApps } from './storeSetup.mjs';
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs],env}),page=await app.firstWindow();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const names={appointments:'Appointments',workentry:'Work Entry',patients:'Patient Record',treatment:'Treatment Progress',lab:'Lab Tracker',finance:'Finance',staff:'Staff',protocols:'Treatment Protocols',calendar:'Calendar'};
const phase=(id,value)=>page.waitForFunction(({id,value})=>document.querySelector(`[data-window-id="${id}"]`).dataset.phase===value,{id,value});
async function fits(){return page.locator('.dock-pill').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=11&&r.right<=innerWidth-11&&Math.abs(r.bottom-innerHeight)<1;});}
try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 await installDemoApps(page);
 await page.waitForFunction(()=>[...document.querySelectorAll('.dock-artwork')].every(e=>e.complete&&e.naturalWidth>0));
 check('All ten dental app launchers use loaded, distinct raster artwork',await page.locator('.dock-artwork[src*=".png"]').evaluateAll(images=>images.length===10&&new Set(images.map(i=>i.src)).size===10&&images.every(i=>i.src.includes('.png'))));
 check('Normal dock excludes prototype demos',await page.getByRole('button',{name:'Motion Studio',exact:true}).count()===0&&await page.getByRole('button',{name:'Records',exact:true}).count()===0);
 check('Removed nonfunctional Playground and Settings placeholders',await page.getByRole('button',{name:/visual placeholder/}).count()===0);
 check('Normal dock has no empty thumbnail slots',await page.locator('.dock-preview').count()===0);
 await page.mouse.move(20,20);await page.screenshot({path:path.join(root,'artifacts/clinic-dock.png')});
 for(const [id,name] of Object.entries(names)){
  await page.getByRole('button',{name,exact:true}).click();await phase(id,'visible');const frame=page.getByTestId(`${id}-window`);
  check(`${name} opens its app content and eight resize handles`,await frame.getByRole('heading',{name:id==='finance'?'Transaction Record':name,exact:true}).isVisible()&&(id==='staff'?await frame.getByRole('table',{name:'Staff list'}).isVisible():id==='lab'?await frame.getByRole('table',{name:'Lab orders',exact:true}).isVisible():await frame.getByText('Coming soon',{exact:true}).isVisible())&&await frame.locator('[data-resize]').count()===8);
  const before=await frame.boundingBox();await page.getByRole('button',{name:`Maximize ${name}`,exact:true}).click();
  check(`${name} expands fullscreen`,await frame.evaluate(e=>{const r=e.getBoundingClientRect();return r.x===0&&r.y===0&&r.width===innerWidth&&r.height===innerHeight;}));
  await page.getByRole('button',{name:`Restore ${name} size`,exact:true}).click();assert.deepEqual(await frame.boundingBox(),before);
  await page.getByRole('button',{name:`Minimize ${name}`,exact:true}).click();await phase(id,'minimized');
  check(`${name} minimizes to a real captured window thumbnail`,await page.getByAltText(`${name} snapshot`,{exact:true}).isVisible());
  await page.getByRole('button',{name:`Restore ${name}`,exact:true}).click();await phase(id,'visible');assert.deepEqual(await frame.boundingBox(),before);
  await page.getByRole('button',{name:`Close ${name}`,exact:true}).click();await phase(id,'closed');
  check(`${name} restores and closes through the shared manager`,await page.getByRole('button',{name:`Open ${name} preview`,exact:true}).count()===0);
 }
 await page.getByRole('button',{name:'Follow-ups',exact:true}).click();await phase('followups','visible');check('Follow-ups retains its working table',await page.getByTestId('followups-window').getByRole('table',{name:'Follow-ups',exact:true}).isVisible());
 await page.getByRole('button',{name:'Close Follow-ups',exact:true}).click();
 for(const name of Object.values(names)) await page.getByRole('button',{name,exact:true}).click();
 await page.mouse.move(20,20);await page.waitForTimeout(350);check('Dock fits with all nine new apps open',await fits());
 await page.getByRole('button',{name:'Finance',exact:true}).click();await page.mouse.move(20,20);await page.waitForTimeout(350);await page.screenshot({path:path.join(root,'artifacts/clinic-coming-soon.png')});
 check('Visible apps do not add duplicate icon thumbnails',await page.locator('.dock-preview').count()===0);
 for(const [id,name] of Object.entries(names)){await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:`Minimize ${name}`,exact:true}).click();await phase(id,'minimized');}
 check('Nine minimized apps retain nine real window thumbnails',await page.locator('.dock-preview img').count()===9);
 await page.mouse.move(20,20);await page.screenshot({path:path.join(root,'artifacts/clinic-minimized.png')});
 const cdp=await page.context().newCDPSession(page);
 for(const width of [800,480]){
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height:600,deviceScaleFactor:1,mobile:false});await page.mouse.move(20,20);await page.waitForTimeout(400);check(`Full app collection fits a ${width}px display`,await fits());
  check(`${width}px resize retains all minimized snapshots`,await page.locator('.dock-preview img[alt$=" snapshot"]').count()===9);
  for(const name of ['Minimize Electron OS','Shut down Electron OS','Calendar']){const button=page.getByRole('button',{name,exact:true});await button.hover();await page.waitForTimeout(400);check(`${width}px dock stays inside screen while hovering ${name}`,await fits());}
 }
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false});await page.mouse.move(20,20);await page.waitForTimeout(400);
 // Actual gesture smoke check for a new app (focus another title without hitting controls).
 const frame=page.getByTestId('finance-window');await page.getByRole('button',{name:'Finance',exact:true}).click();await phase('finance','visible');
 const before=await frame.boundingBox(),bar=await frame.locator('.mac-titlebar').boundingBox();await page.mouse.move(bar.x+bar.width/2,bar.y+20);await page.mouse.down();await page.mouse.move(bar.x+bar.width/2+40,bar.y+50,{steps:6});await page.mouse.up();const moved=await frame.boundingBox();check('New app title bar moves its shared window',moved.x!==before.x||moved.y!==before.y);
 const handle=await frame.locator('[data-resize="se"]').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+80,handle.y+40,{steps:6});await page.mouse.up();check('New app corner resizes its shared window',(await frame.boundingBox()).width>moved.width);
 check('No renderer errors',errors.length===0);await fs.writeFile(path.join(root,'artifacts/dockapps-verification.json'),JSON.stringify({checks,errors},null,2));
}finally{await app.close();}
