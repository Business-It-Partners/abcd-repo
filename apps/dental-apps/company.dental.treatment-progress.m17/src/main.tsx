import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Activity, Search } from "lucide-react";
import { ClinicClient, ClinicError } from "../../../../packages/app-sdk/src/clinicClient";
import type { ClinicTableColumn } from "@/shared/ui/ClinicDataTable";
import {
  DataTable,
  EmptyState,
  Page,
  PageHeader,
  SearchBox,
} from "@/shared/ui/workspace-primitives";
import {
  ClinicLoadingProvider,
  useClinicPageLoading,
} from "@/shared/ui/ClinicLoadingOverlay";
import {
  ClinicPageRefreshProvider,
  useClinicPageRefresh,
} from "@/shared/ui/ClinicPageRefresh";
import { ClinicSnackbarProvider } from "@/shared/ui/ClinicSnackbar";
import { SnackbarProvider } from "@/shared/ui/SnackbarProvider";
import "@/shared/clinic.css";
import "./styles.css";

const APP_ID = "company.dental.treatment-progress.m17";

type TreatmentProgressRow = {
  patientId: string;
  patientNumber: string;
  fullName: string;
  planTitle: string;
  completedStages: number;
  totalStages: number;
  doctorNames: string[];
  outstandingDue: number;
  nextReturnOn: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDateOnly(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function parseTreatmentProgress(value: unknown): TreatmentProgressRow[] {
  if (!isRecord(value) || !Array.isArray(value.patients)) {
    throw new ClinicError("INVALID_RESPONSE", "Treatment progress returned an invalid response.");
  }
  return value.patients.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new ClinicError("INVALID_RESPONSE", "Treatment progress returned an invalid patient row.");
    }
    const completedStages = entry.completedStages;
    const totalStages = entry.totalStages;
    const doctors = entry.doctorNames;
    const outstandingDue = entry.outstandingDue;
    const nextReturnOn = entry.nextReturnOn;
    if (
      typeof entry.patientId !== "string" || !entry.patientId.trim() ||
      typeof entry.patientNumber !== "string" ||
      typeof entry.fullName !== "string" || !entry.fullName.trim() ||
      typeof entry.planTitle !== "string" ||
      typeof completedStages !== "number" || !Number.isInteger(completedStages) || completedStages < 0 ||
      typeof totalStages !== "number" || !Number.isInteger(totalStages) || totalStages < 1 ||
      completedStages > totalStages ||
      !Array.isArray(doctors) || doctors.some((doctor) => typeof doctor !== "string") ||
      typeof outstandingDue !== "number" || !Number.isFinite(outstandingDue) || outstandingDue < 0 ||
      !(nextReturnOn === null || isDateOnly(nextReturnOn))
    ) {
      throw new ClinicError("INVALID_RESPONSE", "Treatment progress contains an invalid patient row (" + (index + 1) + ").");
    }
    return {
      patientId: entry.patientId,
      patientNumber: entry.patientNumber,
      fullName: entry.fullName,
      planTitle: entry.planTitle || "Treatment plan",
      completedStages,
      totalStages,
      doctorNames: doctors,
      outstandingDue,
      nextReturnOn,
    };
  });
}

function formatDate(value: string | null): string {
  if (!value) return "Not scheduled";
  const date = new Date(value + "T12:00:00.000Z");
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatNpr(amount: number): string {
  return new Intl.NumberFormat("en-NP", {
    style: "currency",
    currency: "NPR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function friendlyError(cause: unknown): string {
  if (cause instanceof ClinicError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return "Treatment progress could not be loaded.";
}

function TreatmentProgressWorkspace() {
  const client = useRef<ClinicClient | null>(null);
  const activeLoad = useRef(0);
  const activeRequest = useRef<AbortController | null>(null);
  const [ready, setReady] = useState(false);
  const [openingError, setOpeningError] = useState("");
  const [rows, setRows] = useState<TreatmentProgressRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [doctorFilter, setDoctorFilter] = useState("all");
  useClinicPageLoading("Treatment Progress", loading);

  const refresh = useCallback(async () => {
    const sdk = client.current;
    if (!sdk) throw new ClinicError("STALE_SESSION", "The clinic session is not ready. Reopen Treatment Progress.");
    const requestId = ++activeLoad.current;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    setLoading(true);
    setError("");
    try {
      const result = await sdk.read<{ patients: unknown }>("/v1/treatment-progress", controller.signal);
      const nextRows = parseTreatmentProgress(result);
      if (requestId === activeLoad.current) setRows(nextRows);
    } catch (cause) {
      if (requestId === activeLoad.current && !(cause instanceof ClinicError && cause.code === "CANCELLED")) {
        setRows([]);
        setError(friendlyError(cause));
      }
      throw cause;
    } finally {
      if (requestId === activeLoad.current) {
        setLoading(false);
        activeRequest.current = null;
      }
    }
  }, []);

  useEffect(() => {
    let active = true;
    if (!window.dentalApp) {
      setOpeningError("Open Treatment Progress from the Dental OS Store.");
      return;
    }
    const sdk = new ClinicClient(window.dentalApp, () => {
      activeLoad.current++;
      activeRequest.current?.abort();
      setRows([]);
      if (active) {
        setReady(false);
        setOpeningError("The clinic session changed. Reopen Treatment Progress from Dental OS.");
      }
    });
    client.current = sdk;
    const unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
      if (moduleId !== "treatment-progress") {
        setRows([]);
        setError("The selected Treatment Progress module is unavailable.");
      }
    });
    void sdk.initialize(APP_ID).then(async ({ session }) => {
      if (!session.clinicUser.capabilities.includes("treatment_progress.access")) {
        throw new ClinicError("FORBIDDEN", "Treatment Progress is unavailable for this clinic role.");
      }
      if (!active) return;
      setReady(true);
      setOpeningError("");
      try {
        await refresh();
      } catch {
        // The workspace shows a retryable error state; initialization is complete.
      }
    }).catch((cause) => {
      if (active) setOpeningError(friendlyError(cause));
    });
    return () => {
      active = false;
      activeLoad.current++;
      activeRequest.current?.abort();
      activeRequest.current = null;
      client.current = null;
      unsubscribe();
      sdk.report({ dirty: false, modal: false });
    };
  }, [refresh]);

  const refreshRegistration = useMemo(() => ({
    key: "treatment-progress",
    label: "Treatment Progress",
    refresh,
    successMessage: "Treatment Progress is up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, refresh]);
  useClinicPageRefresh(refreshRegistration);

  const doctorOptions = useMemo(() => {
    const doctors = new Set(rows.flatMap((row) => row.doctorNames));
    return [...doctors].sort((left, right) => left.localeCompare(right));
  }, [rows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return rows.filter((row) => {
      const matchesSearch = !term || [
        row.fullName,
        row.patientNumber,
        row.planTitle,
        row.doctorNames.join(" "),
      ].some((value) => value.toLocaleLowerCase().includes(term));
      return matchesSearch && (doctorFilter === "all" || row.doctorNames.includes(doctorFilter));
    });
  }, [doctorFilter, rows, search]);

  const columns = useMemo<ClinicTableColumn<TreatmentProgressRow>[]>(() => [
    {
      key: "number",
      header: "S.N.",
      align: "center",
      width: 54,
      value: (_row) => "",
      render: (_row, index) => <span className="tprogressMuted">{index + 1}</span>,
    },
    {
      key: "patient",
      header: "Patient",
      sortable: true,
      value: (row) => row.fullName,
      render: (row) => <span className="tprogressPatient">{row.fullName}</span>,
    },
    {
      key: "patientNumber",
      header: "Record ID",
      sortable: true,
      value: (row) => row.patientNumber,
      nowrap: true,
    },
    {
      key: "planTitle",
      header: "Treatment plan",
      sortable: true,
      value: (row) => row.planTitle,
      render: (row) => <span className="tprogressPlan" title={row.planTitle}>{row.planTitle}</span>,
    },
    {
      key: "progress",
      header: "Progress",
      sortable: true,
      value: (row) => row.completedStages / row.totalStages,
      render: (row) => {
        const remaining = row.totalStages - row.completedStages;
        const label = row.completedStages + " of " + row.totalStages + " stages complete";
        return <div className="tprogressMeter" aria-label={label}>
          <div className="tprogressMeterText"><span>{row.completedStages} / {row.totalStages} done</span><span>{remaining} remaining</span></div>
          <progress aria-label={label} max={row.totalStages} value={row.completedStages} />
        </div>;
      },
    },
    {
      key: "balance",
      header: "Balance",
      align: "right",
      sortable: true,
      value: (row) => row.outstandingDue,
      render: (row) => row.outstandingDue > 0
        ? <span className="tprogressBalance">{formatNpr(row.outstandingDue)}</span>
        : <span className="tprogressCleared">Cleared</span>,
    },
    {
      key: "nextReturn",
      header: "Next return",
      sortable: true,
      value: (row) => row.nextReturnOn ?? "9999-12-31",
      render: (row) => row.nextReturnOn
        ? formatDate(row.nextReturnOn)
        : <span className="tprogressMuted">Not scheduled</span>,
    },
  ], []);

  if (openingError) return <main className="tprogressMessage" role="alert"><h1>Treatment Progress unavailable</h1><p>{openingError}</p></main>;
  if (!ready) return <main className="tprogressMessage" role="status">Opening Treatment Progress…</main>;

  const subtitle = loading
    ? "Loading active treatment plans…"
    : error
      ? "Treatment progress is temporarily unavailable."
      : rows.length + " patients with active, incomplete treatment plans.";

  return <Page sheet fillSheet>
    <PageHeader title="Treatment Progress" icon={<Activity size={18} aria-hidden="true" />} subtitle={subtitle} />
    <DataTable
      rows={filteredRows}
      columns={columns}
      rowKey={(row) => row.patientId}
      noun="patients"
      pageSize={10}
      minWidth={1100}
      loading={loading}
      loadingLabel="Loading treatment progress…"
      error={error || undefined}
      errorHint="Refresh to request the latest clinic projection."
      empty={search || doctorFilter !== "all"
        ? <EmptyState icon={<Search size={24} />} message="No patients match these filters." />
        : <EmptyState icon={<Activity size={24} />} message="No active, incomplete treatment plans were found." />}
      filters={<div className="tprogressFilters">
        <SearchBox
          aria-label="Search patients, record IDs, treatment plans, or doctors"
          placeholder="Search patients, plans, or doctors…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <label className="tprogressDoctorFilter">
          <span>Doctor</span>
          <select aria-label="Filter by doctor" value={doctorFilter} onChange={(event) => setDoctorFilter(event.target.value)}>
            <option value="all">All doctors</option>
            {doctorOptions.map((doctor) => <option key={doctor} value={doctor}>{doctor}</option>)}
          </select>
        </label>
        <span className="tprogressCount" aria-live="polite">{filteredRows.length} of {rows.length} patients</span>
      </div>}
    />
  </Page>;
}

declare global {
  interface Window {
    dentalApp?: import("../../../../electron/sdk/contracts").AppSdk;
  }
}

createRoot(document.getElementById("root")!).render(
  <ClinicSnackbarProvider>
    <ClinicLoadingProvider>
      <ClinicPageRefreshProvider>
        <SnackbarProvider>
          <TreatmentProgressWorkspace />
        </SnackbarProvider>
      </ClinicPageRefreshProvider>
    </ClinicLoadingProvider>
  </ClinicSnackbarProvider>,
);
