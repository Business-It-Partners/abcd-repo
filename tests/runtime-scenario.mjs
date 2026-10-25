import { execFileSync } from 'node:child_process';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifyRuntime(profileArgs, reportName) {
 const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const app=await electron.launch({args:[root,...profileArgs,'--runtime-fixtures'],env,timeout:30000});
 const checks=[],errors=[],runtimeEvents=[];let topology;const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
 const shell=await app.firstWindow();
 const attachPageDiagnostics=page=>{
  const kind=page===shell?'shell':'app';
  page.on('pageerror',error=>{if(kind==='shell')errors.push(error.message);else if(runtimeEvents.length<80)runtimeEvents.push({type:'app-pageerror',message:error.message.slice(0,500)});});
  page.on('console',message=>{if(kind==='app'&&message.type()==='error'&&runtimeEvents.length<80)runtimeEvents.push({type:'app-console-error',message:message.text().slice(0,500)});});
 };
 for(const page of app.context().pages())attachPageDiagnostics(page);
 app.context().on('page',attachPageDiagnostics);
 await app.evaluate(({app})=>{
  globalThis.__m15RuntimeEvents=[];
  app.on('web-contents-created',(_event,wc)=>{
   const id=wc.id;
   wc.on('did-fail-load',(_loadEvent,errorCode,errorDescription,validatedURL,isMainFrame)=>globalThis.__m15RuntimeEvents.push({type:'did-fail-load',id,errorCode,errorDescription,validatedURL,isMainFrame}));
   wc.on('render-process-gone',(_goneEvent,details)=>globalThis.__m15RuntimeEvents.push({type:'render-process-gone',id,details}));
  });
 });
 const nativePointerMoves=[];
 async function movePointer(page,x,y,host){
  if(process.platform==='win32'){
   if(process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_OS!=='Windows'||process.env.CI!=='true')throw Error('Native pointer input requires the isolated hosted Windows CI job');
   const point=await app.evaluate(({BrowserWindow,screen},{x,y,host})=>{
    const win=BrowserWindow.getAllWindows()[0],content=win.getContentBounds();
    const view=host?win.contentView.children.find(child=>child.webContents?.getURL().startsWith(`dental-fixture://${host}/`)):undefined;
    if(host&&!view)throw Error('Native pointer target missing');
    const bounds=view?.getBounds()??{x:0,y:0};
    const dip={x:Math.round(content.x+bounds.x+x),y:Math.round(content.y+bounds.y+y)};
    return{dip,physical:screen.dipToScreenPoint(dip),before:screen.getCursorScreenPoint()};
   },{x,y,host});
   for(const n of [point.physical.x,point.physical.y])if(!Number.isSafeInteger(n)||Math.abs(n)>20000)throw Error('Native pointer coordinate bound');
   // CDP moves only Chromium's injected pointer. A native child handoff can
   // resume the real Windows cursor at its old position. Align both input
   // sources so the test exercises the same native mouse path as a user.
   const source='using System; using System.Runtime.InteropServices; public static class DentalCiPointer { [DllImport("user32.dll", SetLastError=true)] public static extern bool SetCursorPos(int x,int y); [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr value); }';
   const script=`$ErrorActionPreference='Stop'; Add-Type -TypeDefinition '${source}'; [void][DentalCiPointer]::SetProcessDpiAwarenessContext([IntPtr]::new(-4)); if(-not [DentalCiPointer]::SetCursorPos(${point.physical.x},${point.physical.y})){throw 'Native CI pointer move failed'}`;
   execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,timeout:10000,stdio:'pipe'});
   const actual=await app.evaluate(({screen})=>screen.getCursorScreenPoint());
   assert.ok(Math.abs(actual.x-point.dip.x)<=2&&Math.abs(actual.y-point.dip.y)<=2,'OS cursor must match injected runtime input');
   nativePointerMoves.push({host:host??'shell',...point,actual});
  }
  await page.mouse.move(x,y);
 }
 const moveShell=(x,y)=>movePointer(shell,x,y);
 const moveGuest=(page,host,x,y)=>movePointer(page,x,y,host);
 // Runtime fixtures stay hidden while a dock item is hovered; move to shell
 // chrome after the click so the native runtime can take over, as it does when
 // a user moves from the dock into the app window.
 const activateDockApp=async name=>{
  await shell.getByRole('button',{name,exact:true}).click();
  await moveShell(10,10);
 };
 const state=id=>shell.locator(`[data-runtime="${id}"]`);
 const geometryTolerance=2,geometryMatches=(actual,expected)=>Math.abs(actual-expected)<=geometryTolerance;
 const ready=async id=>{
  try{return await shell.waitForFunction(id=>document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase==='ready',id,{timeout:25000});}
  catch(error){
   const diagnostic=await Promise.all([
    shell.evaluate(async id=>{const element=document.querySelector(`[data-runtime="${id}"]`);return{surface:element?{phase:element.dataset.runtimePhase,reason:element.dataset.runtimeReason,message:element.querySelector('.runtime-failure')?.innerText??null}:null,status:await window.desktop?.status().catch(error=>({error:String(error)})),body:document.body.innerText.slice(0,2000),buttons:[...document.querySelectorAll('button')].slice(0,50).map(button=>({label:button.getAttribute('aria-label'),text:button.innerText.slice(0,100),disabled:button.disabled}))};},id),
    app.evaluate(({webContents})=>({contents:webContents.getAllWebContents().filter(wc=>wc.getURL().startsWith('dental-fixture:')).map(wc=>({id:wc.id,url:wc.getURL(),title:wc.getTitle(),destroyed:wc.isDestroyed(),crashed:wc.isCrashed?.()??null,processId:wc.getOSProcessId()})),events:globalThis.__m15RuntimeEvents??[]})),
   ]).then(([shellState,processes])=>({runtimeId:id,shell:shellState,processes,errors:[...errors]}));
   runtimeEvents.push(diagnostic);
   await shell.screenshot({path:path.join(root,'artifacts','runtime-startup-failed.png')});
   console.error('RUNTIME STARTUP DIAGNOSTIC',JSON.stringify(diagnostic));
   throw new Error(`${error.message}; runtime startup diagnostic ${JSON.stringify(diagnostic)}`);
  }
 };
 const native=()=>app.evaluate(({webContents,BrowserWindow})=>({shell:BrowserWindow.getAllWindows()[0].webContents.getOSProcessId(),apps:webContents.getAllWebContents().filter(w=>w.getURL().startsWith('dental-fixture:')).map(w=>({id:w.id,url:w.getURL(),pid:w.getOSProcessId(),prefs:{sandbox:w.getLastWebPreferences().sandbox,contextIsolation:w.getLastWebPreferences().contextIsolation,nodeIntegration:w.getLastWebPreferences().nodeIntegration}}))}));
 const nativeView=host=>app.evaluate(({BrowserWindow},host)=>{const view=BrowserWindow.getAllWindows()[0].contentView.children.find(child=>child.webContents?.getURL().startsWith(`dental-fixture://${host}/`));if(!view)return null;const b=view.getBounds();return{visible:view.getVisible(),bounds:{x:b.x,y:b.y,width:b.width,height:b.height}};},host);
 async function waitNativeView(host,predicate){for(let i=0;i<100;i++){const view=await nativeView(host);if(predicate(view))return view;await new Promise(r=>setTimeout(r,20));}throw new Error(`Native app view did not settle: ${host} ${JSON.stringify(await nativeView(host))}`);}
 async function dragWindow(id,dx,dy){const frame=shell.locator(`[data-testid="${id}-window"]`),b=await frame.boundingBox(),viewport=await shell.evaluate(()=>({width:innerWidth,height:innerHeight}));const x=Math.max(2,Math.min(viewport.width-2,b.x+b.width/2)),y=Math.max(35,Math.min(viewport.height-2,b.y+21));await moveShell(x,y);await shell.mouse.down();await shell.waitForFunction(id=>document.querySelector(`[data-testid="${id}-window"]`).dataset.interaction==='moving',id);await shell.mouse.move(x+dx,y+dy,{steps:8});await shell.mouse.up();await shell.waitForFunction(id=>document.querySelector(`[data-testid="${id}-window"]`).dataset.interaction==='idle',id);return frame.boundingBox();}
 async function expectedNative(host){const surface=shell.locator(`[data-runtime="${host==='alpha'?'studio':'records'}"]`),r=await surface.boundingBox(),dockTop=await shell.locator('.window-stage').evaluate(e=>e.getBoundingClientRect().bottom);const y=Math.max(0,Math.round(r.y)),height=Math.min(Math.max(1,Math.round(r.height)),Math.floor(dockTop-y));return{x:Math.round(r.x),y,width:Math.max(1,Math.round(r.width)),height};}
 async function waitExpectedNative(host){const expected=await expectedNative(host);try{return await waitNativeView(host,v=>v?.visible&&geometryMatches(v.bounds.x,expected.x)&&geometryMatches(v.bounds.y,expected.y)&&geometryMatches(v.bounds.width,expected.width)&&geometryMatches(v.bounds.height,expected.height));}catch(error){throw new Error(`Expected native app bounds ${JSON.stringify(expected)}; ${error.message}`);}}
 async function mirrorCenterPixel(id){return shell.locator(`[data-runtime="${id}"] .isolated-mirror`).evaluate(image=>{const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;const context=canvas.getContext('2d');context.drawImage(image,0,0);return [...context.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data];});}
 async function guest(host){for(let n=0;n<60;n++){const p=app.context().pages().find(p=>p.url().startsWith(`dental-fixture://${host}/`));if(p)return p;await new Promise(r=>setTimeout(r,50));}throw new Error('Guest page missing: '+app.context().pages().map(p=>p.url()).join(','));}
 async function shot(name){const image=await shell.evaluate(()=>window.desktop.capture({x:0,y:0,width:innerWidth,height:innerHeight}));await fs.writeFile(path.join(root,'artifacts',name),Buffer.from(image.split(',')[1],'base64'));}
 try {
  await activateDockApp('Motion Studio');await ready('studio');let alpha=await guest('alpha');
  await waitExpectedNative('alpha');
  const initialNative=await nativeView('alpha');assert.ok(initialNative?.visible);await alpha.waitForFunction(({width,height,tolerance})=>Math.abs(innerWidth-width)<=tolerance&&Math.abs(innerHeight-height)<=tolerance,{...initialNative.bounds,tolerance:geometryTolerance});
  await shell.waitForFunction(()=>{const image=document.querySelector('[data-runtime="studio"] .isolated-mirror');return image?.complete&&image.naturalWidth>0;});
  await alpha.evaluate(()=>{const marker=document.createElement('div');marker.id='module-preview-probe';Object.assign(marker.style,{position:'fixed',inset:'0',zIndex:'2147483647',pointerEvents:'none',background:'rgb(20,220,80)'});document.body.append(marker);});
  await alpha.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const alphaSize=await alpha.evaluate(()=>({width:innerWidth,height:innerHeight})),shellSize=await shell.evaluate(()=>({width:innerWidth,height:innerHeight}));
  // Windows can route the first post-hide move in shell coordinates, so keep
  // that injected point inside the shell reveal band too. Linux retains the
  // guest's translated offset and uses its original safe inset.
  const edgeY=process.platform==='win32'?Math.min(alphaSize.height-24,shellSize.height-150):alphaSize.height-80;
  if(process.platform==='win32')check('dock-edge input stays inside both guest and shell hover bands',edgeY>=alphaSize.height-160&&edgeY>=shellSize.height-170&&edgeY<alphaSize.height);
  await alpha.evaluate(()=>{window.__runtimeEdgeTrace=[];window.addEventListener('pointermove',event=>{if(event.clientY>=innerHeight-200)window.__runtimeEdgeTrace.push({x:event.clientX,y:event.clientY,height:innerHeight,trusted:event.isTrusted});});});
  await shell.evaluate(()=>{window.__runtimeDockEdgeEvents=0;window.__runtimeShellPointerTrace=[];window.addEventListener('runtime:dock-edge',()=>window.__runtimeDockEdgeEvents++);window.addEventListener('pointermove',event=>{window.__runtimeShellPointerTrace.push({x:event.clientX,y:event.clientY,trusted:event.isTrusted});if(window.__runtimeShellPointerTrace.length>20)window.__runtimeShellPointerTrace.shift();},true);});
  await shell.waitForTimeout(180);
  await app.evaluate(({BrowserWindow},host)=>{const view=BrowserWindow.getAllWindows()[0].contentView.children.find(child=>child.webContents?.getURL().startsWith(`dental-fixture://${host}/`));if(!view)throw new Error('Native app view missing');const webContents=view.webContents,original=webContents.capturePage.bind(webContents);webContents.capturePage=async(...args)=>{webContents.capturePage=original;await new Promise(resolve=>setTimeout(resolve,400));return original(...args);};},'alpha');
  await moveGuest(alpha,'alpha',alphaSize.width/2,edgeY);
  try{await waitNativeView('alpha',view=>view&&!view.visible);}catch(error){const diagnostics={guest:await alpha.evaluate(()=>({width:innerWidth,height:innerHeight,edgeMoves:window.__runtimeEdgeTrace})),shell:await shell.evaluate(()=>({width:innerWidth,height:innerHeight,dockTop:document.querySelector('.window-stage')?.getBoundingClientRect().bottom,dockEdgeEvents:window.__runtimeDockEdgeEvents,pointerMoves:window.__runtimeShellPointerTrace})),native:await nativeView('alpha'),cursor:await app.evaluate(({screen})=>screen.getCursorScreenPoint()),nativePointerMoves};throw new Error(`${error.message}; edge diagnostics ${JSON.stringify(diagnostics)}`);}
  await shell.waitForTimeout(60);
  check('dock-edge handoff keeps the last app frame visible until its replacement is captured',await state('studio').locator('.isolated-mirror').count()===1&&await state('studio').locator('.runtime-message').count()===0);
  await shell.waitForTimeout(520);
  const edgePreviewPixel=await mirrorCenterPixel('studio');
  check('dock-edge app frame refreshes to current content after the OS hides its native surface',edgePreviewPixel[1]>150&&edgePreviewPixel[0]<100&&edgePreviewPixel[2]<150);
  await moveShell(20,20);await waitNativeView('alpha',view=>view?.visible);
  check('moving away from the dock edge restores the same live app surface',await alpha.evaluate(()=>!!document.querySelector('#module-preview-probe')));
  await alpha.evaluate(()=>document.querySelector('#module-preview-probe')?.remove());
  await alpha.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await moveGuest(alpha,'alpha',alphaSize.width/2,edgeY);await waitNativeView('alpha',view=>view&&!view.visible);await shell.waitForTimeout(160);
  await moveShell(20,20);await waitNativeView('alpha',view=>view?.visible);
  await shell.getByRole('button',{name:'Finance',exact:true}).click();
  const financeExplorer=shell.getByTestId('finance-explorer');await financeExplorer.waitFor();
  const hiddenForExplorer=await waitNativeView('alpha',view=>view&&!view.visible);
  check('Finance explorer covers the native app surface instead of appearing beside it',!!hiddenForExplorer);
  check('Finance explorer receives keyboard focus above the native app',await shell.waitForFunction(()=>document.querySelector('.app-explorer')?.contains(document.activeElement)).then(()=>true));
  await moveShell(680,(await shell.evaluate(()=>innerHeight))-150);await new Promise(resolve=>setTimeout(resolve,120));
  const nativeNearDock=await nativeView('alpha');
  await moveShell(20,20);await new Promise(resolve=>setTimeout(resolve,180));
  const nativeAwayFromDock=await nativeView('alpha');
  check('Finance explorer stays in front as the pointer moves near and away from the dock',!nativeNearDock?.visible&&!nativeAwayFromDock?.visible&&await financeExplorer.isVisible());
  await shot('finance-explorer-over-native.png');
  await shell.keyboard.press('Escape');await financeExplorer.waitFor({state:'detached'});
  const restoredAfterExplorer=await waitExpectedNative('alpha');
  check('Closing Finance explorer restores the foreground native app surface',restoredAfterExplorer.visible);
  await activateDockApp('Records');await ready('records');const beta=await guest('beta');
  const inactiveMirror=shell.locator('[data-runtime="studio"] .isolated-mirror');
  await inactiveMirror.waitFor();
  await shell.waitForFunction(()=>{const image=document.querySelector('[data-runtime="studio"] .isolated-mirror');return image?.complete&&image.naturalWidth>0;});
  check('covered app preview keeps native capture resolution without CSS blur',await inactiveMirror.evaluate(image=>image.naturalWidth>=image.clientWidth&&getComputedStyle(image).filter==='none'&&getComputedStyle(image).backdropFilter==='none'));
  check('covered app window keeps its existing shadow',await shell.locator('[data-testid="studio-window"]').evaluate(frame=>getComputedStyle(frame).boxShadow!=='none'));
  topology=await native();check('two isolated renderer processes and separate shell',topology.apps.length===2&&new Set([topology.shell,...topology.apps.map(w=>w.pid)]).size===3);
  check('sandbox/context isolation and no Node',topology.apps.every(w=>w.prefs.sandbox&&w.prefs.contextIsolation&&!w.prefs.nodeIntegration));
  check('apps have no Node, shell bridge or Files transfer API',await beta.evaluate(()=>typeof window.require==='undefined'&&typeof window.desktop==='undefined'&&Object.keys(window.dentalApp).sort().join()==='cancel,connect,getAppInfo,navigation,onModuleSelected,openAppExplorer,report,request'));
  await alpha.evaluate(()=>localStorage.setItem('isolation','alpha-only'));
  check('storage is separated by app',await beta.evaluate(()=>localStorage.getItem('isolation'))===null);
  await shell.getByRole('button',{name:'Open apps catalog'}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="store"]')?.dataset.phase==='visible');
  const desktopFrame=await shell.evaluate(()=>window.desktop.capture({x:0,y:250,width:20,height:20}));
  const corner=await app.evaluate(({nativeImage},data)=>{const pixel=nativeImage.createFromDataURL(data).getBitmap();return [...pixel.slice(0,3)];},desktopFrame);
  check('switching from an isolated app to a shell window hides its native surface before paint',Math.max(...corner)<190);
  await shell.getByRole('button',{name:'Close App Store',exact:true}).click();
  check('forged report rejected',await beta.evaluate(()=>{try{window.dentalApp.report({dirty:false,modal:false,id:'studio'});return false;}catch{return true;}}));
  check('network and cross-origin fetch denied',await beta.evaluate(async()=>{for(const url of ['http://127.0.0.1:9/','dental-fixture://alpha/app.js','file:///etc/passwd']){try{await fetch(url);return false;}catch{}}return true;}));
  await beta.evaluate(()=>window.open('https://example.com'));check('popup denied',app.context().pages().length===3);
  check('unknown runtime IDs/layouts denied',await shell.evaluate(async()=>{try{await window.desktop.runtime.sync([{id:'forged'}]);return false;}catch{return true;}}));
  await beta.getByLabel('Your draft').fill('beta-kept-in-memory');await shell.waitForFunction(()=>document.querySelector('[data-runtime="records"]').dataset.dirty==='true');
  await beta.getByRole('button',{name:'Open local dialog'}).click();await beta.getByRole('dialog').waitFor();
  check('modal stays in app content',await shell.locator('[data-window-id="records"] .mac-titlebar').evaluate(e=>e.inert));
  await beta.keyboard.press('Tab');check('local modal traps keyboard focus',await beta.evaluate(()=>document.activeElement.id)==='dismiss');
  await activateDockApp('Motion Studio');
  check('beta-to-alpha switch focuses the native foreground',await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).isFocused()));
  await alpha.getByLabel('Your draft').fill('alpha-independent');
  await activateDockApp('Records');
  check('alpha-to-beta switch focuses the native foreground',await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://beta/')).isFocused()));
  await beta.getByRole('button',{name:'Close dialog'}).click();
  await shell.getByRole('button',{name:'Close Records',exact:true}).click();await shell.getByRole('dialog',{name:'Unsaved app work'}).waitFor();
  await shell.getByRole('button',{name:'Keep working',exact:true}).click();check('dirty close cancellation preserves draft',await beta.getByLabel('Your draft').inputValue()==='beta-kept-in-memory');
  await activateDockApp('Motion Studio');
  const handle=shell.locator('[data-window-id="studio"] [data-resize="se"]'),before=await handle.boundingBox();
  await moveShell(before.x+before.width/2,before.y+before.height/2);await shell.mouse.down();await shell.mouse.move(before.x+before.width/2+60,before.y+before.height/2+25,{steps:4});await shell.mouse.up();
  await ready('studio');check('resize uses shared manager',await shell.locator('[data-window-id="studio"]').evaluate(e=>e.getBoundingClientRect().width)>760);
  await shot('runtime-overlap.png');
  // A resize can end in the dock hover band. Leave it and wait for the native
  // surface before sending a key to that app; ready alone is not visibility.
  await moveShell(20,20);await waitExpectedNative('alpha');
  await alpha.getByLabel('Your draft').click();
  check('overview shortcut starts in the visible focused native app',await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).isFocused()));
  await app.evaluate(({webContents})=>{const wc=webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/'));globalThis.__runtimeShortcutInputs=[];wc.on('before-input-event',(_event,input)=>{globalThis.__runtimeShortcutInputs.push({type:input.type,key:input.key,code:input.code,shift:input.shift,control:input.control});if(globalThis.__runtimeShortcutInputs.length>16)globalThis.__runtimeShortcutInputs.shift();});});
  await shell.evaluate(()=>{window.__runtimeForwardedKeys=[];window.addEventListener('keydown',e=>{window.__runtimeForwardedKeys.push({key:e.key,code:e.code,trusted:e.isTrusted});if(window.__runtimeForwardedKeys.length>16)window.__runtimeForwardedKeys.shift();},true);});
  await alpha.keyboard.press('Backquote');
  try{await shell.getByRole('dialog',{name:'Open windows'}).waitFor();}catch(error){throw Error(`${error.message}; shortcut native diagnostics ${JSON.stringify({native:await nativeView('alpha'),focused:await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).isFocused()),nativePointerMoves,inputs:await app.evaluate(()=>globalThis.__runtimeShortcutInputs),shell:await shell.evaluate(()=>({overview:document.querySelector('main.desktop')?.dataset.overview,keys:window.__runtimeForwardedKeys}))})}`);}
  await shell.waitForFunction(()=>document.querySelectorAll('.overview-card .isolated-mirror').length===2);
  check('overview contains both isolated snapshots',await shell.locator('.overview-card .isolated-mirror').count()===2);
  check('overview clones have no runtime identities',await shell.locator('.overview-card [data-runtime]').count()===0);
  await shell.getByRole('button',{name:'Switch to Records',exact:true}).click();
  await shell.getByRole('button',{name:'Maximize Records',exact:true}).click();
  await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.presentation==='fullscreen');
  const expected=await shell.locator('[data-runtime="records"]').boundingBox();assert.ok(expected);
  check('maximized native app fills the viewport while keeping the app title bar below the Dental OS status-bar row',await shell.evaluate(tolerance=>{const close=(actual,expected)=>Math.abs(actual-expected)<=tolerance,frame=document.querySelector('[data-window-id="records"]'),surface=document.querySelector('[data-runtime="records"]'),status=document.querySelector('.desktop-statusbar').getBoundingClientRect(),title=frame.querySelector('.mac-titlebar').getBoundingClientRect(),f=frame.getBoundingClientRect(),s=surface.getBoundingClientRect();return close(f.top,0)&&close(f.bottom,innerHeight)&&close(f.width,innerWidth)&&close(title.top,status.height)&&close(s.top,title.bottom)&&close(s.bottom,innerHeight);},geometryTolerance));
  const maximizedNative=await waitExpectedNative('beta');
  check('fullscreen native content bounds extend to the screen edge underneath the dock',maximizedNative.visible&&geometryMatches(maximizedNative.bounds.y+maximizedNative.bounds.height,(await shell.evaluate(()=>innerHeight))));
  const fullWindowBeforeChrome=await shell.locator('[data-window-id="records"]').boundingBox();
  await moveShell((await shell.evaluate(()=>innerWidth))/2,2);
  await shell.waitForFunction(()=>document.querySelector('.desktop-statusbar')?.classList.contains('chrome-shown'));
  check('top-edge status bar reveals over a stable fullscreen native window',await shell.locator('[data-window-id="records"]').boundingBox().then(r=>geometryMatches(r.y,fullWindowBeforeChrome.y)&&geometryMatches(r.height,fullWindowBeforeChrome.height)));
  await shot('m12-maximized-window.png');
  // React presentation changes before native layout/guest resize acknowledgement.
  await beta.waitForFunction(({w,h})=>innerWidth===w&&innerHeight===h,{w:Math.round(expected.width),h:Math.round(expected.height)});
  const size=await beta.evaluate(()=>({w:innerWidth,h:innerHeight}));
  await moveGuest(beta,'beta',size.w/2,size.h/2);await moveGuest(beta,'beta',size.w/2,size.h-80);
  await shell.waitForFunction(()=>!document.querySelector('.dock-region').inert);check('native app bottom edge reveals fullscreen dock');
  check('bottom-edge dock overlays the native app without shrinking its frame',await shell.locator('[data-window-id="records"]').boundingBox().then(r=>geometryMatches(r.y,fullWindowBeforeChrome.y)&&geometryMatches(r.height,fullWindowBeforeChrome.height)));
  await shell.getByRole('button',{name:'Restore Records size',exact:true}).click();
  await moveShell(10,10);
  await shell.getByRole('button',{name:'Minimize Records',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.phase==='minimized');
  check('Genie thumbnail contains captured native app',await shell.locator('[data-preview-app="records"] img').count()>0 || await shell.locator('[aria-label="Restore Records"] img').count()>0);
  await shell.getByRole('button',{name:'Restore Records',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.phase==='visible');
  check('minimize/restore retains isolated draft and process',await beta.getByLabel('Your draft').inputValue()==='beta-kept-in-memory'&&(await native()).apps.find(w=>w.url.includes('beta')).pid===topology.apps.find(w=>w.url.includes('beta')).pid);
  await shell.getByRole('button',{name:'Close Records',exact:true}).click();await shell.getByRole('button',{name:'Discard and close',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.phase==='closed');
  check('discard destroys the app webContents',(await native()).apps.length===1);
  await activateDockApp('Records');await ready('records');const betaNew=await guest('beta');
  check('reopen creates clean workflow state',await betaNew.getByLabel('Your draft').inputValue()==='');
  await activateDockApp('Motion Studio');
  await alpha.evaluate(()=>{location.href='https://example.com';});await alpha.waitForTimeout(100);check('external navigation denied',alpha.url().startsWith('dental-fixture://alpha/'));
  await app.evaluate(({webContents})=>webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).forcefullyCrashRenderer());
  await shell.locator('[data-runtime="studio"] [role="alert"]').waitFor();
  check('crash is contained to alpha',await betaNew.getByLabel('Your draft').inputValue()===''&&(await shell.evaluate(()=>window.desktop.status())).phase==='ready');
  await shot('runtime-crash.png');
  await shell.getByRole('button',{name:'Restart app',exact:true}).click();await ready('studio');alpha=await guest('alpha');
  await app.evaluate(({webContents})=>{void webContents.getAllWebContents().find(w=>w.getURL().startsWith('dental-fixture://alpha/')).executeJavaScript('while(true){}').catch(()=>{});});
  await shell.locator('[data-runtime="studio"] [role="alert"]').waitFor({timeout:10000});
  check('watchdog terminates hung renderer without stopping beta',await shell.locator('[data-runtime="studio"]').getAttribute('data-runtime-phase')==='unresponsive'&&await betaNew.getByLabel('Your draft').inputValue()==='');
  for(let i=0;i<3;i++){
   if(i===0)await shell.getByRole('button',{name:'Restart app',exact:true}).click();else await activateDockApp('Motion Studio');await ready('studio');
   await shell.getByRole('button',{name:'Close Motion Studio',exact:true}).click();await shell.waitForFunction(()=>document.querySelector('[data-window-id="studio"]').dataset.phase==='closed');
   check(`cleanup cycle ${i+1}: no closed sample webContents`,(await native()).apps.length===1);
  }
  await activateDockApp('Records');await waitExpectedNative('beta');
  const recordsFrame=shell.locator('[data-testid="records-window"]'),originalBounds=await recordsFrame.boundingBox();
  const viewport=await shell.evaluate(()=>({width:innerWidth,height:innerHeight}));
  const frameBox=await recordsFrame.boundingBox(),dragX=Math.max(2,Math.min(viewport.width-2,frameBox.x+frameBox.width/2)),dragY=Math.max(35,Math.min(viewport.height-2,frameBox.y+21));
  await moveShell(dragX,dragY);await shell.mouse.down();await shell.waitForFunction(()=>document.querySelector('[data-testid="records-window"]').dataset.interaction==='moving');
  const hiddenDuringDrag=await nativeView('beta');check('native app surface hides synchronously when window movement starts',!!hiddenDuringDrag&&!hiddenDuringDrag.visible);
  await shell.waitForFunction(()=>{const image=document.querySelector('[data-runtime="records"] .isolated-mirror');return image?.complete&&image.naturalWidth>0;});
  check('moving window uses its crisp full-resolution app preview',await state('records').locator('.isolated-mirror').evaluate(image=>image.naturalWidth>=image.clientWidth&&getComputedStyle(image).filter==='none'&&getComputedStyle(image).backdropFilter==='none'));
  await shot('runtime-drag-preview.png');
  await shell.mouse.move(dragX-2000,dragY,{steps:8});await shell.mouse.up();await shell.waitForFunction(()=>document.querySelector('[data-testid="records-window"]').dataset.interaction==='idle');
  let edgeBounds=await recordsFrame.boundingBox(),edgeView=await waitExpectedNative('beta');
  const leftSurface=await state('records').boundingBox();
  check('left-edge native surface keeps the window origin and full content width',edgeBounds.x<0&&geometryMatches(edgeBounds.x+edgeBounds.width*.7,0)&&geometryMatches(edgeView.bounds.x,leftSurface.x)&&geometryMatches(edgeView.bounds.width,leftSurface.width));
  await shot('runtime-edge-left.png');
  edgeBounds=await dragWindow('records',2000,0);edgeView=await waitExpectedNative('beta');
  check('right-edge native surface follows its window without extending its frame',edgeBounds.x>0&&geometryMatches(edgeBounds.x+edgeBounds.width*.3,viewport.width)&&geometryMatches(edgeView.bounds.x,(await state('records').boundingBox()).x)&&edgeView.bounds.x+edgeView.bounds.width>viewport.width);
  await shot('runtime-edge-right.png');
  const dockTop=await shell.locator('.window-stage').evaluate(e=>e.getBoundingClientRect().bottom);
  edgeBounds=await dragWindow('records',0,10000);edgeView=await waitExpectedNative('beta');
  check('bottom-edge native content ends at the dock-zone boundary',edgeBounds.y+edgeBounds.height*.3<=dockTop-11&&geometryMatches(edgeView.bounds.y+edgeView.bounds.height,dockTop));
  await shot('runtime-edge-bottom.png');
  edgeBounds=await recordsFrame.boundingBox();await dragWindow('records',originalBounds.x-edgeBounds.x,originalBounds.y-edgeBounds.y);edgeView=await waitExpectedNative('beta');
  check('returning the window onscreen restores its live native surface',edgeView.visible&&edgeView.bounds.x>=0&&edgeView.bounds.y+edgeView.bounds.height<=dockTop+geometryTolerance);
  check('edge dragging leaves no selected app text',!await shell.evaluate(()=>window.getSelection()?.toString())&&!await betaNew.evaluate(()=>window.getSelection()?.toString()));
  check('no shell renderer errors',errors.length===0);
  return {checks,topology,errors,platform:process.platform,sha:process.env.GITHUB_SHA??null};
 } finally {
  await fs.mkdir(path.join(root,'artifacts'),{recursive:true});
  await fs.writeFile(path.join(root,'artifacts',reportName),JSON.stringify({nativePointerMoves,runtimeEvents,checks,topology,errors,platform:process.platform,sha:process.env.GITHUB_SHA??null},null,2));
  // The temporary fixture profile has only synthetic state. Exit the test app
  // directly so the desktop's user-facing quit confirmation cannot hang CI.
  const closed=app.waitForEvent('close',{timeout:5000}).then(()=>true,()=>false);
  await app.evaluate(({app})=>app.exit(0)).catch(()=>{});
  if(!await closed&&app.process().exitCode===null)app.process().kill('SIGTERM');
 }
}
