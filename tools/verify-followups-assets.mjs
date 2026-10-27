import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
for (const asset of ['apps/browser/dist/followups/assets/app.js', 'apps/browser/dist/followups/assets/app.css']) {
  assert.ok(existsSync(resolve(root, asset)), 'Missing real React bundle asset: ' + asset);
}
const child = spawn(process.execPath, ['tools/dev-server.mjs', '--flavor', 'preview'], {
  cwd: root, stdio: ['ignore', 'pipe', 'pipe'],
});
const output = [];
child.stdout.on('data', buffer => output.push(buffer.toString()));
child.stderr.on('data', buffer => output.push(buffer.toString()));
try {
  const origin = 'http://127.0.0.1:4280';
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null) throw Error('Preview server terminated: ' + output.join(''));
    try {
      const response = await fetch(origin + '/');
      if (response.ok) { ready = true; break; }
    } catch { /* Starting */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Preview server failed to start: ' + output.join(''));

  async function get(path) { return fetch(origin + path); }
  const shell = await get('/');
  assert.equal(shell.status, 200);
  assert.match(shell.headers.get('content-security-policy'), /connect-src 'none'/);

  const frame = await get('/apps/browser/frame.html');
  assert.equal(frame.status, 200);
  assert.match(frame.headers.get('content-security-policy'), /sandbox allow-scripts/);
  assert.match(frame.headers.get('content-security-policy'), /connect-src 'none'/);
  const html = await frame.text();
  assert.match(html, /bridge\.js/);
  assert.match(html, /frame\.js/);

  for (const path of ['bridge.js', 'frame.js', 'host.js']) {
    const asset = await get('/apps/browser/' + path);
    assert.equal(asset.status, 200, path);
  }
  for (const path of ['app.js', 'app.css']) {
    const asset = await get('/apps/browser/dist/followups/assets/' + path);
    assert.equal(asset.status, 200, path);
    assert.equal(asset.headers.get('access-control-allow-origin'), '*', path);
    assert.ok(Number(asset.headers.get('content-length') || '1') > 0);
  }
  const forbidden = await get('/apps/browser/dist/workentry/assets/app.js');
  assert.equal(forbidden.status, 404);
  const traversal = await get('/apps/browser/dist/followups/%2e%2e/config/staging-firebase.json');
  assert.equal(traversal.status, 404);
  const forbiddenMethod = await fetch(origin + '/apps/browser/dist/followups/assets/app.js', { method: 'POST' });
  assert.equal(forbiddenMethod.status, 405);
  console.log('Follow-ups compiled bundle and sandbox asset boundary: passed.');
} finally {
  child.kill('SIGTERM');
}
