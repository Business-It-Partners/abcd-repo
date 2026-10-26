import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {npmVersionFromUserAgent,toolchainMismatch} from './toolchain.mjs';
const root=fileURLToPath(new URL('../..',import.meta.url));
const expected={node:readFileSync(new URL('../../.node-version',import.meta.url),'utf8').trim()};
if(!/^\\d+\\.\\d+\\.\\d+$/.test(expected.node))throw Error('Invalid .node-version');
let npm=npmVersionFromUserAgent(process.env.npm_config_user_agent??process.env.NPM_CONFIG_USER_AGENT);
if(!npm){
 const command=process.platform==='win32'?'npm.cmd':'npm';
 const result=spawnSync(command,['--version'],{cwd:root,encoding:'utf8',shell:process.platform==='win32',timeout:15000});
 if(result.error)throw result.error;
 if(result.status!==0)throw Error('Cannot determine npm version.');
 npm=result.stdout.trim();
}
const error=toolchainMismatch(expected,{node:process.versions.node,npm});
if(error){console.error(error);process.exitCode=1;}
else console.log(`M15 Windows toolchain verified: Node.js ${expected.node}, npm ${npm}.`);
