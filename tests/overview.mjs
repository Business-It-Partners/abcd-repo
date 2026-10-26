import { fixtureArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...fixtureArgs],env}),page=await app.firstWindow();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const overview=page.getByRole('dialog',{name:'Open windows',exact:true});
const phase=(id,p)=>page.waitForFunction(({id,p})=>document.querySelector('[data-window-id="'+id+'"]').dataset.phase===p,{id,p});
async function toggle(){await page.keyboard.press('Backquote');}
try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 await page.locator('.dock-region').waitFor();
 const preferences=await page.evaluate(()=>window.desktop.preferences());
 check('Isolated profile enables the overview shortcut',preferences.overviewShortcutEnabled===true);
 await toggle();await overview.waitFor({state:'visible'});check('Backquote opens an empty desktop overview',await overview.getByText('No open windows',{exact:true}).isVisible());await toggle();check('Backquote toggles the overview closed',await overview.count()===0);
 await page.locator('[data-dock-app="finance"]').click();
 await phase('finance','visible');
 const finance=page.getByTestId('finance-window');
 await finance.getByRole('button',{name:'Purchases',exact:true}).click();
 await finance.getByRole('heading',{name:'Purchases',exact:true}).waitFor();
 await page.getByRole('button',{name:'Follow-ups',exact:true}).click();await phase('followups','visible');
 const frame=page.getByTestId('followups-window');
 await frame.getByRole('button',{name:'Create follow-up',exact:true}).click();
 const input=frame.getByLabel('Patient name',{exact:true});await input.fill('Draft stays intact');
 const before=await page.evaluate(()=>[...document.querySelectorAll('[data-window-id]')].map(e=>({id:e.dataset.windowId,bounds:[e.style.left,e.style.top,e.style.width,e.style.height],phase:e.dataset.phase,presentation:e.dataset.presentation})));
 check('V1 overview contains only the two permitted open apps and read-only previews',before.filter(w=>w.phase!=='closed').length===2);
 await toggle();check('Overview opens in a form without inserting Backquote',await overview.isVisible()&&await input.inputValue()==='Draft stays intact');
 check('Overview shows exactly two open windows and read-only previews',await overview.locator('.overview-card').count()===2&&await overview.locator('.overview-preview>.studio-window').count()===2);
 check('Previews preserve draft values without duplicate DOM identities',await overview.locator('input[name="patient"]').inputValue()==='Draft stays intact'&&await page.locator('#followups-patient').count()===1&&await overview.locator('[data-window-id],[data-testid]').count()===0);
 check('Background windows and dock are inert',await page.locator('[data-window-id]').evaluateAll(w=>w.every(e=>e.inert))&&await page.locator('.dock-region').evaluate(e=>e.inert));
 check('Full-sized background windows are hidden while previews remain visible',await frame.evaluate(e=>getComputedStyle(e).opacity==='0')&&await overview.locator('.overview-preview>.studio-window').first().evaluate(e=>getComputedStyle(e).opacity==='1'));
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:String.fromCharCode(96),code:'Backquote',repeat:true,bubbles:true})));check('Held key does not repeatedly toggle overview',await overview.isVisible());
 await page.keyboard.press('Escape');check('Escape restores the active draft field and keeps its value',await overview.count()===0&&await input.evaluate(e=>e===document.activeElement)&&await input.inputValue()==='Draft stays intact');
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('[data-window-id]')].map(e=>({id:e.dataset.windowId,bounds:[e.style.left,e.style.top,e.style.width,e.style.height],phase:e.dataset.phase,presentation:e.dataset.presentation}))),before);check('Toggling overview preserves window geometry and lifecycle',true);

 await page.locator('[data-dock-app="finance"]').click();await page.waitForFunction(()=>document.querySelector('[data-window-id="finance"]')?.dataset.active==='true');
 await page.getByRole('button',{name:'Minimize Finance',exact:true}).click();await phase('finance','minimized');
 await toggle();check('Minimized app appears with its saved thumbnail',await overview.getByRole('button',{name:'Switch to Finance',exact:true}).locator('.overview-snapshot').count()===1);
 await overview.getByRole('button',{name:'Switch to Finance',exact:true}).click();await phase('finance','visible');
 check('Overview restores the minimized app and preserves its active module',await overview.count()===0&&await finance.getByRole('heading',{name:'Purchases',exact:true}).isVisible());
 await page.getByRole('button',{name:'Maximize Finance',exact:true}).click();await toggle();await page.keyboard.press('End');
 check('Keyboard navigation selects the final app preview',await overview.locator('.overview-card').last().evaluate(e=>e===document.activeElement));
 await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('.window-overview'));
 check('Selecting a window preserves its fullscreen presentation',await page.getByTestId('finance-window').getAttribute('data-presentation')==='fullscreen');

 await toggle();const cdp=await page.context().newCDPSession(page);
 await cdp.send('Emulation.setDeviceMetricsOverride',{width:504,height:600,deviceScaleFactor:1,mobile:false});await page.waitForTimeout(150);
 check('Two-window overview fits a narrow display',await overview.locator('.overview-card').evaluateAll(cards=>cards.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));
 await page.keyboard.press('End');check('Keyboard selection scrolls the selected preview into view',await overview.locator('.overview-card').last().evaluate(e=>{const r=e.getBoundingClientRect();return e===document.activeElement&&r.top>=0&&r.bottom<=innerHeight;}));
 await page.keyboard.press('Escape');await cdp.send('Emulation.clearDeviceMetricsOverride');
 check('No renderer errors',errors.length===0);
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'artifacts/m19-overview-verification.json'),JSON.stringify({checks,errors},null,2));
}finally{
 const closed=app.waitForEvent('close',{timeout:5000}).then(()=>true,()=>false);
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
 if(!await closed&&app.process().exitCode===null)app.process().kill('SIGTERM');
}
