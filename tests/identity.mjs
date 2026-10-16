import { profileArgs } from './profile.mjs';
import { verifyIdentity } from './identity-scenario.mjs';
await verifyIdentity(profileArgs,'identity-verification.json');
