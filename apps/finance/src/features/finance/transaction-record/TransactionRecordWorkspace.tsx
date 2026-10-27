import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { bsMonthToADRange, todayBSMonth } from "@/shared/dates/nepaliDate";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import type { CashTransaction } from "@/features/finance/internal/lib/financeTruth";
import { transactionPresentation } from "@/features/finance/internal/lib/financeTruth";
import { TransactionRecordApi } from "./api";
import type { ClinicFinanceOverview } from "./types";
import TransactionRecordView from "@/features/finance/internal/components/TransactionRecordView";

const emptyOverview: ClinicFinanceOverview = {
  patientOutstandingDueAmount: 0,
  generalExpenseAmount: 0,
  purchaseAmount: 0,
  supplierPayoutAmount: 0,
  salaryPayoutAmount: 0,
  currentSupplierOutstandingAmount: 0,
  labPurchaseAmount: 0,
  labPayoutAmount: 0,
  currentLabOutstandingAmount: 0,
};

function readableError(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return "Your clinic role cannot open the Finance overview.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    return cause.message || "The overview could not be loaded.";
  }
  return cause instanceof Error ? cause.message : "The overview could not be loaded.";
}

export function TransactionRecordWorkspace({ client }: { client: ClinicClient }) {
  const [transactions, setTransactions] = useState<CashTransaction[]>([]);
  const [monthFilter, setMonthFilter] = useState(todayBSMonth);
  const [summary, setSummary] = useState({ totalRevenue: 0, totalSpend: 0, netCashFlow: 0 });
  const [overview, setOverview] = useState<ClinicFinanceOverview>(emptyOverview);
  const [hasSuccessfulReport, setHasSuccessfulReport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const api = useMemo(() => new TransactionRecordApi(client), [client]);

  useClinicPageLoading("Overview", loading);

  const load = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setLoadError(null);
    try {
      const parts = monthFilter === "all" ? null : monthFilter.split("-").map(Number);
      const range = parts ? bsMonthToADRange(parts[0], parts[1]) : null;
      if (parts && (!Number.isInteger(parts[0]) || !Number.isInteger(parts[1]) || !range)) {
        throw new ClinicError("INVALID_REQUEST", "Choose a valid report month.");
      }
      const report = await api.transactionRecord(range?.start, range?.end, signal);
      if (sequence !== requestSequence.current) return;
      setTransactions(report.transactions.map((transaction) => {
        const presentation = transactionPresentation(transaction.kind);
        return {
          id: transaction.transactionId,
          date: transaction.date,
          flow: presentation.flow,
          category: presentation.category,
          categoryLabel: presentation.categoryLabel,
          payeeOrPatient: transaction.description,
          method: transaction.paymentMethod ?? undefined,
          amount: transaction.cashInAmount || transaction.cashOutAmount,
        };
      }));
      setSummary({
        totalRevenue: report.cashInTotal,
        totalSpend: report.cashOutTotal,
        netCashFlow: report.netCashAmount,
      });
      setOverview(report.overview);
      setHasSuccessfulReport(true);
    } catch (cause) {
      if (sequence === requestSequence.current && !signal?.aborted) setLoadError(readableError(cause));
      throw cause;
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [api, monthFilter]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal).catch(() => undefined);
    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [load]);

  useClinicPageRefresh(useMemo(() => ({
    key: `transaction-record:${monthFilter}`,
    label: "Overview",
    refresh: () => load(),
    successMessage: "Overview is up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [load, loading, monthFilter]));

  return (
    <TransactionRecordView
      workerTransactions={transactions}
      workerSummary={summary}
      workerOverview={overview}
      monthFilter={monthFilter}
      onMonthFilterChange={setMonthFilter}
      loading={loading}
      loadError={loadError}
      hasSuccessfulReport={hasSuccessfulReport}
    />
  );
}
