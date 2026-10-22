import { validMediaUpload } from './mediaUploadContract';
import { createHash, randomUUID } from 'node:crypto';
import { readExact, type MediaKind } from './mediaRead';
import type { ErrorCode, Outcome } from './contracts';
export const uploadKindForApp = (appId: string): MediaKind | undefined => appId === 'company.dental.patient-record' ? 'patient_media' : appId === 'company.dental.staff' ? 'staff_document' : undefined;
export class MediaUploadError extends Error { constructor(readonly code: ErrorCode, readonly outcome: Outcome = 'not_sent') { super(code); } }
type Transfer = { replacement?: { assetId: string; reason: string }; id: string; kind: MediaKind; recordId: string; metadata: Record<string, unknown>; key: string; fingerprint: string; bytes: Uint8Array; offset: number; busy: boolean; expired: boolean; intended: boolean; assetId?: string; timer: ReturnType<typeof setTimeout> };
type Context = { apiBase: string; token: string; signal: AbortSignal; requestId: string; assertCurrent(): void; dispatched(): void; rejected(status: 401 | 403): void; transport(url: string, init: RequestInit): Promise<Response> };
const hash = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');
const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);

/** At most two transient explicit transfers, one per registration. No files, queue or automatic network retries. */
export class MediaUploads {
  private transfers = new Map<object, Transfer>();
  private terminal = new Map<object, Map<string, { kind: MediaKind; key: string; fingerprint: string; total: number; result: { committed: boolean; cancelled?: boolean; assetId?: string } }>>();
  constructor(private changed: (owner: object) => void = () => {}) {}
  kind(owner: object, transferId: unknown): MediaKind | undefined { const t = this.transfers.get(owner); return t && t.id === transferId ? t.kind : this.terminal.get(owner)?.get(transferId as string)?.kind; }
  needsRemote(owner: object, input: Record<string, unknown>) {
    if (this.terminal.get(owner)?.has(input.transferId as string)) return false;
    return input.action === 'commit' || !!this.transfers.get(owner)?.intended;
  }
  has(owner: object) { return this.transfers.has(owner); }
  discard(owner: object) { const t = this.transfers.get(owner); if (!t) return; clearTimeout(t.timer); t.bytes.fill(0); this.transfers.delete(owner); this.changed(owner); }
  forget(owner: object) { this.discard(owner); this.terminal.delete(owner); }
  dispose() { for (const owner of this.transfers.keys()) this.discard(owner); this.terminal.clear(); }
  private complete(owner: object, t: Transfer, result: { committed: boolean; cancelled?: boolean; assetId?: string }) {
    const receipts = this.terminal.get(owner) ?? new Map();
    receipts.set(t.id, { kind: t.kind, key: t.key, fingerprint: t.fingerprint, total: t.bytes.length, result: { ...result } }); this.terminal.set(owner, receipts);
    this.discard(owner); return { ...result };
  }
  begin(owner: object, input: Record<string, unknown>) {
    if (!validMediaUpload(input)) throw new MediaUploadError('INVALID_REQUEST');
    const fingerprint = hash(JSON.stringify([input.kind, input.recordId, Object.fromEntries(Object.entries(input.metadata as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))), input.replacement ?? null])), prior = this.transfers.get(owner);
    for (const [id, receipt] of this.terminal.get(owner) ?? []) if (receipt.key === input.idempotencyKey) {
      if (receipt.fingerprint !== fingerprint) throw new MediaUploadError('CONFLICT');
      return { transferId: id, received: receipt.total, total: receipt.total, ...receipt.result };
    }
    if ([...this.terminal.values()].reduce((sum, receipts) => sum + receipts.size, 0) >= 128) throw new MediaUploadError('BUSY');
    if (prior) {
      if (prior.key === input.idempotencyKey && prior.fingerprint === fingerprint && !prior.expired) return { transferId: prior.id, received: prior.offset, total: prior.bytes.length };
      throw new MediaUploadError(prior.key === input.idempotencyKey ? 'CONFLICT' : 'BUSY');
    }
    if (this.transfers.size >= 2) throw new MediaUploadError('BUSY');
    const metadata = structuredClone(input.metadata) as Record<string, unknown>;
    const t: Transfer = { id: randomUUID(), replacement: input.replacement ? structuredClone(input.replacement) as Transfer['replacement'] : undefined, kind: input.kind as MediaKind, recordId: input.recordId as string, metadata, key: input.idempotencyKey as string, fingerprint, bytes: new Uint8Array(metadata.byteSize as number), offset: 0, busy: false, expired: false, intended: false, timer: undefined! };
    t.timer = setTimeout(() => { t.expired = true; if (!t.busy) this.discard(owner); }, 300_000); t.timer.unref?.();
    this.transfers.set(owner, t); this.changed(owner);
    return { transferId: t.id, received: 0, total: t.bytes.length };
  }
  chunk(owner: object, input: Record<string, unknown>) {
    if (!validMediaUpload(input)) throw new MediaUploadError('INVALID_REQUEST');
    const t = this.require(owner, input.transferId);
    if (t.busy || t.intended) throw new MediaUploadError('BUSY');
    const chunk = Buffer.from(input.data as string, 'base64'), offset = input.offset as number;
    if (chunk.length < 1 || chunk.length > 8192 || chunk.toString('base64') !== input.data || offset > t.offset || offset + chunk.length > t.bytes.length) throw new MediaUploadError('VALIDATION');
    if (offset < t.offset) {
      if (offset + chunk.length > t.offset || !Buffer.from(t.bytes.subarray(offset, offset + chunk.length)).equals(chunk)) throw new MediaUploadError('CONFLICT');
    } else { t.bytes.set(chunk, offset); t.offset += chunk.length; }
    return { transferId: t.id, received: t.offset, total: t.bytes.length };
  }
  private require(owner: object, id: unknown) {
    const t = this.transfers.get(owner);
    if (!t || t.id !== id || t.expired) throw new MediaUploadError('CONFLICT');
    return t;
  }
  async finish(owner: object, input: Record<string, unknown>, context: Context) {
    if (!validMediaUpload(input)) throw new MediaUploadError('INVALID_REQUEST');
    const receipt = this.terminal.get(owner)?.get(input.transferId as string);
    if (receipt) {
      if (receipt.key !== input.idempotencyKey) throw new MediaUploadError('CONFLICT');
      return input.action === 'cancel' && receipt.result.committed ? { ...receipt.result, cancelled: false } : { ...receipt.result };
    }
    const t = this.require(owner, input.transferId);
    if (t.key !== input.idempotencyKey) throw new MediaUploadError('CONFLICT');
    if (t.busy) throw new MediaUploadError('BUSY');
    const cancel = input.action === 'cancel';
    if (!cancel && t.offset !== t.bytes.length) throw new MediaUploadError('VALIDATION');
    if (cancel && !t.intended) { return this.complete(owner, t, { cancelled: true, committed: false }); }
    t.busy = true;
    const checksum = hash(t.bytes), subkey = (stage: string) => hash(JSON.stringify([t.key, stage]));
    const call = async (path: string, method: string, body: string | Uint8Array | undefined, stage?: string, binary = false) => {
      context.assertCurrent();
      const url = new URL(path, context.apiBase); if (url.origin !== context.apiBase || url.username || url.password || url.hash) throw new MediaUploadError('FORBIDDEN');
      const headers: Record<string, string> = { authorization: `Bearer ${context.token}`, accept: 'application/json', 'x-request-id': context.requestId };
      if (body !== undefined) headers['content-type'] = binary ? t.metadata.mimeType as string : 'application/json';
      if (stage) headers['idempotency-key'] = subkey(stage);
      context.dispatched();
      const response = await context.transport(url.href, { method, headers, ...(body === undefined ? {} : { body: body as BodyInit }), redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: context.signal });
      try { context.assertCurrent(); } catch (cause) { void response.body?.cancel(); throw cause; }
      if (response.redirected || response.status >= 300 && response.status < 400) { void response.body?.cancel(); throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown'); }
      if ([401, 403].includes(response.status)) { context.rejected(response.status as 401 | 403); void response.body?.cancel(); throw new MediaUploadError(response.status === 401 ? 'AUTH_REQUIRED' : 'ACCESS_DENIED', 'unknown'); }
      if (response.status >= 500) { void response.body?.cancel(); throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown'); }
      return response;
    };
    const json = async (response: Response): Promise<Record<string, any>> => {
      if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') { void response.body?.cancel(); throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown'); }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await readExact(response, undefined, 262_144, context.signal))); }
      catch { throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown'); }
    };
    const knownActive = async () => {
      const path = t.kind === 'patient_media' ? `/v1/patients/${t.recordId}/media` : `/v1/clinic/staff/${t.recordId}/documents`;
      const response = await call(path, 'GET', undefined);
      if (response.status !== 200) { void response.body?.cancel(); return false; }
      const data = await json(response), values = data?.[t.kind === 'patient_media' ? 'media' : 'documents'];
      if (!Array.isArray(values)) return false;
      const matches = values.filter(value => value?.[t.kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId'] === t.assetId);
      return matches.length === 1 && matches[0].status === 'active' && matches[0][t.kind === 'patient_media' ? 'patientId' : 'staffId'] === t.recordId && matches[0].checksum === checksum && matches[0].byteSize === t.bytes.length && matches[0].mimeType === t.metadata.mimeType;
    };
    try {
      if (!t.assetId) {
        const path = t.kind === 'patient_media' ? t.replacement ? `/v1/patient-media/${t.replacement.assetId}/replace` : '/v1/patient-media/upload-intents' : `/v1/clinic/staff/${t.recordId}/documents`;
        const metadata = { ...t.metadata, checksum, ...(t.kind === 'patient_media' ? { patientId: t.recordId, assetType: 'xray', ...(t.replacement ? { reason: t.replacement.reason } : {}) } : {}) };
        const priorIntentAttempt = t.intended; t.intended = true;
        const response = await call(path, 'POST', JSON.stringify(metadata), 'intent');
        if (response.status !== 201) { void response.body?.cancel(); if (!priorIntentAttempt && [400, 422].includes(response.status)) t.intended = false; throw new MediaUploadError([400, 422].includes(response.status) ? 'VALIDATION' : 'CONFLICT', 'rejected'); }
        const result = await json(response), intent = result?.uploadIntent, item = intent?.[t.kind === 'patient_media' ? 'media' : 'document'];
        const id = item?.[t.kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId'];
        if (!uuid(id)) throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
        const contentPath = t.kind === 'patient_media' ? `/v1/patient-media/${id}/content` : `/v1/clinic/staff/${t.recordId}/documents/${id}/content`;
        if (intent.uploadUrl !== context.apiBase + contentPath || !intent.uploadHeaders || Object.keys(intent.uploadHeaders).join() !== 'content-type' || intent.uploadHeaders['content-type'] !== t.metadata.mimeType || item.checksum !== checksum || item.byteSize !== t.bytes.length || item.mimeType !== t.metadata.mimeType || item[t.kind === 'patient_media' ? 'patientId' : 'staffId'] !== t.recordId) throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
        t.assetId = id;
      }
      const path = t.kind === 'patient_media' ? `/v1/patient-media/${t.assetId}` : `/v1/clinic/staff/${t.recordId}/documents/${t.assetId}`;
      if (cancel) {
        const response = await call(path + '/abort', 'POST', undefined, 'abort');
        if (response.status !== 204) {
          void response.body?.cancel();
          if (response.status === 409 && await knownActive()) { const assetId = t.assetId; return this.complete(owner, t, { cancelled: false, committed: true, assetId }); }
          throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
        }
        return this.complete(owner, t, { cancelled: true, committed: false });
      }
      const uploaded = await call(path + '/content', 'PUT', t.bytes, undefined, true);
      if (uploaded.status !== 204) {
        void uploaded.body?.cancel();
        if (uploaded.status === 409) {
          if (await knownActive()) { const assetId = t.assetId; return this.complete(owner, t, { committed: true, assetId }); }
          // A prior session may have completed the R2 PUT and ended before finalise.
          // The Worker verifies the stored object against the pending record before activation.
          const recovered = await call(path + '/finalise', 'POST', undefined, 'finalise');
          if (recovered.status === 200) {
            const data = await json(recovered), item = data?.[t.kind === 'patient_media' ? 'media' : 'document'];
            if (item?.[t.kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId'] !== t.assetId || item.status !== 'active' || item.checksum !== checksum || item.byteSize !== t.bytes.length || item.mimeType !== t.metadata.mimeType || item[t.kind === 'patient_media' ? 'patientId' : 'staffId'] !== t.recordId) throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
            context.assertCurrent(); const assetId = t.assetId; return this.complete(owner, t, { committed: true, assetId });
          }
          void recovered.body?.cancel();
          if (recovered.status === 409 && await knownActive()) { const assetId = t.assetId; return this.complete(owner, t, { committed: true, assetId }); }
          throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
        }
        throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
      }
      const finalised = await call(path + '/finalise', 'POST', undefined, 'finalise');
      if (finalised.status !== 200) {
        void finalised.body?.cancel();
        if (finalised.status !== 409 || !await knownActive()) throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
      } else {
        const data = await json(finalised), item = data?.[t.kind === 'patient_media' ? 'media' : 'document'];
        if (item?.[t.kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId'] !== t.assetId || item.status !== 'active' || item.checksum !== checksum || item.byteSize !== t.bytes.length || item.mimeType !== t.metadata.mimeType || item[t.kind === 'patient_media' ? 'patientId' : 'staffId'] !== t.recordId) throw new MediaUploadError('UNKNOWN_OUTCOME', 'unknown');
      }
      context.assertCurrent(); const assetId = t.assetId; return this.complete(owner, t, { committed: true, assetId });
    } finally { t.busy = false; if (t.expired && this.transfers.get(owner) === t) this.discard(owner); }
  }
}
