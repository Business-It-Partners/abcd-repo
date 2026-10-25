import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, ...profileArgs, '--runtime-fixtures'], env, timeout: 30000 });

async function nativeView() {
  return app.evaluate(({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const view = win.contentView.children.find(child => child.webContents?.getURL().startsWith('dental-fixture://alpha/'));
    if (!view) return null;
    const bounds = view.getBounds();
    return { visible: view.getVisible(), bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
  });
}

async function waitForNative(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const view = await nativeView();
    if (predicate(view)) return view;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error(`Native app view did not settle: ${JSON.stringify(await nativeView())}`);
}

async function expectedNativeBounds(shell, frame) {
  const surface = await shell.locator('[data-runtime="studio"]').boundingBox();
  const fullscreen = await frame.getAttribute('data-presentation') === 'fullscreen';
  const gutter = fullscreen ? 0 : 15;
  return { x: Math.round(surface.x), y: Math.round(surface.y), width: Math.max(1, Math.round(surface.width) - gutter), height: Math.max(1, Math.round(surface.height) - gutter) };
}

async function waitForNativeBounds(shell, frame) {
  const expected = await expectedNativeBounds(shell, frame);
  return waitForNative(view => view?.visible && Object.keys(expected).every(key => Math.abs(view.bounds[key] - expected[key]) <= 2));
}

async function mirrorPresentation(shell) {
  return shell.locator('[data-runtime="studio"]').evaluate(surface => {
    const probe = document.createElement('img');
    probe.className = 'isolated-mirror';
    surface.append(probe);
    const result = {
      nativeVisible: surface.dataset.nativeViewVisible,
      presentation: surface.dataset.presentation,
      clipPath: getComputedStyle(probe).clipPath,
    };
    probe.remove();
    return result;
  });
}

async function assertMirrorPresentation(shell, nativeVisible, fullscreen = false) {
  await shell.waitForFunction(expected => {
    const surface = document.querySelector('[data-runtime="studio"]');
    return surface?.dataset.nativeViewVisible === (expected ? 'true' : 'false');
  }, nativeVisible, { timeout: 8000 });
  const state = await mirrorPresentation(shell);
  assert.equal(state.nativeVisible, nativeVisible ? 'true' : 'false');
  assert.equal(state.clipPath, nativeVisible && !fullscreen ? 'inset(0px 15px 15px 0px)' : 'none',
    'the mirror must be clipped only while its native view covers the window');
}

try {
  const shell = await app.firstWindow();
  shell.setDefaultTimeout(8000);
  const frame = shell.locator('[data-testid="studio-window"]');
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await shell.mouse.move(20, 20);
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready');
  console.log('PASS sample native app started');
  await waitForNative(view => view?.visible);
  await assertMirrorPresentation(shell, true);

  async function resizeAt(edge, dx, dy) {
    const before = await frame.boundingBox();
    const handle = await frame.locator(`[data-resize="${edge}"]`).boundingBox();
    const x = handle.x + handle.width / 2;
    const y = handle.y + handle.height / 2;
    console.log(`Checking ${edge} resize`);
    await shell.mouse.move(x, y);
    await shell.mouse.down();
    await shell.waitForFunction(() => document.querySelector('[data-testid="studio-window"]')?.dataset.interaction === 'resizing', undefined, { timeout: 8000 });
    await assertMirrorPresentation(shell, false);
    await shell.mouse.move(x + dx, y + dy, { steps: 6 });
    await shell.mouse.up();
    await shell.waitForFunction(() => document.querySelector('[data-testid="studio-window"]')?.dataset.interaction === 'idle', undefined, { timeout: 8000 });
    return { before, after: await frame.boundingBox() };
  }

  const initial = await waitForNative(view => view?.visible);
  let frameBounds = await frame.boundingBox();
  assert.ok(Math.abs(frameBounds.x + frameBounds.width - initial.bounds.x - initial.bounds.width - 15) <= 2,
    'the native view must leave the OS right-edge hit strip clear');
  assert.ok(Math.abs(frameBounds.y + frameBounds.height - initial.bounds.y - initial.bounds.height - 15) <= 2,
    'the native view must leave the OS bottom-edge and corner hit strips clear');
  console.log('PASS native view leaves right and bottom resize strips clear');

  const right = await resizeAt('e', -24, 0);
  assert.ok(right.before.width > right.after.width + 10, 'dragging the right edge inward must resize the OS window from its shared full-size default');
  await waitForNativeBounds(shell, frame);
  await assertMirrorPresentation(shell, true);
  console.log('PASS right-edge resize with native app open');
  const bottom = await resizeAt('s', 0, -24);
  assert.ok(bottom.before.height > bottom.after.height + 10, 'dragging the bottom edge inward must resize the OS window');
  await waitForNativeBounds(shell, frame);
  console.log('PASS bottom-edge resize with native app open');
  const corner = await resizeAt('se', -24, -24);
  assert.ok(corner.before.width > corner.after.width + 10 && corner.before.height > corner.after.height + 10,
    'dragging the bottom-right corner inward must resize the OS window in both directions');
  await waitForNativeBounds(shell, frame);
  console.log('PASS bottom-right resize with native app open');
  console.log('PASS native app right, bottom, and corner resize gestures');

  await shell.getByRole('button', { name: 'Maximize Motion Studio', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-testid="studio-window"]')?.dataset.presentation === 'fullscreen');
  const maximized = await waitForNativeBounds(shell, frame);
  assert.ok(maximized, 'fullscreen apps should continue to use the full content area');
  await assertMirrorPresentation(shell, true, true);
  console.log('PASS native app view leaves the OS resize strips exposed and right, bottom, corner, and fullscreen sizing work');

  await shell.getByRole('button', { name: 'Close Motion Studio', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-testid="studio-window"]')?.dataset.phase === 'closed');
  for (let attempt = 0; attempt < 100 && await nativeView(); attempt++) await new Promise(resolve => setTimeout(resolve, 20));
} finally {
  await app.close();
}
