import { ClinicError, clinicClient } from '@/sdk/client';
import type { PatientMediaAsset, PatientXrayType } from '@/features/patients/types';

type MediaResponse = { status: number; contentType: string; body: Uint8Array };
type XrayMetadata = { chiefComplaintId: string | null; xrayType: PatientXrayType; toothCode: string | null; clinicalNote: string | null; capturedOn: string };
const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp'] as const;
const isObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const isMediaAsset = (value: unknown): value is PatientMediaAsset => isObject(value)
  && typeof value.mediaAssetId === 'string' && typeof value.patientId === 'string'
  && value.assetType === 'xray' && typeof value.displayFilename === 'string'
  && typeof value.status === 'string' && typeof value.createdAt === 'string'
  && (value.xrayType === null || ['IOPA', 'OPG', 'CBCT', 'Intraoral photo'].includes(value.xrayType as string))
  && acceptedTypes.includes(value.mimeType as typeof acceptedTypes[number])
  && Number.isSafeInteger(value.byteSize) && (value.byteSize as number) > 0;

/** Work Entry receives the source app's read-only media grant. */
export const patientMediaApi = {
  async listPatientMedia(patientId: string): Promise<PatientMediaAsset[]> {
    const result = await clinicClient().read<{ media?: unknown }>(`/v1/patients/${patientId}/media`);
    if (!Array.isArray(result?.media) || !result.media.every(isMediaAsset)) throw new ClinicError('INVALID_RESPONSE', 'The patient radiograph list returned an invalid response.');
    return result.media.filter(asset => asset.status === 'active');
  },
  async viewPatientMedia(patientId: string, mediaAssetId: string): Promise<string> {
    const result = await clinicClient().mediaRequest<MediaResponse>('clinic.media.read', { kind: 'patient_media', recordId: patientId, assetId: mediaAssetId });
    if (result.status !== 200 || !acceptedTypes.includes(result.contentType as typeof acceptedTypes[number]) || !(result.body instanceof Uint8Array)) {
      throw new ClinicError('INVALID_RESPONSE', 'The private radiograph could not be verified.');
    }
    return URL.createObjectURL(new Blob([new Uint8Array(result.body)], { type: result.contentType }));
  },
  async uploadPatientMedia(_patientId: string, _file: File, _metadata: XrayMetadata, _onProgress?: (sent: number) => void): Promise<string> {
    throw new ClinicError('FORBIDDEN', 'Image upload is unavailable from Work Entry. Use Patient Record to add radiographs.');
  },
  async withdrawPatientMedia(_mediaAssetId: string, _reason: string): Promise<void> {
    throw new ClinicError('FORBIDDEN', 'Image removal is unavailable from Work Entry. Use Patient Record to manage radiographs.');
  },
};
