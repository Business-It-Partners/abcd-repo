import { profileArgs } from './profile.mjs';
import { verifyPackages } from './packages-scenario.mjs';
await verifyPackages(profileArgs, 'packages-verification.json');
