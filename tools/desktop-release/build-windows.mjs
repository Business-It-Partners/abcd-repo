import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../..');
const env={...process.env,CSC_IDENTITY_AUTO_DISCOVERY:'false',ELECTRON_BUILDER_COMPRESSION_LEVEL:'5',GOMAXPROCS:'2',NODE_OPTIONS:'--max-old-space-size=1536'};
// Build helpers must never connect to the live desktop or trigger an upload.
for(const key of ['DISPLAY','WAYLAND_DISPLAY','DBUS_SESSION_BUS_ADDRESS','ELECTRON_RUN_AS_NODE'])delete env[key];
const prefix=[];
if(process.platform==='linux') {
 const available=Number(readFileSync('/proc/meminfo','utf8').match(/^MemAvailable:\s+(\d+)/m)[1])*1024;
 if(available<2.5*1024**3)throw new Error('Less than 2.5 GiB memory available. Close other heavy tasks before packaging.');
 const allowed=readFileSync('/proc/self/status','utf8').match(/^Cpus_allowed_list:\s+(.+)$/m)[1].split(',').flatMap(part=>{const [a,b]=part.split('-').map(Number);return Array.from({length:(b??a)-a+1},(_,i)=>a+i);}).slice(0,2);
 prefix.push('nice','-n','10','taskset','-c',allowed.join(','));
}
function run(args) {
 const command=prefix[0]??process.execPath;
 const rest=prefix.length?[...prefix.slice(1),process.execPath,...args]:args;
 const result=spawnSync(command,rest,{cwd:root,env,stdio:'inherit',timeout:900_000});
 if(result.error)throw result.error;
 if(result.status!==0)process.exit(result.status??1);
}
const builder=['tools/desktop-release/package-windows.mjs'];
if(process.argv.includes('--prebuilt')) {
 // Packaging-only retry with already built assets; still never publish.
 run([...builder,'--prepackaged']);
} else {
 if(!process.env.npm_execpath)throw new Error('Run npm run dist:windows from the repository root.');
 run([process.env.npm_execpath,'run','build']);
 run(builder);
}
