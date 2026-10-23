import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { SalaryPaymentsApi } from "./api";
import SalaryPaymentsView from "./SalaryPaymentsView";
import type { ClinicSalaryPayout, ClinicStaffProfile } from "./types";

function readableError(cause: unknown, kind: "salary" | "staff"): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return kind === "staff"
        ? "Your clinic role cannot read the staff directory. Salary payouts require staff.manage to choose an active staff member."
        : "Your clinic role cannot open salary payments.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    return cause.message || (kind === "staff" ? "The staff directory could not be loaded." : "Salary payments could not be loaded.");
  }
  return cause instanceof Error
    ? cause.message
    : kind === "staff" ? "The staff directory could not be loaded." : "Salary payments could not be loaded.";
}

export function SalaryPaymentsWorkspace({
  client,
  onNavigationLockChange,
}: {
  client: ClinicClient;
  onNavigationLockChange: (locked: boolean) => void;
}) {
  const [payouts, setPayouts] = useState<ClinicSalaryPayout[]>([]);
  const [staff, setStaff] = useState<ClinicStaffProfile[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [staffLoading, setStaffLoading] = useState(true);
  const [payoutError, setPayoutError] = useState<string | null>(null);
  const [staffError, setStaffError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const api = useMemo(() => new SalaryPaymentsApi(client), [client]);
  const loading = payoutsLoading || staffLoading;

  useClinicPageLoading("Salary payments", loading);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setPayoutsLoading(true);
    setStaffLoading(true);
    setPayoutError(null);
    setStaffError(null);

    const [payoutResult, staffResult] = await Promise.allSettled([
      api.listPayouts(signal),
      api.listStaff(signal),
    ]);
    if (sequence !== requestSequence.current || signal?.aborted) return;

    if (payoutResult.status === "fulfilled") {
      setPayouts(payoutResult.value);
      setPayoutError(null);
    } else {
      setPayoutError(readableError(payoutResult.reason, "salary"));
    }
    if (staffResult.status === "fulfilled") {
      setStaff(staffResult.value);
      setStaffError(null);
    } else {
      setStaff([]);
      setStaffError(readableError(staffResult.reason, "staff"));
    }
    setPayoutsLoading(false);
    setStaffLoading(false);

    if (payoutResult.status === "rejected" || staffResult.status === "rejected") {
      throw new Error("Salary payments or the staff directory could not be refreshed.");
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
    key: "salary-payments",
    label: "Salary payments",
    refresh: () => reload(),
    successMessage: "Salary payments are up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, reload]));

  const refreshAfterWrite = useCallback(async () => {
    try {
      await reload();
    } catch {
      // Keep the accepted write; the page exposes any list refresh error separately.
    }
  }, [reload]);

  return (
    <SalaryPaymentsView
      api={api}
      client={client}
      payouts={payouts}
      staff={staff}
      loading={payoutsLoading}
      staffLoading={staffLoading}
      loadError={payoutError}
      staffError={staffError}
      onNavigationLockChange={onNavigationLockChange}
      onRefresh={reload}
      onWriteAccepted={refreshAfterWrite}
    />
  );
}
