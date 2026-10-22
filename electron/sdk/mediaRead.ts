import { createHash } from 'node:crypto';

export type MediaKind = 'patient_media' | 'staff_document';
export const MEDIA_LIMITS = Object.freeze({ patient_media: 10 * 1024 * 1024, staff_document: 25 * 1024 * 1024 });
export function mediaKindForApp(appId: string): MediaKind | undefined {
  if (['company.dental.patient-record', 'company.dental.work-entry'].includes(appId)) return 'patient_media';
  if (appId === 'company.dental.staff') return 'staff_document';
}
export class MediaReadError extends Error {
  constructor(readonly code: 'INVALID_RESPONSE' | 'REDIRECT_DENIED' | 'AUTH_REQUIRED' | 'ACCESS_DENIED' | 'CONFLICT' | 'MAINTENANCE') { super(code); }
}
type Context = {
  apiBase: string; token: string; signal: AbortSignal; requestId: string;
  transport(url: string, init: RequestInit): Promise<Response>;
  assertCurrent(): void;
  rejected(status: 401 | 403): void;
};
const mimeTypes = { patient_media: ['image/jpeg', 'image/png', 'image/webp'], staff_document: ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] };

async function readExact(response: Response, expected: number | undefined, maximum: number, signal: AbortSignal): Promise<Uint8Array> {
  const length = response.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > maximum || expected !== undefined && Number(length) !== expected)) {
    void response.body?.cancel(); throw new MediaReadError('INVALID_RESPONSE');
  }
  if (!response.body) throw new MediaReadError('INVALID_RESPONSE');
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  const output = expected === undefined ? undefined : new Uint8Array(expected); let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw new Error('Aborted');
    while (true) {
      const part = await reader.read();
      if (signal.aborted) throw new Error('Aborted');
      if (part.done) break;
      if (size + part.value.byteLength > (expected ?? maximum)) throw new MediaReadError('INVALID_RESPONSE');
      if (output) output.set(part.value, size); else chunks.push(part.value);
      size += part.value.byteLength;
    }
    if (expected !== undefined && size !== expected) throw new MediaReadError('INVALID_RESPONSE');
    if (output) return output;
    const bytes = new Uint8Array(size); let offset = 0;
    for (const part of chunks) { bytes.set(part, offset); offset += part.length; }
    return bytes;
  } finally { signal.removeEventListener('abort', abort); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Only host-derived paths and fresh authenticated metadata select an object or its integrity bounds. */
export async function readClinicMedia(input: { kind: MediaKind; recordId: string; assetId: string }, context: Context) {
  const { kind, recordId, assetId } = input;
  const listPath = kind === 'patient_media' ? `/v1/patients/${recordId}/media` : `/v1/clinic/staff/${recordId}/documents`;
  const get = async (path: string, method: 'GET' | 'POST', accept: string) => {
    context.assertCurrent();
    const url = new URL(path, context.apiBase);
    if (url.origin !== context.apiBase || url.username || url.password || url.hash) throw new MediaReadError('ACCESS_DENIED');
    const response = await context.transport(url.href, { method, headers: { authorization: `Bearer ${context.token}`, accept, 'x-request-id': context.requestId }, redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: context.signal });
    try { context.assertCurrent(); } catch (cause) { void response.body?.cancel(); throw cause; }
    if (response.redirected || response.status >= 300 && response.status < 400) { void response.body?.cancel(); throw new MediaReadError('REDIRECT_DENIED'); }
    if (!response.ok) {
      void response.body?.cancel();
      if (response.status === 401 || response.status === 403) context.rejected(response.status);
      throw new MediaReadError(response.status === 401 ? 'AUTH_REQUIRED' : [403, 404].includes(response.status) ? 'ACCESS_DENIED' : response.status === 409 ? 'CONFLICT' : 'MAINTENANCE');
    }
    if (response.status !== 200) { void response.body?.cancel(); throw new MediaReadError('INVALID_RESPONSE'); }
    return response;
  };
  const metadataResponse = await get(listPath, 'GET', 'application/json');
  if (metadataResponse.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== 'application/json') { void metadataResponse.body?.cancel(); throw new MediaReadError('INVALID_RESPONSE'); }
  const bytes = await readExact(metadataResponse, undefined, 262_144, context.signal);
  let document: Record<string, unknown>;
  try { document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new MediaReadError('INVALID_RESPONSE'); }
  const entries = document && document[kind === 'patient_media' ? 'media' : 'documents'];
  if (!Array.isArray(entries)) throw new MediaReadError('INVALID_RESPONSE');
  const matches = entries.filter(value => !!value && typeof value === 'object' && value[kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId'] === assetId);
  if (matches.length !== 1) throw new MediaReadError('ACCESS_DENIED');
  const asset = matches[0], size: unknown = asset.byteSize, mime: unknown = asset.mimeType, checksum: unknown = asset.checksum;
  if (asset[kind === 'patient_media' ? 'patientId' : 'staffId'] !== recordId || asset.status !== 'active' || !Number.isSafeInteger(size) || (size as number) < 1 || (size as number) > MEDIA_LIMITS[kind] || typeof mime !== 'string' || !mimeTypes[kind].includes(mime) || typeof checksum !== 'string' || !/^[a-f0-9]{64}$/.test(checksum)) throw new MediaReadError('INVALID_RESPONSE');
  context.assertCurrent();
  const path = kind === 'patient_media' ? `/v1/patient-media/${assetId}/view` : `/v1/clinic/staff/${recordId}/documents/${assetId}/download`;
  const response = await get(path, 'POST', mime);
  if (response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() !== mime) { void response.body?.cancel(); throw new MediaReadError('INVALID_RESPONSE'); }
  const body = await readExact(response, size as number, MEDIA_LIMITS[kind], context.signal);
  if (createHash('sha256').update(body).digest('hex') !== checksum) throw new MediaReadError('INVALID_RESPONSE');
  context.assertCurrent();
  return { status: 200 as const, contentType: mime, body };
}
