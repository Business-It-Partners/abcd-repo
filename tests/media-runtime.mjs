import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..'), env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const checks = []; let app;
try {
  app = await electron.launch({ args: [root, ...profileArgs, '--runtime-fixtures'], env, timeout: 30_000 });
  for (const [kind, size] of [['patient_media', 10 * 1024 * 1024], ['staff_document', 25 * 1024 * 1024]]) {
    const result = await app.evaluate(async ({ BrowserWindow, ipcMain }, { root, kind, size }) => {
      const require = name => process.mainModule.require(name);
      const path = require('node:path'), { createHash } = require('node:crypto');
      const { ApiBroker } = require(path.join(root, 'dist-electron/sdk/broker.js'));
      const { staging } = require(path.join(root, 'dist-electron/sdk/environment.js'));
      const bytes = new Uint8Array(size); bytes[0] = 42; bytes[size - 1] = 11;
      const recordId = '11111111-1111-4111-8111-111111111111', assetId = '22222222-2222-4222-8222-222222222222';
      const appId = kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff', family = kind === 'patient_media' ? 'clinic.app.patient-record' : 'clinic.app.staff';
      const checksum = createHash('sha256').update(bytes).digest('hex'); let calls = 0;
      const broker = new ApiBroker(staging, { snapshot: () => ({ active: true, generation: 1, userLabel: 'Synthetic', clinicLabel: 'Synthetic' }), allowed: () => true, allowedMediaRead: (_, requested) => requested === kind, credential: async () => 'private-fixture-host-token' }, async (_url, init) => {
        calls++; if (init.headers.authorization !== 'Bearer private-fixture-host-token') throw Error('host credential missing');
        if (init.method === 'GET') return Response.json({ [kind === 'patient_media' ? 'media' : 'documents']: [{ [kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId']: assetId, [kind === 'patient_media' ? 'patientId' : 'staffId']: recordId, status: 'active', mimeType: 'image/png', byteSize: size, checksum }] });
        return new Response(bytes, { headers: { 'content-type': 'image/png' } });
      });
      // Replace handlers only in this disposable private test process; production source is unchanged.
      for (const name of ['sdk:connect', 'sdk:request', 'sdk:cancel']) ipcMain.removeHandler(name);
      const caller = event => ({ sender: event.sender, frame: event.senderFrame, url: event.senderFrame?.url ?? '' });
      ipcMain.handle('sdk:connect', (event, input) => broker.connect(caller(event), input));
      ipcMain.handle('sdk:request', (event, input) => broker.request(caller(event), input));
      ipcMain.handle('sdk:cancel', (event, input) => broker.cancel(caller(event), input));
      const win = new BrowserWindow({ show: false, width: 600, height: 400, webPreferences: { preload: path.join(root, 'dist-electron/runtime/appPreload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'media-test-' + kind } });
      try {
        await win.loadURL('data:text/html,<html><body>Private synthetic media bridge test</body></html>');
        broker.register({ sender: win.webContents, frame: win.webContents.mainFrame, origin: win.webContents.mainFrame.url, appId, appVersion: '1.0.0', capabilities: [family, 'clinic.media.read'], authorizeApiOperation: operation => operation === 'clinic.media.read', report() {} });
        const value = await win.webContents.executeJavaScript(`(async()=>{const connected=await window.dentalApp.connect({major:1,minor:3});if(!connected.ok)return connected;const reply=await window.dentalApp.request({version:1,connection:connected.value.connection,generation:connected.value.generation,requestId:'native-media-0001',operation:'clinic.media.read',input:${JSON.stringify({ kind, recordId, assetId })}});if(!reply.ok)return reply;return {ok:true,byteLength:reply.value.body.byteLength,typedBytes:reply.value.body instanceof Uint8Array,first:reply.value.body[0],last:reply.value.body[reply.value.body.length-1],keys:Object.keys(reply.value).sort(),unprivileged:typeof require==='undefined'&&typeof window.desktop==='undefined',tokenExposed:Object.values(reply.value).some(value=>typeof value==='string'&&value.includes('private-fixture-host-token'))};})()`);
        return { ...value, calls };
      } finally { broker.dispose(); win.destroy(); }
    }, { root, kind, size });
    assert.deepEqual(result, { ok: true, byteLength: size, typedBytes: true, first: 42, last: 11, keys: ['body', 'contentType', 'status'], unprivileged: true, tokenExposed: false, calls: 2 });
    checks.push(`real sandboxed preload/IPC receives verified ${kind} at exact ${size}-byte limit without host credentials`);
    console.log('PASS', checks.at(-1));
  }
} finally {
  await app?.close();
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/media-runtime-verification.json'), JSON.stringify({ sha: process.env.GITHUB_SHA ?? null, checks, passed: checks.length === 2, scope: 'Synthetic authenticated metadata/R2 responses and registration authority through actual ApiBroker, IPC and sandboxed appPreload in private Electron. No public release grant, install/Store or live media proof inferred.' }, null, 2));
}
