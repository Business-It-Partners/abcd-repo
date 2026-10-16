/** Source/config mapping verified at dental-saas origin/cloudfare-staging on 2026-10-16.
 * No credential, production fallback, catalogue or download destination is configured here. */
export const staging = Object.freeze({
  environment: 'cloudfare-staging',
  repository: 'Business-It-Partners/dental-saas',
  branch: 'cloudfare-staging',
  githubEnvironment: 'cloudfare-staging',
  workflow: '.github/workflows/cloudfare-staging-deploy.yml',
  sourceCommit: '76447b93155a2b9bcb52887efa1ba0b73c361630',
  apiBase: 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev',
  worker: 'dentmitra-api-cloudfare-staging',
  firebaseProject: 'dental-managemetn-staging',
  controlD1: 'dentmitra-control-cloudfare-staging',
  controlD1Id: '55ac8b32-9c22-46c5-ab05-45988adff79f',
  privateR2: 'dentmitra-private-cloudfare-staging',
  catalogue: null,
  downloads: null,
} as const);
export type Environment = typeof staging;
export function bindEnvironment(input: unknown): Environment {
  if (!input || typeof input !== 'object' || Object.keys(input).sort().join() !== Object.keys(staging).sort().join() || Object.entries(staging).some(([k, v]) => (input as Record<string, unknown>)[k] !== v)) throw new Error('Unmapped environment');
  return staging;
}
