import { ClinicError, clinicClient } from '@/sdk/client';
import { SDK, type AppSdk, type Connection } from '../../../../../../../packages/browser-sdk/src/contracts';
import type { PatientMediaAsset, PatientXrayType } from '@/features/patients/types';

type MediaResponse = { status: number; contentType: string; body: Uint8Array };
type MediaReceipt = { transferId: string; received: number; total: number };
type PendingUpload = { transferId: string; key: string; file: File; offset: number; total: number };
type XrayMetadata = {
  chiefComplaintId: string | null;
  xrayType: PatientXrayType;
  toothCode: string | null;
  clinicalNote: string | null;
  capturedOn: string;
};

const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value)) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isMediaAsset = (value: unknown): value is PatientMediaAsset => isObject(value)
  && typeof value.mediaAssetId === 'string' && typeof value.patientId === 'string'
  && value.assetType === 'xray' && typeof value.displayFilename === 'string'
  && typeof value.status === 'string' && typeof value.createdAt === 'string'
  && (value.xrayType === null || ['IOPA', 'OPG', 'CBCT', 'Intraoral photo'].includes(value.xrayType as string))
  && acceptedTypes.includes(value.mimeType as typeof acceptedTypes[number])
  && Number.isSafeInteger(value.byteSize) && (value.byteSize as number) > 0;

/** Private patient images stay behind the OS media bridge and host-held clinic credentials. */
class WorkEntryMediaSdk {
  private connection?: Promise<Connection>;
  constructor(private readonly bridge: AppSdk) {}

  private connect() {
    this.connection ??= this.bridge.connect({ major: SDK.major, minor: SDK.minor }).then(result => {
      if (!result.ok) throw new ClinicError(result.error.code, result.error.message, result.error.outcome);
      if (!result.value.capabilities.includes('clinic.media.read') && !result.value.capabilities.includes('clinic.media.upload')) {
        throw new ClinicError('FORBIDDEN', 'Private radiograph permissions are unavailable for this Work Entry release.');
      }
      return result.value;
    });
    return this.connection;
  }

  private async request<T>(operation: 'clinic.media.read' | 'clinic.media.upload', input: Record<string, unknown>): Promise<T> {
    const connection = await this.connect();
    if (!connection.capabilities.includes(operation)) throw new ClinicError('FORBIDDEN', `This Work Entry release does not have ${operation} permission.`);
    const result = await this.bridge.request({ version: 1, connection: connection.connection, generation: connection.generation,
      requestId: crypto.randomUUID(), operation, input });
    if (!result.ok) throw new ClinicError(result.error.code, result.error.message, result.error.outcome, result.error.operationId);
    return result.value as T;
  }

  async list(patientId: string): Promise<PatientMediaAsset[]> {
    const result = await clinicClient().read<{ media?: unknown }>(`/v1/patients/${patientId}/media`);
    if (!Array.isArray(result?.media) || !result.media.every(isMediaAsset)) {
      throw new ClinicError('INVALID_RESPONSE', 'The patient radiograph list returned an invalid response.');
    }
    return result.media.filter(asset => asset.status === 'active');
  }

  async view(patientId: string, mediaAssetId: string): Promise<string> {
    const result = await this.request<MediaResponse>('clinic.media.read', { kind: 'patient_media', recordId: patientId, assetId: mediaAssetId });
    if (result.status !== 200 || !acceptedTypes.includes(result.contentType as typeof acceptedTypes[number]) || !(result.body instanceof Uint8Array)) {
      throw new ClinicError('INVALID_RESPONSE', 'The private radiograph could not be verified.');
    }
    return URL.createObjectURL(new Blob([new Uint8Array(result.body)], { type: result.contentType }));
  }

  async upload(patientId: string, file: File, metadata: XrayMetadata, onProgress?: (sent: number) => void): Promise<string> {
    if (!acceptedTypes.includes(file.type as typeof acceptedTypes[number]) || file.size < 1 || file.size > 10 * 1024 * 1024 || !dateValid(metadata.capturedOn)) {
      throw new ClinicError('VALIDATION', 'Choose a JPEG, PNG or WebP image up to 10 MiB and a valid capture date.');
    }
    const key = crypto.randomUUID();
    const input = { action: 'begin', kind: 'patient_media', recordId: patientId,
      metadata: { ...metadata, displayFilename: file.name.slice(0, 200), mimeType: file.type, byteSize: file.size }, idempotencyKey: key };
    const begun = await this.request<MediaReceipt>('clinic.media.upload', input);
    if (!begun.transferId || begun.total !== file.size || begun.received !== 0) {
      throw new ClinicError('INVALID_RESPONSE', 'The image transfer receipt is invalid.');
    }
    const pending: PendingUpload = { transferId: begun.transferId, key, file, offset: 0, total: file.size };
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.length !== pending.total) throw new ClinicError('VALIDATION', 'The selected image changed. Select it again.');
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      const chunk = bytes.subarray(offset, Math.min(offset + 8192, bytes.length));
      let binary = '';
      for (const byte of chunk) binary += String.fromCharCode(byte);
      const receipt = await this.request<MediaReceipt>('clinic.media.upload', {
        action: 'chunk', transferId: pending.transferId, offset, data: btoa(binary),
      });
      if (receipt.received !== offset + chunk.length) throw new ClinicError('UNKNOWN_OUTCOME', 'The image transfer state is uncertain.', 'unknown');
      pending.offset = receipt.received;
      onProgress?.(receipt.received);
    }
    const saved = await this.request<{ committed: boolean; assetId: string }>('clinic.media.upload', {
      action: 'commit', transferId: pending.transferId, idempotencyKey: pending.key,
    });
    if (!saved.committed || typeof saved.assetId !== 'string') throw new ClinicError('INVALID_RESPONSE', 'The image upload did not return a saved image.');
    return saved.assetId;
  }
}

function mediaSdk() {
  if (!window.dentalApp) throw new ClinicError('STALE_SESSION', 'The Dental OS media service is unavailable. Reopen Work Entry from Dental OS.');
  return new WorkEntryMediaSdk(window.dentalApp);
}

export const patientMediaApi = {
  listPatientMedia(patientId: string) { return mediaSdk().list(patientId); },
  viewPatientMedia(patientId: string, mediaAssetId: string) { return mediaSdk().view(patientId, mediaAssetId); },
  uploadPatientMedia(patientId: string, file: File, metadata: XrayMetadata, onProgress?: (sent: number) => void) {
    return mediaSdk().upload(patientId, file, metadata, onProgress);
  },
  async withdrawPatientMedia(mediaAssetId: string, reason: string): Promise<void> {
    if (!reason.trim() || reason.length > 500) throw new ClinicError('VALIDATION', 'A short removal reason is required.');
    await clinicClient().command<Record<string, unknown>>('POST', `/v1/patient-media/${mediaAssetId}/withdraw`, { reason }, isObject).execute();
  },
};
