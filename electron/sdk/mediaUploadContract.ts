// Renderer-safe upload envelope validation; no transport, credential or native imports.
const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v);
const text = (v: unknown, max: number, empty = true) => typeof v === 'string' && v.length <= max && (empty || v.length > 0) && !/[\u0000-\u001f\u007f]/.test(v);
const shape = (v: unknown, names: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join() === names.sort().join();
const nullable = (v: unknown, max: number) => v === null || text(v, max);
const date = (v: unknown) => v === null || typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
export function uploadMetadata(kind: unknown, value: unknown): value is Record<string, unknown> {
  const common = ['displayFilename', 'mimeType', 'byteSize'];
  const patient = kind === 'patient_media'; if (!patient && kind !== 'staff_document') return false;
  if (!shape(value, [...common, ...(patient ? ['chiefComplaintId', 'xrayType', 'toothCode', 'clinicalNote', 'capturedOn'] : ['documentType', 'expiresOn'])])) return false;
  if (!text(value.displayFilename, 200, false) || !Number.isSafeInteger(value.byteSize) || (value.byteSize as number) < 1 || (value.byteSize as number) > (patient ? 10 : 25) * 1024 * 1024 || !['image/jpeg', 'image/png', 'image/webp', ...(patient ? [] : ['application/pdf'])].includes(value.mimeType as string)) return false;
  return patient ? (value.chiefComplaintId === null || uuid(value.chiefComplaintId)) && ['IOPA', 'OPG', 'CBCT', 'Intraoral photo'].includes(value.xrayType as string) && nullable(value.toothCode, 40) && nullable(value.clinicalNote, 1000) && date(value.capturedOn)
    : ['identity', 'license', 'contract', 'certificate', 'other'].includes(value.documentType as string) && date(value.expiresOn);
}
export function validMediaUpload(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>, key = (input: unknown) => typeof input === 'string' && /^[a-zA-Z0-9_-]{8,64}$/.test(input);
  if (v.action === 'begin') {
    const replacement = v.replacement;
    const validReplacement = replacement === undefined || replacement === null || v.kind === 'patient_media' && shape(replacement, ['assetId', 'reason']) && uuid(replacement.assetId) && text(replacement.reason, 500, false);
    return shape(v, ['action', 'kind', 'recordId', 'metadata', 'idempotencyKey', ...(Object.hasOwn(v, 'replacement') ? ['replacement'] : [])]) && uuid(v.recordId) && key(v.idempotencyKey) && uploadMetadata(v.kind, v.metadata) && validReplacement;
  }
  if (v.action === 'chunk') return shape(v, ['action', 'transferId', 'offset', 'data']) && uuid(v.transferId) && Number.isSafeInteger(v.offset) && (v.offset as number) >= 0 && typeof v.data === 'string' && v.data.length > 0 && v.data.length <= 10_924 && /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.data);
  return ['commit', 'cancel'].includes(v.action as string) && shape(v, ['action', 'transferId', 'idempotencyKey']) && uuid(v.transferId) && key(v.idempotencyKey);
}
