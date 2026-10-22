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
import { spawn } from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'..');
const profile=await mkdtemp(path.join(tmpdir(),'dental-m16-private-ui-'));
const checks=[],errors=[];
let app,page,failed=false;
const report={sha:process.env.GITHUB_SHA??null,platform:process.platform,checks,errors,startup:null};
function check(label,value){assert.ok(value,label);checks.push(label);console.log('PASS',label);}
function summarize(value){return JSON.stringify(value).slice(0,6000);}

async function driveNativeWindowsOpenDialog(filePath, electronPid) {
  // The external PowerShell driver locates the actual OS common file dialog,
  // using Win32 HWND + UI Automation with keyboard fallback. Hosted CI only.
  if (!Number.isSafeInteger(electronPid) || electronPid<=0) throw Error('Missing Electron host PID');
  const script=path.join(repo,'tests','m16-native-dialog-ci.ps1');
  return await new Promise((resolve,reject)=>{
    const proc=spawn('powershell.exe',
      ['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',script,'-ElectronPid',String(electronPid)],
      {env:{...process.env,M16_NATIVE_SAMPLE:filePath},windowsHide:false,stdio:['ignore','pipe','pipe']});
    let out='',err='';
    proc.stdout.on('data',v=>out=(out+v).slice(-2200));
    proc.stderr.on('data',v=>err=(err+v).slice(-2000));
    proc.once('error',reject);
    proc.once('exit',code=>{
      const clean=(out+'\n'+err).replaceAll(filePath,'[synthetic test file]').trim();
      console.log('NATIVE WIN32 DRIVER',clean.slice(0,2000));
      if(code===0)resolve(clean);
      else reject(Error('Native Windows dialog automation failed (exit '+code+'): '+clean));
    });
  });
}

try{
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  app=await electron.launch({args:[repo,'--user-data-dir='+profile,'--files-fixtures','--files-picker-verify','--files-picker-app-fixtures','--runtime-fixtures'],env,timeout:30000});
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
  await frame.locator('.files-card-preview img').first().waitFor({timeout:8000});
  await page.waitForFunction(()=>{const image=document.querySelector('.files-card-preview img');return !!image&&image.complete&&image.naturalWidth>0},null,{timeout:8000});
  check('Windows shell renders bounded synthetic PNG thumbnail',
    await frame.locator('.files-card-preview img').first().evaluate(image=>image.complete&&image.naturalWidth===8));
  check('Files navigates inside a local folder',true);
  const viewer=page.getByTestId('image-viewer-window');
  const imageCard=frame.getByText('m16-synthetic-xray.png',{exact:true});
  await imageCard.click();
  check('Single-click selects image without launching viewer',
    await viewer.getAttribute('data-phase')==='closed');
  await imageCard.dblclick();
  await viewer.waitFor({state:'visible',timeout:10000});
  await viewer.getByRole('img',{name:'m16-synthetic-xray.png'}).waitFor({timeout:10000});
  await page.waitForFunction(()=>{
    const canvas=document.querySelector('[data-testid="image-viewer"] canvas');
    return canvas instanceof HTMLCanvasElement&&canvas.width===8&&canvas.height===8;
  },null,{timeout:10000});
  check('Double-click opens separate managed Image Viewer above persistent Files',
    await frame.isVisible() && await viewer.getAttribute('data-phase')==='visible');
  check('Image Viewer decodes and paints pixels from the bounded synthetic PNG',await viewer.locator('canvas').evaluate(canvas=>{
    const context=canvas.getContext('2d');return canvas.width===8&&canvas.height===8&&!!context
      &&context.getImageData(0,0,8,8).data.some((value,index)=>index%4===3&&value>0);
  }));
  check('Viewer never appears in dock launcher inventory',
    await page.locator('[data-dock-app="image-viewer"]').count()===0);
  await viewer.getByRole('button',{name:'Maximize Image Viewer'}).click();
  check('Viewer uses shared maximize window lifecycle',
    await viewer.getAttribute('data-presentation')==='fullscreen');
  await viewer.getByRole('button',{name:'Restore Image Viewer size'}).click();
  await viewer.getByRole('button',{name:'Zoom in'}).click();
  check('Viewer zoom control adjusts percentage',
    await viewer.getByLabel('Current zoom').innerText()==='125%');
  const panCanvas=viewer.locator('.image-viewer-canvas canvas');
  await panCanvas.evaluate(canvas=>{canvas.style.width='900px';canvas.style.height='700px';});
  const panBox=await panCanvas.boundingBox(),viewportBox=await viewer.locator('.image-viewer-canvas').boundingBox();
  if(!panBox||!viewportBox)throw new Error('Image Viewer pan bounds unavailable');
  const startX=panBox.x+panBox.width/2,startY=panBox.y+panBox.height/2;
  await page.mouse.move(startX,startY);await page.mouse.down();
  await page.mouse.move(startX+900,startY+700,{steps:4});
  const panStyle=await panCanvas.getAttribute('style'),panning=await panCanvas.evaluate(canvas=>canvas.classList.contains('is-panning'));
  await page.mouse.up();
  const movedBox=await panCanvas.boundingBox();
  check('Dragging zoomed picture pans it while keeping the viewport covered',!!movedBox&&panning
    &&panStyle?.includes('translate3d(')&&!panStyle.includes('translate3d(0px, 0px, 0)')
    &&movedBox.x<=viewportBox.x+1&&movedBox.y<=viewportBox.y+1
    &&movedBox.x+movedBox.width>=viewportBox.x+viewportBox.width-1
    &&movedBox.y+movedBox.height>=viewportBox.y+viewportBox.height-1);
  await viewer.getByRole('button',{name:'Rotate picture right'}).click();
  check('Viewer rotates image', (await viewer.getByRole('img',{name:'m16-synthetic-xray.png'}).getAttribute('style'))?.includes('rotate(90deg)'));
  await viewer.getByRole('button',{name:'Fit image to window'}).click();
  const fitStyle=await panCanvas.getAttribute('style');
  check('Viewer fits image to window and recenters it',await viewer.getByLabel('Current zoom').innerText()==='100%'
    &&/translate3d\(0px, 0px, 0(?:px)?\)/.test(fitStyle??''));
  await viewer.getByRole('button',{name:'Next picture'}).click();
  await viewer.getByRole('img',{name:'m16-synthetic-xray-alt.png'}).waitFor({timeout:10000});
  await viewer.getByRole('button',{name:'Previous picture'}).click();
  await viewer.getByRole('img',{name:'m16-synthetic-xray.png'}).waitFor({timeout:10000});
  check('Viewer next/previous stays within supported current folder images',true);
  const captureDenied=await page.evaluate(async gen=>{
    try{await window.desktop.capture({x:0,y:40,width:160,height:160},gen);return false;}catch{return true;}
  },generation);
  check('Private viewer denies shell screenshot captures',captureDenied);
  await page.keyboard.press('Backquote');
  const viewerOverview=page.getByRole('dialog',{name:'Open windows'});
  await viewerOverview.waitFor({timeout:5000});
  check('Viewer absent from overview and filenames omitted',!(await viewerOverview.innerText()).includes('Image Viewer')
    && !(await viewerOverview.innerText()).includes('m16-synthetic-xray'));
  await page.keyboard.press('Escape');
  await viewer.getByRole('button',{name:'Close Image Viewer'}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="image-viewer-window"]')?.getAttribute('data-phase')==='closed');
  check('Viewer close releases managed window without closing Files',await frame.isVisible());
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

  // A separately signed first-party dental app requests the same picker via
  // its isolated WebContentsView and the public SDK, not the main CI driver.
  const signedDock=page.locator('[data-dock-app="company.dental.patient-record"]');
  await signedDock.waitFor({timeout:15000});
  await signedDock.click();
  await page.waitForFunction(()=>document.querySelector('[data-runtime="company.dental.patient-record"]')?.dataset.runtimePhase==='ready',null,{timeout:15000});
  const signedApp=app.context().pages().find(p=>p.url().startsWith('dental-fixture://company.dental.patient-record/'));
  check('Ephemeral company-signed dental app launched in isolated runtime',!!signedApp);
  await signedApp.getByRole('button',{name:'Connect SDK'}).click();
  await signedApp.locator('#pick-result').filter({hasText:'SDK connected'}).waitFor({timeout:12000});
  check('Signed app SDK is connected and ready',true);
  check('Isolated dental-app renderer has no privileged shell Files bridge',
    await signedApp.evaluate(()=>typeof window.desktop==='undefined'));
  await signedApp.getByRole('button',{name:'Programmatic picker request'}).click();
  await signedApp.locator('#pick-result').filter({hasText:'FORBIDDEN'}).waitFor({timeout:6000});
  check('Delayed script request cannot reuse a trusted click ticket',true);
  await signedApp.getByRole('button',{name:'Choose local X-ray'}).click();
  await modal.waitFor({state:'visible',timeout:10000});
  await modal.getByText('X-rays',{exact:true}).dblclick();
  await modal.getByText('m16-synthetic-xray.png',{exact:true}).click();
  await modal.getByRole('button',{name:/Choose 1 file/i}).click();
  await modal.waitFor({state:'detached'});
  await signedApp.locator('#pick-result').filter({hasText:'"ok":true'}).waitFor({timeout:10000});
  const selectedText=await signedApp.locator('#pick-result').innerText();
  check('Signed app receives opaque SDK metadata, never absolute native paths',
    selectedText.includes('m16-synthetic-xray.png')&&!selectedText.includes(profile)&&!selectedText.includes('\\\\'));
  await signedApp.getByRole('button',{name:'Choose local X-ray'}).click();
  await modal.waitFor({state:'visible'});
  const samplePath=path.join(profile,'m16-files-fixture','X-rays','m16-synthetic-xray.png');
  const nativeDriver=driveNativeWindowsOpenDialog(samplePath,app.process().pid);
  await modal.getByRole('button',{name:'Use native picker'}).click();
  await nativeDriver;
  await modal.waitFor({state:'detached',timeout:10000});
  await signedApp.locator('#pick-result').filter({hasText:'"ok":true'}).waitFor({timeout:10000});
  const nativeText=await signedApp.locator('#pick-result').innerText();
  check('Actual Windows native dialog returned synthetic X-ray via signed SDK',
    nativeText.includes('m16-synthetic-xray.png')&&!nativeText.includes(profile));

  // Use the real shell Files button and actual signed isolated SDK subscriber.
  await filesButton.click();
  await frame.getByText('X-rays',{exact:true}).dblclick();
  await frame.getByText('m16-synthetic-xray.png',{exact:true}).click();
  const send=frame.getByRole('button',{name:'Send selected files to active eligible app'});
  await send.waitFor({state:'visible'});
  await page.waitForFunction(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.getAttribute('aria-label')==='Send selected files to active eligible app');return b&&!b.disabled;},null,{timeout:10000});
  // An arbitrary shell script must not transfer even a valid selected token.
  // Wait beyond the main-process one-use trusted activation window.
  const unsolicited=await page.evaluate(async gen=>{
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
  },generation);
  check('Direct script Send without a fresh trusted user gesture is denied',unsolicited==='denied');
  await send.click();
  await frame.getByText(/Delivered 1 file receipt/).waitFor({timeout:10000});
  const transfer=await signedApp.locator('#transfer-result').innerText();
  check('Files explicit Send reaches only the eligible signed SDK app as opaque metadata',
    transfer.includes('m16-synthetic-xray.png')&&!transfer.includes(profile)&&!transfer.includes('\\\\'));
  console.log('M16 FILES/PICKER UI SUCCESS',checks.length);
} catch(error) {
  failed=true;
  console.error('M16 Windows GUI assertion failed:',String(error));
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
} finally {
  await mkdir(path.join(repo,'artifacts'),{recursive:true});
  await writeFile(path.join(repo,'artifacts','m16-windows-files-ui.json'),JSON.stringify(report,null,2)+'\n');
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  if(app){
    let closed=false;
    await Promise.race([app.close().then(()=>{closed=true}).catch(()=>{}),sleep(1500)]);
    if(!closed){try{app.process().kill();}catch{/* Only disposable CI Electron child */}}
  }
  // Windows can retain native Electron file-descriptor locks after the GUI
  // assertions finish. Do not let pending Playwright handles consume the
  // remaining free-plan job minutes or obscure test results.
  await Promise.race([
    rm(profile,{recursive:true,force:true,maxRetries:2,retryDelay:100})
      .catch(error=>console.warn('Synthetic profile cleanup:',error?.code||'IO_ERROR')),
    sleep(1800),
  ]);
  console.log('M16 WINDOWS VERIFIED EXIT',failed?'FAILED':'SUCCESS',checks.length);
  process.exit(failed?1:0);
}
