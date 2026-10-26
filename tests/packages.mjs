import { profileArgs } from './profile.mjs';
import { verifyPackages } from './packages-scenario.mjs';
await verifyPackages(profileArgs, 'm19-packages-recovery-verification.json');
