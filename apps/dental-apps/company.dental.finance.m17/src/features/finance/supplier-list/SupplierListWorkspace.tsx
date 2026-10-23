import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { SupplierListApi } from "./api";
import SupplierDetailView from "./SupplierDetailView";
import SupplierListView from "./SupplierListView";
import type { ClinicPurchase, ClinicSupplier, ClinicSupplierPayment, ClinicSupplierStatement } from "./types";

function readableError(cause: unknown, fallback: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role cannot open supplier finance.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    return cause.message || fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

export function SupplierListWorkspace({
  client,
  onNavigationLockChange,
  selectedSupplierId,
  onOpenSupplier,
  onCloseSupplier,
  onInvalidSupplier,
}: {
  client: ClinicClient;
  onNavigationLockChange: (locked: boolean) => void;
  selectedSupplierId: string | null;
  onOpenSupplier: (supplierId: string) => void;
  onCloseSupplier: () => void;
  onInvalidSupplier: () => void;
}) {
  const [suppliers, setSuppliers] = useState<ClinicSupplier[]>([]);
  const [purchases, setPurchases] = useState<ClinicPurchase[]>([]);
  const [payments, setPayments] = useState<ClinicSupplierPayment[]>([]);
  const [statement, setStatement] = useState<ClinicSupplierStatement | null>(null);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [statementLoading, setStatementLoading] = useState(false);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);
  const [statementError, setStatementError] = useState<string | null>(null);
  const listSequence = useRef(0);
  const detailSequence = useRef(0);
  const api = useMemo(() => new SupplierListApi(client), [client]);
  const selected = suppliers.find((supplier) => supplier.supplierId === selectedSupplierId) ?? null;
  const selectedId = selected?.supplierId ?? null;
  const loading = suppliersLoading || Boolean(selected && (purchasesLoading || paymentsLoading || statementLoading));

  useClinicPageLoading("Supplier list", loading, selected ? {
    title: "Opening supplier account…",
    message: "Loading purchases, payments and the current supplier statement.",
  } : undefined);

  const loadSuppliers = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++listSequence.current;
    setSuppliersLoading(true);
    setSuppliersError(null);
    try {
      const next = await api.listSuppliers(signal);
      if (sequence === listSequence.current) setSuppliers(next);
    } catch (cause) {
      if (sequence === listSequence.current && !signal?.aborted) setSuppliersError(readableError(cause, "The supplier list could not be loaded."));
      throw cause;
    } finally {
      if (sequence === listSequence.current) setSuppliersLoading(false);
    }
  }, [api]);

  const loadDetail = useCallback(async (supplierId: string, signal?: AbortSignal) => {
    const sequence = ++detailSequence.current;
    setStatement(null);
    setStatementError(null);
    setPurchasesError(null);
    setPaymentsError(null);
    setStatementLoading(true);
    setPurchasesLoading(true);
    setPaymentsLoading(true);
    const [statementResult, purchaseResult, paymentResult] = await Promise.allSettled([
      api.supplierStatement(supplierId, signal),
      api.listPurchases(signal),
      api.listSupplierPayments(signal),
    ]);
    if (sequence !== detailSequence.current) return;

    if (statementResult.status === "fulfilled") setStatement(statementResult.value);
    else if (!signal?.aborted) setStatementError(readableError(statementResult.reason, "The supplier statement could not be loaded."));

    if (purchaseResult.status === "fulfilled") setPurchases(purchaseResult.value);
    else if (!signal?.aborted) setPurchasesError(readableError(purchaseResult.reason, "Supplier purchases could not be loaded."));

    if (paymentResult.status === "fulfilled") setPayments(paymentResult.value);
    else if (!signal?.aborted) setPaymentsError(readableError(paymentResult.reason, "Supplier payments could not be loaded."));

    setStatementLoading(false);
    setPurchasesLoading(false);
    setPaymentsLoading(false);
    const rejected = [statementResult, purchaseResult, paymentResult].find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
  }, [api]);

  useEffect(() => {
    const controller = new AbortController();
    void loadSuppliers(controller.signal).catch(() => undefined);
    return () => {
      controller.abort();
      listSequence.current += 1;
    };
  }, [loadSuppliers]);

  useEffect(() => {
    if (!selectedSupplierId || !selectedId) return;
    const controller = new AbortController();
    void loadDetail(selectedId, controller.signal).catch(() => undefined);
    return () => {
      controller.abort();
      detailSequence.current += 1;
    };
  }, [loadDetail, selectedSupplierId, selectedId]);

  useEffect(() => {
    if (!suppliersLoading && !suppliersError && selectedSupplierId && !selected) {
      setStatement(null);
      setStatementLoading(false);
      onInvalidSupplier();
    }
  }, [onInvalidSupplier, selected, selectedSupplierId, suppliersError, suppliersLoading]);

  const refresh = useCallback(async () => {
    const results = await Promise.allSettled([
      loadSuppliers(),
      selected ? loadDetail(selected.supplierId) : Promise.resolve(),
    ]);
    const rejected = results.find((result) => result.status === "rejected");
    if (rejected?.status === "rejected") throw rejected.reason;
  }, [loadDetail, loadSuppliers, selected]);

  useClinicPageRefresh(useMemo(() => ({
    key: selected ? `finance-supplier-detail:${selected.supplierId}` : "finance-supplier-list",
    label: selected ? "Supplier detail" : "Supplier list",
    refresh,
    successMessage: selected ? "Supplier detail is up to date." : "Supplier list is up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, refresh, selected]));

  const onCreated = useCallback(async (supplier: ClinicSupplier) => {
    setSuppliers((current) => [...current.filter((row) => row.supplierId !== supplier.supplierId), supplier]
      .sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name)));
    setSuppliersError(null);
  }, []);

  const onUpdated = useCallback(async (supplier: ClinicSupplier) => {
    setSuppliers((current) => current.map((row) => row.supplierId === supplier.supplierId ? supplier : row)
      .sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name)));
  }, []);

  const openSupplier = useCallback((supplier: ClinicSupplier) => {
    onOpenSupplier(supplier.supplierId);
  }, [onOpenSupplier]);

  const closeSupplier = useCallback(() => {
    onCloseSupplier();
  }, [onCloseSupplier]);

  const onRecordPayment = useCallback(async (payment: ClinicSupplierPayment) => {
    setPayments((current) => [payment, ...current.filter((row) => row.supplierPaymentId !== payment.supplierPaymentId)]);
    setPaymentsError(null);
    void loadDetail(payment.supplierId).catch(() => undefined);
  }, [loadDetail]);

  if (selected) return <SupplierDetailView
    api={api}
    client={client}
    supplier={selected}
    purchases={purchases}
    purchasesLoading={purchasesLoading}
    purchasesError={purchasesError}
    payments={payments}
    paymentsLoading={paymentsLoading}
    paymentsError={paymentsError}
    statement={statement}
    statementLoading={statementLoading}
    statementError={statementError}
    onNavigationLockChange={onNavigationLockChange}
    onBack={closeSupplier}
    onRecordPayment={onRecordPayment}
  />;

  return <SupplierListView
    api={api}
    client={client}
    suppliers={suppliers}
    loading={suppliersLoading}
    loadError={suppliersError}
    onNavigationLockChange={onNavigationLockChange}
    onRefresh={refresh}
    onCreated={onCreated}
    onUpdated={onUpdated}
    onOpenSupplier={openSupplier}
  />;
}
