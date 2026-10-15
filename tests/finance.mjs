import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs],env}),page=await app.firstWindow();
const checks=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const modules=['Transaction Record','Patient payments','General expenses','Salary payments','Product list','Purchases','Supplier list','Supplier payments'];
const phase=value=>page.waitForFunction(p=>document.querySelector('[data-window-id="finance"]').dataset.phase===p,value);
try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 await page.getByRole('button',{name:'Finance',exact:true}).click();await phase('visible');
 const frame=page.getByTestId('finance-window'),tabs=frame.getByRole('tab'),panel=frame.getByRole('tabpanel');
 check('Finance contains the eight reference submodules in order',JSON.stringify(await tabs.allTextContents())===JSON.stringify(modules));
 for(const name of modules){await frame.getByRole('tab',{name,exact:true}).click();check(`${name} selects its own Coming soon panel`,await panel.getByRole('heading',{name,exact:true}).isVisible()&&await panel.getByText('Coming soon',{exact:true}).isVisible()&&await frame.locator('[role="tab"][aria-selected="true"]').count()===1);}
 await page.keyboard.press('ArrowRight');check('Arrow keys wrap to Transaction Record',await frame.getByRole('tab',{name:modules[0],exact:true}).getAttribute('aria-selected')==='true');await page.keyboard.press('End');check('End selects the final submodule',await panel.getByRole('heading',{name:modules[7],exact:true}).isVisible());await page.keyboard.press('Home');check('Home selects the first submodule',await panel.getByRole('heading',{name:modules[0],exact:true}).isVisible());
 await frame.getByRole('tab',{name:'Purchases',exact:true}).click();await page.mouse.move(20,20);await page.waitForTimeout(350);await page.screenshot({path:path.join(root,'artifacts/finance-navigation.png')});
 await page.getByRole('button',{name:'Maximize Finance',exact:true}).click();check('Submodule stays selected through fullscreen',await panel.getByRole('heading',{name:'Purchases',exact:true}).isVisible());await page.getByRole('button',{name:'Restore Finance size',exact:true}).click();
 await page.getByRole('button',{name:'Minimize Finance',exact:true}).click();await phase('minimized');await page.getByRole('button',{name:'Restore Finance',exact:true}).click();await phase('visible');check('Genie restore retains selection',await panel.getByRole('heading',{name:'Purchases',exact:true}).isVisible());
 await page.getByRole('button',{name:'Close Finance',exact:true}).click();await phase('closed');await page.getByRole('button',{name:'Finance',exact:true}).click();await phase('visible');check('Close/reopen retains selection',await panel.getByRole('heading',{name:'Purchases',exact:true}).isVisible());
 await page.evaluate(()=>{window.desktop.onHostTransition(value=>{window.hostTransitioning=value;});});await page.getByRole('button',{name:'Minimize Electron OS',exact:true}).click();
 let minimized=false;for(let n=0;n<40;n++){minimized=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized());if(minimized)break;await new Promise(r=>setTimeout(r,50));}assert.ok(minimized);await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].restore());await page.waitForFunction(()=>window.hostTransitioning===false);check('Whole OS restore retains selected Finance submodule',await panel.getByRole('heading',{name:'Purchases',exact:true}).isVisible());
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setDeviceMetricsOverride',{width:504,height:376,deviceScaleFactor:1,mobile:false});await page.waitForTimeout(200);
 check('Small window wraps navigation without horizontal clipping',await frame.locator('.finance-navigation').evaluate(e=>{const r=e.getBoundingClientRect();return e.scrollWidth===e.clientWidth&&[...e.querySelectorAll('button')].every(b=>{const t=b.getBoundingClientRect();return t.left>=r.left&&t.right<=r.right&&t.top>=r.top&&t.bottom<=r.bottom;});}));
 await frame.getByRole('tab',{name:'Supplier payments',exact:true}).click();check('Wrapped tabs still select their content',await panel.getByRole('heading',{name:'Supplier payments',exact:true}).isVisible());check('Compact window keeps the section name and Coming soon visible without scrolling',await panel.evaluate(e=>e.scrollHeight===e.clientHeight));await page.screenshot({path:path.join(root,'artifacts/finance-navigation-small.png')});
 check('No renderer errors',errors.length===0);await fs.writeFile(path.join(root,'artifacts/finance-verification.json'),JSON.stringify({checks,errors},null,2));
}finally{await app.close();}
