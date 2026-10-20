import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs,'--identity-fixtures','--distribution-fixtures','--distribution-unavailable-fixtures'],env,timeout:30000});
const shell=await app.firstWindow(),checks=[],errors=[];
shell.setDefaultTimeout(15000);shell.on('pageerror',error=>errors.push(error.message));
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const phase=value=>shell.waitForFunction(value=>document.querySelector('[data-window-id="studio"]')?.dataset.phase===value,value);
const openCatalog=async()=>{await shell.getByRole('button',{name:'Open apps catalog',exact:true}).click();const back=shell.getByRole('button',{name:'Back to apps',exact:true});if(await back.isVisible())await back.click();await shell.getByRole('heading',{name:'Your apps. One workspace.'}).waitFor();};

try{
 await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
 await shell.getByLabel('Email',{exact:true}).fill('first@fixture.invalid');
 await shell.getByLabel('Password',{exact:true}).fill('fixture-pass');
 await shell.getByRole('button',{name:'Sign in',exact:true}).click();
 await shell.getByRole('region',{name:'Clinic and signed-in user'}).waitFor();
 await openCatalog();
 await shell.getByRole('button',{name:'Details Motion Studio',exact:true}).click();
 await shell.getByRole('button',{name:'Get',exact:true}).click();
 await shell.getByRole('button',{name:'Open',exact:true}).waitFor();
 await shell.getByRole('button',{name:'Open',exact:true}).click();
 await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase==='ready');
 const studio=app.context().pages().find(page=>page.url().startsWith('dental-fixture://alpha/'));
 assert.ok(studio,'installed app runtime exists');studio.on('pageerror',error=>errors.push(error.message));
 await studio.getByLabel('Your draft').fill('Keep this work while Store is unavailable');
 const profile=await app.evaluate(({app})=>app.getPath('userData'));
 const unavailableFile=path.join(profile,'distribution-unavailable.fixture');
 await fs.writeFile(unavailableFile,'unavailable');
 await openCatalog();
 const refresh=shell.getByRole('button',{name:'Refresh company apps',exact:true});
 await refresh.click();
 const unavailable=shell.locator('.delivery-store-notice[data-state="unavailable"]');
 await unavailable.waitFor();
 check('catalogue outage is an accessible, clear Store alert',await unavailable.getAttribute('role')==='alert'&&await unavailable.innerText().then(text=>text.includes('Store operation unavailable')&&text.includes('installed apps remain available')));
 const studioCard=shell.locator('.store-grid article').filter({hasText:'Motion Studio'});
 check('outage keeps the verified installed app in the catalog',await studioCard.getByRole('button',{name:'Open',exact:true}).isEnabled());
 const recordsCard=shell.locator('.store-grid article').filter({hasText:'Records'});
 const recordsGet=recordsCard.getByRole('button',{name:'Get',exact:true});
 check('new installs are disabled while clinic catalogue authority is unavailable',await recordsGet.isDisabled());
 await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();
 await phase('visible');
 check('installed app remains openable during Store outage and keeps its draft',await shell.locator('.statusbar-active').innerText()==='Motion Studio'&&await studio.getByLabel('Your draft').inputValue()==='Keep this work while Store is unavailable');

 await fs.rm(unavailableFile);
 await openCatalog();
 await refresh.click();
 await shell.waitForFunction(()=>{const article=[...document.querySelectorAll('.store-grid article')].find(item=>item.textContent?.includes('Records'));const get=article?.querySelector('.store-get');return !document.querySelector('.delivery-store-notice')&&get instanceof HTMLButtonElement&&!get.disabled;});
 check('refresh clears the outage state and restores authorized Store actions',await shell.locator('.delivery-store-notice').count()===0&&await recordsGet.isEnabled());
 check('delivery-state transitions have no renderer errors',errors.length===0);
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'artifacts','delivery-states-verification.json'),JSON.stringify({checks,errors,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));
}finally{await app.close();}
