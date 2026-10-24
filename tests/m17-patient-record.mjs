import { profileArgs } from './profile.mjs';
import { assertStandardPageScroll } from './standard-page-scroll-test.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-patient-record-host.cjs');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG', 'M17_DENY_ROLE']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const screenshotPath = path.join(root, 'artifacts', `m17-patient-record-private-${stamp}.png`);
const intakeScreenshotPath = path.join(root, 'artifacts', `m17-patient-record-intake-private-${stamp}.png`);
const detailScreenshotPath = path.join(root, 'artifacts', `m17-patient-record-detail-private-${stamp}.png`);
const labScreenshotPath = path.join(root, 'artifacts', `m17-patient-record-lab-private-${stamp}.png`);
const reportPath = path.join(root, 'artifacts', `m17-patient-record-private-${stamp}.json`);
const checks = [], errors = [], hostLogs = [];
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
let app, page, deniedApp, passed = false, packageInfo, failure, screenshotWritten = false, intakeScreenshotWritten = false,
  detailScreenshotWritten = false, labScreenshotWritten = false, deniedProfile;
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.patient-record.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Patient Record guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17PatientRecord.calls.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  mediaWrites: globalThis.m17PatientRecord.mediaWrites.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  package: globalThis.m17PatientRecord.getPackage(), snapshot: globalThis.m17PatientRecord.snapshot(),
}));
const waitForNavigation = async target => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await target.evaluate(() => globalThis.m17PatientRecord.navigation());
    if (value?.index >= 0) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Patient Record did not report its page history to the host.');
};
const waitForHost = async (target, predicate, timeout = 15000) => {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const state = await inspect(target);
    if (predicate(state)) return state;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for the private SDK fixture to record the expected clinic call.');
};

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  page = await waitForGuest(app); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Patient Record', exact: true }).waitFor();
  await assertStandardPageScroll(page, check, 'Patient Record');
  const careWorkspaceGeometry = await page.locator('[data-sajilo-standard-page]').evaluate(root => {
    const shell = root.querySelector('[data-sajilo-standard-scroll-shell]');
    const careWorkspace = root.closest('.clinicCareWorkspace');
    if (!shell || !careWorkspace) return null;
    return {
      shellLeft: shell.getBoundingClientRect().left - careWorkspace.getBoundingClientRect().left,
      shellRight: careWorkspace.getBoundingClientRect().right - shell.getBoundingClientRect().right,
      padding: getComputedStyle(careWorkspace).padding,
    };
  });
  check('Patient Record list removes the legacy care-workspace gutter', !!careWorkspaceGeometry
    && careWorkspaceGeometry.shellLeft === 0 && careWorkspaceGeometry.shellRight === 0 && careWorkspaceGeometry.padding === '0px');
  await page.getByText('Synthetic Patient', { exact: false }).first().waitFor();
  const initial = await inspect(app); packageInfo = initial.package;
  check('updated package is Patient Record 1.0.10 with app assets and JSON/media grants',
    packageInfo.appId === 'company.dental.patient-record.m17' && packageInfo.version === '1.0.10'
      && packageInfo.wireBytes > 0 && packageInfo.assetCount >= 5
      && ['clinic.api.request', 'clinic.media.read', 'clinic.media.upload'].every(op => packageInfo.grants.includes(op)));
  check('renderer receives the SDK bridge without credential or direct-network accessors', await page.evaluate(() => {
    const methods = Object.keys(window.dentalApp ?? {});
    return ['cancel', 'connect', 'getAppInfo', 'navigation', 'request', 'report'].every(method => methods.includes(method))
      && !methods.some(method => /token|credential|fetch|storage/i.test(method));
  }));
  const directoryRead = initial.calls.find(call => call.method === 'GET' && call.path.startsWith('/v1/patients?'));
  const directoryUrl = new URL(directoryRead?.path ?? '', 'https://clinic.invalid');
  check('SaaS directory uses the scoped patient search route and validated Nepali-month filters',
    Boolean(directoryRead) && directoryUrl.searchParams.get('limit') === '10'
      && directoryUrl.searchParams.has('monthStart') && directoryUrl.searchParams.has('monthEnd')
      && !directoryUrl.searchParams.has('tenantId'));
  const directoryText = await page.locator('body').innerText();
  check('production SaaS directory is displayed without the former custom app header or copy',
    directoryText.includes('Patient Record') && directoryText.includes('Detail')
      && !directoryText.includes('Registration, clinical history and patient care')
      && !directoryText.includes('Signed in as Synthetic user'));
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' }); screenshotWritten = true;

  await page.getByRole('button', { name: 'New patient', exact: true }).click();
  await page.getByRole('heading', { name: 'New patient registration', exact: true }).waitFor();
  const nextPatientCode = page.locator('input[aria-label="Next Patient Code"]');
  await nextPatientCode.waitFor();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Next Patient Code"]')?.value === 'SYN-PR-002');
  check('registration uses the OS window navigation and keeps its production save control',
    await page.getByRole('button', { name: 'Back to Patient Record', exact: true }).count() === 0
      && await page.getByRole('button', { name: 'Save patient', exact: true }).count() === 1);
  const intakeCalls = await inspect(app);
  check('SaaS registration displays the patient number returned by its scoped intake-context route',
    intakeCalls.calls.some(call => call.method === 'GET' && call.path === '/v1/patient-intakes/context'));
  await fs.writeFile(intakeScreenshotPath, await page.screenshot(), { flag: 'wx' }); intakeScreenshotWritten = true;
  check('OS Back requires the discard confirmation while registration is unfinished',
    !(await app.evaluate(() => globalThis.m17PatientRecord.navigate('back'))));
  check('confirmed OS Back discards the unfinished registration and returns to the directory',
    await app.evaluate(() => globalThis.m17PatientRecord.navigate('back', true)));
  await page.getByRole('heading', { name: 'Patient Record', exact: true }).waitFor();

  await page.getByRole('button', { name: 'Detail', exact: true }).click();
  await page.getByRole('button', { name: 'Patient Profile', exact: true }).waitFor();
  await page.getByText('Synthetic condition', { exact: false }).first().waitFor();
  const detailHistory = await waitForNavigation(app);
  check('patient detail reports only opaque UUID entries to the OS', detailHistory?.index === 1 && detailHistory.entries.length === 2 && detailHistory.entries.every(entry => /^[0-9a-f-]{36}$/i.test(entry)));
  check('OS Back returns from patient detail to the directory', await app.evaluate(() => globalThis.m17PatientRecord.navigate('back')));
  await page.getByRole('heading', { name: 'Patient Record', exact: true }).waitFor();
  check('OS Forward restores the patient detail page', await app.evaluate(() => globalThis.m17PatientRecord.navigate('forward')));
  await page.getByRole('button', { name: 'Patient Profile', exact: true }).waitFor();
  check('patient detail no longer renders its own Back button', await page.getByRole('button', { name: /^Back/ }).count() === 0);
  const sidebarWidth = await page.locator('[data-patient-record-layout]').evaluate(layout => layout.children[0]?.getBoundingClientRect().width);
  check('patient detail sidebar uses the slightly narrower 190px width', Math.round(sidebarWidth) === 190);
  await fs.writeFile(detailScreenshotPath, await page.screenshot(), { flag: 'wx' }); detailScreenshotWritten = true;
  const profileRead = await inspect(app);
  check('SaaS patient profile reads the authoritative clinic record through ClinicClient',
    profileRead.calls.some(call => call.method === 'GET' && call.path === '/v1/patients/11111111-1111-4111-8111-111111111111/core'));
  check('billing navigation stays hidden when the clinic role lacks the ledger capability',
    await page.getByRole('button', { name: 'Billing Ledger', exact: true }).count() === 0);

  await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
  await page.locator('input').first().fill('Synthetic Patient Updated');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'Retry original save', exact: true }).waitFor();
  const afterUnknown = await inspect(app);
  const firstProfileWrite = afterUnknown.calls.find(call => call.method === 'PUT' && call.path.endsWith('/profile'));
  check('unknown profile-write outcome remains available to retry with its original operation identity',
    Boolean(firstProfileWrite?.operationId) && afterUnknown.snapshot.profileAttempts === 1 && afterUnknown.snapshot.writeEffects === 0);
  check('OS Back is blocked while Patient Record has an unresolved clinic write', !(await app.evaluate(() => globalThis.m17PatientRecord.navigate('back'))));
  await page.getByRole('button', { name: 'Patient Profile', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Retry original save', exact: true }).click();
  await page.getByText('Synthetic Patient Updated', { exact: true }).waitFor();
  const afterRetry = await inspect(app);
  const profileWrites = afterRetry.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/profile'));
  check('profile retry replays the same payload and original key with expected row versions',
    profileWrites.length === 2 && profileWrites[0].operationId === profileWrites[1].operationId
      && JSON.stringify(profileWrites[0].body) === JSON.stringify(profileWrites[1].body)
      && profileWrites[1].body.expectedPatientRowVersion === 4 && profileWrites[1].body.expectedMedicalProfileRowVersion === 3
      && afterRetry.snapshot.writeEffects === 1);

  await page.getByRole('button', { name: 'Periodontal Chart', exact: true }).click();
  await page.getByText('Pocket Probing Depth', { exact: false }).waitFor();
  const independentScroll = await page.evaluate(() => {
    const layout = document.querySelector('[data-patient-record-layout]');
    const sidebar = layout?.children[0];
    const content = layout?.children[1];
    if (!(sidebar instanceof HTMLElement) || !(content instanceof HTMLElement)) return null;
    const sidebarOverflow = getComputedStyle(sidebar).overflowY;
    const contentOverflow = getComputedStyle(content).overflowY;
    const sidebarStyle = sidebar.getAttribute('style');
    sidebar.style.height = '180px';
    sidebar.style.flex = '0 0 180px';
    const sidebarCanScroll = sidebar.scrollHeight > sidebar.clientHeight;
    const contentCanScroll = content.scrollHeight > content.clientHeight;
    const windowScrollBefore = window.scrollY;
    content.scrollTop = Math.min(120, content.scrollHeight - content.clientHeight);
    const contentMovesAlone = content.scrollTop > 0 && sidebar.scrollTop === 0 && window.scrollY === windowScrollBefore;
    content.scrollTop = 0;
    sidebar.scrollTop = Math.min(70, sidebar.scrollHeight - sidebar.clientHeight);
    const sidebarMovesAlone = sidebar.scrollTop > 0 && content.scrollTop === 0 && window.scrollY === windowScrollBefore;
    if (sidebarStyle === null) sidebar.removeAttribute('style'); else sidebar.setAttribute('style', sidebarStyle);
    return { sidebarOverflow, contentOverflow, sidebarCanScroll, contentCanScroll, contentMovesAlone, sidebarMovesAlone };
  });
  check('patient sidebar and clinical content scroll independently without moving the page',
    !!independentScroll && independentScroll.sidebarOverflow === 'auto' && independentScroll.contentOverflow === 'auto'
      && independentScroll.sidebarCanScroll && independentScroll.contentCanScroll
      && independentScroll.contentMovesAlone && independentScroll.sidebarMovesAlone);

  await page.getByRole('button', { name: 'Clinical Timeline', exact: true }).click();
  await page.getByText('Synthetic tooth pain', { exact: true }).waitFor();
  await page.getByText('Synthetic crown preparation', { exact: true }).waitFor();
  await page.getByText('Synthetic canal measurement', { exact: true }).waitFor();
  const timelineText = await page.locator('body').innerText();
  const timelineState = await inspect(app);
  check('SaaS clinical timeline groups the case events and excludes notes and unscoped work',
    !timelineText.includes('Synthetic note excluded from treatment timeline')
      && !timelineText.includes('Unscoped work excluded from treatment timeline')
      && timelineState.calls.some(call => call.path.endsWith('/timeline'))
      && timelineState.calls.some(call => call.path.endsWith('/treatment-plans')));

  await page.getByRole('button', { name: 'X-Ray Imaging', exact: true }).click();
  await page.getByText('Radiographs & Imaging', { exact: false }).waitFor();
  await page.getByRole('img', { name: /IOPA.*tooth 16/ }).waitFor();
  const imageRead = await waitForHost(app, state => state.calls.some(call => call.method === 'POST'
    && call.path === '/v1/patient-media/22222222-2222-4222-8222-222222222222/view'));
  check('SaaS X-ray gallery reads verified private bytes through clinic.media.read',
    imageRead.calls.some(call => call.method === 'POST' && call.path.endsWith('/view')));
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=', 'base64');
  await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-upload.png', mimeType: 'image/png', buffer: png });
  const uploaded = await waitForHost(app, state => state.mediaWrites.some(call => call.method === 'POST' && call.path.endsWith('/finalise')));
  check('SaaS radiograph upload uses brokered intent, binary transfer and finalisation',
    uploaded.mediaWrites.some(call => call.method === 'POST' && call.path === '/v1/patient-media/upload-intents' && Boolean(call.operationId))
      && uploaded.mediaWrites.some(call => call.method === 'PUT' && call.path.endsWith('/content') && call.body?.binaryBytes === png.length)
      && uploaded.mediaWrites.some(call => call.method === 'POST' && call.path.endsWith('/finalise') && Boolean(call.operationId))
      && uploaded.snapshot.writeEffects === 2);

  await page.getByRole('button', { name: 'Lab', exact: true }).click();
  await page.getByText('Synthetic PFM crown', { exact: true }).waitFor();
  await fs.writeFile(labScreenshotPath, await page.screenshot(), { flag: 'wx' }); labScreenshotWritten = true;
  await page.getByRole('checkbox').first().click();
  await page.getByRole('dialog', { name: 'Send to lab' }).waitFor();
  await page.locator('[role="dialog"] select').first().selectOption('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
  await page.getByRole('button', { name: 'Send to lab', exact: true }).click();
  const dispatched = await waitForHost(app, state => state.calls.some(call => call.method === 'POST'
    && call.path === '/v1/lab-orders/cccccccc-cccc-4ccc-8ccc-cccccccccccc/assign'));
  const assignment = dispatched.calls.find(call => call.method === 'POST' && call.path === '/v1/lab-orders/cccccccc-cccc-4ccc-8ccc-cccccccccccc/assign');
  check('SaaS patient lab screen dispatches through the clinic API with supplier and expected row version',
    Boolean(assignment?.operationId) && assignment.body.supplierId === 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
      && assignment.body.expectedRowVersion === 1 && assignment.body.sentOn);
  const missingMutationKeys = dispatched.calls.filter(call => call.method !== 'GET'
    && !call.path.endsWith('/view') && !call.path.endsWith('/content') && !call.operationId);
  check('renderer completed the tested SaaS workflows without errors or unkeyed clinic mutations',
    errors.length === 0 && missingMutationKeys.length === 0);
  await app.close(); app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), 'electron-os-m17-patient-record-role-'));
  deniedApp = await electron.launch({ args: [hostApp, '--ozone-platform=wayland', `--user-data-dir=${deniedProfile}`], env: { ...env, M17_DENY_ROLE: '1' }, timeout: 30000 });
  deniedApp.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp); deniedPage.setDefaultTimeout(15000); deniedPage.on('pageerror', error => errors.push(error.message));
  await deniedPage.getByRole('heading', { name: 'Patient Record unavailable', exact: true }).waitFor();
  const denied = await inspect(deniedApp);
  check('role without patient_record.access is denied before patient or media routes execute', denied.calls.length === 0 && denied.mediaWrites.length === 0);
  check('role-denied view contains no patient information or renderer errors',
    !(await deniedPage.locator('body').innerText()).includes('Synthetic Patient') && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17PatientRecordDiagnostic ?? null, calls: globalThis.m17PatientRecord?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.patient-record.m17/'));
      if (targetPage) diagnostic.body = await targetPage.evaluate(() => document.body?.innerText?.slice(0, 3500) ?? null);
      if (diagnostic.host) failure += `\nPrivate host: ${diagnostic.host}`;
      failure += `\nPrivate page diagnostic: ${JSON.stringify(diagnostic)}`;
    } catch {}
  }
  if (hostLogs.length) failure += `\nPrivate host stderr: ${hostLogs.join('').slice(-5000)}`;
  throw error;
} finally {
  if (app) await app.close();
  if (deniedApp) await deniedApp.close();
  if (deniedProfile) rmSync(deniedProfile, { recursive: true, force: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ passed, failure: failure ?? null, checks, errors, package: packageInfo,
    scope: 'Private headless Electron acceptance of the pinned SaaS Patient Record screens using only synthetic clinic/media data and test-only signing keys. No live patient data, staging publication or clinic credential was used.',
    screenshot: screenshotWritten ? path.basename(screenshotPath) : null,
    intakeScreenshot: intakeScreenshotWritten ? path.basename(intakeScreenshotPath) : null,
    detailScreenshot: detailScreenshotWritten ? path.basename(detailScreenshotPath) : null,
    labScreenshot: labScreenshotWritten ? path.basename(labScreenshotPath) : null }, null, 2), { flag: 'wx' });
  console.log('ARTIFACT', reportPath);
  if (screenshotWritten) console.log('ARTIFACT', screenshotPath);
  if (intakeScreenshotWritten) console.log('ARTIFACT', intakeScreenshotPath);
  if (detailScreenshotWritten) console.log('ARTIFACT', detailScreenshotPath);
  if (labScreenshotWritten) console.log('ARTIFACT', labScreenshotPath);
}
