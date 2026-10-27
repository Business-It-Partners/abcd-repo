"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { type PatientDetail, todayISO } from "@/features/patients/model/domain";

/**
 * Migration seam: this is intentionally a local, in-memory directory until
 * the Cloudflare patient-directory contract is available. The legacy view
 * above it is unchanged; only its former Firestore reader is replaced.
 */
export const uiMigrationPatients: PatientDetail[] = [
  {
    id: "ui-patient-001",
    patientNumber: "SD-1001",
    createdAt: todayISO(),
    name: "Aarav Shrestha",
    age: 34,
    sex: "M",
    language: "English",
    alerts: ["Penicillin allergy"],
    balance: 4200,
    planTitle: "Root canal treatment",
    planDone: 1,
    planTotal: 3,
    teeth: ["16"],
    visits: [{ date: todayISO(), doctor: "Dr. Anisha Rai", procedure: "Consultation", note: "Pain in upper right molar", tooth: "16" }],
    notes: "Migrated UI fixture only.",
    phone: "9800000001",
  },
];

export interface PagedPatients {
  patients: PatientDetail[];
  loading: boolean;
  loadingMore: boolean;
  loadError: string | null;
  hasMore: boolean;
  loadedCount: number;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  removeLoaded: (patientId: string) => void;
}

export function usePagedPatients(input: { pageSize?: number; search?: string } = {}): PagedPatients {
  const [patients, setPatients] = useState(uiMigrationPatients);
  const [loading, setLoading] = useState(true);
  const search = input.search?.trim().toLowerCase() ?? "";

  const reload = useCallback(async () => {
    setLoading(true);
    setPatients(uiMigrationPatients);
    setLoading(false);
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const visible = useMemo(() => !search ? patients : patients.filter((patient) => (
    patient.name.toLowerCase().includes(search)
    || patient.patientNumber.toLowerCase().includes(search)
    || patient.phone?.includes(search)
  )), [patients, search]);

  return {
    patients: visible,
    loading,
    loadingMore: false,
    loadError: null,
    hasMore: false,
    loadedCount: visible.length,
    reload,
    loadMore: async () => {},
    removeLoaded: (patientId) => setPatients((rows) => rows.filter((patient) => patient.id !== patientId)),
  };
}
