import { fixtureArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...fixtureArgs],env}),page=await app.firstWindow();
const checks=[],errors=[];page.setDefaultTimeout(15000);page.on('pageerror',error=>errors.push(error.message));
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const frame=page.getByTestId('finance-window'),dock=page.locator('[data-dock-app="finance"]');
const modules=['Transaction Record','Patient payments','General expenses','Salary payments','Product list','Purchases','Supplier list','Supplier payments'];
const phase=value=>page.waitForFunction(value=>document.querySelector('[data-window-id="finance"]')?.dataset.phase===value,value);
const select=name=>frame.getByRole('button',{name,exact:true}).click();
const selected=name=>frame.getByRole('heading',{name,exact:true}).isVisible();

try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 await page.locator('.dock-region').waitFor();await dock.click();await phase('visible');
 check('Finance opens as one managed window from its dock icon',await selected('Transaction Record')&&await frame.getAttribute('data-active')==='true');
 check('Finance presents its eight modules in the current sidebar',JSON.stringify(await frame.locator('.window-module-sidebar button').allTextContents())===JSON.stringify(modules));

 await select('Purchases');
 check('Selecting a Finance module updates its heading and active sidebar item',await selected('Purchases')&&await frame.getByRole('button',{name:'Purchases',exact:true}).getAttribute('aria-current')==='page');
 await page.locator('[data-dock-app="followups"]').click();await page.waitForFunction(()=>document.querySelector('[data-window-id="followups"]')?.dataset.phase==='visible');
 check('Opening a second app leaves the Finance module selected',await frame.getAttribute('data-active')==='false'&&await selected('Purchases'));
 await dock.click();await page.waitForFunction(()=>document.querySelector('[data-window-id="finance"]')?.dataset.active==='true');
 check('Clicking Finance again switches to its existing window',await selected('Purchases')&&await page.locator('[data-window-id="finance"]').count()===1);

 await page.getByRole('button',{name:'Maximize Finance',exact:true}).click();
 check('Maximize keeps the selected module visible',await frame.getAttribute('data-presentation')==='fullscreen'&&await selected('Purchases'));
 await page.getByRole('button',{name:'Restore Finance size',exact:true}).click();
 check('Restore returns Finance to its normal presentation',await frame.getAttribute('data-presentation')==='normal'&&await selected('Purchases'));
 await page.getByRole('button',{name:'Minimize Finance',exact:true}).click();await phase('minimized');
 await page.getByRole('button',{name:'Restore Finance',exact:true}).click();await phase('visible');
 check('Minimize and restore keep the selected module',await selected('Purchases'));

 await page.keyboard.press('Backquote');const overview=page.getByRole('dialog',{name:'Open windows',exact:true});await overview.waitFor({state:'visible'});
 check('Overview lists Finance and the second open app',await overview.locator('.overview-card').count()===2&&await overview.getByRole('button',{name:'Switch to Finance',exact:true}).count()===1);
 await overview.getByRole('button',{name:'Switch to Finance',exact:true}).click();await phase('visible');
 check('Overview returns to the selected Finance module',await overview.count()===0&&await selected('Purchases'));

 await page.getByRole('button',{name:'Close Finance',exact:true}).click();await phase('closed');
 await dock.click();await phase('visible');
 check('Close and reopen retain the Finance module selection',await selected('Purchases'));
 check('No renderer errors across Finance window controls',errors.length===0);
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'artifacts/m19-finance-verification.json'),JSON.stringify({checks,errors},null,2));
}finally{
 const closed=app.waitForEvent('close',{timeout:5000}).then(()=>true,()=>false);
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
 if(!await closed&&app.process().exitCode===null)app.process().kill('SIGTERM');
}
