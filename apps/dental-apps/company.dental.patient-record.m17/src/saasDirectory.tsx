import { useCallback, useEffect, useState } from "react";
import PatientRecordView from "@/features/patients/components/PatientRecordView";
import type { PatientDirectoryCriteria } from "@/features/patients/hooks/useServerPatientDirectory";
import type { PatientDetail as SaaSPatientDetail } from "@/features/patients/model/domain";
import { todayBSMonth } from "@/shared/dates/nepaliDate";
import { useApp } from "./main";
import type { PatientSummary } from "./types";

const PAGE_SIZE = 10;

function legacyPatient(patient: PatientSummary): SaaSPatientDetail {
  return {
    id: patient.patientId,
    patientNumber: patient.patientNumber,
    createdAt: `${patient.registeredOn}T00:00:00.000Z`,
    name: patient.fullName,
    age: patient.ageYears ?? 0,
    sex: patient.sex === "female" ? "F" : "M",
    language: "",
    alerts: [],
    balance: 0,
    planTitle: "",
    planDone: 0,
    planTotal: 0,
    teeth: [],
    visits: [],
    notes: "",
    phone: patient.phone ?? undefined,
  };
}

export function SaaSPatientDirectory({ onOpenPatient, onAddPatient }: {
  onOpenPatient: (patientId: string) => void;
  onAddPatient: () => void;
}) {
  const { api } = useApp();
  const [criteria, setCriteria] = useState<PatientDirectoryCriteria>(() => ({ query: "", cohort: "all", month: todayBSMonth() }));
  const [pageIndex, setPageIndex] = useState(0);
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [patients, setPatients] = useState<SaaSPatientDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, new: 0, regular: 0 });
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshVersion, setRefreshVersion] = useState(0);

  const updateCriteria = useCallback((next: PatientDirectoryCriteria) => {
    setCriteria((current) => current.query === next.query && current.cohort === next.cohort && current.month === next.month ? current : next);
    setPageIndex(0);
    setCursors((current) => current.length === 1 && current[0] === null ? current : [null]);
  }, []);

  const changePage = useCallback((page: number) => {
    const index = page - 1;
    if (index < 0 || index > pageIndex + 1) return;
    if (index > pageIndex && !nextCursor) return;
    if (index > pageIndex && nextCursor) {
      setCursors((current) => [...current.slice(0, index), nextCursor]);
    }
    setPageIndex(index);
  }, [nextCursor, pageIndex]);

  const refresh = useCallback(async () => {
    setRefreshVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void api.directory({ query: criteria.query, cohort: criteria.cohort, month: criteria.month, cursor: cursors[pageIndex] ?? null, limit: PAGE_SIZE })
      .then((result) => {
        if (!active) return;
        setPatients(result.patients.map(legacyPatient));
        setTotal(result.total);
        setCounts(result.counts);
        setNextCursor(result.nextCursor);
        setCursors((current) => {
          if ((current[pageIndex + 1] ?? null) === result.nextCursor) return current;
          const next = current.slice(0, pageIndex + 1);
          next[pageIndex + 1] = result.nextCursor;
          return next;
        });
      })
      .catch((cause: unknown) => {
        if (!active) return;
        setError(cause instanceof Error ? cause.message : "The patient directory could not be loaded.");
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api, criteria, cursors, pageIndex, refreshVersion]);

  return <PatientRecordView
    patients={patients}
    loading={loading}
    loadError={error}
    total={total}
    counts={counts}
    pageIndex={pageIndex}
    pageSize={PAGE_SIZE}
    knownPageCount={pageIndex + 1}
    hasPrevious={pageIndex > 0}
    hasNext={Boolean(nextCursor)}
    onPageChange={changePage}
    onCriteriaChange={updateCriteria}
    onOpenPatientDetail={onOpenPatient}
    onAddPatient={onAddPatient}
    onRefresh={refresh}
  />;
}
