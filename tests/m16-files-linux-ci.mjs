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
const privateWayland = process.platform==='linux'&&!process.env.DISPLAY&&!!process.env.ELECTRON_OS_TEST_DISPLAY&&
  !!process.env.WAYLAND_DISPLAY&&!!process.env.XDG_RUNTIME_DIR&&
  path.join(process.env.XDG_RUNTIME_DIR,process.env.WAYLAND_DISPLAY)===process.env.ELECTRON_OS_TEST_DISPLAY&&
  existsSync(process.env.ELECTRON_OS_TEST_DISPLAY);
const privateX11 = process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&
  process.env.RUNNER_OS==='Linux'&&process.env.CI==='true'&&process.env.M16_PRIVATE_X11==='1'&&
  /^:[0-9]+$/.test(process.env.DISPLAY??'');
if(!privateWayland&&!privateX11)
  throw Error('Isolated private Linux display required; refusing user desktop');
const root=path.resolve(import.meta.dirname,'..');
const profile=await mkdtemp(path.join(tmpdir(),'dental-m16-linux-'));
const checks=[],errors=[];let app,page,failed=false;
const report={source:process.env.GITHUB_SHA??null,platform:privateWayland?'private-linux-wayland':'private-linux-x11',checks,errors};
function check(message,ok){assert.ok(ok,message);checks.push(message);console.log('PASS',message);}
try{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;if(privateWayland)delete env.DISPLAY;
  app=await electron.launch({args:[root,privateWayland?'--ozone-platform=wayland':'--ozone-platform=x11',...(privateX11?['--files-x11-verify']:[]),'--user-data-dir='+profile,
    '--runtime-fixtures','--files-fixtures','--files-picker-verify','--files-picker-app-fixtures'],env,timeout:35000});
  page=await app.firstWindow();
  page.on('pageerror',error=>errors.push(error.message));
  await page.waitForFunction(()=>!!window.desktop?.files,null,{timeout:15000});
  const roots=await page.evaluate(async()=>{
    const v=await window.desktop.identity.view();
    return window.desktop.files.roots(v.generation);
  });
  check('Private Linux graphical shell Files bridge and synthetic root',
    roots.length===1&&roots[0].label==='Test Files'&&!JSON.stringify(roots).includes(profile));
  await page.locator('[data-dock-app="files"]').click();
  const frame=page.getByTestId('files-window');
  await frame.getByText('X-rays',{exact:true}).waitFor();
  await frame.getByText('X-rays',{exact:true}).dblclick();
  await frame.getByText('m16-synthetic-xray.png',{exact:true}).waitFor();
  await frame.locator('.files-card-preview img').waitFor({timeout:8000});
  await page.waitForFunction(()=>{const image=document.querySelector('.files-card-preview img');return !!image&&image.complete&&image.naturalWidth>0},null,{timeout:8000});
  check('Linux shell renders bounded synthetic PNG thumbnail',
    await frame.locator('.files-card-preview img').evaluate(image=>image.complete&&image.naturalWidth===8));
  check('Linux Files graphical folder navigation',true);
  await frame.getByRole('button',{name:'Back',exact:true}).click();
  await frame.getByText('notes-synthetic.pdf',{exact:true}).waitFor();
  check('Linux Files back navigation and documents',true);
  const signedDock=page.locator('[data-dock-app="company.dental.patient-record"]');
  await signedDock.waitFor({timeout:15000});await signedDock.click();
  await page.waitForFunction(()=>document.querySelector('[data-runtime="company.dental.patient-record"]')?.dataset.runtimePhase==='ready',null,{timeout:15000});
  const guest=app.context().pages().find(v=>v.url().startsWith('dental-fixture://company.dental.patient-record/'));
  check('Ephemeral signed dental app runs in separate Linux WebContentsView',!!guest);
  check('Linux isolated dental app has no privileged shell Files bridge',
    await guest.evaluate(()=>typeof window.desktop==='undefined'));
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
  // Send from trusted Files shell into the previously focused signed app.
  await page.locator('[data-dock-app="files"]').click();
  await frame.getByText('X-rays',{exact:true}).dblclick();
  await frame.getByText('m16-synthetic-xray.png',{exact:true}).click();
  const send=frame.getByRole('button',{name:'Send selected files to active eligible app'});
  await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Send selected files to active eligible app');return b&&!b.disabled;},null,{timeout:10000});
  const unsolicited=await page.evaluate(async()=>{
    const gen=(await window.desktop.identity.view()).generation;
    const roots=await window.desktop.files.roots(gen);
    const folder=(await window.desktop.files.list({directoryId:roots[0].id,cursor:null,limit:100,generation:gen}))
      .entries.find(v=>v.name==='X-rays');
    if(!folder)return 'missing-folder';
    const file=(await window.desktop.files.list({directoryId:folder.id,cursor:null,limit:100,generation:gen}))
      .entries.find(v=>v.name==='m16-synthetic-xray.png');
    if(!file)return 'missing-file';
    await new Promise(resolve=>setTimeout(resolve,950));
    try{await window.desktop.files.send({generation:gen,fileIds:[file.id]});return 'accepted';}
    catch{return 'denied';}
  });
  check('Linux direct script Send without a fresh trusted activation is denied',unsolicited==='denied');
  await send.click();
  await frame.getByText(/Delivered 1 file receipt/).waitFor({timeout:10000});
  const transferred=await guest.locator('#transfer-result').innerText();
  check('Linux Files explicit Send delivers metadata only to subscribed signed app',
    transferred.includes('m16-synthetic-xray.png')&&!transferred.includes(profile)&&!transferred.includes('/tmp/'));
  console.log('M16 PRIVATE LINUX SUCCESS',checks.length);
} catch(error) {
  failed=true;
  errors.push(String(error));
  console.error('Private Linux M16 graphical assertion failed:',String(error));
  try {
    const state=await page?.evaluate(()=>({
      desktop:!!window.desktop, url:location.pathname+location.search,
      dock:[...document.querySelectorAll('[data-dock-app]')].map(x=>x.getAttribute('data-dock-app')),
      text:document.body.innerText.slice(0,500)
    }));
    report.failureState=state;
    console.error('LINUX GRAPHICAL DIAG',JSON.stringify(state));
  }catch{ /* no patient data ever captured */ }
} finally {
  await mkdir(path.join(root,'artifacts'),{recursive:true});
  await writeFile(path.join(root,'artifacts','m16-linux-files-ui.json'),JSON.stringify(report,null,2)+'\n');
  const sleep=(ms)=>new Promise(resolve=>setTimeout(resolve,ms));
  if(app){
    let closed=false;
    await Promise.race([app.close().then(()=>{closed=true}).catch(()=>{}),sleep(1800)]);
    if(!closed){try{app.process().kill('SIGKILL');}catch{/* only private CI child */}}
  }
  await Promise.race([rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:80})
    .catch(error=>console.warn('Synthetic profile cleanup:',error?.code||'IO_ERROR')),sleep(1800)]);
  // Weston/Wayland can leave Playwright native handles open even after all
  // GUI assertions pass. The dedicated synthetic CI script owns its process;
  // exiting with the recorded result avoids a 7-minute runner cancellation.
  console.log('M16 PRIVATE LINUX EXIT',failed?'FAIL':'SUCCESS',checks.length);
  process.exit(failed?1:0);
}
