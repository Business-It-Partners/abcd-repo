import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

if (process.platform !== 'win32') {
  console.error('The Windows safeStorage smoke runner is Windows-only.');
  process.exitCode = 2;
} else {
  const root = path.resolve(import.meta.dirname, '../../..');
  const electron = path.join(root, 'node_modules/electron/dist/electron.exe');
  const app = path.join(root, 'tools/desktop-release/windows-safe-storage');
  if (!existsSync(electron) || !existsSync(path.join(app, 'main.cjs'))) {
    console.error('The local Electron runtime or Windows smoke app is missing.');
    process.exitCode = 2;
  } else {
    const testRoot = mkdtempSync(path.join(os.tmpdir(), 'sajilo-dental-safe-storage-'));
    const result = await new Promise(resolve => {
      const child = spawn(electron, [app], {
        cwd: root,
        stdio: 'inherit',
        env: { ...process.env, SAJILO_DENTAL_SAFE_STORAGE_ROOT: testRoot },
      });
      let spawnError;
      child.once('error', error => { spawnError = error; });
      child.once('close', (code, signal) => resolve({ code, signal, spawnError }));
    });
    let cleanupError;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        rmSync(testRoot, { recursive: true, force: true });
        cleanupError = undefined;
        break;
      } catch (error) {
        cleanupError = error;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    if (result.spawnError) console.error(result.spawnError.message);
    if (result.signal) console.error('Electron smoke process ended with ' + result.signal + '.');
    if (cleanupError) console.error('Could not remove the temporary smoke profile: ' + cleanupError.message);
    process.exitCode = result.code === 0 && !result.spawnError && !result.signal && !cleanupError ? 0 : 1;
  }
}
