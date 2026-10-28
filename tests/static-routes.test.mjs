import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { browserStaticRoutes, isolatedAppAssets, isolatedAppPages } from '../tools/static-routes.mjs';

const root = resolve(import.meta.dirname, '..');

test('the staging static allowlist contains only existing Browser Edition assets', () => {
  for (const [urlPath, relativePath] of browserStaticRoutes) {
    assert.ok(urlPath.startsWith('/'), `URL path must be rooted: ${urlPath}`);
    assert.ok(!relativePath.startsWith('/') && !relativePath.split('/').includes('..'), `source path must stay inside the Browser Edition: ${relativePath}`);
    assert.ok(existsSync(resolve(root, relativePath)), `missing static asset for ${urlPath}: ${relativePath}`);
  }
});

test('every isolated app page and app script/style is present in the static allowlist', () => {
  for (const page of isolatedAppPages) assert.ok(browserStaticRoutes.has(page), `unserved isolated app page: ${page}`);
  for (const asset of isolatedAppAssets) {
    if (asset === '/apps/runtime.v1.js') continue;
    assert.ok(browserStaticRoutes.has(asset), `unserved isolated app asset: ${asset}`);
  }
});
