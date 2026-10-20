import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
const root=path.resolve(import.meta.dirname,'..'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[root,...profileArgs],env}),page=await app.firstWindow(),checks=[];
async function contrast(selector,minimum=4.5){
 const result=await page.locator(selector).first().evaluate(element=>{
  const rgb=value=>value.match(/[\d.]+/g).map(Number),lum=color=>{const values=rgb(color).slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return values[0]*.2126+values[1]*.7152+values[2]*.0722;};
  const style=getComputedStyle(element);let parent=element,background;const layers=[];
  while(parent){const parts=rgb(getComputedStyle(parent).backgroundColor);layers.push(parts);if(parts.length===3||parts[3]===1)break;parent=parent.parentElement;}let composed=[255,255,255];for(const parts of layers.reverse()){const alpha=parts[3]??1;composed=composed.map((v,i)=>parts[i]*alpha+v*(1-alpha));}background=`rgb(${composed.join(',')})`;
  if(!background)throw Error('No opaque background');const a=lum(style.color),b=lum(background);return {color:style.color,background,ratio:(Math.max(a,b)+.05)/(Math.min(a,b)+.05)};
 });assert.ok(result.ratio>=minimum,`${selector}: ${result.ratio}`);checks.push({selector,minimum,...result});console.log('PASS contrast',selector,result.ratio.toFixed(2));
}
try{
 const display=await app.evaluate(({screen})=>screen.getPrimaryDisplay().bounds);await page.waitForFunction(b=>innerWidth===b.width&&innerHeight===b.height,display);
 await page.getByRole('button',{name:'Staff',exact:true}).click();for(const selector of ['.staff-heading h2','.staff-heading p','.staff-table-wrap thead th','.staff-footer','.staff-primary','.staff-role.support','.staff-role.helper','.staff-table-wrap td small'])await contrast(selector);
 await page.screenshot({path:path.join(root,'artifacts/clarity-staff.png')});
 await page.getByRole('button',{name:'Add staff',exact:true}).click();await contrast('.staff-modal label');await contrast('.staff-modal .form-context');await contrast('.staff-modal input');await page.screenshot({path:path.join(root,'artifacts/clarity-form.png')});await page.getByRole('button',{name:'Close staff dialog'}).click();
 await page.getByRole('button',{name:'Follow-ups',exact:true}).click();for(const selector of ['.followups-heading p','.followups-card.today strong','.followups-card small','.followups-table-scroll thead th','.followups-table-scroll td small','.followups-primary','.followups-session'])await contrast(selector);await page.screenshot({path:path.join(root,'artifacts/clarity-followups.png')});
 await page.getByRole('button',{name:'Finance',exact:true}).click();await contrast('.app-explorer-item span');await contrast('.app-explorer-heading h2');await page.screenshot({path:path.join(root,'artifacts/clarity-finance.png')});
 await page.getByRole('button',{name:'Appointments',exact:true}).click();await contrast('.coming-soon-body p');await page.keyboard.press('Backquote');await contrast('.overview-heading p');await page.screenshot({path:path.join(root,'artifacts/clarity-overview.png')});
 await fs.writeFile(path.join(root,'artifacts/clarity-verification.json'),JSON.stringify({checks},null,2));
}finally{await app.close();}
