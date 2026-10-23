import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { bsMonthToADRange, todayBSMonth } from "@/shared/dates/nepaliDate";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { PatientPaymentsApi } from "./api";
import type { PatientPaymentsReport } from "./types";
import PatientPaymentsView from "./PatientPaymentsView";

function readableError(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return "Your clinic role cannot open patient payments.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    return cause.message || "Patient payments could not be loaded.";
  }
  return cause instanceof Error ? cause.message : "Patient payments could not be loaded.";
}

export function PatientPaymentsWorkspace({
  client,
  capabilities,
}: {
  client: ClinicClient;
  capabilities: readonly string[];
}) {
  const [month, setMonth] = useState(todayBSMonth);
  const [report, setReport] = useState<PatientPaymentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const api = useMemo(() => new PatientPaymentsApi(client), [client]);

  useClinicPageLoading("Patient payments", loading);

  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const parts = month === "all" ? null : month.split("-").map(Number);
      const range = parts ? bsMonthToADRange(parts[0], parts[1]) : null;
      if (parts && (!Number.isInteger(parts[0]) || !Number.isInteger(parts[1]) || !range)) {
        throw new ClinicError("INVALID_REQUEST", "Choose a valid report month.");
      }
      const nextReport = await api.report(range?.start, range?.end, signal);
      if (sequence !== requestSequence.current) return;
      setReport(nextReport);
    } catch (cause) {
      if (sequence === requestSequence.current && !signal?.aborted) setLoadError(readableError(cause));
      throw cause;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [api, month]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => undefined);
    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [load]);

  useClinicPageRefresh(useMemo(() => ({
    key: "patient-payments:" + month,
    label: "Patient payments",
    refresh: () => load(),
    successMessage: "Patient payments are up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [load, loading, month]));

  return (
    <PatientPaymentsView
      report={report}
      month={month}
      onMonthChange={setMonth}
      loading={loading}
      loadError={loadError}
      capabilities={capabilities}
      api={api}
      onReportReload={() => load()}
    />
  );
}
