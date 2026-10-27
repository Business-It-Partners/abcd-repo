import type { StaffReference } from '@/features/staff/types';
import { clinicClient } from '@/sdk/client';

export const staffApi = {
  listStaffReferences: async (_idToken: string): Promise<StaffReference[]> => {
    const result = await clinicClient().read<{ staff: StaffReference[] }>('/v1/clinic/staff-references');
    return result.staff;
  },
};
