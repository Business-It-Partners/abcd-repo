/** Staging company samples only. Public origin verified during the authorized M07 staging rollout. */
import { operations } from '../sdk/contracts';
import type { DistributionConfig } from './service';
export const stagingKeyId = 'company-staging-m07-20261016';
export const stagingDistribution: DistributionConfig = {
 updates: true,
 apiBase: 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev',
 publicBase: 'https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev',
 policy: { keys: { 'company-staging-m08-20261016': { publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEANjpu00Rwhyl+ig7+JjWGEZUi3h/cY5XV4Lb9kW7UWiU=\n-----END PUBLIC KEY-----\n", publisher: 'company' }, [stagingKeyId]: { publicKey: "-----BEGIN PUBLIC KEY-----\nMCowBQYDK2VwAyEAEWtgyVLsULX0Zl8ZzypDXHjSC2FT0RgUQoaI/q2x7iE=\n-----END PUBLIC KEY-----\n", publisher: 'company' } }, apps: {
  'company.sample.alpha': { publisher: 'company', capabilities: operations.filter(o => !o.startsWith('appointments.')) },
  'company.sample.beta': { publisher: 'company', capabilities: operations.filter(o => !o.startsWith('appointments.')) },
 } },
};
