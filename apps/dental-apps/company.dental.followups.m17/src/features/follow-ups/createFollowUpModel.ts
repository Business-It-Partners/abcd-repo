import type { FollowUpCreateInput } from "@/features/patients/types";

export type CreateFollowUpDraft = {
  patientId: string | null;
  requestedByStaffId: string;
  dueOn: string;
  dueTime: string;
  reason: string;
};

export function followUpCreateInput(
  draft: CreateFollowUpDraft,
  today: string,
): FollowUpCreateInput | null {
  const reason = draft.reason.trim();
  if (
    !draft.patientId ||
    !draft.requestedByStaffId ||
    !draft.dueOn ||
    draft.dueOn < today ||
    !reason
  ) return null;

  return {
    patientId: draft.patientId,
    chiefComplaintId: null,
    dueOn: draft.dueOn,
    dueTime: draft.dueTime || null,
    reason,
    requestedByStaffId: draft.requestedByStaffId,
  };
}
