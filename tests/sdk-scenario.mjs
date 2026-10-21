import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifySdk(profileArgs,reportName){
 const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures'],env,timeout:30000});
 const checks=[],errors=[];const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
 try{
  const shell=await app.firstWindow();shell.on('pageerror',e=>errors.push(e.message));
  const open=async(name,id,host)=>{await shell.getByRole('button',{name,exact:true}).click();await shell.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',id);return app.context().pages().find(p=>p.url().startsWith(`dental-fixture://${host}/`));};
  const alpha=await open('Motion Studio','studio','alpha');
  await alpha.getByRole('button',{name:'Connect SDK',exact:true}).click();await alpha.locator('#sdk-result').filter({hasText:'SDK connected: company.sample.alpha'}).waitFor();check('platform binds real alpha sender to company identity');
  await alpha.getByRole('button',{name:'Read synthetic appointment',exact:true}).click();await alpha.waitForFunction(()=>document.querySelector('#sdk-result').textContent.includes('Synthetic patient'));check('named API read works through isolated preload and host broker');
  await alpha.getByRole('button',{name:'Change synthetic status',exact:true}).click();await alpha.waitForFunction(()=>document.querySelector('#sdk-result').textContent.includes('"rowVersion":2'));check('named API write preserves backend revision contract');
  await alpha.getByRole('button',{name:'Change synthetic status',exact:true}).click();await alpha.waitForFunction(()=>document.querySelector('#sdk-result').textContent.includes('"rowVersion":2'));check('same-key replay does not create a second synthetic mutation');
  const beta=await open('Records','records','beta');await beta.getByRole('button',{name:'Connect SDK',exact:true}).click();await beta.locator('#sdk-result').filter({hasText:'SDK connected: company.sample.beta'}).waitFor();
  await beta.getByRole('button',{name:'Change synthetic status',exact:true}).click();await beta.waitForFunction(()=>document.querySelector('#sdk-result').textContent.includes('FORBIDDEN'));check('beta cannot invoke alpha write capability');
  const [a,b]=await Promise.all([alpha.evaluate(()=>window.dentalApp.connect({major:1,minor:0})),beta.evaluate(()=>window.dentalApp.connect({major:1,minor:0}))]);
  check('connections are independently generated',a.ok&&b.ok&&a.value.connection!==b.value.connection);
  check('incompatible handshake fails in real bridge',await beta.evaluate(async()=>{const r=await window.dentalApp.connect({major:9,minor:0});return !r.ok&&r.error.code==='INCOMPATIBLE_SDK';}));
  const invoke=(page,c,operation,input,extra={})=>page.evaluate(async({c,operation,input,extra})=>window.dentalApp.request({version:1,connection:c.connection,generation:c.generation,requestId:crypto.randomUUID(),operation,input,...extra}),{c,operation,input,extra});
  check('copied alpha connection rejected by beta sender',(await invoke(beta,a.value,'platform.status',{})).error.code==='STALE_SESSION');
  check('URL and raw-channel injection rejected',(await invoke(beta,b.value,'platform.status',{}, {url:'https://outside.invalid',channel:'window:control'})).error.code==='INVALID_REQUEST');
  check('oversized request rejected before IPC',(await invoke(beta,b.value,'notifications.show',{message:'x'.repeat(20000)})).error.code==='INVALID_REQUEST');
  check('unconfigured native adapter fails explicitly',(await invoke(beta,b.value,'native.intent',{kind:'export'})).error.code==='UNAVAILABLE');
  const context=await invoke(beta,b.value,'session.context',{});check('only synthetic display context returned',context.ok&&context.value.clinicLabel==='Synthetic clinic'&&!JSON.stringify(context).includes('credential'));
  check('no privileged bridge, token getter or raw transport exposed',await beta.evaluate(()=>typeof require==='undefined'&&typeof window.desktop==='undefined'&&Object.keys(window.dentalApp).sort().join()==='cancel,connect,getAppInfo,onModuleSelected,openAppExplorer,report,request'));
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await shell.getByRole('button',{name:'Close Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]').dataset.phase==='closed');
  const fresh=await open('Motion Studio','studio','alpha');const c=await fresh.evaluate(()=>window.dentalApp.connect({major:1,minor:0}));check('close/reopen revokes old connection',c.ok&&c.value.connection!==a.value.connection&&(await invoke(fresh,a.value,'platform.status',{})).error.code==='STALE_SESSION');
  check('no shell page errors',errors.length===0);
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});const image=await shell.evaluate(()=>window.desktop.capture({x:0,y:0,width:innerWidth,height:innerHeight}));await fs.writeFile(path.join(root,'artifacts','sdk-fixtures.png'),Buffer.from(image.split(',')[1],'base64'));
 }finally{await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts',reportName),JSON.stringify({checks,errors,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));await app.close();}
}
