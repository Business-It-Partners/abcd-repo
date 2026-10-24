import { profile, fixtureArgs as profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs],env});
const page=await app.firstWindow();
const checks=[],cycles=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const phase=(id,value)=>page.waitForFunction(({id,value})=>document.querySelector(`[data-window-id="${id}"]`).dataset.phase===value,{id,value});
async function drag(edge,dx,dy){const h=page.locator(`[data-window-id="records"] [data-resize="${edge}"]`);await h.hover();const b=await h.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2+dy,{steps:8});await page.mouse.up();}
async function snapshot(){return page.evaluate(()=>({
 marker:window.sessionMarker,
 windows:[...document.querySelectorAll('[data-window-id]')].map(e=>({id:e.dataset.windowId,phase:e.dataset.phase,presentation:e.dataset.presentation,active:e.dataset.active,style:{left:e.style.left,top:e.style.top,width:e.style.width,height:e.style.height,zIndex:e.style.zIndex}})),
 note:document.querySelector('#note').value,counter:document.querySelector('[data-testid="counter"]').textContent,
 rows:[...document.querySelectorAll('.records-window tbody tr')].map(e=>e.innerText),
 form:document.querySelector('[role="dialog"]')? [...document.querySelectorAll('[role="dialog"] input,[role="dialog"] select')].map(e=>({name:e.name,value:e.value})):null,
 nodesPreserved:window.sessionNodes.every(e=>e.isConnected),
}));}
async function cycle(name,route){
 const before=await snapshot();
 if(await page.locator('main.is-immersive').count()){
  const v=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));await page.mouse.move(v.w/2,v.h-2);await page.waitForFunction(()=>!document.querySelector('.dock-region').inert);
 }
 
 const traceStart=await app.evaluate(()=>globalThis.sessionTrace.length);
 await page.getByRole('button',{name:'Minimize Sajilo Dental',exact:true}).click();
 let minimized=false;
 for(let n=0;n<40;n++){minimized=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized());if(minimized)break;await new Promise(r=>setTimeout(r,50));}
 check(`${name}: environment minimized without closing`,minimized&&!page.isClosed());
 await new Promise(r=>setTimeout(r,150));
 const frozen=await page.evaluate(()=>({desktopWidth:document.querySelector('main').getBoundingClientRect().width,desktopHeight:document.querySelector('main').getBoundingClientRect().height,iconWidth:document.querySelector('.system-icon').getBoundingClientRect().width,menus:document.querySelectorAll('[role=menu]').length}));
 const displaySize=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);
 check(`${name}: minimized renderer keeps a stable desktop and resting dock`,frozen.desktopWidth===displaySize.width&&frozen.desktopHeight===displaySize.height&&Math.abs(frozen.iconWidth-36)<.1&&frozen.menus===0);
 // Same command as the installed host-dock entry, with an isolated test profile.
 if(route==='launcher')await promisify(execFile)('/home/master-x/.local/bin/electron-os',profileArgs,{env,timeout:10000});
 else await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].restore());
 await page.waitForFunction(()=>window.hostTransitioning===false);
 await page.waitForTimeout(100);
 const after=await snapshot();assert.deepEqual(after,before,`${name}: session state changed`);
 check(`${name}: window bounds, order, presentation, rows, note, counter, and draft stay identical`);
 const native=await app.evaluate(({BrowserWindow,screen})=>{const w=BrowserWindow.getAllWindows()[0],b=w.getBounds(),d=screen.getDisplayMatching(b).bounds;return {id:w.id,count:BrowserWindow.getAllWindows().length,fullscreen:w.isFullScreen(),minimized:w.isMinimized(),bounds:b,display:d};});
 check(`${name}: existing native window restored at full display size`,native.id===1&&native.count===1&&native.fullscreen&&!native.minimized&&JSON.stringify(native.bounds)===JSON.stringify(native.display));
 const trace=await app.evaluate((_electron,start)=>globalThis.sessionTrace.slice(start),traceStart);
 check(`${name}: restore avoids bounds changes and repeated fullscreen calls`,trace.filter(e=>e.method==='setBounds').length===0&&trace.filter(e=>e.method==='setFullScreen').length<=1);
 cycles.push({name,route,before,after,native,trace});
}
try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);
 await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 check('Test profile is isolated from the user session',await app.evaluate(({app})=>app.getPath('userData'))===profile);
 await app.evaluate(({BrowserWindow})=>{
  globalThis.sessionTrace=[];const w=BrowserWindow.getAllWindows()[0];
  for(const method of ['setBounds','setFullScreen','focus']){const original=w[method].bind(w);w[method]=(...args)=>{globalThis.sessionTrace.push({method,args,time:Date.now()});return original(...args);};}
 });
 await page.evaluate(()=>{
  window.hostTransitioning=false;window.desktop.onHostTransition(value=>{window.hostTransitioning=value;});
  window.sessionMarker=crypto.randomUUID();
 });
 await page.getByRole('button',{name:'Motion Studio',exact:true}).click();await phase('studio','visible');
 await page.locator('#note').fill('Keep this note across host-dock restore');
 for(let n=0;n<3;n++)await page.getByTestId('increment').click();
 await page.getByRole('button',{name:'Records',exact:true}).click();await phase('records','visible');
 await drag('nw',180,90);await drag('se',-120,-60);
 await page.getByRole('button',{name:'Add record',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Item name',{exact:true}).fill('Native restore retention record');
 await page.getByRole('dialog').getByLabel('Quantity',{exact:true}).fill('37');
 await page.getByRole('dialog').getByLabel('Unit price',{exact:true}).fill('83.25');
 await page.getByRole('button',{name:'Save record',exact:true}).click();
 await page.getByRole('button',{name:'Add record',exact:true}).click();
 await page.getByRole('dialog').getByLabel('Item name',{exact:true}).fill('Unsaved draft also survives');
 await page.evaluate(()=>{window.sessionNodes=[...document.querySelectorAll('[data-window-id]'),document.querySelector('#note')];});
 await cycle('Normal windows with an open draft','native');
 await cycle('Installed launcher reactivation with an open draft','launcher');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'Motion Studio',exact:true}).click();
 await page.getByRole('button',{name:'Minimize Motion Studio',exact:true}).click();await phase('studio','minimized');
 await page.getByRole('button',{name:'Maximize Records',exact:true}).click();
 await cycle('Fullscreen Records and internally minimized Studio','native');
 await cycle('Installed launcher with fullscreen and minimized apps','launcher');
 const v=await page.evaluate(()=>({w:innerWidth,h:innerHeight}));await page.mouse.move(v.w/2,v.h-2);await page.waitForFunction(()=>!document.querySelector('.dock-region').inert);
 await page.getByRole('button',{name:'Restore Motion Studio',exact:true}).click();await phase('studio','visible');
 check('Internally minimized Studio still restores its note and counter',await page.locator('#note').inputValue()==='Keep this note across host-dock restore'&&await page.getByTestId('counter').textContent()==='3');
 check('Saved Records row remains after all cycles',await page.getByRole('rowheader',{name:'Native restore retention record',exact:true}).count()===1);
 check('No renderer errors',errors.length===0);
 await fs.writeFile(path.join(root,'artifacts/native-session-verification.json'),JSON.stringify({checks,cycles,errors},null,2));
}finally{await app.close();}
