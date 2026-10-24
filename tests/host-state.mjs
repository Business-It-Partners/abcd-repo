import { profile, profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const checks=[];let app;
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);console.log('PASS',name);};
async function launch(){ app=await electron.launch({args:[root,...profileArgs],env});return app.firstWindow(); }
try {
 let page=await launch();await page.waitForFunction(()=>!!window.desktop);
 check('host reaches ready', (await page.evaluate(()=>window.desktop.status())).phase==='ready');
 check('default preference enabled',(await page.evaluate(()=>window.desktop.preferences())).overviewShortcutEnabled);
 await page.keyboard.press('Backquote');await page.locator('.window-overview').waitFor();await page.keyboard.press('Escape');
 check('unknown preference rejected',await page.evaluate(async()=>{try{await window.desktop.preferences({overviewShortcutEnabled:false,patient:'not allowed'});return false;}catch{return true;}}));
 await page.evaluate(()=>window.desktop.preferences({overviewShortcutEnabled:false}));
 await app.close();app=undefined;
 page=await launch();await page.waitForFunction(()=>!!window.desktop);
 check('preference survives full restart',!(await page.evaluate(()=>window.desktop.preferences())).overviewShortcutEnabled);
 await page.keyboard.press('Backquote');
 check('disabled shortcut does not open overview',await page.locator('.window-overview').count()===0);
 await app.close();app=undefined;
 const file=path.join(profile,'state','preferences.json');const raw='{invalid settings';await fs.writeFile(file,raw);
 page=await launch();await page.getByRole('heading',{name:'Sajilo Dental needs recovery'}).waitFor();
 check('corrupt state shows explicit recovery',await page.title()==='Sajilo Dental recovery');
 check('recovery has no privileged preload',await page.evaluate(()=>window.desktop===undefined));
 check('corrupt file preserved',await fs.readFile(file,'utf8')===raw);
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'artifacts','host-state-verification.json'),JSON.stringify({checks,platform:process.platform},null,2));
} finally {if(app)await app.close();}
