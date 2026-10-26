import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profileArgs } from './profile.mjs';

const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const allApps=[
 ['company.dental.followups','Follow-ups'],['company.dental.appointments','Appointments'],['company.dental.work-entry','Work Entry'],
 ['company.dental.patient-record','Patient Record'],['company.dental.treatment-progress','Treatment Progress'],['company.dental.lab-tracker','Lab Tracker'],
 ['company.dental.finance','Finance'],['company.dental.patient-payments','Patient payments'],['company.dental.staff','Staff'],
 ['company.dental.treatment-protocols','Treatment Protocols'],['company.dental.calendar','Calendar'],['company.future.billing','Future Billing'],
];
const requestedApp=process.env.LAUNCH_FEEDBACK_APP;
const apps=allApps.filter(([id])=>!requestedApp||id===requestedApp);
assert.ok(apps.length,`No managed app matches LAUNCH_FEEDBACK_APP=${requestedApp}`);
const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures','--launch-feedback-fixtures'],env,timeout:30000});
const checks=[],errors=[],artifacts=[];
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const runId=new Date().toISOString().replace(/[:.]/g,'-');
const splashShot=path.join(root,'artifacts',`app-launch-feedback-${runId}.png`);
const fadeShot=path.join(root,'artifacts',`app-launch-feedback-handoff-${runId}.png`);
const report=path.join(root,'artifacts',`app-launch-feedback-${runId}.json`);
const shell=await app.firstWindow();shell.setDefaultTimeout(15000);shell.on('pageerror',error=>errors.push(error.message));
let screenshotsWritten=false;
async function launchAndVerify(id,title,{capture=false}={}){
 const dock=shell.locator(`[data-dock-app="${id}"]`);await dock.waitFor({state:'visible'});
 await dock.click();
 if(id==='company.dental.finance'||id==='company.dental.lab-tracker'){
   const explorer=shell.locator('.app-explorer');await explorer.waitFor({state:'visible'});
   await explorer.locator('.app-explorer-item').first().click();
 }
 const startedAt=Date.now();
 const surface=shell.locator(`[data-runtime="${id}"]`),splash=surface.getByTestId('app-launch-splash');
 try{await splash.waitFor({state:'visible'});}catch(error){
   const details={phase:await surface.getAttribute('data-runtime-phase'),reason:await surface.getAttribute('data-runtime-reason'),content:await surface.locator('[role="alert"]').innerText().catch(()=>''),pages:app.context().pages().map(item=>item.url())};
   console.error('LAUNCH FAILURE',id,JSON.stringify(details));throw error;
 }
 check(`${title}: OS-owned launch feedback appears inside its managed window`,await surface.getAttribute('data-runtime-phase')==='loading'||await surface.getAttribute('data-runtime-phase')==='ready');
 const splashStatus={headingCount:await splash.getByRole('heading',{name:title,exact:true}).count(),headingText:await splash.locator('h2').textContent(),role:await splash.getAttribute('role'),live:await splash.getAttribute('aria-live'),busy:await splash.getAttribute('aria-busy')};
 check(`${title}: splash uses the app title and accessible busy status ${JSON.stringify(splashStatus)}`,splashStatus.headingCount===1&&splashStatus.headingText===title&&splashStatus.role==='status'&&splashStatus.live==='polite'&&splashStatus.busy==='true');
 check(`${title}: splash uses app artwork or the OS icon fallback and shared loading indicator`,await splash.locator(`[data-store-art="${id}"] img, [data-store-art="${id}"] svg`).count()===1&&await splash.locator('.app-launch-spinner').count()===1);
 await shell.waitForFunction(runtimeId=>document.querySelector(`[data-runtime="${runtimeId}"]`)?.dataset.launchCountState==='counting',id,{timeout:10000});
 const countObservedAt=Date.now();
 await shell.waitForFunction(runtimeId=>document.querySelector(`[data-runtime="${runtimeId}"]`)?.dataset.runtimePhase==='ready',id,{timeout:12000});
 let guest=app.context().pages().find(item=>item.url().startsWith(`dental-fixture://${id}/`));
 assert.ok(guest,`${title}: isolated package page should load`);
 await guest.waitForLoadState('domcontentloaded');
 check(`${title}: isolated app is ready while the shell still holds its launch screen`,await surface.getAttribute('data-runtime-phase')==='ready'&&await splash.isVisible()&&await surface.getAttribute('data-launch-handoff')==='waiting');
 const reducedMotion=await guest.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 if(!reducedMotion)check(`${title}: OS prepares the isolated app's paused fade`,await guest.evaluate(()=>window.__dentalOSLaunchAnimation?.playState==='paused'&&Number(getComputedStyle(document.documentElement).opacity)===0));
 if(capture&&!screenshotsWritten){
   await fs.mkdir(path.dirname(splashShot),{recursive:true});
   await fs.writeFile(splashShot,await shell.screenshot(),{flag:'wx'});artifacts.push(path.basename(splashShot));
 }
 try{await shell.waitForFunction(runtimeId=>document.querySelector(`[data-runtime="${runtimeId}"]`)?.dataset.launchHandoff==='revealing',id,{timeout:10000});}catch(error){
   console.error('LAUNCH REVEAL FAILURE',id,JSON.stringify({runtimePhase:await surface.getAttribute('data-runtime-phase'),handoff:await surface.getAttribute('data-launch-handoff'),minimumElapsed:await surface.getAttribute('data-launch-minimum-elapsed'),countState:await surface.getAttribute('data-launch-count-state'),active:await surface.evaluate(element=>element.closest('[data-window-id]')?.getAttribute('data-active')),windowPhase:await surface.evaluate(element=>element.closest('[data-window-id]')?.getAttribute('data-phase')),motion:await shell.locator('main.desktop').getAttribute('data-motion'),overview:await shell.locator('main.desktop').getAttribute('data-overview'),explorer:await shell.locator('.app-explorer').count(),notice:await shell.locator('[role="alert"]').allTextContents()}));
   throw error;
 }
 const foregroundHoldObservedMs=Date.now()-countObservedAt;
 check(`${title}: OS holds launch feedback for at least two foreground seconds (${foregroundHoldObservedMs} ms observed)`,foregroundHoldObservedMs>=1800&&await surface.getAttribute('data-launch-minimum-elapsed')==='true');
 check(`${title}: native app reveal starts only after the shell splash`,await splash.count()===0&&await surface.getAttribute('data-launch-handoff')==='revealing');
 if(!reducedMotion){
   await guest.waitForFunction(()=>{const animation=window.__dentalOSLaunchAnimation;return !!animation&&animation.playState!=='paused'&&Number(animation.currentTime)>0;},undefined,{timeout:5000});
   const fade=await guest.evaluate(()=>{const animation=window.__dentalOSLaunchAnimation;return {state:animation?.playState,time:Number(animation?.currentTime),duration:Number(animation?.effect?.getTiming().duration)};});
   check(`${title}: isolated app content starts its 260 ms fade after the two-second shell splash`,fade.duration===260&&['running','finished'].includes(fade.state)&&fade.time>0);
   if(capture&&!screenshotsWritten){
     await guest.evaluate(()=>{const animation=window.__dentalOSLaunchAnimation;if(animation){animation.pause();animation.currentTime=130;}});
     await fs.writeFile(fadeShot,await guest.screenshot(),{flag:'wx'});artifacts.push(path.basename(fadeShot));
     await guest.evaluate(()=>window.__dentalOSLaunchAnimation?.play());screenshotsWritten=true;
   }
 }else{
   check(`${title}: reduced-motion preference skips the content fade`,await guest.evaluate(()=>!window.__dentalOSLaunchAnimation&&Number(getComputedStyle(document.documentElement).opacity)===1));
 }
 try{await shell.waitForFunction(runtimeId=>document.querySelector(`[data-runtime="${runtimeId}"]`)?.dataset.launchHandoff==='done',id,{timeout:10000});}catch(error){
   console.error('HANDOFF FAILURE',id,JSON.stringify({handoff:await surface.getAttribute('data-launch-handoff'),countState:await surface.getAttribute('data-launch-count-state'),phase:await surface.getAttribute('data-runtime-phase'),splash:await splash.count(),windowPhase:await surface.evaluate(element=>element.closest('[data-window-id]')?.getAttribute('data-phase'))}));
   throw error;
 }
 check(`${title}: shared handoff completes with the live isolated app visible`,await surface.getAttribute('data-runtime-phase')==='ready'&&await surface.getAttribute('data-launch-handoff')==='done'&&await splash.count()===0);
 const close=shell.getByRole('button',{name:`Close ${title}`,exact:true});await close.click();
 await shell.waitForFunction(runtimeId=>document.querySelector(`[data-runtime="${runtimeId}"]`)?.closest('[data-window-id]')?.dataset.phase==='closed',id,{timeout:10000});
 check(`${title}: closing resets the OS launch state for the next cold open`);
 return {id,title,startedAt,reducedMotion};
}

try{
 await shell.waitForFunction(expected=>expected.every(([id])=>!!document.querySelector(`[data-dock-app="${id}"]`)),allApps,{timeout:15000});
 check('all eleven current apps and a differently named future managed app are installed in the private fixture dock');
 for(const [id,title] of apps)await launchAndVerify(id,title,{capture:id==='company.dental.patient-record'});
 if(!requestedApp)await launchAndVerify('company.dental.patient-record','Patient Record');
 check('the shell renderer has no errors across managed-app launch and repeat-launch handoffs',errors.length===0);
 console.log('ARTIFACT',splashShot);console.log('ARTIFACT',fadeShot);
}finally{
 await fs.writeFile(report,JSON.stringify({checks,errors,apps:apps.map(([id,title])=>({id,title})),platform:process.platform,artifacts},null,2),{flag:'wx'});
 const closed=app.waitForEvent('close',{timeout:5000}).then(()=>true,()=>false);
 await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
 if(!await closed&&app.process().exitCode===null)app.process().kill('SIGTERM');
}
