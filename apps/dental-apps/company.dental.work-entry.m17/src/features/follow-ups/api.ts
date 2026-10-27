import type { FollowUpWorklistItem } from '@/features/patients/types';
import { clinicClient } from '@/sdk/client';

export const followUpsApi = {
  listFollowUps: async (_idToken: string, date?: string): Promise<FollowUpWorklistItem[]> => {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    const result = await clinicClient().read<{ followUps: FollowUpWorklistItem[] }>(`/v1/follow-ups${suffix}`);
    return result.followUps;
  },
};
