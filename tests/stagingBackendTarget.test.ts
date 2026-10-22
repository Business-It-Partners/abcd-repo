import { describe, expect, it } from 'vitest';
import { configuration, target } from '../tools/staging-backend/target.mjs';
const source = { name: target.worker, compatibility_date: '2026-09-25', vars: { APP_ENV: 'cloudfare-staging', FIREBASE_PROJECT_ID: target.project } };
const registry = [{ binding_name: 'CLINIC_AAAAAAAAAAAAAAAA', database_id: 'staging-clinic-id' }];
const settings = { compatibility_date: source.compatibility_date, bindings: [
  { type: 'plain_text', name: 'APP_ENV', text: 'cloudfare-staging' }, { type: 'plain_text', name: 'FIREBASE_PROJECT_ID', text: target.project },
  { type: 'd1', name: 'CONTROL_DB', id: target.control }, { type: 'd1', name: registry[0].binding_name, id: registry[0].database_id },
  { type: 'r2_bucket', name: 'PRIVATE_BUCKET', bucket_name: 'dentmitra-private-cloudfare-staging' }, { type: 'r2_bucket', name: 'DENTAL_OS_RELEASES', bucket_name: 'dentmitra-dental-os-releases-cloudfare-staging' },
  { type: 'secret_text', name: 'EXISTING_SECRET' },
] };
describe('staging-only backend deployment target', () => {
  it('preserves exact live D1/R2/vars without inventing secret values', () => { const result = configuration(source, settings, registry); expect(result.d1_databases).toHaveLength(2); expect(result.r2_buckets).toHaveLength(2); expect(JSON.stringify(result)).not.toContain('EXISTING_SECRET'); });
  it.each(['worker', 'project', 'control', 'clinic', 'bucket', 'duplicate', 'unknown', 'compatibility'])('rejects changed or unreviewed %s authority', kind => {
    const s = structuredClone(source), live: any = structuredClone(settings);
    if (kind === 'worker') s.name = 'production'; if (kind === 'project') live.bindings[1].text = 'production'; if (kind === 'control') live.bindings[2].id = 'production';
    if (kind === 'clinic') live.bindings[3].id = 'foreign-id'; if (kind === 'bucket') live.bindings[4].bucket_name = 'production'; if (kind === 'duplicate') live.bindings.push(live.bindings[0]);
    if (kind === 'unknown') live.bindings.push({ type: 'service', name: 'UNREVIEWED' }); if (kind === 'compatibility') live.compatibility_date = '2026-10-22';
    expect(() => configuration(s, live, registry)).toThrow();
  });
});
