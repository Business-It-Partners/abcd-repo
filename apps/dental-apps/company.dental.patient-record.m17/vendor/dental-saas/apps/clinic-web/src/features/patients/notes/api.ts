import type { PatientNote, PatientNoteCreateInput } from "@/features/patients/types";
import { clinicRequest } from "@/shared/api/httpClient";

export const patientNotesApi = {
  patientNotes: async (idToken: string, patientId: string): Promise<PatientNote[]> => {
    const result = await clinicRequest<{ notes: PatientNote[] }>(`/v1/patients/${patientId}/notes`, idToken);
    return result.notes;
  },
  createPatientNote: async (idToken: string, input: PatientNoteCreateInput, idempotencyKey = crypto.randomUUID()): Promise<PatientNote> => {
    const result = await clinicRequest<{ note: PatientNote }>("/v1/patient-notes", idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.note;
  },
  withdrawPatientNote: async (idToken: string, patientNoteId: string, reason: string, idempotencyKey = crypto.randomUUID()): Promise<PatientNote> => {
    const result = await clinicRequest<{ note: PatientNote }>(`/v1/patient-notes/${patientNoteId}/withdraw`, idToken, {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify({ reason }),
    });
    return result.note;
  }
};
