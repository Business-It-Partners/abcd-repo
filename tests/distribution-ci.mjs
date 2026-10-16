if(process.platform!=='win32'||process.env.GITHUB_ACTIONS!=='true'||process.env.RUNNER_OS!=='Windows')throw new Error('GitHub Windows runner required');
import { mkdtemp,rm } from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {verifyDistribution} from './distribution-scenario.mjs';
const profile=await mkdtemp(path.join(tmpdir(),'dental-distribution-ci-'));
try{await verifyDistribution([`--user-data-dir=${profile}`],'windows-distribution.json');}finally{await rm(profile,{recursive:true,force:true,maxRetries:10,retryDelay:200});}
