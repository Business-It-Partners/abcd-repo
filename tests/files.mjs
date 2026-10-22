import { profileArgs, profile } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, ...profileArgs, '--files-fixtures'], env });
const page = await app.firstWindow();
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
function check(label, result) { assert.ok(result, label); checks.push(label); }
const phase = value => page.waitForFunction(expected => document.querySelector('[data-testid="files-window"]')?.dataset.phase === expected, value);
try {
  await page.waitForFunction(() => !!window.desktop?.files);
  const rootResponses = await page.evaluate(async () => {
    const generation = (await window.desktop.identity.view()).generation;
    return window.desktop.files.roots(generation);
  });
  check('Private fixture exposes one opaque root without paths', rootResponses.length === 1
    && rootResponses[0].label === 'Test Files' && !JSON.stringify(rootResponses).includes(profile));
  await page.getByRole('button', { name: 'Files', exact: true }).click();
  await phase('visible');
  const frame = page.getByTestId('files-window');
  check('Files is a managed OS window and accessible from the dock', await frame.getByTestId('files-app').isVisible());
  check('Image-friendly grid is the default Files view', await frame.locator('.files-list.is-grid').isVisible()
    && await frame.getByRole('button', { name: 'Grid view' }).getAttribute('aria-pressed') === 'true');
  await frame.getByRole('button', { name: 'List view' }).click();
  check('List view remains available for detailed file metadata', await frame.locator('.files-list.is-list').isVisible()
    && await frame.locator('.files-columns').isVisible());
  await frame.getByRole('button', { name: 'Grid view' }).click();
  const entries = frame.locator('[role="option"][id^="file-option-"]');
  await entries.first().waitFor();
  check('Root listing has synthetic folder and document, with hidden entries omitted',
    await entries.count() === 2 &&
    await frame.getByText('X-rays', {exact:true}).count() === 1 &&
    await frame.getByText('.m16-hidden-synthetic.png', {exact:true}).count() === 0);
  const folderCard = entries.filter({ hasText: 'X-rays' });
  const documentCard = entries.filter({ hasText: 'notes-synthetic.pdf' });
  check('Folders and documents use type icons while grid thumbnails are reserved for supported pictures',
    await folderCard.locator('[data-file-icon="folder"]').count() === 1 &&
    await documentCard.locator('[data-file-icon="document"]').count() === 1 &&
    await entries.locator('.files-card-preview img').count() === 0);
  await frame.getByText('X-rays', { exact: true }).dblclick();
  await frame.getByText('m16-synthetic-xray.png', { exact: true }).waitFor();
  check('Double-click navigates into real host folder through opaque handles',
    await entries.count() === 2);
  await page.waitForFunction(() => {
    const image = document.querySelector('.files-card-preview img');
    return !!image && image.complete && image.naturalWidth > 0;
  }, null, { timeout: 8000 });
  check('Bounded local PNG thumbnail renders in Files without a file path',
    await frame.locator('.files-card-preview img').first().evaluate(image => image.complete && image.naturalWidth === 96 && image.naturalHeight === 192));
  const viewer = page.getByTestId('image-viewer-window');
  await frame.getByText('m16-synthetic-xray.png', { exact: true }).dblclick();
  await viewer.waitFor({ state: 'visible', timeout: 10000 });
  await viewer.getByRole('img', { name: 'm16-synthetic-xray.png' }).waitFor({ timeout: 10000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('[data-testid="image-viewer"] canvas');
    return canvas instanceof HTMLCanvasElement && canvas.width === 320 && canvas.height === 640;
  }, null, { timeout: 10000 });
  check('Double-click opens a managed Image Viewer above the still-open Files window',
    await frame.isVisible() && await viewer.getAttribute('data-phase') === 'visible');
  check('Image Viewer decodes and paints pixels from the bounded synthetic PNG', await viewer.locator('canvas').evaluate(canvas => {
    const context = canvas.getContext('2d');
    return canvas.width === 320 && canvas.height === 640 && !!context && context.getImageData(160, 320, 1, 1).data.some((value, index) => index % 4 === 3 && value > 0);
  }));
  const panCanvas=viewer.locator('.image-viewer-canvas canvas');
  const initialBox=await panCanvas.boundingBox(),initialViewportBox=await viewer.locator('.image-viewer-canvas').boundingBox();
  if(!initialBox||!initialViewportBox)throw new Error('Image Viewer initial fit bounds unavailable');
  const initialRatio=initialBox.width/initialBox.height;
  const initialZoom=Number((await viewer.getByLabel('Current zoom').innerText()).replace('%',''));
  check('Portrait picture opens fully fitted, centered and undistorted',Math.abs(initialRatio-.5)<.01
    &&initialBox.x>=initialViewportBox.x-1&&initialBox.y>=initialViewportBox.y-1
    &&initialBox.x+initialBox.width<=initialViewportBox.x+initialViewportBox.width+1
    &&initialBox.y+initialBox.height<=initialViewportBox.y+initialViewportBox.height+1);
  await panCanvas.evaluate(canvas=>{canvas.style.width='900px';canvas.style.height='700px';});
  await viewer.getByRole('button', { name: 'Zoom in' }).click();
  check('Image Viewer zoom control updates its displayed scale',
    Number((await viewer.getByLabel('Current zoom').innerText()).replace('%','')) > initialZoom);
  const panBox=await panCanvas.boundingBox(),viewportBox=await viewer.locator('.image-viewer-canvas').boundingBox();
  if(!panBox||!viewportBox)throw new Error('Image Viewer pan bounds unavailable');
  const startX=panBox.x+panBox.width/2,startY=panBox.y+panBox.height/2;
  await page.mouse.move(startX,startY);await page.mouse.down();
  await page.mouse.move(startX+900,startY+700,{steps:4});
  const panStyle=await panCanvas.getAttribute('style'),panning=await panCanvas.evaluate(canvas=>canvas.classList.contains('is-panning'));
  await page.mouse.up();
  const movedBox=await panCanvas.boundingBox();
  check('Dragging a zoomed image pans it while keeping the viewport covered',!!movedBox&&panning
    &&panStyle?.includes('translate3d(')&&!panStyle.includes('translate3d(0px, 0px, 0)')
    &&movedBox.x<=viewportBox.x+1&&movedBox.y<=viewportBox.y+1
    &&movedBox.x+movedBox.width>=viewportBox.x+viewportBox.width-1
    &&movedBox.y+movedBox.height>=viewportBox.y+viewportBox.height-1);
  await viewer.getByRole('button', { name: 'Rotate picture right' }).click();
  check('Image Viewer rotates the displayed picture',
    (await viewer.getByRole('img', { name: 'm16-synthetic-xray.png' }).getAttribute('style'))?.includes('rotate(90deg)'));
  await viewer.getByRole('button', { name: 'Fit image to window' }).click();
  const fitStyle=await panCanvas.getAttribute('style');
  check('Fitting the image recenters it and restores its initial fit scale',await viewer.getByLabel('Current zoom').innerText()===`${initialZoom}%`
    &&/translate3d\(0px, 0px, 0(?:px)?\)/.test(fitStyle??''));
  await viewer.getByRole('button', { name: 'Rotate picture right' }).click();
  const rotatedBox=await panCanvas.boundingBox(),rotatedViewport=await viewer.locator('.image-viewer-canvas').boundingBox();
  check('Rotating in fit mode keeps the full image visible at its preserved ratio',!!rotatedBox&&!!rotatedViewport
    &&Math.abs(rotatedBox.width/rotatedBox.height-2)<.02
    &&rotatedBox.x>=rotatedViewport.x-1&&rotatedBox.y>=rotatedViewport.y-1
    &&rotatedBox.x+rotatedBox.width<=rotatedViewport.x+rotatedViewport.width+1
    &&rotatedBox.y+rotatedBox.height<=rotatedViewport.y+rotatedViewport.height+1);
  await viewer.getByRole('button', { name: 'Fit image to window' }).click();
  const viewerCaptureDenied = await page.evaluate(async generation => {
    try { await window.desktop.capture({ x: 0, y: 40, width: 160, height: 160 }, generation); return false; }
    catch { return true; }
  }, (await page.evaluate(async () => (await window.desktop.identity.view()).generation)));
  check('Private Image Viewer blocks shell screenshot capture while its picture is visible', viewerCaptureDenied);
  await viewer.getByRole('button', { name: 'Close Image Viewer' }).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="image-viewer-window"]')?.getAttribute('data-phase') === 'closed');
  check('Closing Image Viewer releases its session while Files stays open', await frame.isVisible());
  await frame.getByRole('button', { name: 'Back', exact: true }).click();
  await frame.getByText('notes-synthetic.pdf', { exact: true }).waitFor();
  await frame.getByRole('button', { name: 'Forward', exact: true }).click();
  await frame.getByText('m16-synthetic-xray.png', { exact: true }).waitFor();
  check('Back and forward navigation reuse bounded file listings', true);
  await frame.getByRole('listbox').focus();
  await page.keyboard.press('Home'); await page.keyboard.press('Enter');
  check('Keyboard file selection does not execute or upload files',
    await frame.getByText(/Selected: m16-synthetic-xray(?:-alt)?\.png/).isVisible());
  await page.keyboard.press('Backquote');
  const overview = page.getByRole('dialog', { name: 'Open windows' });
  await overview.waitFor();
  check('Overview privacy placeholder excludes local file names',
    await overview.getByText('Private file preview').isVisible()
    && !(await overview.innerText()).includes('m16-synthetic-xray.png'));
  await page.keyboard.press('Escape');
  await frame.getByRole('button', { name: 'Minimize Files' }).click();
  await phase('minimized');
  check('Minimized File preview is nonclinical static artwork',
    await page.locator('.dock-preview').evaluateAll(xs => xs.some(x => x.querySelector('img')?.src.startsWith('data:image/svg+xml'))));
  await page.getByRole('button', { name: 'Restore Files' }).click();
  await phase('visible');
  await frame.getByRole('button', { name: 'Close Files' }).click();
  await phase('closed');
  check('Files uses shared minimize, restore and close lifecycle', true);
  check('No renderer errors', errors.length === 0);
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', 'm16-files-verification.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
} finally { await app.close(); }
