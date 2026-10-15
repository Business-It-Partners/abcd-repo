import { profileArgs } from '../tests/profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const root = '/home/master-x/Desktop/fewa_business_os';
const env = {...process.env}; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({args:[root,...profileArgs],env});
const page = await app.firstWindow();
const report = [];
try {
 const display = await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);
 await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 const cdp=await page.context().newCDPSession(page);
 for (const [width,height] of [[1366,768],[1920,1080]]) {
  await cdp.send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
  await page.reload();
  await page.waitForFunction(()=>document.querySelector('.wallpaper')?.naturalWidth>0);
  await page.getByRole('button',{name:'Records',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-window-id="records"]').dataset.phase==='visible');
  await page.mouse.move(15,44);
  await page.waitForFunction(()=>Math.abs(document.querySelector('.dock-icon').getBoundingClientRect().width-36)<.1);
  const measurement=await page.evaluate(()=>{
   const rect=s=>{const b=document.querySelector(s).getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom};};
   const window=rect('[data-window-id="records"]'),dock=rect('.dock-pill');
   return {viewport:{width:innerWidth,height:innerHeight},window,dock,topGap:window.y,windowDockGap:dock.y-window.bottom,dockBottomMargin:innerHeight-dock.bottom,iconWidth:rect('.dock-icon').width};
  });
  assert.ok(Math.abs(measurement.topGap-4)<.1);
  assert.ok(Math.abs(measurement.windowDockGap-8)<.1);
  assert.ok(Math.abs(measurement.dockBottomMargin-8)<.1);
  const handle=page.locator('[data-window-id="records"] [data-resize="s"]');
  await handle.hover();
  assert.ok(await handle.evaluate(e=>{const b=e.getBoundingClientRect();return document.elementFromPoint(b.x+b.width/2,b.y+b.height/2)===e;}));
  await page.mouse.move(15,44);
  await page.waitForFunction(()=>Math.abs(document.querySelector('.dock-icon').getBoundingClientRect().width-36)<.1);
  await page.screenshot({path:`${root}/artifacts/dock-system-menu-layout-${width}.png`});
  await page.getByRole('button',{name:'Electron OS menu',exact:true}).click();
  const menu=await page.getByRole('menu',{name:'Electron OS',exact:true}).boundingBox();
  assert.ok(menu.x>=0 && menu.y>=0 && menu.x+menu.width<=width && menu.y+menu.height<height);
  await page.screenshot({path:`${root}/artifacts/dock-system-menu-${width}.png`});
  await page.keyboard.press('Escape');
  report.push({...measurement,menu});
 }
 await fs.writeFile(`${root}/artifacts/dock-system-menu-layout-verification.json`,JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
} finally {await app.close();}
