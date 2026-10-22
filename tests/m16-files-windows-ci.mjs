/**
 * Hosted Windows UI proof for M16 Files and OS-owned picker.
 * Does not use real clinic credentials, patient data, production or staging.
 * The app's private picker test driver is available only with explicit CI flags.
 */
if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_OS!=='Windows')
  throw Error('Hosted Windows CI only');
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
const repo=path.resolve(import.meta.dirname,'..');
const profile=await mkdtemp(path.join(tmpdir(),'dental-m16-private-ui-'));
const checks=[],errors=[];
let app,page;
const report={sha:process.env.GITHUB_SHA??null,platform:process.platform,checks,errors,startup:null};
function check(label,value){assert.ok(value,label);checks.push(label);console.log('PASS',label);}
function summarize(value){return JSON.stringify(value).slice(0,6000);}
try{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:[repo,'--user-data-dir='+profile,'--files-fixtures','--files-picker-verify','--runtime-fixtures'],env,timeout:30000});
  page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>!!window.desktop?.files,{timeout:15000}).catch(()=>{});
  const initial=await page.evaluate(async()=>{
    const shell=window.desktop;
    return {
      url:location.pathname+location.search,
      phase:document.querySelector('.identity-gate')?.getAttribute('data-session-phase')??'workspace',
      desktop:!!shell,filesBridge:!!shell?.files,
      buttons:[...document.querySelectorAll('button[aria-label]')].slice(0,35).map(el=>el.getAttribute('aria-label')),
      dockApps:[...document.querySelectorAll('[data-dock-app]')].map(el=>el.getAttribute('data-dock-app')),
      text:document.body.innerText.slice(0,330),
    };
  });
  report.startup=initial;console.log('STARTUP',summarize(initial));
  check('Host shell and Files bridge loaded',initial.desktop&&initial.filesBridge);
  check('Runtime fixture mode actually loaded',new URLSearchParams(initial.url.split('?')[1]??'').get('runtimeFixtures')==='1');
  const generation=await page.evaluate(async()=> (await window.desktop.identity.view()).generation);
  const roots=await page.evaluate(gen=>window.desktop.files.roots(gen),generation);
  check('Only synthetic file location exposed',roots.length===1&&roots[0].label==='Test Files'&&!summarize(roots).includes(profile));
  const filesButton=page.locator('[data-dock-app="files"]');
  await filesButton.waitFor({timeout:10000});
  await filesButton.click();
  const frame=page.locator('[data-testid="files-window"]');
  await frame.waitFor({state:'visible'});
  await frame.getByText('X-rays',{exact:true}).waitFor();
  await frame.getByText('notes-synthetic.pdf',{exact:true}).waitFor();
  check('Files window opens and enumerates synthetic directory',true);
  await frame.getByText('X-rays',{exact:true}).dblclick();
  await frame.getByText('m16-synthetic-xray.png',{exact:true}).waitFor();
  check('Files navigates inside a local folder',true);
  await frame.getByRole('button',{name:'Back',exact:true}).click();
  await frame.getByText('notes-synthetic.pdf',{exact:true}).waitFor();
  check('Files back navigation returns to root',true);
  const began=await app.evaluate(()=>globalThis.__m16FilesCiFixture?.start()??false);
  check('Main-process synthetic picker driver is guarded and available',began);
  const modal=page.getByTestId('files-picker-dialog');
  await modal.waitFor({state:'visible',timeout:10000});
  check('Custom file picker is an OS-owned modal',await modal.getAttribute('aria-modal')==='true');
  await modal.getByText('X-rays',{exact:true}).dblclick();
  await modal.getByText('m16-synthetic-xray.png',{exact:true}).click();
  await modal.getByRole('button',{name:/Choose 1 file/i}).click();
  await modal.waitFor({state:'detached',timeout:10000});
  const outcome=await app.evaluate(()=>globalThis.__m16FilesCiFixture?.outcome());
  check('User-confirmed choice returns metadata-only synthetic filename',outcome?.status==='selected'
    &&outcome.files?.length===1&&outcome.files[0]==='m16-synthetic-xray.png'&&!summarize(outcome).includes(profile));
  const beganCancel=await app.evaluate(()=>globalThis.__m16FilesCiFixture?.start()??false);
  check('A second picker can open after completion',beganCancel);
  await modal.waitFor({state:'visible'});
  await modal.getByRole('button',{name:'Cancel file selection'}).click();
  await modal.waitFor({state:'detached',timeout:10000});
  check('Cancelling picker leaves no active receipt', (await app.evaluate(()=>globalThis.__m16FilesCiFixture?.outcome()))?.status==='cancelled');
  const dock=await page.locator('[data-dock-app="studio"]').count();
  check('Runtime fixture Motion Studio launcher exists',dock===1);
  console.log('M16 FILES/PICKER UI SUCCESS',checks.length);
} catch(error) {
  errors.push(String(error));
  try{
    const snapshot=await page?.evaluate(()=>({
      url:location.pathname+location.search,
      phase:document.querySelector('.identity-gate')?.getAttribute('data-session-phase')??'workspace',
      buttons:[...document.querySelectorAll('button[aria-label]')].slice(0,45).map(el=>el.getAttribute('aria-label')),
      dockApps:[...document.querySelectorAll('[data-dock-app]')].map(el=>el.getAttribute('data-dock-app')),
      body:document.body.innerText.slice(0,800),
    }));
    console.error('DIAGNOSE',summarize(snapshot));report.failureState=snapshot;
    await page?.screenshot({path:path.join(repo,'artifacts','m16-windows-files-ui.png'),fullPage:true,timeout:5000});
  }catch(e){errors.push('Diagnostic capture failed: '+String(e));}
  throw error;
} finally {
  await mkdir(path.join(repo,'artifacts'),{recursive:true});
  await writeFile(path.join(repo,'artifacts','m16-windows-files-ui.json'),JSON.stringify(report,null,2)+'\n');
  if(app)await app.close().catch(()=>{});
  await rm(profile,{recursive:true,force:true,maxRetries:6,retryDelay:100});
}
