import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const app=await electron.launch({args:[process.cwd(),...profileArgs],env});
try{
 const page=await app.firstWindow();await page.getByRole('button',{name:'App Store',exact:true}).click();const frame=page.getByTestId('store-window');await frame.getByRole('button',{name:'Details Calendar',exact:true}).click();
 // Pause effects as soon as inserted, so slow software screenshots cannot miss the flight.
 await page.evaluate(()=>{new MutationObserver(()=>{document.querySelectorAll('.store-celebration *').forEach(el=>el.getAnimations().forEach(a=>a.pause()));}).observe(document.body,{childList:true,subtree:true});});
 await frame.getByRole('button',{name:'Get',exact:true}).click();await page.locator('.store-arrival').waitFor();
 const samples=[];
 for(const [name,time] of [['lift',250],['flight',950],['landing',1630]]){
  await page.evaluate(t=>document.querySelectorAll('.store-celebration *').forEach(el=>el.getAnimations().forEach(a=>{a.pause();a.currentTime=t;})),time);
  await page.screenshot({path:`artifacts/store-paused-${name}.png`});
  samples.push(await page.locator('.store-arrival').evaluate(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {rect:{x:r.x,y:r.y,width:r.width,height:r.height},position:s.position,opacity:s.opacity,zIndex:s.zIndex,transform:s.transform,viewport:[innerWidth,innerHeight]};}));
 }
 await fs.writeFile('artifacts/store-visual-inspection.json',JSON.stringify(samples,null,2));
}finally{await app.close();}
