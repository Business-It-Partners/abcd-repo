// Optional live staging desktop acceptance. Never runs in default suites/Windows CI.
import {profileArgs} from './profile.mjs';
import {_electron as electron} from 'playwright';
import fs from 'node:fs/promises';
if(process.env.DENTAL_OS_STAGING_ACCEPTANCE!=='true'||!process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE)throw new Error('Explicit approved staging desktop acceptance required');
const file=process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE,s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||(s.mode&0o077)!==0||s.size>4096)throw new Error('Unsafe credential input');
const credentials=JSON.parse(await fs.readFile(file,'utf8')),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.DEBUG;delete env.PWDEBUG;
const checks=[];let app,passed=false,phase='launch';
try{
 app=await electron.launch({args:[process.cwd(),...profileArgs,'--identity-staging'],env,timeout:30000});const shell=await app.firstWindow();
 await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();await shell.waitForFunction(()=>document.querySelector('[data-session-phase]')?.dataset.sessionPhase==='signed-out');checks.push('real staging mode starts gated');phase='sign-in';
 await shell.getByLabel('Email',{exact:true}).fill(credentials.email);await shell.getByLabel('Password',{exact:true}).fill(credentials.password);await shell.getByRole('button',{name:'Sign in',exact:true}).click();
 await shell.getByRole('complementary',{name:'Session controls'}).waitFor({timeout:15000});const v=await shell.evaluate(()=>window.desktop.identity.view());if(v.phase!=='ready'||v.mode!=='staging'||v.remembered)throw new Error('Not authorized staging session');checks.push('actual desktop sign-in reaches Worker-authorized staging workspace without remember-me');
 phase='lock';await shell.getByRole('button',{name:'Lock',exact:true}).click();await shell.getByRole('heading',{name:'Session locked'}).waitFor();const locked=await shell.evaluate(()=>window.desktop.identity.view());if(locked.userLabel||locked.clinicLabel||locked.generation<=v.generation)throw new Error('Lock privacy failure');checks.push('real session lock clears context and advances generation');
 phase='logout';await shell.evaluate(()=>window.desktop.identity.action('logout'));await shell.getByRole('heading',{name:'Sign in to your clinic'}).waitFor();checks.push('real desktop local logout returns to sign-in');passed=true;
}catch{console.log('Live desktop acceptance failed in phase:',phase);}
finally{credentials.password=undefined;if(app)await app.close();await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/identity-staging-desktop.json',JSON.stringify({passed,phase,checks,scope:'Private Linux desktop with approved staging identity; no business operations, user mutations or global revocation.'},null,2));}
if(!passed)process.exitCode=1;
