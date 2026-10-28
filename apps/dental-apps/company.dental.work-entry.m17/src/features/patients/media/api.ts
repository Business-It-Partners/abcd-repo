import { ClinicError, clinicClient } from '@/sdk/client';
import { executeClinicCommand } from '@/sdk/commands';
import { PatientMediaClient } from '../../../../../../clinic-app-runtime/patientMediaClient';
import type { PatientXrayType } from '@/features/patients/types';

type XrayMetadata = { chiefComplaintId: string | null; xrayType: PatientXrayType; toothCode: string | null; clinicalNote: string | null; capturedOn: string };

export const patientMediaApi = {
  async uploadPatientMedia(patientId: string, file: File, metadata: XrayMetadata, onProgress?: (sent: number) => void): Promise<string> {
    const media = new PatientMediaClient(clinicClient());
    const pending = await media.begin(patientId, file, metadata);
    const receipt = await media.transfer(pending, onProgress);
    if (!receipt.committed || !receipt.assetId) throw new ClinicError('INVALID_RESPONSE', 'The radiograph upload was not confirmed.');
    return receipt.assetId;
  },
  withdrawPatientMedia(mediaAssetId: string, reason: string, commandId: string): Promise<void> {
    return executeClinicCommand<void>('POST', `/v1/patient-media/${mediaAssetId}/withdraw`, { reason }, commandId,
      value => value === undefined || (!!value && typeof value === 'object' && !Array.isArray(value)));
  },
};
