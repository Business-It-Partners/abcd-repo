import { BrowserClinicClient, ClinicError } from './browserClinicClient';

export type PatientXrayType = 'IOPA' | 'OPG' | 'CBCT' | 'Intraoral photo';
export type PatientXrayMetadata = {
  chiefComplaintId: string | null;
  xrayType: PatientXrayType;
  toothCode: string | null;
  clinicalNote: string | null;
  capturedOn: string;
  displayFilename: string;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
  byteSize: number;
};
export type PatientMediaPending = { transferId: string; key: string; file: File; offset: number; total: number; patientId: string };
export type PatientMediaReceipt = { committed: boolean; assetId: string };
type MediaResponse = { status: number; contentType: string; body: Uint8Array };
type MediaTransferReceipt = { transferId: string; received: number; total: number };

const imageTypes = ['image/jpeg', 'image/png', 'image/webp'];
const dateValid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;

/** Shared browser bridge for private patient images. Tokens and storage URLs stay in the host. */
export class PatientMediaClient {
  constructor(private readonly sdk: BrowserClinicClient) {}

  private request<T>(input: Record<string, unknown>): Promise<T> {
    return this.sdk.mediaRequest<T>('clinic.media.upload', input);
  }

  async view(patientId: string, assetId: string): Promise<string> {
    const result = await this.sdk.mediaRequest<MediaResponse>('clinic.media.read', {
      kind: 'patient_media', recordId: patientId, assetId,
    });
    if (result.status !== 200 || !imageTypes.includes(result.contentType) || !(result.body instanceof Uint8Array)) {
      throw new ClinicError('INVALID_RESPONSE', 'The private image could not be verified.');
    }
    return URL.createObjectURL(new Blob([new Uint8Array(result.body)], { type: result.contentType }));
  }

  async begin(
    patientId: string,
    file: File,
    metadata: Omit<PatientXrayMetadata, 'displayFilename' | 'mimeType' | 'byteSize'>,
    replacement?: { assetId: string; reason: string },
  ): Promise<PatientMediaPending> {
    if (file.size < 1 || file.size > 10 * 1024 * 1024 || !imageTypes.includes(file.type) || !dateValid(metadata.capturedOn)) {
      throw new ClinicError('VALIDATION', 'Choose a JPEG, PNG or WebP up to 10 MiB and a valid capture date.');
    }
    const key = crypto.randomUUID();
    const fields: PatientXrayMetadata = {
      displayFilename: file.name.slice(0, 200),
      mimeType: file.type as PatientXrayMetadata['mimeType'],
      byteSize: file.size,
      ...metadata,
    };
    const input: Record<string, unknown> = {
      action: 'begin', kind: 'patient_media', recordId: patientId, metadata: fields, idempotencyKey: key,
    };
    if (replacement) input.replacement = replacement;
    const receipt = await this.request<MediaTransferReceipt>(input);
    if (!receipt.transferId || receipt.total !== file.size || !Number.isSafeInteger(receipt.received)
      || receipt.received < 0 || receipt.received > file.size) {
      throw new ClinicError('INVALID_RESPONSE', 'The image transfer receipt is invalid.');
    }
    return { transferId: receipt.transferId, key, file, offset: receipt.received, total: file.size, patientId };
  }

  async transfer(pending: PatientMediaPending, onProgress?: (sent: number) => void): Promise<PatientMediaReceipt> {
    try {
      const bytes = new Uint8Array(await pending.file.arrayBuffer());
      if (bytes.length !== pending.total) throw new ClinicError('VALIDATION', 'The selected file changed. Re-select the same file.');
      for (let i = pending.offset; i < bytes.length; i += 8192) {
        const chunk = bytes.subarray(i, Math.min(i + 8192, bytes.length));
        const data = btoa(Array.from(chunk, value => String.fromCharCode(value)).join(''));
        const receipt = await this.request<MediaTransferReceipt>({ action: 'chunk', transferId: pending.transferId, offset: i, data });
        if (receipt.received !== i + chunk.length) {
          throw new ClinicError('UNKNOWN_OUTCOME', 'The image transfer state is uncertain.', 'unknown');
        }
        pending.offset = receipt.received;
        onProgress?.(receipt.received);
      }
      const committed = await this.commit(pending);
      if (!committed.committed || !committed.assetId) throw new ClinicError('INVALID_RESPONSE', 'The image upload was not confirmed.');
      return committed;
    } catch (cause) {
      // Release incomplete in-memory transfers. The host checks for an already committed
      // receipt before aborting, so a lost final response can still resolve as success.
      try {
        const outcome = await this.cancel(pending);
        if (outcome.committed && outcome.assetId) return { committed: true, assetId: outcome.assetId };
      } catch {
        // Keep the original failure; the host also expires abandoned transfers.
      }
      throw cause;
    }
  }

  commit(pending: PatientMediaPending): Promise<PatientMediaReceipt> {
    return this.request({ action: 'commit', transferId: pending.transferId, idempotencyKey: pending.key });
  }

  cancel(pending: PatientMediaPending): Promise<{ cancelled: boolean; committed: boolean; assetId?: string }> {
    return this.request({ action: 'cancel', transferId: pending.transferId, idempotencyKey: pending.key });
  }
}
