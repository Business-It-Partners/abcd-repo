import { ClinicError } from '@/sdk/client';

/** Work Entry does not hold the host's patient-media withdrawal grant. */
export const patientMediaApi = {
  async withdrawPatientMedia(_idToken: string, _mediaAssetId: string, _reason: string): Promise<never> {
    throw new ClinicError('FORBIDDEN', 'Radiographs can only be withdrawn by an app with the required media permission.');
  },
};
