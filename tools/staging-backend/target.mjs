export const target = Object.freeze({ account: '03453ad990acaaa56336e5851e24f490', worker: 'dentmitra-api-cloudfare-staging', control: '55ac8b32-9c22-46c5-ab05-45988adff79f', project: 'dental-managemetn-staging', base: 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev' });
export function configuration(source, settings, registry) {
  if (source.name !== target.worker || source.vars?.APP_ENV !== 'cloudfare-staging' || source.vars?.FIREBASE_PROJECT_ID !== target.project) throw Error('Source target is not staging');
  const bindings = settings.bindings;
  if (!Array.isArray(bindings) || bindings.some(b => !['d1','r2_bucket','plain_text','secret_text'].includes(b.type)) || new Set(bindings.map(b => b.name)).size !== bindings.length) throw Error('Unexpected Worker binding');
  const vars = Object.fromEntries(bindings.filter(b => b.type === 'plain_text').map(b => [b.name, b.text]));
  if (vars.APP_ENV !== 'cloudfare-staging' || vars.FIREBASE_PROJECT_ID !== target.project) throw Error('Live target is not staging');
  const d1 = bindings.filter(b => b.type === 'd1');
  if (d1.filter(b => b.name === 'CONTROL_DB' && (b.id ?? b.database_id) === target.control).length !== 1) throw Error('Wrong staging Control D1');
  const known = new Map(registry.map(row => [row.binding_name, row.database_id]));
  for (const binding of d1) if (binding.name !== 'CONTROL_DB' && (!/^CLINIC_[A-F0-9]{16}$/.test(binding.name) || known.get(binding.name) !== (binding.id ?? binding.database_id))) throw Error('Clinic binding not in staging registry');
  const r2 = bindings.filter(b => b.type === 'r2_bucket'), required = { PRIVATE_BUCKET: 'dentmitra-private-cloudfare-staging', DENTAL_OS_RELEASES: 'dentmitra-dental-os-releases-cloudfare-staging', DENTAL_OS_APP_DISTRIBUTION: 'dental-app-distribution', DENTAL_OS_DISTRIBUTION: 'dental-os-distribution', DENTAL_OS_ARTWORK: 'dentmitra-dental-os-artwork-cloudfare-staging' };
  if (r2.length !== Object.keys(required).length || r2.some(b => required[b.name] !== b.bucket_name)) throw Error('Wrong staging R2 scope');
  if (settings.compatibility_date && settings.compatibility_date !== source.compatibility_date) throw Error('Compatibility date changed');
  return { ...source, account_id: target.account, vars, d1_databases: d1.map(b => ({ binding: b.name, database_name: b.name, database_id: b.id ?? b.database_id })), r2_buckets: r2.map(b => ({ binding: b.name, bucket_name: b.bucket_name })) };
}
