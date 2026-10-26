import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import path from 'node:path';
export async function verifyIdentity(profileArgs,reportName){
 const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures','--identity-fixtures','--dev-credentials-fixtures'],env,timeout:30000});const checks=[],errors=[];let crypto,closed=false;
 const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
 try{
  const shell=await app.firstWindow(),sessionOptions=shell.locator('.statusbar-account-menu > summary');shell.on('pageerror',e=>errors.push(e.message));
  const splashSeenAt=Date.now();await shell.locator('.brand-splash').waitFor({state:'visible'});
  check('startup splash shows Sajilo Dental branding',await shell.getByRole('heading',{name:'Sajilo Dental',exact:true}).isVisible()&&await shell.getByText('Less admin. More room to grow.',{exact:true}).isVisible());
  await shell.getByRole('progressbar',{name:'Startup session check'}).waitFor();
  await shell.waitForFunction(()=>document.querySelector('.brand-splash__progress')?.getAttribute('aria-valuenow')==='100');
  check('completed session check reports real completion',await shell.getByRole('progressbar').getAttribute('aria-valuenow')==='100'&&await shell.getByText('Ready to sign in',{exact:true}).isVisible());
  await shell.getByRole('button',{name:'Mute startup sound'}).click();
  check('startup sound can be muted and remembers the preference',await shell.getByRole('button',{name:'Enable startup sound'}).isVisible()&&await shell.evaluate(()=>localStorage.getItem('sajilo.startup-sound'))==='off');
  await shell.getByRole('button',{name:'Enable startup sound'}).click();
  check('startup sound can be enabled again',await shell.getByRole('button',{name:'Mute startup sound'}).getAttribute('aria-pressed')==='true'&&await shell.evaluate(()=>localStorage.getItem('sajilo.startup-sound'))==='on');
  const branding=path.join(root,'artifacts','sajilo-dental-branding');await fs.mkdir(branding,{recursive:true});
  await shell.screenshot({path:path.join(branding,'sajilo-dental-splash.png'),animations:'disabled'});
  await shell.locator('.brand-splash__mark').screenshot({path:path.join(branding,'sajilo-dental-logo.png'),omitBackground:true,animations:'disabled'});
  await shell.locator('.brand-splash__lockup').screenshot({path:path.join(branding,'sajilo-dental-lockup.png'),omitBackground:true,animations:'disabled'});
  await shell.locator('.brand-splash__tagline').screenshot({path:path.join(branding,'sajilo-dental-slogan.png'),omitBackground:true,animations:'disabled'});
  await shell.screenshot({path:path.join(branding,'sajilo-dental-background.png'),style:'.brand-splash__lockup,.brand-splash__sound{visibility:hidden}',animations:'disabled'});
  await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();await shell.waitForFunction(()=>document.querySelector('[data-session-phase]')?.dataset.sessionPhase==='signed-out');
  check('startup splash remains visible for five seconds before the sign-in gate',Date.now()-splashSeenAt>=4800);
  check('signed-out shell has no desktop workflow or preview',await shell.locator('.desktop,[data-window-id],.window-overview,.dock-preview').count()===0);
  const loginArtifacts=path.join(root,'artifacts','sajilo-dental-branding');
  await shell.screenshot({path:path.join(loginArtifacts,'sajilo-dental-login.png')});
  const loginViewport=shell.viewportSize()??{width:1366,height:768};
  await shell.setViewportSize({width:360,height:800});
  check('compact login keeps fields and window controls reachable without horizontal scrolling',await shell.evaluate(()=>{const main=document.querySelector('.identity-gate');const input=document.querySelector('#clinic-email').getBoundingClientRect();const controls=document.querySelector('.identity-window-controls').getBoundingClientRect();return main.scrollWidth<=innerWidth&&input.left>=0&&input.right<=innerWidth&&controls.right<=innerWidth;} )&&await shell.getByRole('button',{name:'Close Sajilo Dental'}).isVisible());
  await shell.screenshot({path:path.join(loginArtifacts,'sajilo-dental-login-compact.png')});
  await shell.setViewportSize(loginViewport);
  check('login window exposes minimize and close controls without a status bar',await shell.getByRole('group',{name:'Window controls'}).getByRole('button').count()===2&&await shell.locator('.desktop-statusbar').count()===0);
  // The dock-caption overlay is a separate BrowserWindow; locate the native
  // shell by its loaded URL and parentless ownership, never by list order.
  const nativeShellUrl=await shell.url();
  await shell.evaluate(()=>{
    window.__identityHostTransitionEvents=[];
    window.desktop?.onHostTransition(value=>window.__identityHostTransitionEvents.push(value));
  });
  await shell.getByRole('button',{name:'Minimize Sajilo Dental'}).click();
  await shell.waitForTimeout(300);
  const nativeShellState=await app.evaluate(({BrowserWindow},url)=>{
    const windows=BrowserWindow.getAllWindows();
    const matches=windows.filter(win=>!win.getParentWindow()&&win.webContents.getURL()===url);
    return {matches:matches.length,minimized:matches[0]?.isMinimized()??false,topLevel:windows.filter(win=>!win.getParentWindow()).length};
  },nativeShellUrl);
  if(nativeShellState.matches!==1||!nativeShellState.minimized)console.log('Native shell minimize diagnostics',JSON.stringify(nativeShellState));
  check('top-right minimize control minimizes the native Sajilo window',nativeShellState.matches===1&&nativeShellState.minimized);
  await app.evaluate(({BrowserWindow},url)=>{
    const nativeShell=BrowserWindow.getAllWindows().find(win=>!win.getParentWindow()&&win.webContents.getURL()===url);
    if(!nativeShell)throw Error('Native Sajilo shell not found for restore');
    nativeShell.restore();
  },nativeShellUrl);
  // Native Windows minimize/restore must release renderer layout before
  // viewport-dependent Dock assertions. Do not fake the transition state.
  try {
    await shell.waitForFunction(()=>{
      const events=window.__identityHostTransitionEvents??[];
      const suspended=events.indexOf(true);
      return suspended>=0&&events.slice(suspended+1).includes(false);
    },null,{timeout:12000});
  } catch(error) {
    console.error('Native host restore failed to resume shell layout',JSON.stringify({
      events:await shell.evaluate(()=>window.__identityHostTransitionEvents).catch(()=>[])
    }));
    throw error;
  }
  check('native Windows restore releases the shell layout transition');
  await shell.waitForLoadState('domcontentloaded');
  await shell.getByRole('button',{name:'Fill development sign-in',exact:true}).click();
  await shell.waitForFunction(()=>document.querySelector('input[type="email"]')?.value==='dev-login@fixture.invalid'&&document.querySelector('input[type="password"]')?.value==='synthetic-dev-fill-only');
  check('development sign-in button fills fields from a private synthetic fixture',await shell.getByLabel('Email',{exact:true}).inputValue()==='dev-login@fixture.invalid'&&await shell.getByLabel('Password',{exact:true}).inputValue()==='synthetic-dev-fill-only');
  await shell.getByRole('button',{name:'Show password',exact:true}).click();
  check('password reveal preserves the entered value',await shell.getByLabel('Password',{exact:true}).getAttribute('type')==='text'&&await shell.getByLabel('Password',{exact:true}).inputValue()==='synthetic-dev-fill-only');
  await shell.getByRole('button',{name:'Hide password',exact:true}).click();
  check('password can be concealed again',await shell.getByLabel('Password',{exact:true}).getAttribute('type')==='password');
  check('email remembering is separate from secure session restore',await shell.getByRole('checkbox',{name:'Remember me',exact:true}).isChecked()&&await shell.getByText(/Your email is remembered on this device\. Sign out clears the secure session, not this email\./i).isVisible());
  const signIn=async(email='first@fixture.invalid',password='fixture-pass')=>{await shell.getByLabel('Email',{exact:true}).fill(email);await shell.getByLabel('Password',{exact:true}).fill(password);await shell.getByRole('button',{name:'Sign in',exact:true}).click();};
  await signIn('disabled@fixture.invalid');await shell.getByRole('alert').filter({hasText:'denied'}).waitFor();check('disabled fixture identity cannot enter the desktop');
  await signIn('unavailable@fixture.invalid');await shell.getByRole('alert').filter({hasText:'unavailable'}).waitFor();check('unavailable identity service remains gated');
  await signIn();await sessionOptions.waitFor();check('platform sign-in gates ready on resolved clinic access');
  check('V1 omits the in-house Files Explorer and Image Viewer dock apps',await shell.locator('[data-dock-app="files"],[data-window-id="files"],[data-window-id="image-viewer"]').count()===0);
  await shell.locator('.dock-region').screenshot({path:path.join(loginArtifacts,'sajilo-dental-dock-no-files.png'),animations:'disabled'});
  check('status bar and desktop identity/widgets appear only after sign-in',await shell.locator('.desktop-statusbar').count()===1&&await shell.getByRole('region',{name:'Clinic and signed-in user'}).isVisible()&&await shell.getByRole('region',{name:'Desktop widgets'}).isVisible());
  check('status bar identifies the Sajilo Dental desktop when no app is active',await shell.locator('.statusbar-brand').getAttribute('aria-label')==='Sajilo Dental'&&await shell.locator('.statusbar-brand img').evaluate(img=>img.complete&&img.naturalWidth>0));
  const menuBar=shell.locator('.desktop-statusbar');const menuBarStyle=await menuBar.evaluate(e=>({height:e.getBoundingClientRect().height,color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundImage,reduced:matchMedia('(prefers-reduced-transparency: reduce)').matches,items:[...e.querySelectorAll('.statusbar-menu > button')].map(button=>button.innerText)}));const chromeCss=await fs.readFile(path.join(root,'src/DesktopChrome.css'),'utf8');const menuBarOkay=menuBarStyle.height>=34&&menuBarStyle.height<=38&&menuBarStyle.color==='rgb(32, 44, 49)'&&menuBarStyle.background.includes('linear-gradient')&&(chromeCss.includes('backdrop-filter:blur(28px) saturate(170%)')||menuBarStyle.reduced)&&menuBarStyle.items.join('|')==='Apps|Windows|Help';if(!menuBarOkay)console.log('Menu bar diagnostics',JSON.stringify({menuBarStyle,expectedGlassRule:chromeCss.includes('backdrop-filter:blur(28px) saturate(170%)')}));check('menu bar uses the Sajilo light frosted-glass style and expected top-level controls',menuBarOkay);
  check('clinic widget uses the authenticated clinic, user and role',await shell.locator('.clinic-widget-copy').innerText()==='Synthetic clinic\nfirst@fixture.invalid\nDoctor');
  check('status bar and time card expose current date/time',!!await shell.locator('.statusbar-date').getAttribute('datetime')&&!!await shell.locator('.statusbar-time').innerText()&&!!(await shell.locator('.clock-widget-time').getAttribute('aria-label'))?.startsWith('Current time '));
  await shell.getByRole('button',{name:'Open apps catalog'}).click();
   try {
     await shell.waitForFunction(()=>document.querySelector('[data-window-id="store"]')?.dataset.phase==='visible',null,{timeout:10000});
   } catch(error) {
     // Preserve the genuine open-window requirement; distinguish a stuck native
     // overlay / modal / reducer gate from a missing or closed Store window.
     const diagnostic=await shell.evaluate(()=>({
       store:[...document.querySelectorAll('[data-window-id="store"]')].map(node=>({phase:node.dataset.phase,visibility:getComputedStyle(node).visibility,hidden:node.getAttribute('aria-hidden')})),
       windows:[...document.querySelectorAll('[data-window-id]')].filter(node=>node.dataset.phase!=='closed').map(node=>({id:node.dataset.windowId,phase:node.dataset.phase})).slice(0,12),
       dialog:[...document.querySelectorAll('[role="dialog"]')].filter(node=>node.getAttribute('aria-hidden')!=='true').map(node=>node.textContent?.trim().slice(0,120)).slice(0,3),
       disabled:document.querySelector('button[aria-label="Open apps catalog"]')?.disabled??null,
       overview:document.querySelector('main')?.dataset.overview
     })).catch(()=>({unavailable:true}));
     console.error('Windows Apps menu catalog did not open; bounded diagnostic:',JSON.stringify(diagnostic));
     throw error;
   }
   check('menu-bar Apps opens the signed-in app catalog');
   await shell.getByRole('button',{name:'Close App Store',exact:true}).click();
   await shell.waitForFunction(()=>document.querySelector('[data-window-id="store"]')?.dataset.phase==='closed');
   await shell.getByRole('button',{name:'Show open windows'}).click();
   await shell.waitForFunction(()=>document.querySelector('main')?.dataset.overview==='true');
   check('menu-bar Windows opens the shared window overview');
   // The native guest WebContentsView can retain OS keyboard focus even while
   // the shell overlay is on screen. Focus an accessible overview control first,
   // then send a genuine keyboard event to that control (not a reducer shortcut).
   const overviewClose=shell.getByRole('button',{name:'Close window overview'});
   await overviewClose.focus();
   check('window overview takes keyboard focus before Escape',await overviewClose.evaluate(button=>document.activeElement===button));
   await overviewClose.press('Escape');
   try {
     await shell.waitForFunction(()=>document.querySelector('main')?.dataset.overview==='false',null,{timeout:10000});
   } catch(error) {
     const diagnostic=await shell.evaluate(()=>({
       overview:document.querySelector('main')?.dataset.overview,
       focused:document.activeElement?.getAttribute('aria-label')??document.activeElement?.tagName,
       openWindows:[...document.querySelectorAll('[data-window-id]')].filter(x=>x.dataset.phase!=='closed').map(x=>({id:x.dataset.windowId,phase:x.dataset.phase})).slice(0,10),
       dialogPresent:!!document.querySelector('.window-overview'),
     })).catch(()=>({unavailable:true}));
     console.error('Windows overview Escape did not close; bounded diagnostic:',JSON.stringify(diagnostic));
     throw error;
   }
   check('window overview closes with focused Escape keyboard input');
  const nepaliCalendar=shell.locator('.nepali-calendar-grid'),gregorianCalendar=shell.locator('.gregorian-calendar-grid');
  const widgetPlacement=await shell.evaluate(()=>{const box=(selector)=>document.querySelector(selector).getBoundingClientRect();const updates=box('.app-updates-widget');return{updatesTop:updates.top,calendarsBottom:Math.max(box('.nepali-calendar-widget').bottom,box('.time-widget').bottom,box('.gregorian-calendar-widget').bottom)}});
  check('calendar and time widgets remain, with the App Updates widget below them',await shell.locator('.desktop-widget-collection .desktop-widget').count()===4&&await shell.getByRole('region',{name:'Nepali calendar'}).isVisible()&&await shell.getByRole('region',{name:'Local time'}).isVisible()&&await shell.getByRole('region',{name:'English calendar'}).isVisible()&&await shell.getByRole('region',{name:'App updates'}).isVisible()&&widgetPlacement.updatesTop>=widgetPlacement.calendarsBottom&&await shell.locator('.calendar-today-line').count()===0);
  const currentBsMonth=await nepaliCalendar.getAttribute('aria-label');check('Nepali calendar highlights today',await nepaliCalendar.locator('[role="gridcell"][aria-selected="true"]').count()===1);await shell.getByRole('button',{name:'Previous Nepali month'}).click();check('Nepali calendar navigates to the previous month',await nepaliCalendar.getAttribute('aria-label')!==currentBsMonth);await shell.getByRole('button',{name:'Next Nepali month'}).click();check('Nepali calendar returns to the current month',await nepaliCalendar.getAttribute('aria-label')===currentBsMonth);
  const currentEnglishMonth=await gregorianCalendar.getAttribute('aria-label');check('Gregorian calendar highlights today',await gregorianCalendar.locator('[role="gridcell"][aria-selected="true"]').count()===1);await shell.getByRole('button',{name:'Previous English month'}).click();check('Gregorian calendar navigates independently',await gregorianCalendar.getAttribute('aria-label')!==currentEnglishMonth&&await nepaliCalendar.getAttribute('aria-label')===currentBsMonth);await shell.getByRole('button',{name:'Next English month'}).click();check('Gregorian calendar returns to the current month',await gregorianCalendar.getAttribute('aria-label')===currentEnglishMonth);
  const glass=await shell.locator('.desktop-widget-collection .desktop-widget').first().evaluate(e=>getComputedStyle(e).backgroundImage);check('calendar cards use a translucent glass surface',glass.includes('linear-gradient')&&glass.includes('rgba'));
  const viewport=shell.viewportSize()??{width:1366,height:768};await shell.setViewportSize({width:580,height:800});await shell.waitForFunction(()=>{const pill=document.querySelector('.dock-pill')?.getBoundingClientRect();return !!pill&&pill.left>=0&&pill.right<=innerWidth;});const compact=await shell.evaluate(()=>{const box=(selector)=>{const r=document.querySelector(selector).getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};const icon=box('.dock-icon');const pill=box('.dock-pill');return{bar:box('.desktop-statusbar'),menu:box('.statusbar-menu'),right:box('.statusbar-right'),clinic:box('.desktop-clinic-widget'),widgets:box('.desktop-widget-collection'),icon,pill,height:innerHeight,width:innerWidth};});const menuAndStatusDoNotOverlap=compact.menu.right<=compact.right.left||compact.menu.bottom<=compact.right.top||compact.right.bottom<=compact.menu.top;const compactOkay=compact.bar.bottom<=compact.clinic.top&&menuAndStatusDoNotOverlap&&compact.right.right<=compact.width&&compact.clinic.bottom<compact.widgets.top&&compact.widgets.bottom<compact.height-70&&compact.widgets.left>=0&&compact.widgets.right<=compact.width&&compact.icon.width<36&&compact.icon.width>=20&&compact.pill.bottom<=compact.height&&compact.pill.left>=0&&compact.pill.right<=compact.width;if(!compactOkay)console.log('Compact layout diagnostics',JSON.stringify(compact));check('compact layout stacks widgets, keeps menu/status clear, and scales dock icons for laptop widths',compactOkay);await shell.setViewportSize(viewport);
  await shell.evaluate(()=>window.dispatchEvent(new Event('offline')));await shell.getByText('Offline',{exact:true}).waitFor();check('status bar shows the OS-reported offline state',await shell.getByText('Offline',{exact:true}).count()===1);await shell.evaluate(()=>window.dispatchEvent(new Event('online')));await shell.getByText('Online',{exact:true}).waitFor();
  check('workspace prototype footnote strip is removed',await shell.locator('.desktop-footnote').count()===0);
  const sessionActionsMenu=shell.locator('.statusbar-account-menu .identity-menu-actions');check('session actions stay collapsed until their options menu opens',await sessionActionsMenu.count()===1&&!await sessionActionsMenu.isVisible());
  await sessionOptions.click();const sessionActions=shell.getByRole('group',{name:'Session controls'});await sessionActions.waitFor();check('session actions remain available from the status-bar options menu',await sessionActions.isVisible()&&await sessionActions.getByRole('button').count()===4);await sessionOptions.click();
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts','m12-full-fixture-dock.png'),await shell.screenshot());
  const before=await shell.evaluate(()=>window.desktop.identity.view());check('shell view exposes no credential fields',!JSON.stringify(before).match(/fixture-refresh|synthetic-fixture-credential|fixture-pass/));
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await shell.mouse.move(520,320);await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase==='ready');const studioWindow=shell.locator('[data-window-id="studio"]');check('Motion Studio opens as the active managed app',await studioWindow.isVisible()&&await studioWindow.getAttribute('data-active')==='true'&&await studioWindow.locator('.window-title').innerText()==='Motion Studio');
  const alpha=app.context().pages().find(p=>p.url().startsWith('dental-fixture://alpha/'));
  const c=await alpha.evaluate(()=>window.dentalApp.connect({major:1,minor:0}));check('app shares platform sign-in without password/token or shell Files transfer getter',c.ok&&c.value.generation===before.generation&&await alpha.evaluate(()=>!window.desktop&&Object.keys(window.dentalApp).sort().join()==='cancel,connect,getAppInfo,navigation,onModuleSelected,openAppExplorer,report,request'));
  await alpha.evaluate(()=>localStorage.setItem('private-session-canary','sensitive-fixture-storage'));
  await alpha.getByLabel('Your draft').fill('sensitive-fixture-draft');await shell.getByRole('button',{name:'Minimize Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]').dataset.phase==='minimized');
  await sessionOptions.click();await shell.getByRole('button',{name:'Lock',exact:true}).click();await shell.getByRole('heading',{name:'Session locked'}).waitFor();
  await shell.screenshot({path:path.join(loginArtifacts,'sajilo-dental-login-locked.png')});
  check('lock destroys isolated content and removes workflow/previews',await app.evaluate(({webContents})=>webContents.getAllWebContents().every(w=>!w.getURL().startsWith('dental-fixture:')))&&await shell.locator('[data-window-id],.dock-preview,.window-overview').count()===0);
  check('locked shell capture and runtime layout are refused',await shell.evaluate(async()=>{try{await window.desktop.capture({x:0,y:0,width:10,height:10});return false;}catch{}try{await window.desktop.runtime.sync([]);return false;}catch{}return true;}));
  const locked=await shell.evaluate(()=>window.desktop.identity.view());check('lock clears display context, advances generation, and retains the remembered email',locked.generation>before.generation&&!locked.userLabel&&!locked.clinicLabel&&await shell.getByLabel('Email',{exact:true}).inputValue()==='first@fixture.invalid');
  await signIn('second@fixture.invalid');await sessionOptions.waitFor();check('clinic identity widget follows the newly authenticated user',await shell.locator('.clinic-widget-copy').innerText()==='Synthetic clinic\nsecond@fixture.invalid\nDoctor');
  const after=await shell.evaluate(()=>window.desktop.identity.view());check('new user gets new generation and clean workflow',after.generation>locked.generation&&after.userLabel==='second@fixture.invalid'&&await shell.locator('[data-window-id="studio"][data-phase="visible"]').count()===0);
  check('old shell generation cannot capture a new session',await shell.evaluate(async old=>{try{await window.desktop.capture({x:0,y:0,width:10,height:10},old);return false;}catch{return true;}},before.generation));
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await shell.mouse.move(520,320);await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]').dataset.runtimePhase==='ready');const fresh=app.context().pages().find(p=>p.url().startsWith('dental-fixture://alpha/'));check('old app draft never enters new user workspace',await fresh.getByLabel('Your draft').inputValue()==='');
  check('previous account storage partition is never reused',await fresh.evaluate(()=>localStorage.getItem('private-session-canary'))===null);
  const forged=await fresh.evaluate(async old=>window.dentalApp.request({version:1,connection:old.connection,generation:old.generation,requestId:'old_user_request',operation:'session.context',input:{}}),c.value);check('old app connection/generation cannot read new session',!forged.ok&&forged.error.code==='STALE_SESSION');
  // Guest frames cannot invoke the shell-only identity channel; test only public bridge shape.
  check('guest cannot obtain shell login controls',await fresh.evaluate(()=>typeof window.desktop==='undefined'&&!('identity' in window.dentalApp)));
  crypto=await app.evaluate(({safeStorage})=>{
   const backend=process.platform==='linux'?safeStorage.getSelectedStorageBackend():'os-protected';const adequate=safeStorage.isEncryptionAvailable()&&(process.platform!=='linux'||['gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(backend));
   if(!adequate)return {adequate:false,backend};const cipher=safeStorage.encryptString('native-fixture-probe');return {adequate:true,backend,roundtrip:safeStorage.decryptString(cipher)==='native-fixture-probe',opaque:!cipher.includes(Buffer.from('native-fixture-probe'))};
  });check('native secret-provider classification is explicit',crypto.adequate?crypto.roundtrip&&crypto.opaque:['basic_text','unknown','gnome_libsecret','kwallet','kwallet5','kwallet6'].includes(crypto.backend));
  await sessionOptions.click();await shell.getByRole('group',{name:'Session controls'}).getByRole('button',{name:'Sign out',exact:true}).click();await shell.getByRole('alertdialog',{name:'Sign out of Sajilo Dental?'}).getByRole('button',{name:'Sign out',exact:true}).click();await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
  check('logout destroys guest runtimes and clears authority',(await shell.evaluate(()=>window.desktop.identity.view())).phase==='signed-out'&&await app.evaluate(({webContents})=>webContents.getAllWebContents().every(w=>!w.getURL().startsWith('dental-fixture:'))));
  check('signed-out form retains the remembered account identifier and keeps window controls available',await shell.getByLabel('Email',{exact:true}).inputValue()==='second@fixture.invalid'&&await shell.getByRole('button',{name:'Close Sajilo Dental'}).isVisible());
  await shell.evaluate(()=>localStorage.setItem('sajilo.startup-sound','off'));await shell.reload();
  await shell.getByRole('button',{name:'Enable startup sound'}).waitFor();
  check('muted startup preference survives a fresh renderer launch',await shell.getByRole('button',{name:'Enable startup sound'}).getAttribute('aria-pressed')==='false');
  await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
  check('no shell page errors',errors.length===0);await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts','identity-gate.png'),await shell.screenshot());
  const closeWindow=app.waitForEvent('close',{timeout:5000});
  await shell.getByRole('button',{name:'Close Sajilo Dental'}).click();await shell.getByRole('alertdialog',{name:'Are you sure you want to leave Sajilo Dental?'}).getByRole('button',{name:'OK',exact:true}).click();
  await closeWindow;closed=true;check('top-right close control exits Sajilo Dental');
  const profile=profileArgs.find(v=>v.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
  async function scan(dir){for(const f of await fs.readdir(dir,{withFileTypes:true})){
    const p=path.join(dir,f.name);if(f.isDirectory())await scan(p);else if(f.isFile()){
      for(let attempt=0;;attempt++){
        try{let tail=Buffer.alloc(0);for await(const chunk of createReadStream(p,{highWaterMark:65536})){
          const data=Buffer.concat([tail,chunk]);assert.ok(!data.includes(Buffer.from('fixture-pass'))&&!data.includes(Buffer.from('fixture-refresh-')),`credential bytes in profile ${f.name}`);tail=data.subarray(-32);
        }break;}catch(error){if(!['EBUSY','EPERM'].includes(error.code)||attempt>=5)throw error;await new Promise(r=>setTimeout(r,100));}
      }
    }
  }}
  if(profile)await scan(profile);check('closed profile contains no plaintext fixture password/refresh token');
  return {checks,errors,crypto};
 }finally{await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts',reportName),JSON.stringify({checks,errors,crypto,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));if(!closed)await app.close();}
}
