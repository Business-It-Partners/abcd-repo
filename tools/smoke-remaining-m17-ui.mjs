import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { browserModules } from '../apps/browser/catalog.js';

const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const artifacts = path.join(ROOT, 'artifacts');
mkdirSync(artifacts, { recursive: true });
const TARGETS = ['appointments', 'patients', 'calendar', 'finance', 'staff',
  'lab', 'treatment', 'protocols', 'workentry'];
const origin = 'http://127.0.0.1:4280';
const capabilities = [
  'appointments.access', 'patient_record.access', 'calendar.access', 'finance.manage',
  'patient_payments.outstanding.read', 'staff.manage', 'staff.reference.read',
  'lab_tracker.access', 'treatment_progress.access', 'treatment_protocols.manage',
  'work_entry.access', 'patient_payments.collect',
];
const server = spawn(process.execPath, ['tools/dev-server.mjs', '--flavor', 'preview'], {
  cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'],
});
const serverOutput = [];
server.stdout.on('data', b => serverOutput.push(b.toString()));
server.stderr.on('data', b => serverOutput.push(b.toString()));
let browser = null;
const statuses = [];
try {
  let up = false;
  for (let i = 0; i < 45; i++) {
    try { if ((await fetch(origin + '/')).ok) { up = true; break; } } catch { /* Startup */ }
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  assert.ok(up, 'Preview server could not start: ' + serverOutput.join(''));
  browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  for (const id of TARGETS) {
    const module = browserModules[id];
    const page = await browser.newPage({ viewport: { width: 1420, height: 950 } });
    const errors = [];
    page.on('pageerror', error => errors.push('JS: ' + error.message));
    page.on('console', event => { if (event.type() === 'error') errors.push('Console: ' + event.text()); });
    page.on('response', response => { if (response.status() >= 400) errors.push('HTTP ' + response.status() + ': ' + response.url()); });
    const views = module.views.map(v => ({ id: v.id, title: v.title, route: v.route }));
    const allReads = [];
    try {
      await page.goto(origin + '/');
      await page.evaluate(async ({ id, module, views, capabilities }) => {
        const iframe = document.createElement('iframe');
        iframe.id = 'm17-original-frame';
        iframe.setAttribute('sandbox', 'allow-scripts');
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        iframe.style.cssText = 'position:absolute;z-index:1000;inset:20px 10px;width:1366px;height:860px;border:1px solid #bbb;';
        iframe.src = '/apps/browser/frame.html';
        document.body.append(iframe);
        await new Promise(resolve => iframe.addEventListener('load', resolve, { once: true }));
        const channel = new MessageChannel();
        window.__m17Reads = [];
        channel.port1.onmessage = message => {
          const request = message.data;
          if (request?.type !== 'read') return;
          window.__m17Reads.push(request.path);
          const data = {
            appointments: [], patients: [], staff: [], followUps: [], calendarTasks: [],
            labOrders: [], labRequests: [], suppliers: [], transactions: [], payments: [],
            expenses: [], payouts: [], products: [], purchases: [], supplierPayments: [],
            cases: [], treatmentProtocols: [], treatmentProgress: [], rows: [],
            summaries: [], branches: [], tasks: [], totals: {},
          };
          channel.port1.postMessage({ type: 'response', id: request.id, ok: true, data });
        };
        channel.port1.start();
        iframe.contentWindow.postMessage({
          type: 'dental-os-browser-init',
          appId: id,
          title: module.title,
          source: module.source,
          icon: module.icon,
          nonce: 'abc123'.repeat(8),
          preview: false,
          views,
          session: {
            clinic: {
              tenantId: '11111111-1111-4111-8111-111111111111',
              displayName: 'Synthetic test clinic',
              timezone: 'Asia/Kathmandu',
              currency: 'NPR',
              defaultBranchId: null,
              hasActiveTrial: true,
            },
            clinicUser: {
              clinicUserId: '22222222-2222-4222-8222-222222222222',
              displayName: 'Synthetic test doctor',
              role: 'admin',
              capabilities,
            },
            branches: [],
          },
        }, '*', [channel.port2]);
      }, { id, module: { source: module.source, title: module.title, icon: module.icon }, views, capabilities });

      const frame = page.frameLocator('#m17-original-frame');
      await frame.locator('#root').waitFor({ timeout: 14000 });
      await page.waitForTimeout(850);
      const observed = await frame.locator('body').evaluate(body => {
        const root = body.querySelector('#root');
        return {
          text: root?.innerText?.slice(0, 600) ?? null,
          childCount: root?.children?.length ?? 0,
          fallback: !!body.querySelector('#app-root'),
          readOnlyNotice: !!body.querySelector('.browser-m17-readonly-note'),
          appMarker: !!root?.querySelector('[data-dental-os-app]'),
        };
      });
      allReads.push(...await page.evaluate(() => window.__m17Reads ?? []));
      assert.equal(observed.fallback, false, 'Original app failed to bootstrap; see console.');
      assert.ok(observed.childCount > 0, 'Original React UI did not mount.');
      assert.equal(observed.readOnlyNotice, true, 'Read-only warning absent');
      assert.doesNotMatch(observed.text ?? '', /^Opening (?:Appointments|Patient Record|Calendar|Finance|Staff|Lab Tracker|Treatment Progress|Treatment Protocols|Work Entry)/i, 'Original app stuck at opening');
      statuses.push({ app: id, status: 'PASS', reads: allReads.length, mounted: observed.appMarker, text: observed.text?.slice(0, 160), errors: errors.slice(0, 8) });
      console.log(id + ': original React app mounted (' + allReads.length + ' synthetic reads)');
    } catch (cause) {
      const body = await page.frameLocator('#m17-original-frame').locator('body').innerText().catch(() => '<frame unavailable>');
      statuses.push({ app: id, status: 'FAIL', reason: String(cause), body: body.slice(0, 800), errors: errors.slice(0, 10) });
      console.error(id + ': FAIL ' + String(cause) + '\n' + errors.slice(0, 6).join('\n'));
    } finally {
      await page.locator('#m17-original-frame').screenshot({ path: path.join(artifacts, 'm17-' + id + '.png') }).catch(() => {});
      await page.close();
    }
  }
  writeFileSync(path.join(artifacts, 'm17-remaining-ui-status.json'), JSON.stringify(statuses, null, 2) + '\n');
  console.log(JSON.stringify(statuses, null, 2));
  assert.ok(statuses.every(x => x.status === 'PASS'), 'One or more M17 browser windows did not mount the original UI');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
