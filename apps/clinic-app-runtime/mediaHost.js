import { appMediaOperationIsGranted } from '../catalog.js';

const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
const hex64 = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
const maxBytes = 10 * 1024 * 1024;
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
const exactKeys = (value, keys) => isRecord(value) && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const safeText = (value, max, required = false) => typeof value === 'string' && value.length <= max
  && (!required || value.length > 0) && !/[\u0000-\u001f\u007f]/.test(value);
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
const validKey = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(value);
const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), value => value.toString(16).padStart(2, '0')).join('');

function validateMetadata(value) {
  return exactKeys(value, ['displayFilename', 'mimeType', 'byteSize', 'chiefComplaintId', 'xrayType', 'toothCode', 'clinicalNote', 'capturedOn'])
    && safeText(value.displayFilename, 200, true)
    && Number.isSafeInteger(value.byteSize) && value.byteSize >= 1 && value.byteSize <= maxBytes
    && mimeTypes.includes(value.mimeType)
    && (value.chiefComplaintId === null || uuid(value.chiefComplaintId))
    && ['IOPA', 'OPG', 'CBCT', 'Intraoral photo'].includes(value.xrayType)
    && (value.toothCode === null || safeText(value.toothCode, 40))
    && (value.clinicalNote === null || safeText(value.clinicalNote, 1000))
    && validDate(value.capturedOn);
}

function validateUpload(input) {
  if (!isRecord(input)) return false;
  if (input.action === 'begin') {
    const keys = ['action', 'kind', 'recordId', 'metadata', 'idempotencyKey', ...(Object.hasOwn(input, 'replacement') ? ['replacement'] : [])];
    const replacement = input.replacement;
    return exactKeys(input, keys) && input.kind === 'patient_media' && uuid(input.recordId)
      && validKey(input.idempotencyKey) && validateMetadata(input.metadata)
      && (replacement === undefined || replacement === null
        || exactKeys(replacement, ['assetId', 'reason']) && uuid(replacement.assetId) && safeText(replacement.reason, 500, true));
  }
  if (input.action === 'chunk') return exactKeys(input, ['action', 'transferId', 'offset', 'data']) && uuid(input.transferId)
    && Number.isSafeInteger(input.offset) && input.offset >= 0 && typeof input.data === 'string' && input.data.length > 0
    && input.data.length <= 10_924 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input.data);
  return ['commit', 'cancel'].includes(input.action) && exactKeys(input, ['action', 'transferId', 'idempotencyKey'])
    && uuid(input.transferId) && validKey(input.idempotencyKey);
}

async function readExact(response, expected, maximum, signal) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maximum || expected !== undefined && Number(declared) !== expected)) {
    void response.body?.cancel(); throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
  }
  if (!response.body) throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
  const reader = response.body.getReader(), chunks = [];
  let length = 0;
  const cancel = () => void reader.cancel().catch(() => {});
  signal.addEventListener('abort', cancel, { once: true });
  try {
    while (true) {
      const part = await reader.read();
      if (signal.aborted) throw Object.assign(new Error('CANCELLED'), { code: 'CANCELLED' });
      if (part.done) break;
      length += part.value.byteLength;
      if (length > (expected ?? maximum)) throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
      chunks.push(part.value);
    }
    if (expected !== undefined && length !== expected) throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
    const result = new Uint8Array(length); let offset = 0;
    for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.byteLength; }
    return result;
  } finally {
    signal.removeEventListener('abort', cancel);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

function safeJson(response, signal, max = 262_144) {
  if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') {
    void response.body?.cancel(); throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' });
  }
  return readExact(response, undefined, max, signal).then(bytes => {
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw Object.assign(new Error('INVALID_RESPONSE'), { code: 'INVALID_RESPONSE' }); }
  });
}

function mediaError(code, message = 'The private media request could not be completed.') {
  return Object.assign(new Error(message), { code });
}

/** Host-only private media transport. It never sends paths, tokens, URLs or storage handles to app frames. */
export class BrowserClinicMediaHost {
  constructor({ getContext, isCurrent, onPendingChange }) {
    this.getContext = getContext;
    this.isCurrent = isCurrent;
    this.onPendingChange = onPendingChange;
    this.transfers = new Map();
    this.receipts = new Map();
    this.requests = new Map();
  }

  hasTransfer(owner) { return this.transfers.has(owner); }

  cancel(owner, requestId) {
    const request = this.requests.get(owner)?.get(requestId);
    request?.controller.abort();
  }

  dispose(owner) {
    for (const request of this.requests.get(owner)?.values() ?? []) request.controller.abort();
    this.requests.delete(owner);
    this.discard(owner);
    this.receipts.delete(owner);
  }

  async handle(app, owner, attempt, message) {
    if (!appMediaOperationIsGranted(app, message.operation)) throw mediaError('FORBIDDEN', 'This app does not have permission for that media operation.');
    const context = this.getContext();
    if (!context.connected || !context.session || !context.user || !context.apiBaseUrl) throw mediaError('AUTH_REQUIRED', 'A verified clinic session is required.');
    const cap = app.id === 'patients' ? 'patient_record.access' : 'work_entry.access';
    if (!context.session.clinicUser?.capabilities?.includes(cap)) throw mediaError('FORBIDDEN', 'Your clinic role does not permit this media action.');
    const active = this.requests.get(owner) ?? new Map();
    if (active.size >= 2 || [...this.requests.values()].reduce((count, values) => count + values.size, 0) >= 4) throw mediaError('BUSY', 'The private media service is busy.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60_000);
    active.set(message.requestId, { controller }); this.requests.set(owner, active);
    const write = message.operation === 'clinic.media.upload';
    if (write) this.setPending(owner, true);
    try {
      if (message.operation === 'clinic.media.read') return await this.readPatientMedia(context, owner, attempt, message, controller.signal);
      if (!validateUpload(message.input)) throw mediaError('INVALID_REQUEST', 'The media upload request is invalid.');
      if (message.input.action === 'begin') return this.begin(owner, message.input);
      if (message.input.action === 'chunk') return this.chunk(owner, message.input);
      return this.finish(context, owner, attempt, message, controller.signal);
    } finally {
      clearTimeout(timeout);
      active.delete(message.requestId);
      if (!active.size) this.requests.delete(owner);
      if (write) this.setPending(owner, this.transfers.has(owner));
    }
  }

  setPending(owner, pending) {
    owner.mediaPending = pending;
    this.onPendingChange(owner, pending);
  }

  async fetch(context, owner, attempt, signal, path, method, { body, contentType, accept = 'application/json', key } = {}) {
    if (!this.isCurrent(owner.app, owner, attempt)) throw mediaError('STALE_SESSION', 'Clinic access changed. Reopen the app.');
    const base = new URL(context.apiBaseUrl);
    const url = new URL(path, base);
    if (base.protocol !== 'https:' || url.origin !== base.origin || url.pathname !== path || url.search || url.hash || url.username || url.password) {
      throw mediaError('FORBIDDEN', 'This private media route is not available.');
    }
    const token = await context.user.getIdToken();
    if (!this.isCurrent(owner.app, owner, attempt) || signal.aborted) throw mediaError('STALE_SESSION', 'Clinic access changed. Reopen the app.');
    const response = await fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${token}`, accept,
        ...(body !== undefined ? { 'content-type': contentType ?? 'application/json' } : {}),
        ...(key ? { 'idempotency-key': key } : {}),
      },
      ...(body !== undefined ? { body } : {}),
      credentials: 'omit', cache: 'no-store', redirect: 'manual', signal,
    });
    if (!this.isCurrent(owner.app, owner, attempt) || signal.aborted) { void response.body?.cancel(); throw mediaError('STALE_SESSION', 'Clinic access changed. Reopen the app.'); }
    if (response.redirected || response.status >= 300 && response.status < 400) { void response.body?.cancel(); throw mediaError('REDIRECT_DENIED'); }
    return response;
  }

  async readPatientMedia(context, owner, attempt, message, signal) {
    const input = message.input;
    if (!exactKeys(input, ['kind', 'recordId', 'assetId']) || input.kind !== 'patient_media' || !uuid(input.recordId) || !uuid(input.assetId)) {
      throw mediaError('INVALID_REQUEST', 'The private image request is invalid.');
    }
    const list = await this.fetch(context, owner, attempt, signal, `/v1/patients/${input.recordId}/media`, 'GET');
    if (list.status !== 200) { void list.body?.cancel(); throw mediaError(list.status === 403 ? 'ACCESS_DENIED' : list.status === 401 ? 'AUTH_REQUIRED' : 'INVALID_RESPONSE'); }
    const document = await safeJson(list, signal);
    const matches = document?.media?.filter(item => item?.mediaAssetId === input.assetId) ?? [];
    if (!Array.isArray(document?.media) || matches.length !== 1) throw mediaError('ACCESS_DENIED');
    const asset = matches[0];
    if (asset.patientId !== input.recordId || asset.status !== 'active' || !Number.isSafeInteger(asset.byteSize)
      || asset.byteSize < 1 || asset.byteSize > maxBytes || !mimeTypes.includes(asset.mimeType) || !hex64(asset.checksum)) {
      throw mediaError('INVALID_RESPONSE');
    }
    const response = await this.fetch(context, owner, attempt, signal, `/v1/patient-media/${input.assetId}/view`, 'POST', { accept: asset.mimeType });
    if (response.status !== 200 || response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== asset.mimeType) {
      void response.body?.cancel(); throw mediaError(response.status === 403 || response.status === 404 ? 'ACCESS_DENIED' : 'INVALID_RESPONSE');
    }
    const body = await readExact(response, asset.byteSize, maxBytes, signal);
    if (await sha256(body) !== asset.checksum || !this.isCurrent(owner.app, owner, attempt)) throw mediaError('INVALID_RESPONSE');
    return { status: 200, contentType: asset.mimeType, body };
  }

  begin(owner, input) {
    const fingerprint = JSON.stringify([input.kind, input.recordId, Object.fromEntries(Object.entries(input.metadata).sort(([a], [b]) => a.localeCompare(b))), input.replacement ?? null]);
    const terminal = this.receipts.get(owner) ?? new Map();
    this.receipts.set(owner, terminal);
    for (const [id, receipt] of terminal) if (receipt.key === input.idempotencyKey) {
      if (receipt.fingerprint !== fingerprint) throw mediaError('CONFLICT');
      return { transferId: id, received: receipt.total, total: receipt.total, ...receipt.result };
    }
    const existing = this.transfers.get(owner);
    if (existing) {
      if (existing.key === input.idempotencyKey && existing.fingerprint === fingerprint && !existing.expired) return { transferId: existing.id, received: existing.offset, total: existing.bytes.length };
      throw mediaError(existing.key === input.idempotencyKey ? 'CONFLICT' : 'BUSY');
    }
    if ([...this.transfers.values()].length >= 2 || [...this.receipts.values()].reduce((sum, map) => sum + map.size, 0) >= 128) throw mediaError('BUSY');
    const metadata = structuredClone(input.metadata);
    const transfer = { id: crypto.randomUUID(), replacement: input.replacement ? structuredClone(input.replacement) : undefined,
      kind: input.kind, recordId: input.recordId, metadata, key: input.idempotencyKey, fingerprint,
      bytes: new Uint8Array(metadata.byteSize), offset: 0, busy: false, expired: false, intended: false, assetId: undefined, timer: null };
    transfer.timer = setTimeout(() => { transfer.expired = true; if (!transfer.busy) this.discard(owner); }, 300_000);
    this.transfers.set(owner, transfer); this.setPending(owner, true);
    return { transferId: transfer.id, received: 0, total: transfer.bytes.length };
  }

  chunk(owner, input) {
    const transfer = this.require(owner, input.transferId);
    if (transfer.busy || transfer.intended) throw mediaError('BUSY');
    let binary;
    try { binary = atob(input.data); } catch { throw mediaError('INVALID_REQUEST'); }
    const chunk = Uint8Array.from(binary, char => char.charCodeAt(0)), offset = input.offset;
    if (chunk.length < 1 || chunk.length > 8192 || btoa(binary) !== input.data || offset > transfer.offset || offset + chunk.length > transfer.bytes.length) throw mediaError('VALIDATION');
    if (offset < transfer.offset) {
      if (offset + chunk.length > transfer.offset || chunk.some((value, index) => value !== transfer.bytes[offset + index])) throw mediaError('CONFLICT');
    } else { transfer.bytes.set(chunk, offset); transfer.offset += chunk.length; }
    return { transferId: transfer.id, received: transfer.offset, total: transfer.bytes.length };
  }

  require(owner, id) {
    const transfer = this.transfers.get(owner);
    if (!transfer || transfer.id !== id || transfer.expired) throw mediaError('CONFLICT');
    return transfer;
  }

  discard(owner) {
    const transfer = this.transfers.get(owner);
    if (!transfer) return;
    clearTimeout(transfer.timer); transfer.bytes.fill(0); this.transfers.delete(owner);
    this.setPending(owner, false);
  }

  complete(owner, transfer, result) {
    const receipts = this.receipts.get(owner) ?? new Map();
    receipts.set(transfer.id, { kind: transfer.kind, key: transfer.key, fingerprint: transfer.fingerprint, total: transfer.bytes.length, result: { ...result } });
    this.receipts.set(owner, receipts); this.discard(owner); return { ...result };
  }

  async json(response, signal) {
    if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') { void response.body?.cancel(); throw mediaError('UNKNOWN_OUTCOME'); }
    const bytes = await readExact(response, undefined, 262_144, signal);
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw mediaError('UNKNOWN_OUTCOME'); }
  }

  async finish(context, owner, attempt, message, signal) {
    const input = message.input;
    const receipts = this.receipts.get(owner);
    const prior = receipts?.get(input.transferId);
    if (prior) {
      if (prior.key !== input.idempotencyKey) throw mediaError('CONFLICT');
      return input.action === 'cancel' && prior.result.committed ? { ...prior.result, cancelled: false } : { ...prior.result };
    }
    const transfer = this.require(owner, input.transferId);
    if (transfer.key !== input.idempotencyKey) throw mediaError('CONFLICT');
    if (transfer.busy) throw mediaError('BUSY');
    const cancel = input.action === 'cancel';
    if (!cancel && transfer.offset !== transfer.bytes.length) throw mediaError('VALIDATION');
    if (cancel && !transfer.intended) return this.complete(owner, transfer, { cancelled: true, committed: false });
    transfer.busy = true;
    try {
      const checksum = await sha256(transfer.bytes);
      const subkey = async stage => sha256(new TextEncoder().encode(JSON.stringify([transfer.key, stage])));
      const call = async (path, method, body, stage, binary = false) => this.fetch(context, owner, attempt, signal, path, method, {
        body, contentType: binary ? transfer.metadata.mimeType : body === undefined ? undefined : 'application/json',
        key: stage ? await subkey(stage) : undefined,
      });
      const activeReceipt = async () => {
        const response = await call(`/v1/patients/${transfer.recordId}/media`, 'GET');
        if (response.status !== 200) { void response.body?.cancel(); return false; }
        const data = await this.json(response, signal);
        const matches = data?.media?.filter(item => item?.mediaAssetId === transfer.assetId) ?? [];
        const item = matches[0];
        return matches.length === 1 && item.status === 'active' && item.patientId === transfer.recordId
          && item.checksum === checksum && item.byteSize === transfer.bytes.length && item.mimeType === transfer.metadata.mimeType;
      };
      const verifyFinal = async response => {
        const data = await this.json(response, signal), item = data?.media;
        if (item?.mediaAssetId !== transfer.assetId || item.status !== 'active' || item.patientId !== transfer.recordId
          || item.checksum !== checksum || item.byteSize !== transfer.bytes.length || item.mimeType !== transfer.metadata.mimeType) throw mediaError('UNKNOWN_OUTCOME');
      };
      if (!transfer.assetId) {
        const path = transfer.replacement ? `/v1/patient-media/${transfer.replacement.assetId}/replace` : '/v1/patient-media/upload-intents';
        const metadata = { ...transfer.metadata, checksum, patientId: transfer.recordId, assetType: 'xray', ...(transfer.replacement ? { reason: transfer.replacement.reason } : {}) };
        const priorIntent = transfer.intended; transfer.intended = true;
        const response = await call(path, 'POST', JSON.stringify(metadata), 'intent');
        if (response.status !== 201) {
          void response.body?.cancel();
          if (!priorIntent && [400, 422].includes(response.status)) transfer.intended = false;
          throw mediaError([400, 422].includes(response.status) ? 'VALIDATION' : response.status === 409 ? 'CONFLICT' : 'UNKNOWN_OUTCOME');
        }
        const data = await this.json(response, signal), intent = data?.uploadIntent, item = intent?.media;
        if (!uuid(item?.mediaAssetId)) throw mediaError('UNKNOWN_OUTCOME');
        transfer.assetId = item.mediaAssetId;
        const contentPath = `/v1/patient-media/${transfer.assetId}/content`;
        if (intent.uploadUrl !== new URL(contentPath, context.apiBaseUrl).href || !exactKeys(intent.uploadHeaders, ['content-type'])
          || intent.uploadHeaders['content-type'] !== transfer.metadata.mimeType || item.checksum !== checksum
          || item.byteSize !== transfer.bytes.length || item.mimeType !== transfer.metadata.mimeType || item.patientId !== transfer.recordId) throw mediaError('UNKNOWN_OUTCOME');
      }
      const basePath = `/v1/patient-media/${transfer.assetId}`;
      if (cancel) {
        const response = await call(`${basePath}/abort`, 'POST', undefined, 'abort');
        if (response.status === 204) return this.complete(owner, transfer, { cancelled: true, committed: false });
        void response.body?.cancel();
        if (response.status === 409 && await activeReceipt()) return this.complete(owner, transfer, { cancelled: false, committed: true, assetId: transfer.assetId });
        throw mediaError('UNKNOWN_OUTCOME');
      }
      const uploaded = await call(`${basePath}/content`, 'PUT', transfer.bytes, undefined, true);
      if (uploaded.status !== 204) {
        void uploaded.body?.cancel();
        if (uploaded.status !== 409) throw mediaError('UNKNOWN_OUTCOME');
        if (await activeReceipt()) return this.complete(owner, transfer, { committed: true, assetId: transfer.assetId });
        const recovered = await call(`${basePath}/finalise`, 'POST', undefined, 'finalise');
        if (recovered.status === 200) { await verifyFinal(recovered); return this.complete(owner, transfer, { committed: true, assetId: transfer.assetId }); }
        void recovered.body?.cancel();
        if (recovered.status === 409 && await activeReceipt()) return this.complete(owner, transfer, { committed: true, assetId: transfer.assetId });
        throw mediaError('UNKNOWN_OUTCOME');
      }
      const finalised = await call(`${basePath}/finalise`, 'POST', undefined, 'finalise');
      if (finalised.status === 200) await verifyFinal(finalised);
      else {
        void finalised.body?.cancel();
        if (finalised.status !== 409 || !await activeReceipt()) throw mediaError('UNKNOWN_OUTCOME');
      }
      if (!this.isCurrent(owner.app, owner, attempt)) throw mediaError('STALE_SESSION');
      return this.complete(owner, transfer, { committed: true, assetId: transfer.assetId });
    } finally {
      transfer.busy = false;
      if (transfer.expired && this.transfers.get(owner) === transfer) this.discard(owner);
    }
  }
}
