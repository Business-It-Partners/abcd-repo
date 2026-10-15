import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
if (!process.env.ELECTRON_OS_TEST_DISPLAY || path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') !== process.env.ELECTRON_OS_TEST_DISPLAY || process.env.DISPLAY) {
  throw new Error('UI tests require the isolated display runner. Use npm run test:<name>; never test on the user desktop.');
}
// Every graphical test gets a separate session, leaving the user's app alone.
export const profile = mkdtempSync(path.join(tmpdir(), 'electron-os-test-'));
export const profileArgs = ['--ozone-platform=wayland', `--user-data-dir=${profile}`];
// Legacy demo apps are regression fixtures, absent from the normal dental dock.
export const fixtureArgs = [...profileArgs, '--prototype-fixtures'];
process.once('exit', () => rmSync(profile, { recursive: true, force: true }));
