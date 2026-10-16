import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifyDistribution(profileArgs, reportName) {
 const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const checks=[],check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};let app;
 try {
  app=await electron.launch({args:[root,...profileArgs,'--distribution-fixtures'],env,timeout:30000});const shell=await app.firstWindow();shell.setDefaultTimeout(15000);
  await shell.getByRole('button',{name:'App Store',exact:true}).click();await shell.getByRole('heading',{name:'Your apps. One workspace.'}).waitFor();
  await shell.getByRole('button',{name:'Details Motion Studio',exact:true}).waitFor();check('real Store displays only signed company catalogue',await shell.getByRole('button',{name:/^Details /}).count()===2);
  check('sample artwork uses the existing vector icon language',await shell.locator('.delivery-art svg').count()===2);
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts','distribution-store.png'),await shell.screenshot());
  check('uninstalled apps are absent from dock',await shell.locator('[data-dock-app="studio"]').count()===0&&await shell.locator('[data-dock-app="records"]').count()===0);
  await shell.getByRole('button',{name:'Details Motion Studio',exact:true}).click();await shell.getByRole('button',{name:'Get',exact:true}).click();await shell.getByRole('button',{name:'Open',exact:true}).waitFor();
  const profile=await app.evaluate(({app})=>app.getPath('userData')),file=path.join(profile,'packages/registry.json');
  const registry=JSON.parse(await fs.readFile(file,'utf8'));check('Ready follows real registry activation',!!registry.apps['company.sample.alpha']);check('dock derives installed state',await shell.locator('[data-dock-app="studio"]').count()===1);
  await shell.getByRole('button',{name:'Open',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase==='ready');
  const guest=app.context().pages().find(p=>p.url().startsWith('dental-fixture://alpha/'));check('downloaded signed package launches in isolated runtime',!!guest&&await guest.getByLabel('Your draft').inputValue()==='');
  check('app has no Store or installation bridge',await guest.evaluate(()=>!window.desktop&&!window.dentalApp.install));
  await shell.getByRole('button',{name:'Close Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]')?.dataset.phase==='closed');
  await shell.getByRole('button',{name:'App Store',exact:true}).click();await shell.getByRole('button',{name:'Uninstall',exact:true}).click();await shell.getByRole('button',{name:'Confirm uninstall',exact:true}).click();await shell.getByRole('button',{name:'Get',exact:true}).waitFor();
  check('uninstall updates registry and dock',!JSON.parse(await fs.readFile(file,'utf8')).apps['company.sample.alpha']&&await shell.locator('[data-dock-app="studio"]').count()===0);
  await shell.getByRole('button',{name:'Get',exact:true}).click();await shell.getByRole('button',{name:'Open',exact:true}).waitFor();
  await app.close();app=undefined;
  app=await electron.launch({args:[root,...profileArgs,'--distribution-fixtures'],env,timeout:30000});const relaunched=await app.firstWindow();relaunched.setDefaultTimeout(15000);
  await relaunched.locator('[data-dock-app="studio"]').waitFor();check('installed state survives complete app relaunch');
  await relaunched.getByRole('button',{name:'Motion Studio',exact:true}).click();await relaunched.waitForFunction(()=>document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase==='ready');check('retained verified app launches after restart');
 }finally{await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts',reportName),JSON.stringify({checks,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));if(app)await app.close();}
}
