import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { ProductListApi } from "../product-list/api";
import { SupplierListApi } from "../supplier-list/api";
import { PurchasesApi } from "./api";
import PurchasesView from "./PurchasesView";
import type { ClinicProduct, ClinicPurchase, ClinicSupplier } from "./types";

function readableError(cause: unknown, noun: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role cannot open Finance purchases.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    return cause.message || `${noun} could not be loaded.`;
  }
  return cause instanceof Error ? cause.message : `${noun} could not be loaded.`;
}

export function PurchasesWorkspace({
  client,
  onNavigationLockChange,
  screen,
  purchaseId,
  onOpenPurchaseForm,
  onReviewPurchase,
  onExitPurchaseForm,
}: {
  client: ClinicClient;
  onNavigationLockChange: (locked: boolean) => void;
  screen: "main" | "purchase-form" | "purchase-review";
  purchaseId?: string;
  onOpenPurchaseForm: (purchaseId?: string) => void;
  onReviewPurchase: () => void;
  onExitPurchaseForm: () => void;
}) {
  const [purchaseDraftDirty, setPurchaseDraftDirty] = useState(false);
  const [purchases, setPurchases] = useState<ClinicPurchase[]>([]);
  const [products, setProducts] = useState<ClinicProduct[]>([]);
  const [suppliers, setSuppliers] = useState<ClinicSupplier[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [suppliersLoading, setSuppliersLoading] = useState(true);
  const [purchasesError, setPurchasesError] = useState<string | null>(null);
  const [productsError, setProductsError] = useState<string | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const api = useMemo(() => new PurchasesApi(client), [client]);
  const productApi = useMemo(() => new ProductListApi(client), [client]);
  const supplierApi = useMemo(() => new SupplierListApi(client), [client]);
  const loading = purchasesLoading || productsLoading || suppliersLoading;

  useClinicPageLoading("Purchases", loading);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setPurchasesLoading(true);
    setProductsLoading(true);
    setSuppliersLoading(true);
    setPurchasesError(null);
    setProductsError(null);
    setSuppliersError(null);
    const [purchaseResult, productResult, supplierResult] = await Promise.allSettled([
      api.list(signal),
      productApi.listProducts(signal),
      supplierApi.listSuppliers(signal),
    ]);
    if (sequence !== requestSequence.current) return;

    if (purchaseResult.status === "fulfilled") setPurchases(purchaseResult.value);
    else if (!signal?.aborted) setPurchasesError(readableError(purchaseResult.reason, "The purchase list"));
    if (productResult.status === "fulfilled") setProducts(productResult.value);
    else if (!signal?.aborted) setProductsError(readableError(productResult.reason, "The product catalogue"));
    if (supplierResult.status === "fulfilled") setSuppliers(supplierResult.value);
    else if (!signal?.aborted) setSuppliersError(readableError(supplierResult.reason, "The supplier list"));

    setPurchasesLoading(false);
    setProductsLoading(false);
    setSuppliersLoading(false);
    const failed = [purchaseResult, productResult, supplierResult].find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  }, [api, productApi, supplierApi]);

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal).catch(() => undefined);
    return () => {
      controller.abort();
      requestSequence.current += 1;
    };
  }, [reload]);

  useClinicPageRefresh(useMemo(() => ({
    key: "finance-purchases",
    label: "Purchases",
    refresh: () => reload(),
    successMessage: "Purchases are up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, reload]));

  const onProductCreated = useCallback((product: ClinicProduct) => {
    setProducts((current) => [...current.filter((row) => row.productId !== product.productId), product]
      .sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name)));
  }, []);

  const onSupplierCreated = useCallback((supplier: ClinicSupplier) => {
    setSuppliers((current) => [...current.filter((row) => row.supplierId !== supplier.supplierId), supplier]
      .sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name)));
  }, []);

  const onCreated = useCallback((purchase: ClinicPurchase) => {
    setPurchases((current) => [purchase, ...current.filter((row) => row.purchaseId !== purchase.purchaseId)]);
  }, []);

  const onCorrected = useCallback((purchase: ClinicPurchase) => {
    setPurchases((current) => [purchase, ...current.filter((row) => row.purchaseId !== purchase.correctsPurchaseId && row.purchaseId !== purchase.purchaseId)]);
  }, []);

  const onVoided = useCallback((purchaseId: string) => {
    setPurchases((current) => current.filter((purchase) => purchase.purchaseId !== purchaseId));
  }, []);

  return (
    <PurchasesView
      api={api}
      productApi={productApi}
      supplierApi={supplierApi}
      client={client}
      purchases={purchases}
      products={products}
      suppliers={suppliers}
      purchasesLoading={purchasesLoading}
      referencesLoading={productsLoading || suppliersLoading}
      purchasesError={purchasesError}
      referencesError={productsError || suppliersError}
      onNavigationLockChange={onNavigationLockChange}
      purchaseDraftDirty={purchaseDraftDirty}
      onDraftDirtyChange={setPurchaseDraftDirty}
      screen={screen}
      purchaseId={purchaseId}
      onOpenPurchaseForm={onOpenPurchaseForm}
      onReviewPurchase={onReviewPurchase}
      onExitPurchaseForm={onExitPurchaseForm}
      onRefresh={reload}
      onProductCreated={onProductCreated}
      onSupplierCreated={onSupplierCreated}
      onCreated={onCreated}
      onCorrected={onCorrected}
      onVoided={onVoided}
    />
  );
}
