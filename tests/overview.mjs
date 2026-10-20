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
const overview=page.getByRole('dialog',{name:'Open windows',exact:true});
const phase=(id,p)=>page.waitForFunction(({id,p})=>document.querySelector(`[data-window-id="${id}"]`).dataset.phase===p,{id,p});
async function selectFinance(module){await page.getByRole('button',{name:'Finance',exact:true}).click();await page.getByTestId('finance-explorer').getByRole('button',{name:module,exact:true}).click();}
async function toggle(){await page.keyboard.press('Backquote');}
try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 await installDemoApps(page);
 await toggle();check('Backquote opens an empty desktop overview',await overview.getByText('No open windows',{exact:true}).isVisible());await toggle();check('Backquote toggles the overview closed',await overview.count()===0);
 await selectFinance('Transaction Record');for(const name of ['Appointments','Follow-ups'])await page.getByRole('button',{name,exact:true}).click();await phase('followups','visible');
 const frame=page.getByTestId('followups-window');await frame.getByRole('button',{name:'Create follow-up',exact:true}).click();const input=frame.getByLabel('Patient name',{exact:true});await input.fill('Draft stays intact');
 const before=await page.evaluate(()=>[...document.querySelectorAll('[data-window-id]')].map(e=>({id:e.dataset.windowId,bounds:[e.style.left,e.style.top,e.style.width,e.style.height],phase:e.dataset.phase,presentation:e.dataset.presentation})));
 await toggle();check('Shortcut works in a form without inserting Backquote',await overview.isVisible()&&await input.inputValue()==='Draft stays intact');
 check('Overview contains three open apps and read-only window previews',await overview.locator('.overview-card').count()===3&&await overview.locator('.overview-preview>.studio-window').count()===3);
 check('Previews preserve draft values without duplicate DOM identities',await overview.locator('input[name="patient"]').inputValue()==='Draft stays intact'&&await page.locator('#followups-patient').count()===1&&await overview.locator('[data-window-id],[data-testid]').count()===0);
 check('Background windows and dock are inert',await page.locator('[data-window-id]').evaluateAll(w=>w.every(e=>e.inert))&&await page.locator('.dock-region').evaluate(e=>e.inert));
 check('Full-sized background windows are hidden while previews remain visible',await frame.evaluate(e=>getComputedStyle(e).opacity==='0')&&await overview.locator('.overview-preview>.studio-window').first().evaluate(e=>getComputedStyle(e).opacity==='1'));
 await page.screenshot({path:path.join(root,'artifacts/window-overview.png')});
 await page.evaluate(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'`',code:'Backquote',repeat:true,bubbles:true})));check('Held key does not repeatedly toggle overview',await overview.isVisible());
 await page.keyboard.press('Escape');check('Escape restores the active draft field and keeps its value',await overview.count()===0&&await input.evaluate(e=>e===document.activeElement)&&await input.inputValue()==='Draft stays intact');
 assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('[data-window-id]')].map(e=>({id:e.dataset.windowId,bounds:[e.style.left,e.style.top,e.style.width,e.style.height],phase:e.dataset.phase,presentation:e.dataset.presentation}))),before);check('Toggling overview preserves window geometry and lifecycle',true);
 await page.keyboard.press('Escape');await selectFinance('Purchases');await page.getByRole('button',{name:'Minimize Finance',exact:true}).click();await phase('finance','minimized');
 await toggle();check('Minimized apps appear with their real saved thumbnail',await overview.getByRole('button',{name:'Switch to Finance',exact:true}).locator('.overview-snapshot').count()===1);
 await overview.getByRole('button',{name:'Switch to Finance',exact:true}).click();await phase('finance','visible');check('Choosing a minimized app restores its saved module',await overview.count()===0&&await page.getByTestId('finance-window').getByRole('heading',{name:'Purchases',exact:true}).isVisible());
 await page.getByRole('button',{name:'Maximize Finance',exact:true}).click();await toggle();await page.keyboard.press('End');check('Keyboard navigation selects the final preview',await overview.locator('.overview-card').last().evaluate(e=>e===document.activeElement));await page.keyboard.press('Enter');await page.waitForFunction(()=>!document.querySelector('.window-overview'));
 await page.getByRole('button',{name:'Finance',exact:true}).click();await toggle();await overview.getByRole('button',{name:'Switch to Finance',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-window-id="finance"]').dataset.active==='true'&&!document.querySelector('.window-overview'));check('Selecting a fullscreen app preserves fullscreen',await page.getByTestId('finance-window').getAttribute('data-presentation')==='fullscreen');
 await toggle();const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:504,height:600,deviceScaleFactor:1,mobile:false});await page.waitForTimeout(200);check('Overview previews fit a narrow screen and can scroll',await overview.locator('.overview-card').evaluateAll(cards=>cards.every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;})));await page.screenshot({path:path.join(root,'artifacts/window-overview-small.png')});await overview.getByRole('button',{name:'Close window overview',exact:true}).click();check('Close control exits the overview',await overview.count()===0);
 await cdp.send('Emulation.clearDeviceMetricsOverride');await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 for (const [count,names] of [[4,['Lab Tracker']],[7,['Patient Record','Work Entry','Treatment Progress']],[10,['Staff','Treatment Protocols','Calendar']]]) {
  for(const name of names) { await page.mouse.move(683,767); await page.getByRole('button',{name,exact:true}).click(); }
  await toggle();await page.waitForTimeout(150);
  const arrangement=await overview.evaluate(e=>{
   const grid=e.querySelector('.overview-grid').getBoundingClientRect();
   const cards=[...e.querySelectorAll('.overview-card')].map(c=>{const r=c.getBoundingClientRect(),p=c.querySelector('.overview-window').getBoundingClientRect();return {x:r.left-grid.left,y:r.top-grid.top,width:r.width,height:r.height,previewWidth:p.width,previewHeight:p.height};});
   return {cards,width:grid.width,height:grid.height};
  });
  check(`${count} windows form a centered multi-row collection`,arrangement.cards.length===count&&new Set(arrangement.cards.map(c=>Math.round(c.y))).size>1&&Math.abs(Math.min(...arrangement.cards.map(c=>c.x))+Math.max(...arrangement.cards.map(c=>c.x+c.width))-arrangement.width)<2&&Math.abs(Math.min(...arrangement.cards.map(c=>c.y))+Math.max(...arrangement.cards.map(c=>c.y+c.height))-arrangement.height)<2);
  check(`${count} previews have no overlapping windows or captions`,arrangement.cards.every((p,i)=>arrangement.cards.slice(i+1).every(q=>p.x+p.width<=q.x+1||q.x+q.width<=p.x+1||p.y+p.height<=q.y+1||q.y+q.height<=p.y+1)));
  check(`${count} previews preserve each actual window's proportions`,await overview.locator('.overview-card').evaluateAll(cards=>cards.every(c=>{const clone=c.querySelector('.studio-window'),preview=c.querySelector('.overview-window').getBoundingClientRect();return !clone||Math.abs(preview.width/preview.height-parseFloat(clone.style.width)/parseFloat(clone.style.height))<.01;})));
  await page.screenshot({path:path.join(root,`artifacts/window-overview-${count}.png`)});
  if(count===4){await page.keyboard.press('ArrowDown');check('Down arrow moves to the next visual row',await overview.locator('.overview-card').evaluateAll(cards=>{const first=cards[0].getBoundingClientRect(),active=document.activeElement.getBoundingClientRect();return active.top>first.bottom;}));}
  await page.keyboard.press('Escape');
 }
 await toggle();await cdp.send('Emulation.setDeviceMetricsOverride',{width:504,height:600,deviceScaleFactor:1,mobile:false});await page.waitForTimeout(150);
 check('Ten windows stay inside the narrow display with vertical scrolling',await overview.locator('.overview-card').evaluateAll(cards=>cards.every(c=>{const r=c.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}))&&await overview.locator('.overview-scroll').evaluate(e=>e.scrollHeight>e.clientHeight));
 check('Scrollable collection starts at the top without wasted space',await overview.locator('.overview-card').first().evaluate(e=>{const stage=document.querySelector('.overview-scroll').getBoundingClientRect();return e.getBoundingClientRect().top-stage.top<30;}));await page.screenshot({path:path.join(root,'artifacts/window-overview-many-small.png')});await page.keyboard.press('End');check('Keyboard selection scrolls the last window into view',await overview.locator('.overview-card').last().evaluate(e=>{const r=e.getBoundingClientRect();return e===document.activeElement&&r.top>=0&&r.bottom<=innerHeight;}));await page.keyboard.press('Escape');
 check('No renderer errors',errors.length===0);await fs.writeFile(path.join(root,'artifacts/overview-verification.json'),JSON.stringify({checks,errors},null,2));
}finally{await app.close();}
