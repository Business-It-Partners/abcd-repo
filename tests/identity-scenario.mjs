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
  const shell=await app.firstWindow(),sessionOptions=shell.locator('.statusbar-role-menu > summary');shell.on('pageerror',e=>errors.push(e.message));
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
  // Capture native events without altering their behavior, so an uncompleted
  // Windows restore can be distinguished from a fullscreen-settle delay.
  await app.evaluate(({BrowserWindow},url)=>{
    const win=BrowserWindow.getAllWindows().find(w=>!w.getParentWindow()&&w.webContents.getURL()===url);
    if(!win)throw Error('Sajilo native shell not found for restore trace');
    globalThis.__identityNativeRestoreEvents=[];
    for(const name of ['minimize','restore','show','focus','enter-full-screen','leave-full-screen'])win.on(name,()=>{
      globalThis.__identityNativeRestoreEvents.push({
        name,minimized:win.isMinimized(),fullscreen:win.isFullScreen(),visible:win.isVisible()
      });
    });
  },nativeShellUrl);
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
    const native=await app.evaluate(({BrowserWindow},url)=>{
      const win=BrowserWindow.getAllWindows().find(w=>!w.getParentWindow()&&w.webContents.getURL()===url);
      return {exists:!!win,minimized:win?.isMinimized(),fullscreen:win?.isFullScreen(),visible:win?.isVisible(),focused:win?.isFocused(),
        bounds:win?.getBounds(),nativeEvents:(globalThis.__identityNativeRestoreEvents??[]).slice(-15)};
    },nativeShellUrl).catch(()=>({unavailable:true}));
    console.error('Native host restore failed to resume shell layout',JSON.stringify({
      rendererTransitions:await shell.evaluate(()=>window.__identityHostTransitionEvents).catch(()=>[]),
      native
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
  const waitForIdentity=async predicate=>{const deadline=Date.now()+10000;while(Date.now()<deadline){const view=await shell.evaluate(()=>window.desktop.identity.view());if(predicate(view))return view;await shell.waitForTimeout(100);}throw new Error('Timed out waiting for the expected clinic identity state.');};
  await signIn('disabled@fixture.invalid');await shell.getByRole('alert').filter({hasText:'denied'}).waitFor();check('disabled fixture identity cannot enter the desktop');
  await signIn('unavailable@fixture.invalid');await shell.getByRole('alert').filter({hasText:'unavailable'}).waitFor();check('unavailable identity service remains gated');
  await signIn();await sessionOptions.waitFor();check('platform sign-in gates ready on resolved clinic access');
  check('V1 omits the in-house Files Explorer and Image Viewer dock apps',await shell.locator('[data-dock-app="files"],[data-window-id="files"],[data-window-id="image-viewer"]').count()===0);
  await shell.locator('.dock-region').screenshot({path:path.join(loginArtifacts,'sajilo-dental-dock-no-files.png'),animations:'disabled'});
  check('status bar and desktop identity/widgets appear only after sign-in',await shell.locator('.desktop-statusbar').count()===1&&await shell.getByRole('region',{name:'Clinic and signed-in user'}).isVisible()&&await shell.getByRole('region',{name:'Desktop widgets'}).isVisible());
  check('status bar identifies the Sajilo Dental desktop when no app is active',await shell.locator('.statusbar-brand').getAttribute('aria-label')==='Sajilo Dental'&&await shell.locator('.statusbar-brand img').evaluate(img=>img.complete&&img.naturalWidth>0));
  const menuBar=shell.locator('.desktop-statusbar');const menuBarStyle=await menuBar.evaluate(e=>{const summary=e.querySelector('.statusbar-role-menu > summary');return{height:e.getBoundingClientRect().height,color:getComputedStyle(e).color,background:getComputedStyle(e).backgroundImage,reduced:matchMedia('(prefers-reduced-transparency: reduce)').matches,items:[...e.querySelectorAll('.statusbar-menu > button')].map(button=>button.innerText),roleMenu:summary?.textContent?.trim(),roleMenuBorder:summary?getComputedStyle(summary).borderTopStyle:'none'};});const chromeCss=await fs.readFile(path.join(root,'src/DesktopChrome.css'),'utf8');const menuBarOkay=menuBarStyle.height>=34&&menuBarStyle.height<=38&&menuBarStyle.color==='rgb(32, 44, 49)'&&menuBarStyle.background.includes('linear-gradient')&&(chromeCss.includes('backdrop-filter:blur(28px) saturate(170%)')||menuBarStyle.reduced)&&menuBarStyle.items.length===0&&menuBarStyle.roleMenu==='Switch role'&&menuBarStyle.roleMenuBorder==='solid';if(!menuBarOkay)console.log('Menu bar diagnostics',JSON.stringify({menuBarStyle,expectedGlassRule:chromeCss.includes('backdrop-filter:blur(28px) saturate(170%)')}));check('menu bar uses Sajilo frosted glass and outlines workspace switching',menuBarOkay);
  check('clinic widget uses the authenticated clinic, user and role',await shell.locator('.clinic-widget-copy').innerText()==='Synthetic clinic\nfirst@fixture.invalid\nDoctor');
  check('status bar and time card expose current date/time',!!await shell.locator('.statusbar-date').getAttribute('datetime')&&!!await shell.locator('.statusbar-time').innerText()&&!!(await shell.locator('.clock-widget-time').getAttribute('aria-label'))?.startsWith('Current time '));
  await shell.getByRole('button',{name:'Explore apps'}).click();await shell.getByRole('dialog',{name:'Explore apps'}).getByRole('button',{name:'App Store'}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="store"]')?.dataset.phase==='visible');check('Dock Explore opens the signed-in app catalog');await shell.getByRole('button',{name:'Close App Store',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="store"]')?.dataset.phase==='closed');await shell.keyboard.press('Backquote');await shell.waitForFunction(()=>document.querySelector('main')?.dataset.overview==='true');check('keyboard overview shortcut opens the shared window overview');await shell.keyboard.press('Escape');await shell.waitForFunction(()=>document.querySelector('main')?.dataset.overview==='false');
  const nepaliCalendar=shell.locator('.nepali-calendar-grid'),gregorianCalendar=shell.locator('.gregorian-calendar-grid');
  const widgetPlacement=await shell.evaluate(()=>{const box=(selector)=>document.querySelector(selector).getBoundingClientRect();const updates=box('.app-updates-widget');return{updatesTop:updates.top,calendarsBottom:Math.max(box('.nepali-calendar-widget').bottom,box('.time-widget').bottom,box('.gregorian-calendar-widget').bottom)}});
  check('calendar and time widgets remain, with the App Updates widget below them',await shell.locator('.desktop-widget-collection .desktop-widget').count()===4&&await shell.getByRole('region',{name:'Nepali calendar'}).isVisible()&&await shell.getByRole('region',{name:'Local time'}).isVisible()&&await shell.getByRole('region',{name:'English calendar'}).isVisible()&&await shell.getByRole('region',{name:'App updates'}).isVisible()&&widgetPlacement.updatesTop>=widgetPlacement.calendarsBottom&&await shell.locator('.calendar-today-line').count()===0);
  const currentBsMonth=await nepaliCalendar.getAttribute('aria-label');check('Nepali calendar highlights today',await nepaliCalendar.locator('[role="gridcell"][aria-selected="true"]').count()===1);await shell.getByRole('button',{name:'Previous Nepali month'}).click();check('Nepali calendar navigates to the previous month',await nepaliCalendar.getAttribute('aria-label')!==currentBsMonth);await shell.getByRole('button',{name:'Next Nepali month'}).click();check('Nepali calendar returns to the current month',await nepaliCalendar.getAttribute('aria-label')===currentBsMonth);
  const currentEnglishMonth=await gregorianCalendar.getAttribute('aria-label');check('Gregorian calendar highlights today',await gregorianCalendar.locator('[role="gridcell"][aria-selected="true"]').count()===1);await shell.getByRole('button',{name:'Previous English month'}).click();check('Gregorian calendar navigates independently',await gregorianCalendar.getAttribute('aria-label')!==currentEnglishMonth&&await nepaliCalendar.getAttribute('aria-label')===currentBsMonth);await shell.getByRole('button',{name:'Next English month'}).click();check('Gregorian calendar returns to the current month',await gregorianCalendar.getAttribute('aria-label')===currentEnglishMonth);
  const glass=await shell.locator('.desktop-widget-collection .desktop-widget').first().evaluate(e=>getComputedStyle(e).backgroundImage);check('calendar cards use a translucent glass surface',glass.includes('linear-gradient')&&glass.includes('rgba'));
  const viewport=shell.viewportSize()??{width:1366,height:768};await shell.setViewportSize({width:580,height:800});await shell.waitForFunction(()=>{const pill=document.querySelector('.dock-pill')?.getBoundingClientRect();return !!pill&&pill.left>=0&&pill.right<=innerWidth;});const compact=await shell.evaluate(()=>{const box=(selector)=>{const r=document.querySelector(selector).getBoundingClientRect();return{top:r.top,bottom:r.bottom,left:r.left,right:r.right,width:r.width,height:r.height};};const icon=box('.dock-icon');const pill=box('.dock-pill');return{bar:box('.desktop-statusbar'),menu:box('.statusbar-menu'),right:box('.statusbar-right'),clinic:box('.desktop-clinic-widget'),widgets:box('.desktop-widget-collection'),icon,pill,height:innerHeight,width:innerWidth};});const menuAndStatusDoNotOverlap=compact.menu.right<=compact.right.left||compact.menu.bottom<=compact.right.top||compact.right.bottom<=compact.menu.top;const compactOkay=compact.bar.bottom<=compact.clinic.top&&menuAndStatusDoNotOverlap&&compact.right.right<=compact.width&&compact.clinic.bottom<compact.widgets.top&&compact.widgets.bottom<compact.height-70&&compact.widgets.left>=0&&compact.widgets.right<=compact.width&&compact.icon.width<36&&compact.icon.width>=20&&compact.pill.bottom<=compact.height&&compact.pill.left>=0&&compact.pill.right<=compact.width;if(!compactOkay)console.log('Compact layout diagnostics',JSON.stringify(compact));check('compact layout stacks widgets, keeps role menu/status clear, and scales dock icons for laptop widths',compactOkay);await shell.setViewportSize(viewport);
  await shell.evaluate(()=>window.dispatchEvent(new Event('offline')));await shell.getByText('Offline',{exact:true}).waitFor();check('status bar shows the OS-reported offline state',await shell.getByText('Offline',{exact:true}).count()===1);await shell.evaluate(()=>window.dispatchEvent(new Event('online')));await shell.getByText('Online',{exact:true}).waitFor();
  check('workspace prototype footnote strip is removed',await shell.locator('.desktop-footnote').count()===0);
  const sessionActionsMenu=shell.locator('.statusbar-role-menu .identity-menu-actions');check('role popup has no session-action group',await sessionActionsMenu.count()===0);
  await sessionOptions.click();const roleChoices=shell.locator('.statusbar-role-menu .workspace-role-actions');await roleChoices.waitFor();const roleChoiceNames=(await roleChoices.getByRole('button').allTextContents()).map(name=>name.trim());const openStatusbarHeight=await menuBar.evaluate(e=>e.getBoundingClientRect().height);const widgetLock=shell.locator('.desktop-clinic-widget').getByRole('button',{name:'Lock workspace',exact:true});const widgetSignOut=shell.locator('.desktop-clinic-widget').getByRole('button',{name:'Sign out',exact:true});const roleMenuOkay=await roleChoices.isVisible()&&roleChoiceNames.length===1&&roleChoiceNames[0]==='Switch to Reception'&&await widgetLock.isVisible()&&await widgetSignOut.isVisible();if(!roleMenuOkay)console.log('Role menu diagnostics',JSON.stringify({roleChoiceNames,sessionActionCount:await sessionActionsMenu.count(),widgetLockCount:await widgetLock.count(),widgetSignOutCount:await widgetSignOut.count()}));check('role popup lists workspace choices only; Lock and sign out stay in clinic info',roleMenuOkay);check('opening the role menu does not expand the status bar',openStatusbarHeight<=38);
  await shell.mouse.click(700,640);await shell.waitForFunction(()=>!document.querySelector('.statusbar-role-menu')?.open);check('role menu closes after clicking outside it');
  await sessionOptions.click();await shell.getByRole('button',{name:'Switch to Reception'}).click();const receptionDialog=shell.getByRole('alertdialog',{name:'Switch to the Reception workspace?'});await receptionDialog.waitFor();await shell.mouse.click(700,640);await receptionDialog.waitFor({state:'detached'});check('workspace confirmation cancels when the backdrop is clicked');
  const roleBefore=await shell.evaluate(()=>window.desktop.identity.view());await sessionOptions.click();await shell.getByRole('button',{name:'Switch to Reception'}).click();const roleSwitchDialog=shell.getByRole('alertdialog',{name:'Switch to the Reception workspace?'});await roleSwitchDialog.getByRole('button',{name:'Switch workspace'}).click();const switchingStatus=shell.getByRole('status',{name:'Switching to the reception workspace'});await switchingStatus.waitFor({state:'visible'});check('role change shows a loading screen instead of the sign-in page',await switchingStatus.isVisible()&&await shell.getByRole('heading',{name:'Switching workspace',exact:true}).isVisible()&&await shell.locator('.identity-gate').count()===0);const reception=await waitForIdentity(view=>view.phase==='ready'&&view.role==='reception'&&view.generation>roleBefore.generation);check('Doctor login switches to the Reception workspace and starts a fresh generation',reception.accountRole==='doctor');const successNotice=shell.getByRole('status',{name:'Reception workspace is active'});await successNotice.waitFor({state:'visible'});check('successful role change confirms the active workspace with a checkmark message',await successNotice.isVisible()&&await successNotice.getByText("You're all set. Enjoy your day!",{exact:true}).isVisible());
  await shell.locator('.statusbar-role-menu > summary').click();await shell.getByRole('button',{name:'Switch to Doctor'}).click();await shell.getByRole('alertdialog',{name:'Switch to the Doctor workspace?'}).getByRole('button',{name:'Switch workspace'}).click();await waitForIdentity(view=>view.phase==='ready'&&view.role==='doctor');check('Reception workspace can switch back to the account role without a PIN');
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});await fs.writeFile(path.join(root,'artifacts','m12-full-fixture-dock.png'),await shell.screenshot());
  const before=await shell.evaluate(()=>window.desktop.identity.view());check('shell view exposes no credential fields',!JSON.stringify(before).match(/fixture-refresh|synthetic-fixture-credential|fixture-pass/));
  await shell.getByRole('button',{name:'Motion Studio',exact:true}).click();await shell.mouse.move(520,320);await shell.waitForFunction(()=>document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase==='ready');const studioWindow=shell.locator('[data-window-id="studio"]');check('Motion Studio opens as the active managed app',await studioWindow.isVisible()&&await studioWindow.getAttribute('data-active')==='true'&&await studioWindow.locator('.window-title').innerText()==='Motion Studio');
  const alpha=app.context().pages().find(p=>p.url().startsWith('dental-fixture://alpha/'));
  const c=await alpha.evaluate(()=>window.dentalApp.connect({major:1,minor:0}));check('app shares platform sign-in without password/token or shell Files transfer getter',c.ok&&c.value.generation===before.generation&&await alpha.evaluate(()=>!window.desktop&&Object.keys(window.dentalApp).sort().join()==='cancel,connect,getAppInfo,navigation,onModuleSelected,openAppExplorer,report,request'));
  await alpha.evaluate(()=>localStorage.setItem('private-session-canary','sensitive-fixture-storage'));
  await alpha.getByLabel('Your draft').fill('sensitive-fixture-draft');await shell.getByRole('button',{name:'Minimize Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]').dataset.phase==='minimized');
  await shell.locator('.desktop-clinic-widget').getByRole('button',{name:'Lock workspace',exact:true}).click();await shell.getByRole('heading',{name:'Session locked'}).waitFor();
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
  await shell.getByRole('button',{name:'Minimize Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]')?.dataset.phase==='minimized');
  await shell.locator('.desktop-clinic-widget').getByRole('button',{name:'Sign out',exact:true}).click();await shell.getByRole('alertdialog',{name:'Sign out of Sajilo Dental?'}).getByRole('button',{name:'Sign out',exact:true}).click();await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
  check('logout destroys guest runtimes and clears authority',(await shell.evaluate(()=>window.desktop.identity.view())).phase==='signed-out'&&await app.evaluate(({webContents})=>webContents.getAllWebContents().every(w=>!w.getURL().startsWith('dental-fixture:'))));
  await signIn('admin@fixture.invalid');await sessionOptions.waitFor();await waitForIdentity(view=>view.phase==='ready'&&view.role==='admin');
  await sessionOptions.click();await shell.getByRole('button',{name:'Switch to Reception'}).click();const leaveAdminDialog=shell.getByRole('alertdialog',{name:'Switch to the Reception workspace?'});await leaveAdminDialog.getByRole('button',{name:'Switch workspace'}).click();await waitForIdentity(view=>view.phase==='ready'&&view.role==='reception');check('Admin can leave without configuring a PIN');
  await sessionOptions.click();await shell.getByRole('button',{name:'Switch to Admin'}).click();const returnToAdmin=shell.getByRole('alertdialog',{name:'Switch to the Admin workspace?'});await returnToAdmin.getByLabel('Four-digit Admin PIN').fill('1111');await returnToAdmin.getByRole('button',{name:'Switch to Admin'}).click();await returnToAdmin.getByText('The role or PIN was rejected. Check your access and try again.').waitFor();check('incorrect Admin PIN is rejected without changing workspace', (await shell.evaluate(()=>window.desktop.identity.view())).role==='reception');await returnToAdmin.getByLabel('Four-digit Admin PIN').fill('9876');await returnToAdmin.getByRole('button',{name:'Switch to Admin'}).click();await waitForIdentity(view=>view.phase==='ready'&&view.role==='admin');check('fixed Admin PIN returns the user to Admin workspace');
  await shell.locator('.desktop-clinic-widget').getByRole('button',{name:'Sign out',exact:true}).click();await shell.getByRole('alertdialog',{name:'Sign out of Sajilo Dental?'}).getByRole('button',{name:'Sign out',exact:true}).click();await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();
  check('signed-out form retains the remembered account identifier and keeps window controls available',await shell.getByLabel('Email',{exact:true}).inputValue()==='admin@fixture.invalid'&&await shell.getByRole('button',{name:'Close Sajilo Dental'}).isVisible());
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
