"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "@/features/patients/patient-record.module.css";
import { SearchX, UserPlus, Users } from "lucide-react";
import { type PatientDetail, displayToISO, formatDateShort, todayISO } from "@/features/patients/model/domain";
import { isInBSMonth, todayBSMonth } from "@/shared/dates/nepaliDate";
import { patientDirectoryCounts } from "@/features/patients/patientDirectory";
import type { PatientDirectoryCohort, PatientDirectoryCounts } from "@/features/patients/types";
import type { PatientDirectoryCriteria } from "@/features/patients/hooks/useServerPatientDirectory";
import MonthPicker from "@/shared/dates/MonthPicker";
import {
  Page,
  PageHeader,
  SearchBox,
  RowActions,
  StackCell,
  DataTable,
  EmptyState,
  Pagination,
} from "@/shared/ui/workspace-primitives";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";

interface PatientRecordViewProps {
  onOpenPatientDetail: (patient: PatientDetail) => void;
  onAddPatient: () => void;
  onRefresh: () => Promise<void>;
  /** Tenant-scoped Worker directory rows, adapted only for the preserved legacy presentation. */
  patients: PatientDetail[];
  loading?: boolean;
  loadError?: string | null;
  total: number;
  counts: PatientDirectoryCounts;
  pageIndex: number;
  pageSize: number;
  hasPrevious: boolean;
  hasNext: boolean;
  knownPageCount: number;
  onPageChange: (page: number) => void;
  onCriteriaChange: (criteria: PatientDirectoryCriteria) => void;
}

type Cohort = PatientDirectoryCohort;

function registeredISO(patient: PatientDetail): string | null {
  if (patient.createdAt) return patient.createdAt.slice(0, 10);
  const dates = patient.visits
    .map((visit) => displayToISO(visit.date))
    .filter((date): date is string => date !== null)
    .sort();
  return dates[0] ?? null;
}

function cohortOf(patient: PatientDetail, month: string): { isNew: boolean; isRegular: boolean } {
  const registered = registeredISO(patient);
  const isNew = Boolean(registered && isInBSMonth(registered, month));
  const visitedThisMonth = patient.visits.some((visit) => {
    const date = displayToISO(visit.date);
    return Boolean(date && isInBSMonth(date, month));
  });
  return { isNew, isRegular: !isNew && visitedThisMonth };
}

export default function PatientRecordView(props: PatientRecordViewProps) {
  const { onOpenPatientDetail, onAddPatient, onRefresh, patients, loading = false, loadError = null, total, counts, pageIndex, pageSize, hasPrevious, hasNext, knownPageCount, onPageChange, onCriteriaChange } = props;
  useClinicPageRefresh(useMemo(() => ({
    key: "patient-record-directory",
    label: "Patient Record",
    refresh: onRefresh,
    successMessage: "Patient Record is up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, onRefresh]));
  const [searchInput, setSearchInput] = useState("");
  const [cohort, setCohort] = useState<Cohort>("all");
  const [cohortMonth, setCohortMonth] = useState(todayBSMonth());
  const safeCounts = patientDirectoryCounts(counts, total, cohort);
  useEffect(() => {
    const timer = window.setTimeout(() => onCriteriaChange({ query: searchInput.trim(), cohort, month: cohortMonth }), 300);
    return () => window.clearTimeout(timer);
  }, [cohort, cohortMonth, onCriteriaChange, searchInput]);
  const directoryIsEmpty = total === 0 && !searchInput.trim() && cohort === "all";
  const firstRow = total === 0 ? 0 : pageIndex * pageSize + 1;
  const lastRow = Math.min(total, pageIndex * pageSize + patients.length);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const canOpenPage = (pageNumber: number) => pageNumber <= knownPageCount || (pageNumber === pageIndex + 2 && hasNext) || (pageNumber === pageIndex && hasPrevious);

  return (
    <Page sheet standardPage>
      <PageHeader
        title="Patient Record"
      >
        <ClinicActionButton onClick={onAddPatient}>
          <UserPlus size={14} /> {directoryIsEmpty ? "Add first patient" : "New patient"}
        </ClinicActionButton>
      </PageHeader>

      {/* Directory Table with Integrated Filters */}
      <DataTable<PatientDetail>
        rows={patients}
        standardPage
        rowKey={(p) => p.id}
        noun="patients"
        filters={(
          <div className={styles.directoryFilters}>
            <div className={styles.segmented} aria-label="Patient activity filter">
              {(["all", "new", "regular"] as Cohort[]).map((segment) => (
                <button
                  key={segment}
                  type="button"
                  className={`${styles.segment} ${cohort === segment ? styles.segmentActive : ""}`}
                  onClick={() => setCohort(segment)}
                >
                  {segment === "all" ? "All" : segment === "new" ? "New" : "Regular"}
                  <span className={styles.segmentCount}>{safeCounts[segment]}</span>
                </button>
              ))}
            </div>
            <MonthPicker value={cohortMonth} onChange={setCohortMonth} max={todayISO().slice(0, 7)} />
            <SearchBox
              placeholder="Search by name or record ID…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />
            <span aria-live="polite" style={{ marginLeft: "auto", color: "var(--ink-3)", fontSize: "var(--fs-13)", whiteSpace: "nowrap" }}>
              {loading ? "Loading…" : directoryIsEmpty ? "No patients" : `${total} ${total === 1 ? "patient" : "patients"}`}
            </span>
            {searchInput.trim() && (
              <div role="status" style={{ width: "100%", fontSize: "var(--fs-12)", color: "#475569" }}>
                Searching every patient record. Month and activity filters resume when the search is cleared.
              </div>
            )}
          </div>
        )}
        loading={loading}
        loadingLabel="Loading patient directory…"
        error={loadError ? `Couldn't load the patient directory — ${loadError}` : undefined}
        errorHint="Check the clinic session and Worker connection, then refresh the page."
        empty={
          directoryIsEmpty ? (
            <EmptyState
              icon={<Users size={30} />}
              message="Your patient directory is ready"
              hint="Register the first patient to begin their clinical record, treatment plan and follow-up history."
            >
              <button className="btn btn-primary btn-sm" onClick={onAddPatient} type="button"><UserPlus size={14} /> Register first patient</button>
            </EmptyState>
          ) : patients.length === 0 ? (
            <EmptyState
              icon={<SearchX size={28} />}
              message={searchInput.trim() ? "No patient records match this search" : "No patient records match these filters"}
              hint="Try a different month, activity group, or search term."
            >
              <button className="btn btn-secondary btn-sm" onClick={() => { setSearchInput(""); setCohort("all"); }} type="button">Clear filters</button>
            </EmptyState>
          ) : null
        }
        columns={[
          {
            key: "name",
            header: "Patient",
            value: (p) => p.name,
            render: (p, i) => <StackCell avatar={i + 1} primary={p.name} secondary={p.phone || "Phone not recorded"} badge={cohortOf(p, cohortMonth).isNew ? <span className={styles.newTag}>New</span> : undefined} />,
          },
          {
            key: "patientNumber",
            header: "Record ID",
            value: (p) => p.patientNumber,
            render: (p) => (
              <span style={{ fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums" }}>
                {p.patientNumber}
              </span>
            ),
          },
          {
            key: "registered",
            header: "Registered",
            nowrap: true,
            value: (p) => registeredISO(p) ?? "",
            render: (p) => {
              const registered = registeredISO(p);
              return (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {registered ? formatDateShort(registered) : <span style={{ color: "#4c4c56" }}>—</span>}
                </span>
              );
            },
          },
          {
            key: "age",
            header: "Age / Sex",
            nowrap: true,
            value: (p) => p.age,
            render: (p) => `${p.age} yrs / ${p.sex}`,
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (p) => (
              <RowActions>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ClinicActionButton size="compact" onClick={() => onOpenPatientDetail(p)}>
                    Detail
                  </ClinicActionButton>
                </div>
              </RowActions>
            ),
          },
        ]}
        paginate={false}
      />

      {!loading && total > 0 && <div data-sajilo-pagination=""><Pagination page={pageIndex + 1} totalPages={totalPages} from={firstRow} to={lastRow} total={total} noun="patients" onPage={onPageChange} canPage={canOpenPage} /></div>}

    </Page>
  );
}
