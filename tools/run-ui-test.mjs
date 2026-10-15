import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..'),scripts=process.argv.slice(2);
if(!scripts.length)throw new Error('Provide one or more UI test scripts.');
if(!existsSync('/usr/bin/gnome-shell')||!existsSync('/usr/bin/dbus-run-session'))throw new Error('Isolated UI tests require GNOME headless and dbus-run-session. Tests never fall back to your desktop.');
const runtime=mkdtempSync(path.join(tmpdir(),'electron-os-display-'));
for(const folder of ['config','data','cache'])mkdirSync(path.join(runtime,folder));
const socket='electron-ui-tests';
const base={...process.env,XDG_RUNTIME_DIR:runtime,XDG_CONFIG_HOME:path.join(runtime,'config'),XDG_DATA_HOME:path.join(runtime,'data'),XDG_CACHE_HOME:path.join(runtime,'cache'),XDG_SESSION_TYPE:'wayland',GDK_BACKEND:'wayland',LIBGL_ALWAYS_SOFTWARE:'1',LP_NUM_THREADS:'2',XDG_CURRENT_DESKTOP:'GNOME',NO_AT_BRIDGE:'1'};
for(const key of ['DISPLAY','WAYLAND_DISPLAY','DBUS_SESSION_BUS_ADDRESS','ELECTRON_RUN_AS_NODE','SESSION_MANAGER'])delete base[key];
let server,child;
const cleanup=()=>{child?.kill('SIGTERM');if(server?.pid){try{process.kill(-server.pid,'SIGTERM');}catch{}}};
process.once('exit',cleanup);
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{cleanup();process.exit(130);});
try{
 server=spawn('nice',['-n','10','dbus-run-session','--','gnome-shell','--wayland','--headless','--no-x11','--virtual-monitor=1366x768','--wayland-display='+socket],{env:base,detached:true,stdio:['ignore','ignore','pipe']});
 let errors='';server.stderr.on('data',data=>{errors=(errors+data).slice(-6000);});
 let ready=false;
 for(let n=0;n<100;n++){
  await new Promise(resolve=>setTimeout(resolve,100));
  if(server.exitCode!==null)throw new Error(`Headless compositor exited: ${errors}`);
  if(existsSync(path.join(runtime,socket))){ready=true;break;}
 }
 if(!ready)throw new Error(`Headless compositor startup timed out: ${errors}`);
 const env={...base,WAYLAND_DISPLAY:socket,ELECTRON_OS_TEST_DISPLAY:path.join(runtime,socket)};
 console.log('UI tests isolated on a private headless GNOME display; your desktop is untouched.');
 for(const script of scripts){
  child=spawn('nice',['-n','10',process.execPath,path.resolve(root,script)],{cwd:root,env,stdio:'inherit'});
  const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolve(code??(signal?1:0)));});
  child=undefined;
  if(code!==0){process.exitCode=code;break;}
 }
}finally{cleanup();await new Promise(resolve=>setTimeout(resolve,150));rmSync(runtime,{recursive:true,force:true});}
