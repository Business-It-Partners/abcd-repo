const appIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const appVersionPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const capabilityPattern = /^[a-z0-9][a-z0-9_.-]{0,99}$/;
const iconPathPattern = /^\/assets\/dock\/[a-z0-9-]+\.webp$/;
const appAssetPathPattern = /^\/apps\/[a-z0-9.-]+\.(?:html|js|css)$/;
const apiPathPattern = /^\/v1\/(?:[a-z0-9-]+\/)*[a-z0-9-]+(?:\/\{uuid\})?$/;
const uuidPathPattern = /^\/v1\/treatment-protocols\/([0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12})$/i;
const sha256Pattern = /^[a-f0-9]{64}$/;

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function hasOnlyKeys(value, keys) {
  return isRecord(value) && Object.keys(value).every((key) => keys.includes(key))
    && keys.every((key) => Object.hasOwn(value, key));
}

function isLocalPath(path, pattern, baseOrigin) {
  if (typeof path !== 'string' || !pattern.test(path) || path.includes('..') || path.includes('\\')) return false;
  try {
    const resolved = new URL(path, baseOrigin);
    return resolved.origin === new URL(baseOrigin).origin && resolved.pathname === path
      && !resolved.search && !resolved.hash;
  } catch {
    return false;
  }
}

export function isValidAppDescriptor(app, baseOrigin) {
  if (!hasOnlyKeys(app, ['id', 'title', 'icon', 'version', 'capabilities', 'bundle', 'apiGrants'])) return false;
  if (typeof app.id !== 'string' || !appIdPattern.test(app.id)) return false;
  if (typeof app.title !== 'string' || app.title.trim() !== app.title || app.title.length < 1 || app.title.length > 64) return false;
  if (!isLocalPath(app.icon, iconPathPattern, baseOrigin)) return false;
  if (typeof app.version !== 'string' || !appVersionPattern.test(app.version)) return false;
  if (!Array.isArray(app.capabilities) || app.capabilities.length < 1 || app.capabilities.length > 16
    || !app.capabilities.every((capability) => typeof capability === 'string' && capabilityPattern.test(capability))
    || new Set(app.capabilities).size !== app.capabilities.length) return false;
  if (!isRecord(app.bundle)) return false;
  const bundleKeys = Object.keys(app.bundle);
  const requiredBundleKeys = ['entry', 'entrySha256', 'script', 'scriptSha256'];
  if (!requiredBundleKeys.every((key) => Object.hasOwn(app.bundle, key))
    || bundleKeys.some((key) => ![...requiredBundleKeys, 'style', 'styleSha256'].includes(key))
    || (Object.hasOwn(app.bundle, 'style') !== Object.hasOwn(app.bundle, 'styleSha256'))) return false;
  if (!isLocalPath(app.bundle.entry, appAssetPathPattern, baseOrigin)
    || !app.bundle.entry.endsWith('.html')) return false;
  if (!isLocalPath(app.bundle.script, appAssetPathPattern, baseOrigin)
    || !app.bundle.script.endsWith('.js')) return false;
  if (typeof app.bundle.entrySha256 !== 'string' || !sha256Pattern.test(app.bundle.entrySha256)
    || typeof app.bundle.scriptSha256 !== 'string' || !sha256Pattern.test(app.bundle.scriptSha256)) return false;
  if (Object.hasOwn(app.bundle, 'style')
    && (!isLocalPath(app.bundle.style, appAssetPathPattern, baseOrigin) || !app.bundle.style.endsWith('.css')
      || typeof app.bundle.styleSha256 !== 'string' || !sha256Pattern.test(app.bundle.styleSha256))) return false;
  if (!Array.isArray(app.apiGrants) || app.apiGrants.length > 32) return false;
  const seenGrants = new Set();
  for (const grant of app.apiGrants) {
    if (!hasOnlyKeys(grant, ['method', 'path']) || !['GET', 'POST', 'PUT'].includes(grant.method)
      || typeof grant.path !== 'string' || !apiPathPattern.test(grant.path)
      || grant.path.includes('..') || grant.path.includes('\\')) return false;
    const protocolRoute = grant.path === '/v1/treatment-protocols';
    const protocolItemTemplate = grant.path === '/v1/treatment-protocols/{uuid}';
    if (app.id === 'protocols'
      ? !(protocolRoute && ['GET', 'POST'].includes(grant.method) || protocolItemTemplate && grant.method === 'PUT')
      : grant.method !== 'GET' || grant.path.includes('{')) return false;
    const key = `${grant.method} ${grant.path}`;
    if (seenGrants.has(key)) return false;
    seenGrants.add(key);
  }
  return true;
}

export function isValidAppCatalog(appCatalog, baseOrigin) {
  if (!Array.isArray(appCatalog) || appCatalog.length < 1 || appCatalog.length > 32) return false;
  const ids = new Set();
  for (const app of appCatalog) {
    if (!isValidAppDescriptor(app, baseOrigin) || ids.has(app.id)) return false;
    ids.add(app.id);
  }
  return true;
}

export function visibleAppsForCapabilities(appCatalog, rawCapabilities) {
  if (!Array.isArray(rawCapabilities)) return [];
  const capabilities = new Set(rawCapabilities.filter((capability) => typeof capability === 'string'));
  return appCatalog.filter((app) => Array.isArray(app.capabilities)
    && app.capabilities.some((capability) => capabilities.has(capability)));
}

export function findAppApiGrant(app, method, path) {
  if (typeof method !== 'string' || typeof path !== 'string') return null;
  return app?.apiGrants?.find((grant) => grant.method === method
    && (grant.path === path || grant.path === '/v1/treatment-protocols/{uuid}' && uuidPathPattern.test(path))) ?? null;
}
