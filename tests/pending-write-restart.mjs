import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs,'--identity-fixtures','--runtime-fixtures','--api-loss-once'],env,timeout:30000});
const shell=await app.firstWindow(),checks=[];shell.setDefaultTimeout(15000);
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const phase=(id,value)=>shell.waitForFunction(({id,value})=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase===value,{id,value});

try{
 await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
 await shell.getByLabel('Email',{exact:true}).fill('first@fixture.invalid');
 await shell.getByLabel('Password',{exact:true}).fill('fixture-pass');
 await shell.getByRole('button',{name:'Sign in',exact:true}).click();
 await shell.waitForFunction(async()=> (await window.desktop.identity.view()).phase==='ready');
 check('fixture clinic session is ready for synthetic app writes');

 for(const [name,id] of [['Motion Studio','studio'],['Records','records']]){
  await shell.getByRole('button',{name,exact:true}).click();
  await phase(id,'ready');
 }
 const alpha=app.context().pages().find(page=>page.url().startsWith('dental-fixture://alpha/'));
 const beta=app.context().pages().find(page=>page.url().startsWith('dental-fixture://beta/'));
 assert.ok(alpha&&beta,'both isolated apps should be running');
 await alpha.getByRole('button',{name:'Connect SDK',exact:true}).click();
 await alpha.getByLabel('Appointment date',{exact:true}).fill('2026-10-16');
 await alpha.getByRole('button',{name:'Read synthetic appointment',exact:true}).click();
 await alpha.waitForFunction(()=>document.querySelector('#sdk-result')?.textContent.includes('11111111-1111-4111-8111-111111111111'));
 await alpha.getByLabel('Selected appointment',{exact:true}).selectOption('11111111-1111-4111-8111-111111111111');
 await alpha.getByRole('button',{name:'Change synthetic status',exact:true}).click();
 await alpha.waitForFunction(()=>document.querySelector('#sdk-result')?.textContent.includes('UNKNOWN_OUTCOME'));
 await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]')?.dataset.writeState==='unknown');
 check('dropped successful write response is tracked as an unknown server outcome');

 await app.evaluate(({webContents})=>webContents.getAllWebContents().find(page=>page.getURL().startsWith('dental-fixture://alpha/')).emit('unresponsive'));
 await phase('studio','unresponsive');
 await beta.getByLabel('Your draft').fill('Records remains responsive');
 check('the shell and the other app remain usable during the app hang',(await shell.evaluate(()=>window.desktop.status())).phase==='ready'&&await beta.getByLabel('Your draft').inputValue()==='Records remains responsive');

 const restartBlocked=await shell.evaluate(async()=>{
  const generation=(await window.desktop.identity.view()).generation;
  try{await window.desktop.runtime.restart('studio',generation);return false;}
  catch(error){return String(error?.message??error).includes('server change');}
 });
 check('restart is blocked while a server write outcome is unresolved',restartBlocked&&await shell.locator('[data-runtime="studio"]').getAttribute('data-write-state')==='unknown');
 await app.evaluate(({webContents})=>webContents.getAllWebContents().find(page=>page.getURL().startsWith('dental-fixture://alpha/')).emit('responsive'));
 await phase('studio','ready');
 await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();
 await alpha.getByRole('button',{name:'Check saved result',exact:true}).click();
 await alpha.waitForFunction(()=>document.querySelector('#sdk-result')?.textContent.includes('"rowVersion":2'));
 await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]')?.dataset.writeState==='none');
 check('original server write is reconciled before normal app operation resumes');

 await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
 await fs.writeFile(path.join(root,'artifacts/m19-pending-write-restart-verification.json'),JSON.stringify({checks,platform:process.platform},null,2));
}finally{
 const closed=app.waitForEvent('close',{timeout:5000}).then(()=>true,()=>false);
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
 if(!await closed&&app.process().exitCode===null)app.process().kill('SIGTERM');
}
