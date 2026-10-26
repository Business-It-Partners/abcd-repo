import { describe, expect, it } from 'vitest';
import { normalizeAsarEntry } from '../tools/desktop-release/asar-paths.mjs';

describe('Windows ASAR entry normalization', () => {
  it('keeps POSIX-style entries in canonical archive form', () => {
    expect(normalizeAsarEntry('/dist/index.html')).toBe('/dist/index.html');
  });

  it('converts Windows and mixed separators before verifier checks', () => {
    expect(normalizeAsarEntry('\\dist\\index.html')).toBe('/dist/index.html');
    expect(normalizeAsarEntry('/node_modules\\safe-package/index.js')).toBe('/node_modules/safe-package/index.js');
  });

  it('rejects empty and traversal paths instead of normalizing them into an allowlisted root', () => {
    expect(() => normalizeAsarEntry('')).toThrow('non-empty string');
    expect(() => normalizeAsarEntry('\\')).toThrow('Invalid ASAR entry path');
    expect(() => normalizeAsarEntry('\\dist\\..\\package.json')).toThrow('Invalid ASAR entry path');
    expect(() => normalizeAsarEntry('/dist/./index.html')).toThrow('Invalid ASAR entry path');
  });
});
