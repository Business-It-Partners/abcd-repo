import type { PatientDirectoryCohort } from "@/features/patients/types";

export type PatientDirectoryCriteria = { query: string; cohort: PatientDirectoryCohort; month: string };
