import { profile, profileArgs } from './profile.mjs';
import { assertStandardPageScroll } from './standard-page-scroll-test.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-work-entry-app');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG', 'M17_DENY_ROLE']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const reportPath = path.join(root, 'artifacts', `m17-work-entry-private-${stamp}.json`);
const screenshotPath = path.join(root, 'artifacts', `m17-work-entry-private-${stamp}.png`);
const pickedImageScreenshotPath = path.join(root, 'artifacts', `m17-work-entry-picked-image-private-${stamp}.png`);
const checks = [], errors = [], hostLogs = [];
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
let app, page, deniedApp, passed = false, packageInfo, failure, screenshotWritten = false, pickedImageScreenshotWritten = false, deniedProfile;
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.work-entry.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Work Entry guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17WorkEntry.calls.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  effects: globalThis.m17WorkEntry.effects(), moduleAcks: globalThis.m17WorkEntry.moduleAcks.slice(),
  moduleSelectionResult: globalThis.m17WorkEntry.moduleSelectionResult(), package: globalThis.m17WorkEntry.package,
}));

try {
  const expectedAppVersion = JSON.parse(await fs.readFile(path.join(root, 'apps/dental-apps/company.dental.work-entry.m17/app.manifest.json'), 'utf8')).version;
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  await app.firstWindow();
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  check('private UI host uses its isolated temporary app profile', await app.evaluate(({ app }) => app.getPath('userData')) === profile);
  page = await waitForGuest(app); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Work Entry', exact: true }).waitFor();
  await assertStandardPageScroll(page, check, 'Work Entry');
  await page.getByText('Synthetic Work Entry Patient', { exact: true }).waitFor();
  const initial = await inspect(app); packageInfo = initial.package;
  check(`private signed package has Work Entry identity, version ${expectedAppVersion}, and packaged assets`, packageInfo.appId === 'company.dental.work-entry.m17' && packageInfo.version === expectedAppVersion && packageInfo.wireBytes > 0 && packageInfo.wireBytes < 2 * 1024 * 1024 && packageInfo.assetCount >= 5);
  check('renderer receives the SDK bridge without a credential getter', await page.evaluate(() => {
    const methods = Object.keys(window.dentalApp ?? {});
    return ['cancel', 'connect', 'getAppInfo', 'request', 'report'].every(method => methods.includes(method))
      && !methods.some(method => /token|credential|fetch|storage/i.test(method));
  }));
  check('initial worklist reads use only its registered case, treatment-protocol, and staff-reference routes',
    initial.calls.filter(call => call.method === 'GET').map(call => call.path).sort().join('|') === '/v1/clinic/staff-references|/v1/treatment-protocols|/v1/work-entry/cases');
  check('worklist preserves the SaaS patient, complaint, protocol-count, and in-progress state',
    await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).getByText('Synthetic molar pain').count() === 1
      && await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).getByText('In progress').count() === 1);
  await app.evaluate(() => globalThis.m17WorkEntry.module());
  for (let index = 0; index < 40 && !(await inspect(app)).moduleAcks.length; index++) await new Promise(resolve => setTimeout(resolve, 50));
  const module = await inspect(app);
  check('Work Entry module selection is acknowledged after the package opens', module.moduleSelectionResult?.ok === true && module.moduleAcks.length === 1);

  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await page.locator('[data-work-entry-step="1"][aria-current="step"]').waitFor();
  check('an in-progress case opens on the first Patient & case tab by default',
    await page.locator('[data-work-entry-step="1"][aria-current="step"]').getAttribute('aria-current') === 'step'
      && !(await page.evaluate(() => new URLSearchParams(location.search).has('workTab'))));
  const caseNavigationAtOpen = await app.evaluate(() => globalThis.m17WorkEntry.navigation());
  await page.locator('[data-work-entry-step="2"]').click();
  await page.getByText('Work Done Today', { exact: false }).waitFor();
  const opened = await inspect(app);
  const requiredReads = ['/v1/follow-ups', '/v1/patients/11111111-1111-4111-8111-111111111111/core',
    '/v1/patients/11111111-1111-4111-8111-111111111111/ledger', '/v1/patients/11111111-1111-4111-8111-111111111111/odontogram',
    '/v1/patients/11111111-1111-4111-8111-111111111111/periodontal-chart', '/v1/patients/11111111-1111-4111-8111-111111111111/canal-measurements',
    '/v1/clinic/suppliers?scope=lab', '/v1/chief-complaints/22222222-2222-4222-8222-222222222222/work-entry'];
  check('opening an in-progress case reads its clinical context through the approved SDK routes', requiredReads.every(route => opened.calls.some(call => call.method === 'GET' && call.path === route)));
  await page.getByRole('button', { name: /Patient & case/ }).click();
  await page.getByText('Synthetic Work Entry Patient', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Imaging & Rx/ }).click();
  await page.getByRole('button', { name: /Add Image/ }).waitFor();
  check('the imaging step exposes the patient radiograph gallery and upload control',
    await page.locator('[aria-label="Radiographs"] input[type="file"]').count() === 1);
  check('the continuation view does not duplicate the window navigation with a Back to Work Entry button',
    await page.getByRole('button', { name: 'Back to Work Entry', exact: true }).count() === 0);
  check('the workflow tabs stay on one row and the Next action remains visible beside them', await page.locator('[data-work-entry-step-tabs]').evaluate(strip => {
    const tabs = [...strip.querySelectorAll('[data-work-entry-step]')];
    const tabRows = new Set(tabs.map(tab => Math.round(tab.getBoundingClientRect().top)));
    const nextAction = strip.parentElement.querySelector('[data-work-entry-step-actions] button');
    return tabs.length > 0 && tabRows.size === 1 && nextAction?.getBoundingClientRect().width > 0;
  }));
  check('workflow tabs show step numbers and labels without decorative icons', await page.locator('[data-work-entry-step-tabs]').evaluate(strip => {
    const tabs = [...strip.querySelectorAll('[data-work-entry-step]')];
    return tabs.length > 0 && tabs.every(tab => tab.querySelector('svg') === null
      && tab.querySelector('span')?.textContent?.trim()
      && tab.textContent?.trim());
  }));
  const routeStep = await page.evaluate(() => new URLSearchParams(location.search).get('workTab'));
  let hostNavigation;
  for (let attempt = 0; attempt < 40; attempt++) {
    hostNavigation = await app.evaluate(() => globalThis.m17WorkEntry.navigation());
    if (hostNavigation && hostNavigation.index > 0) break;
    await page.waitForTimeout(50);
  }
  check('the active Work Entry step is reflected in its app-owned history', routeStep === 'imaging');
  check('workflow tab changes replace the current case page instead of adding Back-stack entries',
    Boolean(hostNavigation && caseNavigationAtOpen
      && hostNavigation.index === caseNavigationAtOpen.index
      && hostNavigation.entries.join('|') === caseNavigationAtOpen.entries.join('|')));
  check('the OS Back request is accepted for the active Work Entry route',
    await app.evaluate(() => globalThis.m17WorkEntry.navigate('back', false, true)));
  await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).waitFor();
  await page.waitForFunction(() => !new URLSearchParams(location.search).has('caseId'));
  check('OS Back returns from the case workflow to the Work Entry worklist',
    await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).count() === 1);
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await page.locator('[data-work-entry-step="1"][aria-current="step"]').waitFor();
  await page.locator('[data-work-entry-step="2"]').click();
  await page.getByText('Work Done Today', { exact: false }).waitFor();
  check('in-progress treatment protocol cards use half-width columns on desktop',
    await page.locator('[data-work-entry-treatment-grid]').evaluate(grid => {
      const bounds = grid.getBoundingClientRect();
      const cards = [...grid.children].map(card => card.getBoundingClientRect());
      return bounds.width > 900 && cards.length > 0 && cards.every(card => card.width < bounds.width * 0.55);
    }));
  await page.getByRole('button', { name: /Imaging & Rx/ }).click();
  await page.locator('[data-work-entry-step][aria-current="step"]').filter({ hasText: 'Imaging & Rx' }).waitFor();
  check('the removed Lab requirement panel is absent from this step', await page.getByText('Lab requirement', { exact: true }).count() === 0);
  check('Radiographs and Prescription occupy the same row', await page.locator('[data-work-entry-imaging-layout]').evaluate(layout => {
    const xray = layout.querySelector('[data-work-entry-radiographs]').getBoundingClientRect();
    const prescription = layout.querySelector('[data-work-entry-prescription]').getBoundingClientRect();
    return xray.width > 0 && prescription.width > 0 && Math.abs(xray.top - prescription.top) < 2 && xray.left < prescription.left;
  }));
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' }); screenshotWritten = true;

  const imageBase64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 384;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create the private preview image.');
    const background = context.createRadialGradient(256, 190, 25, 256, 190, 310);
    background.addColorStop(0, '#666b70'); background.addColorStop(1, '#171a1e');
    context.fillStyle = background; context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = 'rgba(238, 241, 242, 0.8)'; context.lineWidth = 5;
    for (let index = 0; index < 4; index++) {
      const x = 92 + index * 108;
      context.fillStyle = 'rgba(223, 227, 228, 0.62)';
      context.beginPath(); context.ellipse(x, 158, 31, 57, (index - 1.5) * 0.04, 0, Math.PI * 2); context.fill();
      context.beginPath(); context.moveTo(x - 16, 194); context.quadraticCurveTo(x - 22, 263, x - 10, 300);
      context.moveTo(x + 15, 194); context.quadraticCurveTo(x + 22, 260, x + 10, 302); context.stroke();
    }
    context.strokeStyle = 'rgba(235, 238, 238, 0.25)'; context.lineWidth = 2;
    context.beginPath(); context.moveTo(25, 223); context.quadraticCurveTo(256, 185, 487, 223); context.stroke();
    return canvas.toDataURL('image/png').split(',')[1];
  });
  const imageBytes = Buffer.from(imageBase64, 'base64');
  const radiograph = 'm17-work-entry-radiograph-1.png';
  const radiographs = [radiograph, 'm17-work-entry-radiograph-2.png', 'm17-work-entry-radiograph-3.png'];
  await app.evaluate(() => globalThis.m17WorkEntry.setMediaUploadDelay(450));
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.locator('[data-testid="radiograph-dropzone"]').click();
  const fileChooser = await fileChooserPromise;
  check('Add Image opens the device file chooser and accepts multiple radiographs', fileChooser.isMultiple());
  await fileChooser.setFiles(radiographs.map(name => ({ name, mimeType: 'image/png', buffer: imageBytes })));
  const uploadSpinner = page.locator('[data-work-entry-upload-spinner]').first();
  await uploadSpinner.waitFor();
  check('each uploading image shows a centered blue circular loader on its own preview card', await uploadSpinner.evaluate(spinner => {
    const frame = spinner.parentElement.getBoundingClientRect();
    const icon = spinner.querySelector('svg').getBoundingClientRect();
    const color = getComputedStyle(spinner.querySelector('svg')).color;
    return color === 'rgb(2, 132, 199)' && Math.abs((frame.left + frame.width / 2) - (icon.left + icon.width / 2)) < 1
      && Math.abs((frame.top + frame.height / 2) - (icon.top + icon.height / 2)) < 1
      && Number.parseFloat(getComputedStyle(spinner.querySelector('svg')).animationDuration) > 0;
  }));
  await app.evaluate(() => globalThis.m17WorkEntry.setMediaUploadDelay(0));
  await page.getByRole('button', { name: `Preview ${radiographs[2]}` }).waitFor();
  check('the radiograph gallery lays out three image cards before its Add Image tile', await page.locator('[aria-label="Radiographs"] article').count() === 3);
  await fs.writeFile(pickedImageScreenshotPath, await page.screenshot(), { flag: 'wx' });
  pickedImageScreenshotWritten = true;
  const afterUpload = await inspect(app);
  const uploadCalls = afterUpload.calls.filter(call => call.path.includes('/v1/patient-media/'));
  check('the selected radiograph is uploaded and finalised through the host media bridge',
    uploadCalls.some(call => call.method === 'POST' && call.path === '/v1/patient-media/upload-intents')
      && uploadCalls.some(call => call.method === 'PUT' && call.path === '/v1/patient-media/88888888-8888-4888-8888-888888888888/content')
      && uploadCalls.some(call => call.method === 'POST' && call.path === '/v1/patient-media/88888888-8888-4888-8888-888888888888/finalise'));
  const droppedName = 'm17-work-entry-dropped-radiograph.png';
  const dropEvents = await page.locator('[data-testid="radiograph-dropzone"]').evaluate((zone, { name, base64 }) => {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const data = new DataTransfer();
    data.items.add(new File([bytes], name, { type: 'image/png' }));
    zone.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: data }));
    const over = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: data });
    zone.dispatchEvent(over);
    const drop = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: data });
    zone.dispatchEvent(drop);
    return { overPrevented: over.defaultPrevented, dropPrevented: drop.defaultPrevented,
      fileCount: data.files.length, itemFileCount: Array.from(data.items).filter(item => item.kind === 'file' && item.getAsFile()).length };
  }, { name: droppedName, base64: imageBase64 });
  check('radiograph drop zone accepts file drags and handles the drop event',
    dropEvents.overPrevented && dropEvents.dropPrevented && dropEvents.fileCount === 1 && dropEvents.itemFileCount === 1);
  await page.waitForTimeout(500);
  const afterDrop = await inspect(app);
  const droppedPreview = await page.getByRole('button', { name: `Preview ${droppedName}` }).count();
  console.log('PRIVATE DROP RESULT', JSON.stringify({ dropEvents, droppedPreview,
    droppedUpload: afterDrop.calls.some(call => call.method === 'POST' && call.path === '/v1/patient-media/upload-intents' && call.body?.displayFilename === droppedName),
    status: await page.locator('[role="alert"]').allTextContents() }));
  check('a dropped image follows the same authenticated upload and finalise flow',
    droppedPreview > 0
      && afterDrop.calls.some(call => call.method === 'POST' && call.path === '/v1/patient-media/upload-intents' && call.body?.displayFilename === droppedName)
      && afterDrop.calls.some(call => call.method === 'POST' && call.path.endsWith('/finalise')));
  await page.getByRole('button', { name: `Remove ${radiograph}` }).click();
  await page.getByRole('button', { name: 'Remove image', exact: true }).click();
  await page.getByRole('button', { name: `Preview ${radiograph}` }).waitFor({ state: 'detached' });
  const afterWithdrawal = await inspect(app);
  const withdrawal = afterWithdrawal.calls.find(call => call.method === 'POST' && call.path === '/v1/patient-media/88888888-8888-4888-8888-888888888888/withdraw');
  check('the preview disappears only after the host-mediated audited withdrawal succeeds',
    Boolean(withdrawal && withdrawal.body.reason === 'Removed by clinician from Work Entry.')
      && await page.getByRole('button', { name: `Preview ${radiograph}` }).count() === 0);
  check('In-progress case tabs omit Payment and rename the lab-free imaging step',
    await page.locator('[data-work-entry-step]').filter({ hasText: /^Payment$/ }).count() === 0
      && await page.locator('[data-work-entry-step]').filter({ hasText: /Imaging & Rx/ }).count() === 1);
  await page.locator('[data-work-entry-step="6"]').click();
  await page.locator('[data-work-entry-step="6"][aria-current="step"]').waitFor();
  check('In-progress Follow-up contains no payment collection or lab-order form',
    await page.getByText('Paid today (NPR)', { exact: true }).count() === 0
      && await page.getByText('Discount (Rs)', { exact: true }).count() === 0
      && await page.getByText('Payment method', { exact: true }).count() === 0
      && await page.getByText('Lab requirement', { exact: true }).count() === 0);
  await page.getByLabel('No follow-up needed for this visit').check();
  check('Follow-up can advance without collecting payment',
    await page.locator('[data-work-entry-step-actions] button').filter({ hasText: 'Next' }).isEnabled());
  await page.locator('[data-work-entry-step="7"]').click();
  const reviewSave = page.locator('[data-work-entry-review-save]');
  await reviewSave.waitFor();
  check('Review & save is in the stepbar action position with no duplicate bottom commit button',
    await reviewSave.isVisible()
      && await reviewSave.evaluate(button => Boolean(button.closest('[data-work-entry-step-actions]')))
      && await page.getByRole('button', { name: 'Commit Work Entry', exact: true }).count() === 0);
  check('the in-progress case workflow can return to the list through the window Back control',
    await app.evaluate(() => globalThis.m17WorkEntry.navigate('back', false, true)));
  await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).waitFor();
  await app.evaluate(() => globalThis.m17WorkEntry.setWorklistStatus('open'));
  await page.getByRole('button', { name: 'Refresh Work Entry', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).getByText('Open', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await page.getByRole('button', { name: /Patient & purpose/ }).waitFor();
  const assertOpenCaseTabbarHasNoBack = async step => check(`Open Case tab ${step} has no in-tab Back button`,
    await page.locator('[data-work-entry-step-actions]').getByRole('button', { name: 'Back', exact: true }).count() === 0);
  check('the Open Case flow uses the window Back control without an in-page Back to Work Entry button',
    await page.getByRole('button', { name: 'Back to Work Entry', exact: true }).count() === 0);
  check('the Open Case workflow uses the larger numbered preview stepbar and visible page border',
    await page.locator('[data-work-entry-step="1"]').evaluate(tab => getComputedStyle(tab).fontSize === '14.4px')
      && await page.locator('[data-work-entry-workflow-page]').evaluate(panel => getComputedStyle(panel).borderTopWidth === '1px'));
  await page.locator('[data-work-entry-step="2"]').click();
  await page.getByText('Treatment Plan (1)', { exact: true }).waitFor();
  await assertOpenCaseTabbarHasNoBack('Chart & plan');
  check('the Open Case treatment plan uses the responsive protocol-card grid',
    await page.locator('[data-work-entry-treatment-grid] > *').count() === 1);
  await page.locator('[data-work-entry-step="3"]').click();
  await assertOpenCaseTabbarHasNoBack('Imaging & Rx');
  const openImagingLayout = page.locator('[data-work-entry-open-imaging-layout]');
  await openImagingLayout.waitFor();
  check('Open Case replaces Lab with Prescription in the right column beside Radiographs',
    await page.getByText('Lab requirement', { exact: true }).count() === 0
      && await page.locator('[data-work-entry-step]').filter({ hasText: /^Lab$/ }).count() === 0
      && await openImagingLayout.evaluate(layout => {
        const radiographs = layout.querySelector('[data-work-entry-open-radiographs-card]').getBoundingClientRect();
        const prescription = layout.querySelector('[data-work-entry-open-prescription-card]').getBoundingClientRect();
        return radiographs.width > 0 && prescription.width > 0 && Math.abs(radiographs.top - prescription.top) < 2
          && radiographs.left < prescription.left;
      }));
  await page.locator('[data-work-entry-step="4"]').click();
  await assertOpenCaseTabbarHasNoBack("Today's work");
  await page.locator('[data-work-entry-open-today-work-grid]').waitFor();
  check('Open Case Today’s work uses the full width and has no payment or lab-entry form',
    await page.locator('[data-work-entry-open-today-work-grid]').evaluate(grid => {
      const bounds = grid.getBoundingClientRect();
      const card = grid.firstElementChild.getBoundingClientRect();
      return card.width > bounds.width * 0.9;
    })
      && await page.locator('[data-work-entry-open-payment-panel]').count() === 0
      && await page.getByText('Paid today (NPR)', { exact: true }).count() === 0
      && await page.getByText('Discount (Rs)', { exact: true }).count() === 0
      && await page.getByText('Payment method', { exact: true }).count() === 0
      && await page.getByText('Lab requirement', { exact: true }).count() === 0);
  check('Open Case tabs omit Payment and show Imaging & Rx',
    await page.locator('[data-work-entry-step]').filter({ hasText: /^Payment$/ }).count() === 0
      && await page.locator('[data-work-entry-step]').filter({ hasText: /Imaging & Rx/ }).count() === 1);
  check('the Open Case flow labels the recall step Follow-up',
    await page.getByRole('button', { name: /Follow-up/ }).count() === 1);
  await page.locator('[data-work-entry-step="5"]').click();
  await assertOpenCaseTabbarHasNoBack('Follow-up');
  await page.locator('[data-work-entry-step="6"]').click();
  await assertOpenCaseTabbarHasNoBack('Review & commit');
  check('the Open Case window Back returns to the Work Entry worklist',
    await app.evaluate(() => globalThis.m17WorkEntry.navigate('back', false, true)));
  await page.waitForFunction(() => !new URLSearchParams(location.search).has('caseId'));
  await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).waitFor();
  check('opening the patient case performs no clinic writes', opened.effects === 0 && opened.calls.every(call => call.method === 'GET'));
  check('renderer errors stayed clear through worklist and clinical context views', errors.length === 0);
  await app.close(); app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), 'electron-os-m17-work-entry-role-'));
  deniedApp = await electron.launch({ args: [hostApp, '--ozone-platform=wayland', `--user-data-dir=${deniedProfile}`], env: { ...env, M17_DENY_ROLE: '1' }, timeout: 30000 });
  deniedApp.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp); deniedPage.setDefaultTimeout(15000); deniedPage.on('pageerror', error => errors.push(error.message));
  await deniedPage.getByText('This app is not available for the current clinic role.', { exact: true }).waitFor();
  check('role without work_entry.access is denied before business routes execute', (await inspect(deniedApp)).calls.length === 0);
  check('role-denied view contains no clinic data or renderer errors', !(await deniedPage.locator('body').innerText()).includes('Synthetic Work Entry Patient') && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17WorkEntryDiagnostic ?? null, calls: globalThis.m17WorkEntry?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.work-entry.m17/'));
      if (targetPage) diagnostic.body = await targetPage.evaluate(() => document.body?.innerText?.slice(0, 3000) ?? null);
      if (diagnostic.host) failure += `\nPrivate host: ${diagnostic.host}`;
      failure += `\nPrivate page diagnostic: ${JSON.stringify(diagnostic)}`;
    } catch {}
  }
  if (hostLogs.length) failure += `\nPrivate host stderr: ${hostLogs.join('').slice(-6000)}`;
  throw error;
} finally {
  if (app) await app.close();
  if (deniedApp) await deniedApp.close();
  if (deniedProfile) rmSync(deniedProfile, { recursive: true, force: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ passed, failure: failure ?? null, checks, errors, package: packageInfo,
    scope: 'Private headless GNOME/Electron acceptance using a test-only ephemeral signing key and in-memory synthetic clinic API. No live clinic data or publication.',
    screenshot: screenshotWritten ? path.basename(screenshotPath) : null,
    pickedImageScreenshot: pickedImageScreenshotWritten ? path.basename(pickedImageScreenshotPath) : null }, null, 2), { flag: 'wx' });
  console.log('ARTIFACT', reportPath);
  if (screenshotWritten) console.log('ARTIFACT', screenshotPath);
  if (pickedImageScreenshotWritten) console.log('ARTIFACT', pickedImageScreenshotPath);
}
