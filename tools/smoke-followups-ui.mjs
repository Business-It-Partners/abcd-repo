import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const origin = 'http://127.0.0.1:4280';
const server = spawn(process.execPath, ['tools/dev-server.mjs', '--flavor', 'preview'], {
  cwd: new URL('../', import.meta.url).pathname, stdio: ['ignore', 'pipe', 'pipe'],
});
const logs = [];
server.stdout.on('data', chunk => logs.push(chunk.toString()));
server.stderr.on('data', chunk => logs.push(chunk.toString()));
let browser = null;
let page = null;
const screenshotDir = path.resolve(fileURLToPath(new URL('../artifacts/', import.meta.url)));
mkdirSync(screenshotDir, { recursive: true });
try {
  let up = false;
  for (let i = 0; i < 50; i++) {
    try { if ((await fetch(origin + '/')).ok) { up = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(up, 'Preview server did not start: ' + logs.join(''));
  // CI runner Chrome is used only as a transport/UI smoke. Brave acceptance is a separate gate.
  browser = await chromium.launch({
    channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const pageErrors = [];
  const browserDiagnostics = [];
  page.on('pageerror', err => pageErrors.push(err.message));
  page.on('console', event => { if (event.type() === 'error' || event.type() === 'warning') browserDiagnostics.push(event.text()); });
  page.on('requestfailed', request => browserDiagnostics.push(request.url() + ': ' + request.failure()?.errorText));
  page.on('response', response => { if (response.status() >= 400) browserDiagnostics.push('HTTP ' + response.status() + ' ' + response.url()); });
  await page.goto(origin + '/');
  await page.evaluate(async () => {
    const frame = document.createElement('iframe');
    frame.id = 'synthetic-followups';
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.title = 'Synthetic Follow-ups browser acceptance';
    frame.style.cssText = 'position:absolute;z-index:9999;inset:50px 20px 70px;width:1000px;height:740px;border:1px solid #ccc';
    frame.src = '/apps/browser/frame.html';
    document.body.append(frame);
    await new Promise(resolve => frame.addEventListener('load', resolve, { once: true }));
    const channel = new MessageChannel();
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kathmandu' });
    window.__syntheticFollowupsPaths = [];
    channel.port1.onmessage = event => {
      const request = event.data;
      if (request?.type !== 'read') return;
      window.__syntheticFollowupsPaths.push(request.path);
      let data;
      if (request.path === '/v1/follow-ups') {
        data = { followUps: [{
          followUpId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          patientId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          chiefComplaintId: null, dueOn: today, dueTime: null,
          reason: 'Synthetic return visit', status: 'pending', rowVersion: 1,
          patientNumber: 'TEST-001', patientName: 'Synthetic Test Patient',
          patientPhone: '9800000000', requestedByStaffName: 'Synthetic Doctor',
          lastVisitOn: null, called: false, noAnswer: false,
        }] };
      } else if (request.path === '/v1/clinic/staff-references') {
        data = { staff: [] };
      } else data = { patients: [] };
      channel.port1.postMessage({ type: 'response', id: request.id, ok: true, data });
    };
    channel.port1.start();
    frame.contentWindow.postMessage({
      type: 'dental-os-browser-init',
      appId: 'followups',
      source: 'company.dental.followups.m17',
      nonce: 'abcdef'.repeat(8),
      title: 'Follow-ups', icon: '/assets/dock/followups.webp',
      preview: false,
      views: [
        { id: 'worklist', title: 'Follow-up worklist', route: '/v1/follow-ups' },
        { id: 'doctors', title: 'Doctors', route: '/v1/clinic/staff-references' },
      ],
      session: {
        clinic: { tenantId: 'synthetic-only', displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: null, hasActiveTrial: false },
        clinicUser: { clinicUserId: 'synthetic-user', displayName: 'Synthetic doctor', role: 'doctor', capabilities: ['followups.access'] },
        branches: [],
      },
    }, '*', [channel.port2]);
  });

  const frame = page.frameLocator('#synthetic-followups');
  try {
    await frame.locator('[data-dental-os-app="company.dental.followups.m17"]').waitFor({ timeout: 12000 });
  } catch (cause) {
    const text = await frame.locator('body').innerText().catch(() => '(iframe body unavailable)');
    const src = await frame.locator('#app-root, #root').evaluate(el => ({ id: el.id, html: el.innerHTML.slice(0, 2000) })).catch(() => null);
    const requested = await page.evaluate(() => window.__syntheticFollowupsPaths).catch(() => []);
    console.error('Follow-ups iframe diagnostics:', JSON.stringify({
      text: text.slice(0, 2000), src, requested, pageErrors, browserDiagnostics,
    }, null, 2));
    throw cause;
  }
  await frame.getByText('Synthetic Test Patient').first().waitFor({ timeout: 15000 });
  assert.ok(await frame.getByText('Browser verification mode').count() > 0);
  const create = frame.getByRole('button', { name: /Create follow-up/i });
  assert.equal(await create.isDisabled(), true, 'unverified write controls must be disabled');
  const checkboxes = frame.locator('[data-checkbox-control]');
  assert.ok(await checkboxes.count() > 0, 'original follow-up status UI should render');
  for (let i = 0; i < await checkboxes.count(); i++) {
    assert.equal(await checkboxes.nth(i).isDisabled(), true);
  }
  const requested = await page.evaluate(() => window.__syntheticFollowupsPaths);
  assert.ok(requested.includes('/v1/follow-ups'), 'Original React UI must read through the MessageChannel');
  assert.equal(requested.some(x => !['/v1/follow-ups', '/v1/clinic/staff-references'].includes(x)), false);
  assert.equal(pageErrors.length, 0, 'Unexpected browser exceptions: ' + pageErrors.join('; '));
  console.log('Original Follow-ups React UI rendered in sandbox with synthetic data: passed.');
 } finally {
  if (page) {
    try {
      await page.locator('#synthetic-followups').screenshot({ path: path.join(screenshotDir, 'followups-actual-ui.png') });
      await page.screenshot({ path: path.join(screenshotDir, 'followups-browser-shell.png'), fullPage: true });
      console.log('Synthetic browser screenshots captured in artifacts/.');
    } catch (cause) { console.error('Screenshot capture failed:', String(cause)); }
  }
  await browser?.close();
  server.kill('SIGTERM');
}
