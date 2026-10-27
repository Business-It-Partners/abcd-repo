/** UI handoff shape enriched with the active patient/case before the Worker request. */
export type LabRequestPreviewDraft = {
  patientId: string;
  patientName: string;
  patientNumber: string;
  chiefComplaintId: string;
  chiefComplaint: string;
  labWorkName: string;
  toothScope: string | null;
  shade: string | null;
  clinicalNote: string | null;
};

export type LabRequestPreview = LabRequestPreviewDraft & {
  id: string;
  createdAt: string;
};
