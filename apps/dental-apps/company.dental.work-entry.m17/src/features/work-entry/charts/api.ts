import type { CanalMeasurementSaveInput, OdontogramMark, OdontogramSaveInput, PatientCanalMeasurement, PatientPeriodontalChart, PeriodontalChartSaveInput } from '@/features/patients/types';
import { clinicClient } from '@/sdk/client';
import { executeClinicCommand } from '@/sdk/commands';

export const clinicalChartsApi = {
  patientOdontogram: async (_idToken: string, patientId: string): Promise<OdontogramMark[]> => (await clinicClient().read<{ marks: OdontogramMark[] }>(`/v1/patients/${patientId}/odontogram`)).marks,
  savePatientOdontogram: async (_idToken: string, patientId: string, input: OdontogramSaveInput, idempotencyKey?: string): Promise<OdontogramMark[]> => (await executeClinicCommand<{ marks: OdontogramMark[] }>('PUT', `/v1/patients/${patientId}/odontogram`, input, idempotencyKey)).marks,
  patientPeriodontalChart: async (_idToken: string, patientId: string): Promise<PatientPeriodontalChart> => (await clinicClient().read<{ chart: PatientPeriodontalChart }>(`/v1/patients/${patientId}/periodontal-chart`)).chart,
  savePatientPeriodontalChart: async (_idToken: string, patientId: string, input: PeriodontalChartSaveInput, idempotencyKey?: string): Promise<PatientPeriodontalChart> => (await executeClinicCommand<{ chart: PatientPeriodontalChart }>('PUT', `/v1/patients/${patientId}/periodontal-chart`, input, idempotencyKey)).chart,
  patientCanalMeasurements: async (_idToken: string, patientId: string): Promise<PatientCanalMeasurement[]> => (await clinicClient().read<{ sessions: PatientCanalMeasurement[] }>(`/v1/patients/${patientId}/canal-measurements`)).sessions,
  savePatientCanalMeasurement: async (_idToken: string, patientId: string, input: CanalMeasurementSaveInput, idempotencyKey?: string): Promise<PatientCanalMeasurement> => (await executeClinicCommand<{ session: PatientCanalMeasurement }>('POST', `/v1/patients/${patientId}/canal-measurements`, input, idempotencyKey)).session,
};
