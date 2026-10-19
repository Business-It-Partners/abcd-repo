import {_electron as electron} from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const appId='company.sample.preview';
const expected=new Map([['1.0.0','Coming soon'],['1.1.0','Your workspace is ready'],['1.2.0','Release history']]);

export async function verifyOnboarding(profileArgs,reportName){
 const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const checks=[],check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
 let app,shell,profile,failureDetails;
 const wait=async(predicate,label='state')=>{for(let n=0;n<150;n++){try{const value=await predicate();if(value)return value;}catch{}await new Promise(resolve=>setTimeout(resolve,100));}throw Error(`Timed out waiting for ${label}`);};
 const registry=async profile=>JSON.parse(await fs.readFile(path.join(profile,'packages/registry.json'),'utf8'));
 const openStore=async shell=>{await shell.getByRole('button',{name:'App Store',exact:true}).click();const back=shell.getByRole('button',{name:'Back to apps',exact:true});if(await back.isVisible())await back.click();await shell.getByRole('heading',{name:'Your apps. One workspace.'}).waitFor();};
 const detail=async(shell)=>{await openStore(shell);await shell.getByRole('button',{name:'Details Dental Workspace Preview',exact:true}).click();await shell.getByRole('heading',{name:'Dental Workspace Preview'}).waitFor();};
 const verifyPage=async(version)=>{
  const page=await wait(async()=>{
   for(const candidate of app.context().pages().filter(page=>page.url().startsWith(`dental-fixture://${appId}/`))){
    if(await candidate.locator('h1').textContent().catch(()=>null)===expected.get(version))return candidate;
   }
   return undefined;
  },`isolated ${version} runtime content`);
  await page.getByRole('heading',{name:expected.get(version),exact:true}).waitFor();return page;
 };
 try{
  const args=[root,...profileArgs,'--distribution-fixtures','--update-fixtures','--onboarding-fixtures'];
  app=await electron.launch({args,env,timeout:30000});
  shell=await app.firstWindow();shell.setDefaultTimeout(15000);
  profile=await app.evaluate(({app})=>app.getPath('userData'));
  const registryFile=path.join(profile,'packages/registry.json');
  await openStore(shell);
  check('signed Store catalog includes a third first-party app without app-specific shell code',await shell.getByRole('button',{name:'Details Motion Studio',exact:true}).count()===1&&await shell.getByRole('button',{name:'Details Records',exact:true}).count()===1&&await shell.getByRole('button',{name:'Details Dental Workspace Preview',exact:true}).count()===1);
  await shell.getByRole('button',{name:'Details Dental Workspace Preview',exact:true}).click();
  await shell.getByRole('heading',{name:'Dental Workspace Preview'}).waitFor();
  await shell.getByRole('button',{name:'Get',exact:true}).click();
  await shell.getByRole('button',{name:'Open',exact:true}).waitFor();
  await shell.locator('.store-arrival').waitFor();
  check('new company app artwork flies from its Store detail page toward the dock',await shell.locator('.store-arrival svg').count()===1);
  check('new company app is appended at the right end of the dock',await shell.locator('[data-dock-app]').last().getAttribute('data-dock-app')===appId);
  check('installed dock icon stays hidden until the flight lands',((await shell.locator(`[data-dock-app="${appId}"]`).getAttribute('style'))??'').includes('visibility: hidden'));
  await shell.locator('.store-celebration').waitFor({state:'detached'});
  check('company app dock icon appears after the arrival animation settles',await shell.locator(`[data-dock-app="${appId}"]`).isVisible());
  check('company app dock icon lands with the same thumbnail artwork',await shell.locator(`[data-dock-app="${appId}"] .dock-artwork svg`).count()===1);
  let saved=await registry(profile),installed=saved.apps[appId];
  check('Store Get installs the signed app under its own dynamic registry identity',!!installed&&installed.versions.length===1&&!saved.apps['company.sample.alpha']&&!saved.apps['company.sample.beta']);
  await shell.getByRole('button',{name:'Open',exact:true}).click();
  let guest=await verifyPage('1.0.0');
  check('version 1.0.0 opens in an isolated app window and exposes no OS/store bridge',await guest.evaluate(()=>!window.desktop&&!window.dentalApp?.install)&&await shell.locator(`[data-window-id="${appId}"]`).count()===1);
  await wait(async()=>{const state=(await registry(profile)).apps[appId];return state.knownGood===state.active;},'first app launch health acknowledgement');
  let priorDigest=installed.active;
  for(const [version,previous] of [['1.1.0','1.0.0'],['1.2.0','1.1.0']]){
   const previousVersionCount=installed.versions.length;
   await fs.writeFile(path.join(profile,'update-fixture.json'),JSON.stringify({version:'1.0.0',gammaVersion:version,offset:version==='1.1.0'?1:2}));
   await detail(shell);
   await shell.getByRole('button',{name:'Refresh',exact:true}).click();
   await wait(async()=>await shell.locator('.store-facts').textContent().then(text=>text.includes(version)),'new catalogue version');
   check(`${version} appears in Store as an independent update`,await shell.locator('.store-facts').textContent().then(text=>text.includes(`Installed${previous}`)&&text.includes(`PendingNone`)&&text.includes(`Version${version}`)));
   await shell.getByRole('button',{name:'Download update',exact:true}).click();
   await shell.getByRole('button',{name:'Use update now',exact:true}).waitFor();
   saved=await registry(profile);installed=saved.apps[appId];
   check(`${version} downloads as a separate verified package while ${previous} stays active`,installed.active===priorDigest&&!!installed.pending&&installed.versions.length===previousVersionCount+1);
   await shell.getByRole('button',{name:'Use update now',exact:true}).click();
   guest=await verifyPage(version);
   saved=await registry(profile);installed=saved.apps[appId];
   check(`${version} activates in a protected runtime trial without an OS package update`,installed.active!==priorDigest&&!installed.pending&&installed.trial===installed.active);
   await wait(async()=>{const state=(await registry(profile)).apps[appId];return state.knownGood===state.active&&!state.trial;},`${version} launch health acknowledgement`);
   installed=(await registry(profile)).apps[appId];
   check(`${version} becomes known-good only after its runtime health check`,installed.knownGood===installed.active&&!installed.trial);
   priorDigest=installed.active;
  }
  check('original app IDs remain uninstalled and the new app retains only its bounded release history',Object.keys((await registry(profile)).apps).join()===appId&&installed.versions.length===3);
  await app.close();app=undefined;
  app=await electron.launch({args,env,timeout:30000});shell=await app.firstWindow();shell.setDefaultTimeout(15000);
  await shell.locator(`[data-dock-app="${appId}"]`).waitFor();
  saved=await registry(profile);check('installed app version survives a complete Dental OS relaunch',saved.apps[appId].active===priorDigest);
  await shell.getByRole('button',{name:'Dental Workspace Preview',exact:true}).click();
  await shell.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',appId);
  guest=await verifyPage('1.2.0');
  check('relaunch reopens the independently updated app at version 1.2.0',await guest.getByRole('heading',{name:'Release history',exact:true}).isVisible());
 }catch(error){
  try{
   const saved=await registry(profile),active=saved.apps[appId]?.active,bundle=active?JSON.parse(await fs.readFile(path.join(profile,'packages/apps',appId,active,'bundle.dentalpkg'),'utf8')):undefined;
   const pages=[];for(const page of app.context().pages())if(page.url().startsWith(`dental-fixture://${appId}/`))pages.push({url:page.url(),title:await page.title().catch(()=>''),heading:await page.locator('h1').textContent().catch(()=>null)});
   failureDetails={error:String(error),activeVersion:bundle?.release?.version,pending:saved.apps[appId]?.pending,knownGood:saved.apps[appId]?.knownGood,windowPhase:await shell.locator(`[data-window-id="${appId}"]`).getAttribute('data-phase').catch(()=>null),runtimePhase:await shell.locator(`[data-runtime="${appId}"]`).getAttribute('data-runtime-phase').catch(()=>null),runtimeReason:await shell.locator(`[data-runtime="${appId}"]`).getAttribute('data-runtime-reason').catch(()=>null),storeStatus:await shell.locator('.staff-footer [role="status"]').allTextContents().catch(()=>[]),updateButtonDisabled:await shell.getByRole('button',{name:'Use update now'}).isDisabled().catch(()=>null),pages};
  }catch(diagnosticError){failureDetails={error:String(error),diagnosticError:String(diagnosticError)};}
  throw error;
 }finally{
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
  await fs.writeFile(path.join(root,'artifacts',reportName),JSON.stringify({checks,platform:process.platform,sha:process.env.GITHUB_SHA??null,...(failureDetails?{failureDetails}:{})},null,2));
  if(app)await app.close();
 }
}
