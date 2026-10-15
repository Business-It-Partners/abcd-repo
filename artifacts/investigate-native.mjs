import { profileArgs } from '../tests/profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:['/home/master-x/Desktop/fewa_business_os',...profileArgs],env});
const page=await app.firstWindow();
try{
 await page.waitForTimeout(300);
 await app.evaluate(({BrowserWindow})=>{
  globalThis.nativeEvents=[];
  const win=BrowserWindow.getAllWindows()[0];
  for(const event of ['minimize','restore','resize','move','focus','blur','enter-full-screen','leave-full-screen'])win.on(event,()=>globalThis.nativeEvents.push({event,time:Date.now(),bounds:win.getBounds(),fullscreen:win.isFullScreen(),minimized:win.isMinimized()}));
  for(const method of ['setBounds','setFullScreen','focus','restore','minimize']){
   const original=win[method].bind(win);win[method]=(...args)=>{globalThis.nativeEvents.push({method,args,time:Date.now()});return original(...args);};
  }
 });
 await page.evaluate(()=>{
  window.nativeRendererEvents=[];
  for(const event of ['resize','blur','focus','visibilitychange'])window.addEventListener(event,()=>window.nativeRendererEvents.push({event,time:Date.now(),width:innerWidth,height:innerHeight,visibility:document.visibilityState}));
 });
 await page.getByRole('button',{name:'Motion Studio',exact:true}).click();
 await page.locator('#note').fill('native retention probe');
 await page.getByRole('button',{name:'Electron OS menu',exact:true}).click();
 await page.getByRole('menuitem',{name:'Minimize Electron OS',exact:true}).click();
 await new Promise(r=>setTimeout(r,600));
 const minimized=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized());
 await app.evaluate(({BrowserWindow})=>{BrowserWindow.getAllWindows()[0].restore();});
 await page.waitForTimeout(500);
 const report={minimized,native:await app.evaluate(()=>globalThis.nativeEvents),renderer:await page.evaluate(()=>window.nativeRendererEvents),note:await page.locator('#note').inputValue()};
 await fs.writeFile('artifacts/native-headless.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{await app.close();}
