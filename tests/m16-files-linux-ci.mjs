/**
 * M16 isolated Linux Wayland graphical proof; synthetic data only.
 * Caller must provision a private compositor/socket and explicitly mark it.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { _electron as electron } from 'playwright';
if (process.platform!=='linux'||process.env.DISPLAY||!process.env.ELECTRON_OS_TEST_DISPLAY||
    !process.env.WAYLAND_DISPLAY||!process.env.XDG_RUNTIME_DIR||
    path.join(process.env.XDG_RUNTIME_DIR,process.env.WAYLAND_DISPLAY)!==process.env.ELECTRON_OS_TEST_DISPLAY||
    !existsSync(process.env.ELECTRON_OS_TEST_DISPLAY))
  throw Error('Private Wayland compositor required; refusing to use user desktop');
const root=path.resolve(import.meta.dirname,'..');
const profile=await mkdtemp(path.join(tmpdir(),'dental-m16-linux-'));
const checks=[],errors=[];let app,page;
const report={source:process.env.GITHUB_SHA??null,platform:'private-linux-wayland',checks,errors};
function check(message,ok){assert.ok(ok,message);checks.push(message);console.log('PASS',message);}
try{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.DISPLAY;
  app=await electron.launch({args:[root,'--ozone-platform=wayland','--user-data-dir='+profile,
    '--runtime-fixtures','--files-fixtures','--files-picker-verify','--files-picker-app-fixtures'],env,timeout:35000});
  page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>!!window.desktop?.files,null,{timeout:15000});
  const roots=await page.evaluate(async()=>{
    const v=await window.desktop.identity.view();
    return window.desktop.files.roots(v.generation);
  });
  check('Private Linux Wayland shell Files bridge and synthetic root',
    roots.length===1&&roots[0].label==='Test Files'&&!JSON.stringify(roots).includes(profile));
  await page.locator('[data-dock-app="files"]').click();
  const frame=page.getByTestId('files-window');
  await frame.getByText('X-rays',{exact:true}).waitFor();
  await frame.getByText('X-rays',{exact:true}).dblclick();
  await frame.getByText('m16-synthetic-xray.png',{exact:true}).waitFor();
  check('Linux Files graphical folder navigation',true);
  await frame.getByRole('button',{name:'Back',exact:true}).click();
  await frame.getByText('notes-synthetic.pdf',{exact:true}).waitFor();
  check('Linux Files back navigation and documents',true);
  const signedDock=page.locator('[data-dock-app="company.dental.patient-record"]');
  await signedDock.waitFor({timeout:15000});await signedDock.click();
  await page.waitForFunction(()=>document.querySelector('[data-runtime="company.dental.patient-record"]')?.dataset.runtimePhase==='ready',null,{timeout:15000});
  const guest=app.context().pages().find(v=>v.url().startsWith('dental-fixture://company.dental.patient-record/'));
  check('Ephemeral signed dental app runs in separate Linux WebContentsView',!!guest);
  await guest.getByRole('button',{name:'Connect SDK'}).click();
  await guest.locator('#pick-result').filter({hasText:'SDK connected'}).waitFor({timeout:12000});
  await guest.getByRole('button',{name:'Programmatic picker request'}).click();
  await guest.locator('#pick-result').filter({hasText:'FORBIDDEN'}).waitFor({timeout:6000});
  check('Delayed script SDK picker invocation is denied',true);
  await guest.getByRole('button',{name:'Choose local X-ray'}).click();
  const modal=page.getByTestId('files-picker-dialog');
  await modal.waitFor({state:'visible',timeout:10000});
  await modal.getByText('X-rays',{exact:true}).dblclick();
  await modal.getByText('m16-synthetic-xray.png',{exact:true}).click();
  await modal.getByRole('button',{name:/Choose 1 file/i}).click();
  await modal.waitFor({state:'detached',timeout:10000});
  await guest.locator('#pick-result').filter({hasText:'"ok":true'}).waitFor({timeout:10000});
  const result=await guest.locator('#pick-result').innerText();
  check('Linux signed SDK app returns only synthetic, opaque metadata',
    result.includes('m16-synthetic-xray.png')&&!result.includes(profile)&&!result.includes('/tmp/'));
  await guest.getByRole('button',{name:'Choose local X-ray'}).click();
  await modal.waitFor({state:'visible'});
  await modal.getByRole('button',{name:'Cancel file selection'}).click();
  await modal.waitFor({state:'detached',timeout:10000});
  await guest.locator('#pick-result').filter({hasText:'CANCELLED'}).waitFor({timeout:7000});
  check('Linux custom picker cancel revokes pending request',true);
  console.log('M16 PRIVATE WAYLAND SUCCESS',checks.length);
} catch(error) {
  errors.push(String(error));
  try {
    const state=await page?.evaluate(()=>({
      desktop:!!window.desktop, url:location.pathname+location.search,
      dock:[...document.querySelectorAll('[data-dock-app]')].map(x=>x.getAttribute('data-dock-app')),
      text:document.body.innerText.slice(0,500)
    }));
    report.failureState=state;
    console.error('WAYLAND DIAG',JSON.stringify(state));
  }catch{ /* no patient data ever captured */ }
  throw error;
} finally {
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,'artifacts','m16-linux-files-ui.json'),JSON.stringify(report,null,2)+'\n');
  if(app){
    let closed=false;
    await Promise.race([app.close().then(()=>{closed=true}).catch(()=>{}),
      new Promise(resolve=>setTimeout(resolve,3500))]);
    if(!closed){try{app.process().kill();}catch{/* only synthetic CI child */}}
  }
  await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:50});
}
