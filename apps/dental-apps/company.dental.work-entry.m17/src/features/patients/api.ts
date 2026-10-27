import type { PatientCase, PatientCaseInput, PatientCore, PatientDirectoryPage } from '@/features/patients/types';
import { clinicClient } from '@/sdk/client';
import { executeClinicCommand } from '@/sdk/commands';

export const patientsApi = {
  searchPatients: async (_idToken: string, input: string): Promise<PatientDirectoryPage> => {
    const params = new URLSearchParams({ q: input.trim(), limit: '8' });
    return clinicClient().read(`/v1/patients?${params}`);
  },
  patientCore: async (_idToken: string, patientId: string): Promise<PatientCore> => {
    const result = await clinicClient().read<{ patient: PatientCore }>(`/v1/patients/${patientId}/core`);
    return result.patient;
  },
  createPatientCase: async (_idToken: string, patientId: string, input: PatientCaseInput): Promise<PatientCase> => {
    const result = await executeClinicCommand<{ case: PatientCase }>('POST', `/v1/patients/${patientId}/cases`, input);
    return result.case;
  },
};
