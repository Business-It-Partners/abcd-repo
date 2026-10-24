import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs,'--identity-fixtures','--distribution-fixtures','--distribution-progress-fixtures'],env,timeout:30000});
const shell=await app.firstWindow(),checks=[],errors=[];
shell.setDefaultTimeout(15000);shell.on('pageerror',error=>errors.push(error.message));
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const phase=(id,value)=>shell.waitForFunction(({id,value})=>document.querySelector(`[data-window-id="${id}"]`)?.dataset.phase===value,{id,value});
const openCatalog=async()=>{await shell.getByRole('button',{name:'Open apps catalog',exact:true}).click();await phase('store','visible');const back=shell.locator('[data-window-id="store"] .window-history-controls').getByRole('button',{name:'Back',exact:true});if(await back.isEnabled())await back.click();await shell.getByRole('heading',{name:'App Store'}).waitFor();};

try{
 await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
 await shell.getByLabel('Email',{exact:true}).fill('first@fixture.invalid');
 await shell.getByLabel('Password',{exact:true}).fill('fixture-pass');
 await shell.getByRole('button',{name:'Sign in',exact:true}).click();
 await shell.getByRole('region',{name:'Clinic and signed-in user'}).waitFor();
 check('signed-in workspace starts with the desktop shell and no app windows',await shell.locator('.desktop-statusbar').count()===1&&await shell.locator('[data-window-id][data-phase="visible"]').count()===0);

 await openCatalog();
 check('Apps opens the authorized first-party Store catalog',await shell.getByRole('button',{name:'Details Motion Studio',exact:true}).isVisible()&&await shell.getByRole('button',{name:'Details Records',exact:true}).isVisible());
 await shell.getByLabel('Search store').fill('motion');
 check('app discovery search narrows the first-party list',await shell.getByRole('button',{name:'Details Motion Studio',exact:true}).count()===1&&await shell.getByRole('button',{name:'Details Records',exact:true}).count()===0);
 await shell.getByLabel('Search store').fill('');

 const install=async(title,id)=>{
  await shell.getByRole('button',{name:`Details ${title}`,exact:true}).click();
  await shell.getByRole('button',{name:'Install',exact:true}).click();
  const progress=shell.getByRole('progressbar',{name:`${title} progress`,exact:true});
  await progress.waitFor();
  const progressStatus=shell.locator('.delivery-store-progress-label[role="status"]');await progressStatus.waitFor({state:'visible'});
  check(`${title} installation exposes live download progress`,Number(await progress.getAttribute('max'))>0&&await progressStatus.innerText().then(text=>text.includes('Downloading'))&&await progressStatus.getAttribute('aria-live')==='polite');
  await shell.getByRole('button',{name:'Open',exact:true}).waitFor();
  await shell.locator('.delivery-store-notice').getByText('Verified app installed. Ready to open.',{exact:true}).waitFor();
  check(`${title} install result is announced from verified Store state`);
  const ready=shell.locator('.store-ready');
  await ready.waitFor();
  const readyText=await ready.innerText();
  check(`${title} install notification is polite status feedback`,await ready.getAttribute('role')==='status'&&readyText.includes(title)&&readyText.includes('Ready to open'));
  check(`${title} install notification offers a direct open action`,await ready.getByRole('button',{name:`Open ${title} from dock`,exact:true}).isVisible());
  await ready.getByRole('button',{name:`Open ${title} from dock`,exact:true}).click();
  await shell.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',id);
  const guest=app.context().pages().find(page=>page.url().startsWith(`dental-fixture://${id==='studio'?'alpha':'beta'}/`));
  assert.ok(guest,`${title} isolated page exists`);guest.on('pageerror',error=>errors.push(error.message));
  return guest;
 };

 const studio=await install('Motion Studio','studio');
  check('installed app launches inside its isolated runtime',await studio.getByLabel('Your draft').isVisible()&&await shell.locator('[data-window-id="studio"]').getAttribute('data-active')==='true');
 await studio.getByLabel('Your draft').fill('Return-to-work draft remains here');
 await openCatalog();
 const records=await install('Records','records');
 check('switching from Store to a second app follows shared window focus',await shell.locator('[data-window-id="records"]').getAttribute('data-active')==='true');

 await shell.getByRole('button',{name:'Show open windows',exact:true}).click();
 const overview=shell.getByRole('dialog',{name:'Open windows',exact:true});await overview.waitFor();
 check('Windows overview discovers both open apps and the Store',await overview.getByRole('button',{name:'Switch to Motion Studio',exact:true}).isVisible()&&await overview.getByRole('button',{name:'Switch to Records',exact:true}).isVisible()&&await overview.getByRole('button',{name:'Switch to App Store',exact:true}).isVisible());
 await overview.getByRole('button',{name:'Switch to Motion Studio',exact:true}).click();
 await phase('studio','visible');
 check('overview returns focus to Motion Studio and preserves its draft',await shell.locator('[data-window-id="studio"]').getAttribute('data-active')==='true'&&await studio.getByLabel('Your draft').inputValue()==='Return-to-work draft remains here');
 await shell.getByRole('button',{name:'Show open windows',exact:true}).click();
 await shell.getByRole('dialog',{name:'Open windows',exact:true}).getByRole('button',{name:'Switch to Records',exact:true}).click();
 await phase('records','visible');
 check('overview switches directly to Records and updates active-app identity',await shell.locator('[data-window-id="records"]').getAttribute('data-active')==='true');
 await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();
 check('dock returns to the existing app without losing unfinished work',await shell.locator('[data-window-id="studio"]').getAttribute('data-active')==='true'&&await studio.getByLabel('Your draft').inputValue()==='Return-to-work draft remains here');
 check('workspace discovery and return flow has no renderer errors',errors.length===0);
 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'artifacts','workspace-navigation-verification.json'),JSON.stringify({checks,errors,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));
}finally{await app.close();}
