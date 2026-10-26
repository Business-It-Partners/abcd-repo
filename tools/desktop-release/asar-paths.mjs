export function normalizeAsarEntry(entry) {
  if (typeof entry !== 'string' || entry.length === 0) {
    throw new TypeError('ASAR entry path must be a non-empty string');
  }

  const segments = entry.replace(/\\/g, '/').split('/').filter(Boolean);
  if (segments.length === 0 || segments.some(segment => segment === '.' || segment === '..')) {
    throw new Error(`Invalid ASAR entry path: ${entry}`);
  }

  return `/${segments.join('/')}`;
}
