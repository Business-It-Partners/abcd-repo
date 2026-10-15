import { profileArgs } from './profile.mjs';
import { verifyRuntime } from './runtime-scenario.mjs';
await verifyRuntime(profileArgs,'runtime-verification.json');
