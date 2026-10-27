import type { ClinicSupplier } from '@/features/finance/suppliers/types';
import { clinicClient } from '@/sdk/client';

export const suppliersApi = {
  listSuppliers: async (_idToken: string, scope?: 'lab'): Promise<ClinicSupplier[]> => {
    const result = await clinicClient().read<{ suppliers: ClinicSupplier[] }>(`/v1/clinic/suppliers${scope === 'lab' ? '?scope=lab' : ''}`);
    return result.suppliers;
  },
};
