/** Staging company samples only. Public base remains unconfigured until approved R2 rollout. */
import { operations } from '../sdk/contracts';
import type { DistributionConfig } from './service';
export const stagingKeyId = 'company-staging-m07-20261016';
export const stagingDistribution: DistributionConfig = {
 apiBase: 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev',
 publicBase: null,
 policy: { keys: { [stagingKeyId]: { publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAEWtgyVLsULX0Zl8ZzypDXHjSC2FT0RgUQoaI/q2x7iE=\n-----END PUBLIC KEY-----\n", publisher: 'company' } }, apps: {
  'company.sample.alpha': { publisher: 'company', capabilities: operations.filter(o => !o.startsWith('appointments.')) },
  'company.sample.beta': { publisher: 'company', capabilities: operations.filter(o => !o.startsWith('appointments.')) },
 } },
};
