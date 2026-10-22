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
      const require = name => process.mainModule.require(name), path = require('node:path'), { createHash } = require('node:crypto');
      const { ApiBroker } = require(path.join(root, 'dist-electron/sdk/broker.js')), { staging } = require(path.join(root, 'dist-electron/sdk/environment.js'));
      const recordId = '11111111-1111-4111-8111-111111111111', assetId = '22222222-2222-4222-8222-222222222222';
      const appId = kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff', family = kind === 'patient_media' ? 'clinic.app.patient-record' : 'clinic.app.staff';
      let item, active = false, dropped = false, finalisations = 0, safetyObserved = false; const stepKeys = [];
      const broker = new ApiBroker(staging, { snapshot: () => ({ active: true, generation: 1, userLabel: 'Synthetic', clinicLabel: 'Synthetic' }), allowed: () => true, allowedMediaUpload: (_, requested) => requested === kind, credential: async () => 'private-upload-host-token' }, async (url, init) => {
        const endpoint = new URL(url); if (endpoint.origin !== staging.apiBase || init.headers.authorization !== 'Bearer private-upload-host-token') throw Error('Transport fence');
        if (init.headers['idempotency-key']) stepKeys.push(init.headers['idempotency-key']);
        if (init.method === 'GET') return Response.json({ [kind === 'patient_media' ? 'media' : 'documents']: [{ ...item, status: active ? 'active' : 'pending' }] });
        if (endpoint.pathname.endsWith('/upload-intents') || endpoint.pathname.endsWith('/documents')) {
          item = { ...JSON.parse(init.body), [kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId']: assetId, [kind === 'patient_media' ? 'patientId' : 'staffId']: recordId, status: 'pending' };
          const content = kind === 'patient_media' ? `/v1/patient-media/${assetId}/content` : `/v1/clinic/staff/${recordId}/documents/${assetId}/content`;
          return Response.json({ uploadIntent: { [kind === 'patient_media' ? 'media' : 'document']: item, uploadUrl: staging.apiBase + content, uploadHeaders: { 'content-type': 'image/png' } } }, { status: 201 });
        }
        if (endpoint.pathname.endsWith('/content')) {
          if (active) return new Response(null, { status: 409 });
          const data = init.body;
          if (data.byteLength !== size || data[0] !== 42 || data[size - 1] !== 11 || createHash('sha256').update(data).digest('hex') !== item.checksum) throw Error('Content integrity mismatch');
          return new Response(null, { status: 204 });
        }
        if (endpoint.pathname.endsWith('/finalise')) {
          active = true; finalisations++;
          if (kind === 'staff_document' && !dropped) { dropped = true; throw Error('Synthetic finalise response loss'); }
          return Response.json({ [kind === 'patient_media' ? 'media' : 'document']: { ...item, status: 'active' } });
        }
        throw Error('Unexpected endpoint');
      }, undefined, id => { if (broker.hasUnsafeWrites(id)) safetyObserved = true; });
      for (const name of ['sdk:connect', 'sdk:request', 'sdk:cancel']) ipcMain.removeHandler(name);
      const caller = event => ({ sender: event.sender, frame: event.senderFrame, url: event.senderFrame?.url ?? '' });
      ipcMain.handle('sdk:connect', (event, input) => broker.connect(caller(event), input)); ipcMain.handle('sdk:request', (event, input) => broker.request(caller(event), input)); ipcMain.handle('sdk:cancel', (event, input) => broker.cancel(caller(event), input));
      const win = new BrowserWindow({ show: false, width: 500, height: 400, webPreferences: { preload: path.join(root, 'dist-electron/runtime/appPreload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'upload-test-' + kind } });
      try {
        await win.loadURL('data:text/html,<html><body>Private synthetic upload protocol test</body></html>');
        broker.register({ sender: win.webContents, frame: win.webContents.mainFrame, origin: win.webContents.mainFrame.url, appId, appVersion: '1.0.0', capabilities: [family, 'clinic.media.upload'], authorizeApiOperation: op => op === 'clinic.media.upload', report() {} });
        const parameters = JSON.stringify({ kind, size, recordId });
        const value = await win.webContents.executeJavaScript(`(async()=>{const {kind,size,recordId}=${parameters};const c=await window.dentalApp.connect({major:1,minor:4});if(!c.ok)throw Error('connect');let counter=0;const call=input=>window.dentalApp.request({version:1,connection:c.value.connection,generation:c.value.generation,requestId:'native-upload-'+(++counter),operation:'clinic.media.upload',input});const metadata={displayFilename:'synthetic.png',mimeType:'image/png',byteSize:size,...(kind==='patient_media'?{chiefComplaintId:null,xrayType:'IOPA',toothCode:null,clinicalNote:null,capturedOn:'2026-10-22'}:{documentType:'other',expiresOn:null})};const begin=await call({action:'begin',kind,recordId,metadata,idempotencyKey:'native-original-upload-key'});if(!begin.ok)throw Error('begin');const transferId=begin.value.transferId,bytes=new Uint8Array(size);bytes[0]=42;bytes[size-1]=11;for(let offset=0;offset<size;offset+=8192){const data=btoa(String.fromCharCode(...bytes.subarray(offset,offset+8192)));const chunk=await call({action:'chunk',transferId,offset,data});if(!chunk.ok)throw Error('chunk');}let result=await call({action:'commit',transferId,idempotencyKey:'native-original-upload-key'});const unknownObserved=!result.ok&&result.error.code==='UNKNOWN_OUTCOME'&&result.error.outcome==='unknown';if(unknownObserved)result=await call({action:'commit',transferId,idempotencyKey:'native-original-upload-key'});if(!result.ok)throw Error('commit');return {committed:result.value.committed,assetId:result.value.assetId,keys:Object.keys(result.value).sort(),unknownObserved,unprivileged:typeof require==='undefined'&&typeof window.desktop==='undefined'};})()`);
        return { ...value, finalisations, safetyObserved, safeAfter: !broker.hasUnsafeWrites(appId), stageKeysDistinct: new Set(stepKeys).size === 2 };
      } finally { broker.dispose(); win.destroy(); }
    }, { root, kind, size });
    assert.deepEqual(result, { committed: true, assetId: '22222222-2222-4222-8222-222222222222', keys: ['assetId', 'committed'], unknownObserved: kind === 'staff_document', unprivileged: true, finalisations: 1, safetyObserved: true, safeAfter: true, stageKeysDistinct: true });
    checks.push(`real sandboxed ${kind} upload at ${size} bytes; bounded chunks, host SHA-256, stable stage keys, single finalise and safe close state${kind === 'staff_document' ? ', including lost-finalise reconciliation' : ''}`); console.log('PASS', checks.at(-1));
  }
} finally {
  await app?.close(); await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/media-upload-runtime-verification.json'), JSON.stringify({ sha: process.env.GITHUB_SHA ?? null, checks, passed: checks.length === 2, scope: 'Actual sandboxed preload/IPC/ApiBroker upload protocol at declared bounds; synthetic Worker/R2 and local registration authority. No live media writes, public signed grant or backend concurrency proof inferred.' }, null, 2));
}
