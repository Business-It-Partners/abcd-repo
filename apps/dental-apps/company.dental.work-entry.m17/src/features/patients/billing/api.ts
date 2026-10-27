import type { PatientLedger } from '@/features/patients/types';
import { clinicClient } from '@/sdk/client';

export const patientBillingApi = {
  patientLedger: async (_idToken: string, patientId: string, month?: string, cursor?: string): Promise<PatientLedger> => {
    const params = new URLSearchParams();
    if (month) params.set('month', month);
    if (cursor) params.set('cursor', cursor);
    const query = params.size ? `?${params}` : '';
    const result = await clinicClient().read<{ ledger: PatientLedger }>(`/v1/patients/${patientId}/ledger${query}`);
    return result.ledger;
  },
};
