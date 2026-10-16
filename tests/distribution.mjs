import { profileArgs } from './profile.mjs';
import { verifyDistribution } from './distribution-scenario.mjs';
await verifyDistribution(profileArgs,'distribution-verification.json');
