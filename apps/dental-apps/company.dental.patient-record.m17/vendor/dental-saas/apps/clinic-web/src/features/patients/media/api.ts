import type { PatientMediaAsset, PatientMediaReplacementInput, PatientMediaUploadIntentInput } from "@/features/patients/types";
import { clinicBlobObjectUrl, clinicRequest } from "@/shared/api/httpClient";

export const patientMediaApi = {
  listPatientMedia: async (idToken: string, patientId: string, chiefComplaintId?: string): Promise<PatientMediaAsset[]> => {
    const params = new URLSearchParams();
    if (chiefComplaintId) params.set("chiefComplaintId", chiefComplaintId);
    const result = await clinicRequest<{ media: PatientMediaAsset[] }>(`/v1/patients/${patientId}/media${params.size ? `?${params.toString()}` : ""}`, idToken);
    return result.media;
  },
  createPatientMediaUploadIntent: async (idToken: string, input: PatientMediaUploadIntentInput) => {
    const result = await clinicRequest<{ uploadIntent: { media: PatientMediaAsset; uploadUrl: string; uploadHeaders: Record<string, string>; expiresInSeconds: number } }>("/v1/patient-media/upload-intents", idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(input),
    });
    return result.uploadIntent;
  },
  createPatientMediaReplacementIntent: async (idToken: string, mediaAssetId: string, input: PatientMediaReplacementInput) => {
    const result = await clinicRequest<{ uploadIntent: { media: PatientMediaAsset; uploadUrl: string; uploadHeaders: Record<string, string>; expiresInSeconds: number } }>(`/v1/patient-media/${mediaAssetId}/replace`, idToken, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(input) });
    return result.uploadIntent;
  },
  finalisePatientMedia: async (idToken: string, mediaAssetId: string): Promise<PatientMediaAsset> => {
    const result = await clinicRequest<{ media: PatientMediaAsset }>(`/v1/patient-media/${mediaAssetId}/finalise`, idToken, {
      method: "POST", headers: { "idempotency-key": crypto.randomUUID() },
    });
    return result.media;
  },
  patientMediaView: async (idToken: string, mediaAssetId: string): Promise<string> => {
    return clinicBlobObjectUrl(
      `/v1/patient-media/${mediaAssetId}/view`,
      idToken,
      "patient_media_unavailable",
      "The private X-ray could not be opened.",
    );
  },
  withdrawPatientMedia: async (idToken: string, mediaAssetId: string, reason: string): Promise<void> => {
    await clinicRequest<unknown>(`/v1/patient-media/${mediaAssetId}/withdraw`, idToken, {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ reason }),
    });
  }
};
