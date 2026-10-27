import type { OdontogramMark, OdontogramSaveInput, PatientPeriodontalChart, PeriodontalChartSaveInput, PatientCanalMeasurement, CanalMeasurementSaveInput } from "@/features/patients/types";
import { clinicRequest } from "@/shared/api/httpClient";

export const clinicalChartsApi = {
  patientOdontogram: async (idToken: string, patientId: string): Promise<OdontogramMark[]> => {
    const result = await clinicRequest<{ marks: OdontogramMark[] }>(`/v1/patients/${patientId}/odontogram`, idToken);
    return result.marks;
  },
  savePatientOdontogram: async (idToken: string, patientId: string, input: OdontogramSaveInput, idempotencyKey = crypto.randomUUID()): Promise<OdontogramMark[]> => {
    const result = await clinicRequest<{ marks: OdontogramMark[] }>(`/v1/patients/${patientId}/odontogram`, idToken, {
      method: "PUT",
      headers: { "content-type": "application/json", "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    });
    return result.marks;
  },
  patientPeriodontalChart: async (idToken: string, patientId: string): Promise<PatientPeriodontalChart> => {
    const result = await clinicRequest<{ chart: PatientPeriodontalChart }>(`/v1/patients/${patientId}/periodontal-chart`, idToken);
    return result.chart;
  },
  savePatientPeriodontalChart: async (idToken: string, patientId: string, input: PeriodontalChartSaveInput, idempotencyKey = crypto.randomUUID()): Promise<PatientPeriodontalChart> => {
    const result = await clinicRequest<{ chart: PatientPeriodontalChart }>(`/v1/patients/${patientId}/periodontal-chart`, idToken, { method: "PUT", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input) });
    return result.chart;
  },
  patientCanalMeasurements: async (idToken: string, patientId: string): Promise<PatientCanalMeasurement[]> => {
    const result = await clinicRequest<{ sessions: PatientCanalMeasurement[] }>(`/v1/patients/${patientId}/canal-measurements`, idToken);
    return result.sessions;
  },
  savePatientCanalMeasurement: async (idToken: string, patientId: string, input: CanalMeasurementSaveInput, idempotencyKey = crypto.randomUUID()): Promise<PatientCanalMeasurement> => {
    const result = await clinicRequest<{ session: PatientCanalMeasurement }>(`/v1/patients/${patientId}/canal-measurements`, idToken, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": idempotencyKey }, body: JSON.stringify(input) });
    return result.session;
  }
};
