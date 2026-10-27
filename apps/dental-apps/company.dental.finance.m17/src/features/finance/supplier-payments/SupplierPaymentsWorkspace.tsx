import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { SupplierListApi } from "../supplier-list/api";
import SupplierPaymentsView from "./SupplierPaymentsView";
import type { ClinicPurchase, ClinicSupplier, ClinicSupplierPayment } from "../supplier-list/types";

function readableError(cause: unknown, noun: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role cannot open Finance supplier payments.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    return cause.message || `${noun} could not be loaded.`;
  }
  return cause instanceof Error ? cause.message : `${noun} could not be loaded.`;
}

export function SupplierPaymentsWorkspace({
  client,
  onNavigationLockChange,
}: {
  client: ClinicClient;
  onNavigationLockChange: (locked: boolean) => void;
}) {
  const [payments, setPayments] = useState<ClinicSupplierPayment[]>([]);
  const [suppliers, setSuppliers] = useState<ClinicSupplier[]>([]);
  const [purchases, setPurchases] = useState<ClinicPurchase[]>([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(null);
  const requestSequence = useRef(0);
  const api = useMemo(() => new SupplierListApi(client), [client]);
  const loading = paymentsLoading || suppliersLoading || purchasesLoading;

  useClinicPageLoading("Supplier payments", loading);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setPaymentsLoading(true);
    setSuppliersLoading(true);
    setPurchasesLoading(true);
    setPaymentsError(null);
    setSuppliersError(null);
    setPurchasesError(null);

    const [paymentResult, supplierResult, purchaseResult] = await Promise.allSettled([
      api.listSupplierPayments(signal),
      api.listSuppliers(signal),
      api.listPurchases(signal),
    ]);
    if (sequence !== requestSequence.current) return;

    if (paymentResult.status === "fulfilled") setPayments(paymentResult.value);
    else if (!signal?.aborted) setPaymentsError(readableError(paymentResult.reason, "The supplier payment list"));
    if (supplierResult.status === "fulfilled") setSuppliers(supplierResult.value);
    else if (!signal?.aborted) setSuppliersError(readableError(supplierResult.reason, "The supplier list"));
    if (purchaseResult.status === "fulfilled") setPurchases(purchaseResult.value);
    else if (!signal?.aborted) setPurchasesError(readableError(purchaseResult.reason, "The purchase list"));

    setPaymentsLoading(false);
    setSuppliersLoading(false);
    setPurchasesLoading(false);
    const failed = [paymentResult, supplierResult, purchaseResult].find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
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
    key: "finance-supplier-payments",
    label: "Supplier payments",
    refresh: () => reload(),
    successMessage: "Supplier payments and references are up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, reload]));

  const onWritten = useCallback(async (payment: ClinicSupplierPayment, replacedPaymentId?: string) => {
    setNotice(null);
    setPayments((current) => [payment, ...current.filter((row) => row.supplierPaymentId !== payment.supplierPaymentId && row.supplierPaymentId !== replacedPaymentId)]);

    const [refreshResult, statementResult] = await Promise.allSettled([
      reload(),
      api.supplierStatement(payment.supplierId),
    ]);
    if (statementResult.status === "fulfilled") {
      const refreshedSupplier = statementResult.value.supplier;
      setSuppliers((current) => [refreshedSupplier, ...current.filter((row) => row.supplierId !== refreshedSupplier.supplierId)]
        .sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name)));
    }

    if (statementResult.status === "rejected") {
      setNotice({
        message: `Payment saved, but the supplier statement could not be refreshed (${readableError(statementResult.reason, "The supplier statement")}). Refresh before relying on the supplier account totals.`,
        error: true,
      });
    } else if (refreshResult.status === "rejected") {
      setNotice({ message: "Payment saved and the supplier statement refreshed, but one or more lists could not be reloaded. Use Refresh before continuing.", error: true });
    } else {
      setNotice({ message: "Payment saved and the supplier statement refreshed.", error: false });
    }
  }, [api, reload]);

  return (
    <SupplierPaymentsView
      api={api}
      client={client}
      payments={payments}
      suppliers={suppliers}
      purchases={purchases}
      paymentsLoading={paymentsLoading}
      suppliersLoading={suppliersLoading}
      purchasesLoading={purchasesLoading}
      paymentsError={paymentsError}
      suppliersError={suppliersError}
      purchasesError={purchasesError}
      notice={notice}
      onNavigationLockChange={onNavigationLockChange}
      onRefresh={reload}
      onWritten={onWritten}
    />
  );
}
