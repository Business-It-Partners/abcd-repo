import type { TreatmentProtocol } from '@/shell/session/types';
import { clinicClient } from '@/sdk/client';

export const treatmentProtocolsApi = {
  treatmentProtocols: async (_idToken: string): Promise<TreatmentProtocol[]> => {
    const result = await clinicClient().read<{ treatmentProtocols: TreatmentProtocol[] }>('/v1/treatment-protocols');
    return result.treatmentProtocols;
  },
};
