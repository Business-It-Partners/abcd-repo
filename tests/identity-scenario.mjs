import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifyIdentity(profileArgs,reportName){
 const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures','--identity-fixtures'],env,timeout:30000});const checks=[],errors=[];let crypto;
 const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
 try{
  const shell=await app.firstWindow();shell.on('pageerror',e=>errors.push(e.message));
  await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();await shell.waitForFunction(()=>document.querySelector('[data-session-phase]')?.dataset.sessionPhase==='signed-out');
  check('signed-out shell has no desktop workflow or preview',await shell.locator('.desktop,[data-window-id],.window-overview,.dock-preview').count()===0);
  check('remember-me is disabled without adequate secret provider',await shell.getByRole('checkbox').isDisabled());
  const signIn=async(email='first@fixture.invalid',password='fixture-pass')=>{await shell.getByLabel('Email',{exact:true}).fill(email);await shell.getByLabel('Password',{exact:true}).fill(password);await shell.getByRole('button',{name:'Sign in',exact:true}).click();};
  await signIn('disabled@fixture.invalid');await shell.getByRole('alert').filter({hasText:'denied'}).waitFor();check('disabled fixture identity cannot enter the desktop');
  await signIn('unavailable@fixture.invalid');await shell.getByRole('alert').filter({hasText:'unavailable'}).waitFor();check('unavailable identity service remains gated');
  await signIn();await shell.getByRole('complementary',{name:'Session controls'}).waitFor();check('platform sign-in gates ready on resolved clinic access');
  const before=await shell.evaluate(()=>window.desktop.identity.view());check('shell view exposes no credential fields',!JSON.stringify(before).match(/fixture-refresh|synthetic-fixture-credential|fixture-pass/));
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]').dataset.runtimePhase==='ready');
  const alpha=app.context().pages().find(p=>p.url().startsWith('dental-fixture://alpha/'));
  const c=await alpha.evaluate(()=>window.dentalApp.connect({major:1,minor:0}));check('app shares platform sign-in without password/token getter',c.ok&&c.value.generation===before.generation&&await alpha.evaluate(()=>!window.desktop&&Object.keys(window.dentalApp).sort().join()==='cancel,connect,report,request'));
  await alpha.getByLabel('Your draft').fill('sensitive-fixture-draft');await shell.getByRole('button',{name:'Minimize Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]').dataset.phase==='minimized');
  await shell.getByRole('button',{name:'Lock',exact:true}).click();await shell.getByRole('heading',{name:'Session locked'}).waitFor();
  check('lock destroys isolated content and removes workflow/previews',await app.evaluate(({webContents})=>webContents.getAllWebContents().every(w=>!w.getURL().startsWith('dental-fixture:')))&&await shell.locator('[data-window-id],.dock-preview,.window-overview').count()===0);
  check('locked shell capture and runtime layout are refused',await shell.evaluate(async()=>{try{await window.desktop.capture({x:0,y:0,width:10,height:10});return false;}catch{}try{await window.desktop.runtime.sync([]);return false;}catch{}return true;}));
  const locked=await shell.evaluate(()=>window.desktop.identity.view());check('lock clears display context and advances generation',locked.generation>before.generation&&!locked.userLabel&&!locked.clinicLabel&&await shell.getByLabel('Email',{exact:true}).inputValue()==='');
  await signIn('second@fixture.invalid');await shell.getByRole('complementary',{name:'Session controls'}).waitFor();
  const after=await shell.evaluate(()=>window.desktop.identity.view());check('new user gets new generation and clean workflow',after.generation>locked.generation&&after.userLabel==='second@fixture.invalid'&&await shell.locator('[data-window-id="studio"][data-phase="visible"]').count()===0);
  check('old shell generation cannot capture a new session',await shell.evaluate(async old=>{try{await window.desktop.capture({x:0,y:0,width:10,height:10},old);return false;}catch{return true;}},before.generation));
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]').dataset.runtimePhase==='ready');const fresh=app.context().pages().find(p=>p.url().startsWith('dental-fixture://alpha/'));check('old app draft never enters new user workspace',await fresh.getByLabel('Your draft').inputValue()==='');
  const forged=await fresh.evaluate(async old=>window.dentalApp.request({version:1,connection:old.connection,generation:old.generation,requestId:'old_user_request',operation:'session.context',input:{}}),c.value);check('old app connection/generation cannot read new session',!forged.ok&&forged.error.code==='STALE_SESSION');
  // Guest frames cannot invoke the shell-only identity channel; test only public bridge shape.
  check('guest cannot obtain shell login controls',await fresh.evaluate(()=>typeof window.desktop==='undefined'&&!('identity' in window.dentalApp)));
  crypto=await app.evaluate(({safeStorage})=>{
   const backend=process.platform==='linux'?safeStorage.getSelectedStorageBackend():'os-protected';const adequate=safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(backend));
   if(!adequate)return {adequate:false,backend};const cipher=safeStorage.encryptString('native-fixture-probe');return {adequate:true,backend,roundtrip:safeStorage.decryptString(cipher)==='native-fixture-probe',opaque:!cipher.includes(Buffer.from('native-fixture-probe'))};
  });check('native secret-provider classification is explicit',crypto.adequate?crypto.roundtrip&&crypto.opaque:['basic_text','unknown','gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(crypto.backend));
  await shell.getByRole('button',{name:'Sign out',exact:true}).click();await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
  check('logout destroys guest runtimes and clears authority',(await shell.evaluate(()=>window.desktop.identity.view())).phase==='signed-out'&&await app.evaluate(({webContents})=>webContents.getAllWebContents().every(w=>!w.getURL().startsWith('dental-fixture:'))));
  check('signed-out form clears account identifier and keeps exit available',await shell.getByLabel('Email',{exact:true}).inputValue()===''&&await shell.getByRole('button',{name:'Exit Dental OS',exact:true}).isVisible());
  const profile=profileArgs.find(v=>v.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
  async function scan(dir){for(const f of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await scan(p);else if(f.isFile()){const s=await fs.stat(p);if(s.size<5_000_000){const data=await fs.readFile(p);assert.ok(!data.includes(Buffer.from('fixture-pass'))&&!data.includes(Buffer.from('fixture-refresh-')),`credential bytes in profile ${f.name}`);}}}}
  if(profile)await scan(profile);check('profile contains no plaintext fixture password/refresh token');
  check('no shell page errors',errors.length===0);await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts','identity-gate.png'),await shell.screenshot());
  return {checks,errors,crypto};
 }finally{await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts',reportName),JSON.stringify({checks,errors,crypto,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));await app.close();}
}
