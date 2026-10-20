import {profileArgs} from './profile.mjs';
import {verifyOnboarding} from './onboarding-scenario.mjs';
await verifyOnboarding(profileArgs,'app-onboarding-verification.json');
