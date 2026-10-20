if (process.platform !== 'win32' || process.env.GITHUB_ACTIONS !== 'true' || process.env.RUNNER_OS !== 'Windows') throw Error('GitHub Windows runner required');
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { verifyRuntimeLimitResources } from './resources-limit-scenario.mjs';

const profile = await mkdtemp(path.join(tmpdir(), 'dental-resources-limit-ci-'));
try {
  await verifyRuntimeLimitResources([`--user-data-dir=${profile}`, '--runtime-fixtures', '--runtime-app-count=16'], 'windows-resources-limit.json');
} finally {
  await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
}
