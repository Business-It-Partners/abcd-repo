import { afterEach, describe, expect, it } from 'vitest';
import { chmodSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadDevelopmentCredentials } from '../electron/identity/devCredentials';

let root = '';
function prepare(value: unknown, mode = 0o600) {
  root = mkdtempSync(path.join(os.tmpdir(), 'dental-os-dev-login-'));
  const file = path.join(root, 'dev-login.json');
  writeFileSync(file, JSON.stringify(value), { mode });
  chmodSync(file, mode);
  return file;
}
afterEach(() => { if (root) rmSync(root, { recursive: true, force: true }); root = ''; });

describe('local development sign-in credentials', () => {
  it('loads only the exact development credential shape from an owner-only file', () => {
    const credentials = { email: 'dev-user@example.invalid', password: 'local-dev-only' };
    expect(loadDevelopmentCredentials(prepare(credentials))).toEqual(credentials);
  });

  it('ignores missing, malformed, oversized, linked, and unexpected credential files', () => {
    const file = prepare({ email: 'dev-user@example.invalid', password: 'local-dev-only', other: true });
    expect(loadDevelopmentCredentials(file)).toBeUndefined();
    expect(loadDevelopmentCredentials(path.join(root, 'missing.json'))).toBeUndefined();
    const oversized = path.join(root, 'large.json');
    writeFileSync(oversized, ' '.repeat(4097), { mode: 0o600 });
    expect(loadDevelopmentCredentials(oversized)).toBeUndefined();
  });

  it.skipIf(process.platform === 'win32')('ignores symbolic links to credential files', () => {
    const file = prepare({ email: 'dev-user@example.invalid', password: 'local-dev-only' });
    const link = path.join(root, 'link.json');
    symlinkSync(file, link);
    expect(loadDevelopmentCredentials(link)).toBeUndefined();
  });

  it.skipIf(process.platform === 'win32')('ignores POSIX credential files readable by group or others', () => {
    const file = prepare({ email: 'dev-user@example.invalid', password: 'local-dev-only' }, 0o644);
    expect(loadDevelopmentCredentials(file)).toBeUndefined();
  });
});
