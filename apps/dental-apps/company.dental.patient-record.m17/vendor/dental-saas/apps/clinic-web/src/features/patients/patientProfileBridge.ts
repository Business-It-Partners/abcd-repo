import type { PatientDetail } from "@/features/patients/model/domain";

type PatientProfileUpdater = (patientId: string, patch: Partial<PatientDetail>) => Promise<void> | void;

let updater: PatientProfileUpdater | null = null;

/**
 * The Patient Drawer is retained as a presentation component during the
 * Cloudflare migration. Keep its write handler in the authenticated adapter;
 * this bridge avoids giving that component direct API or session access.
 */
export function registerPatientProfileUpdater(next: PatientProfileUpdater): void {
  updater = next;
}

export function updatePatientProfileThroughBridge(patientId: string, patch: Partial<PatientDetail>): Promise<void> | void {
  if (!updater) throw new Error("The patient profile is still loading. Please try again.");
  return updater(patientId, patch);
}
