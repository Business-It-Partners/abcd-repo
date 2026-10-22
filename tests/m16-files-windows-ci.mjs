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
let app,page;
const report={sha:process.env.GITHUB_SHA??null,platform:process.platform,checks,errors,startup:null};
function check(label,value){assert.ok(value,label);checks.push(label);console.log('PASS',label);}
function summarize(value){return JSON.stringify(value).slice(0,6000);}

async function driveNativeWindowsOpenDialog(filePath) {
  // Synthetic private runner only: Windows SendKeys targets a dialog by exact title.
  // Never type into an unknown foreground window and never use real patient files.
  const script=[
    'Add-Type -AssemblyName System.Windows.Forms',
    "$code = @'",
    'using System; using System.Runtime.InteropServices;',
    'public static class M16Dialog {',
    ' [DllImport("user32.dll", CharSet=CharSet.Unicode)]',
    ' public static extern IntPtr FindWindow(string cls, string title);',
    ' [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);',
    '}',
    "'@",
    'Add-Type -TypeDefinition $code',
    '$deadline=(Get-Date).AddSeconds(22)',
    '$dialog=[IntPtr]::Zero',
    'do { $dialog=[M16Dialog]::FindWindow($null,"Choose local files for Dental OS");',
    ' if($dialog -ne [IntPtr]::Zero){break}; Start-Sleep -Milliseconds 130',
    '} while((Get-Date) -lt $deadline)',
    'if($dialog -eq [IntPtr]::Zero){throw "Native file chooser did not appear"}',
    '[void][M16Dialog]::SetForegroundWindow($dialog)',
    'Start-Sleep -Milliseconds 260',
    '[System.Windows.Forms.SendKeys]::SendWait("%n")',
    'Start-Sleep -Milliseconds 200',
    '[System.Windows.Forms.Clipboard]::SetText($env:M16_NATIVE_SAMPLE)',
    '[System.Windows.Forms.SendKeys]::SendWait("^v")',
    'Start-Sleep -Milliseconds 220',
    '[System.Windows.Forms.SendKeys]::SendWait("{ENTER}")',
    'Write-Output "Native chooser appeared and received synthetic selection"'
  ].join('\n');
  const encoded=Buffer.from(script,'utf16le').toString('base64');
  return await new Promise((resolve,reject)=>{
    const proc=spawn('powershell.exe',['-NoProfile','-STA','-EncodedCommand',encoded],
      {env:{...process.env,M16_NATIVE_SAMPLE:filePath},windowsHide:true,stdio:['ignore','pipe','pipe']});
    let out='',err='';
    proc.stdout.on('data',v=>out=(out+v).slice(-1000));
    proc.stderr.on('data',v=>err=(err+v).slice(-1000));
    proc.on('error',reject);
    proc.on('exit',code=>code===0?resolve(out.trim()):reject(Error('Private native file-dialog driver failed code '+code+': '+err.replaceAll(filePath,'[synthetic]'))));
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
  const nativeDriver=driveNativeWindowsOpenDialog(samplePath);
  await modal.getByRole('button',{name:'Use native picker'}).click();
  await nativeDriver;
  await modal.waitFor({state:'detached',timeout:10000});
  await signedApp.locator('#pick-result').filter({hasText:'"ok":true'}).waitFor({timeout:10000});
  const nativeText=await signedApp.locator('#pick-result').innerText();
  check('Actual Windows native dialog returned synthetic X-ray via signed SDK',
    nativeText.includes('m16-synthetic-xray.png')&&!nativeText.includes(profile));

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
  if(app){
    let closed=false;
    await Promise.race([app.close().then(()=>{closed=true}).catch(()=>{}),
      new Promise(resolve=>setTimeout(resolve,3500))]);
    if(!closed){try{app.process().kill();}catch{/* only synthetic CI child */}}
  }
  await rm(profile,{recursive:true,force:true,maxRetries:6,retryDelay:100});
}
