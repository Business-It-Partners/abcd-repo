// Run with tools/run-ui-test.mjs. Linux ASAR smoke proof, not Windows certification.
import { fixtureArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const asar=path.join(root,'release/windows/win-unpacked/resources/app.asar');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const app=await electron.launch({args:[asar,...fixtureArgs],env});
const page=await app.firstWindow(),checks=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
const check=(name,value)=>{assert.ok(value,name);checks.push(name);console.log('PASS',name);};
const phase=value=>page.waitForFunction(value=>document.querySelector('[data-window-id="followups"]').dataset.phase===value,value);
try {
 const host=await app.evaluate(({app,screen})=>({appPath:app.getAppPath(),version:app.getVersion(),platform:process.platform,display:screen.getPrimaryDisplay().bounds}));
 check('Linux host launches the exact ASAR bundled for Windows',host.appPath===asar&&host.platform==='linux');
 await page.waitForFunction(bounds=>innerWidth===bounds.width&&innerHeight===bounds.height,host.display);
 check('Packaged preload bridge loads without exposing Node',await page.evaluate(()=>typeof window.desktop?.control==='function'&&typeof window.require==='undefined'));
 await page.waitForFunction(()=>document.querySelector('.wallpaper')?.complete&&[...document.querySelectorAll('.dock-artwork')].every(image=>image.complete&&image.naturalWidth>0));
 check('Packaged wallpaper and app artwork load from relative ASAR paths',await page.locator('.dock-artwork').count()>0&&await page.getByRole('button',{name:'Follow-ups',exact:true}).locator('img').evaluate(image=>image.complete&&image.naturalWidth>0));
 await page.getByRole('button',{name:'Follow-ups',exact:true}).click();await phase('visible');
 const frame=page.getByTestId('followups-window');
 check('Packaged Follow-ups renders demo data',await frame.getByRole('table',{name:'Follow-ups',exact:true}).isVisible()&&await frame.getByRole('checkbox',{name:'Call Kalpana Shrestha',exact:true}).count()===1);
 await frame.getByRole('button',{name:'Create follow-up',exact:true}).click();
 await frame.getByLabel('Patient name',{exact:true}).fill('Packaged draft');
 await page.evaluate(()=>window.desktop.onHostTransition(value=>{window.packageHostTransition=value;}));
 await page.getByRole('button',{name:'Minimize Electron OS',exact:true}).click();
 await page.waitForTimeout(150);
 check('Packaged native minimize works on the isolated Linux host',await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isMinimized()));
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].restore());
 await page.waitForFunction(()=>window.packageHostTransition===false);
 check('Packaged restore retains the open form draft',await frame.getByLabel('Patient name',{exact:true}).inputValue()==='Packaged draft');
 await page.keyboard.press('Escape');
 await page.screenshot({path:path.join(root,'artifacts/windows-package-linux-smoke.png')});
 check('No packaged renderer exceptions',errors.length===0);
 await fs.writeFile(path.join(root,'artifacts/windows-package-linux-smoke.json'),JSON.stringify({host,checks,errors,limitation:'ASAR smoke run on Linux; Windows EXE/installer not executed.'},null,2)+'\n');
} finally { await app.close(); }
