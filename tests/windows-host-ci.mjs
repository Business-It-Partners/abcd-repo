// Hosted Windows CI only. This is not a live-desktop test entry point.
if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'Windows') {
  throw new Error('This check requires a GitHub-hosted Windows runner.');
}
import { _electron as electron } from 'playwright';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const profile=await mkdtemp(path.join(tmpdir(),'dental-windows-ci-'));
const root=path.resolve(import.meta.dirname,'..');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const checks=[];let app;
const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const launch=async()=>{app=await electron.launch({args:[root,`--user-data-dir=${profile}`],env,timeout:30000});return app.firstWindow();};
try {
 let page=await launch();await page.waitForFunction(()=>!!window.desktop);
 check('host ready',(await page.evaluate(()=>window.desktop.status())).phase==='ready');
 await page.evaluate(()=>window.desktop.preferences({overviewShortcutEnabled:false}));
 await app.close();app=undefined;
 page=await launch();await page.waitForFunction(()=>!!window.desktop);
 check('preference survives restart',!(await page.evaluate(()=>window.desktop.preferences())).overviewShortcutEnabled);
 await app.close();app=undefined;
 const file=path.join(profile,'state','preferences.json');await writeFile(file,'corrupt');
 page=await launch();await page.getByRole('heading',{name:'Sajilo Dental needs recovery'}).waitFor();
 check('safe recovery without preload',await page.evaluate(()=>window.desktop===undefined));
 check('corrupt state retained',(await readFile(file,'utf8'))==='corrupt');
} finally {
 if(app)await app.close();
 await rm(profile,{recursive:true,force:true});
 await mkdir(path.join(root,'artifacts'),{recursive:true});
 await writeFile(path.join(root,'artifacts/windows-host-ci.json'),JSON.stringify({sha:process.env.GITHUB_SHA,platform:process.platform,checks,scope:'GitHub Windows runner automation; physical device acceptance deferred'},null,2));
}
