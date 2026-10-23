import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { GeneralExpensesApi } from "./api";
import GeneralExpensesView from "./GeneralExpensesView";
import type { ClinicOperatingExpense } from "./types";

function readableError(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return "Your clinic role cannot open general expenses.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    return cause.message || "General expenses could not be loaded.";
  }
  return cause instanceof Error ? cause.message : "General expenses could not be loaded.";
}

export function GeneralExpensesWorkspace({
  client,
  onNavigationLockChange,
}: {
  client: ClinicClient;
  onNavigationLockChange: (locked: boolean) => void;
}) {
  const [expenses, setExpenses] = useState<ClinicOperatingExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const api = useMemo(() => new GeneralExpensesApi(client), [client]);

  useClinicPageLoading("General expenses", loading);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const nextExpenses = await api.list(signal);
      if (sequence === requestSequence.current) setExpenses(nextExpenses);
    } catch (cause) {
      if (sequence === requestSequence.current && !signal?.aborted) setLoadError(readableError(cause));
      throw cause;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch(() => undefined);
    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [reload]);

  useClinicPageRefresh(useMemo(() => ({
    key: "general-expenses",
    label: "General expenses",
    refresh: () => reload(),
    successMessage: "General expenses are up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, reload]));

  const refreshAfterWrite = useCallback(async () => {
    try {
      await reload();
    } catch {
      // The Worker accepted the write. The directory keeps its own refresh error visible.
    }
  }, [reload]);

  return (
    <GeneralExpensesView
      expenses={expenses}
      loading={loading}
      loadError={loadError}
      api={api}
      client={client}
      onNavigationLockChange={onNavigationLockChange}
      onRefresh={reload}
      onWriteAccepted={refreshAfterWrite}
    />
  );
}
