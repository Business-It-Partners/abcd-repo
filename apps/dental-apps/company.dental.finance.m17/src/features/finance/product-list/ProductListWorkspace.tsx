import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClinicClient, ClinicError } from "@/sdk/client";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import { ProductListApi } from "./api";
import ProductListView from "./ProductListView";
import type { ClinicProduct, ProductPurchase } from "./types";

function readableError(cause: unknown, fallback: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role cannot open the product list.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    return cause.message || fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

export function ProductListWorkspace({
  client,
  onNavigationLockChange,
}: {
  client: ClinicClient;
  onNavigationLockChange: (locked: boolean) => void;
}) {
  const [products, setProducts] = useState<ClinicProduct[]>([]);
  const [purchases, setPurchases] = useState<ProductPurchase[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [purchasesLoading, setPurchasesLoading] = useState(true);
  const [productError, setProductError] = useState<string | null>(null);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const api = useMemo(() => new ProductListApi(client), [client]);
  const loading = productsLoading || purchasesLoading;

  useClinicPageLoading("Product list", loading);

  const reload = useCallback(async (signal?: AbortSignal) => {
    const sequence = ++requestSequence.current;
    setProductsLoading(true);
    setPurchasesLoading(true);
    setProductError(null);
    setPurchaseError(null);
    const [productResult, purchaseResult] = await Promise.allSettled([
      api.listProducts(signal),
      api.listPurchases(signal),
    ]);
    if (sequence !== requestSequence.current) return;

    if (productResult.status === "fulfilled") setProducts(productResult.value);
    else if (!signal?.aborted) setProductError(readableError(productResult.reason, "Product catalogue could not be loaded."));

    if (purchaseResult.status === "fulfilled") setPurchases(purchaseResult.value);
    else if (!signal?.aborted) setPurchaseError(readableError(purchaseResult.reason, "Purchase history could not be loaded."));

    setProductsLoading(false);
    setPurchasesLoading(false);
    if (productResult.status === "rejected") throw productResult.reason;
    if (purchaseResult.status === "rejected") throw purchaseResult.reason;
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
    key: "finance-product-list",
    label: "Product list",
    refresh: () => reload(),
    successMessage: "Product list is up to date.",
    busy: loading,
    placement: "page-action" as const,
  }), [loading, reload]));

  const saveCreated = useCallback(async (product: ClinicProduct) => {
    setProducts((current) => [...current, product].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)));
  }, []);

  const saveUpdated = useCallback(async (product: ClinicProduct) => {
    setProducts((current) => current.map((row) => row.productId === product.productId ? product : row)
      .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name)));
  }, []);

  return (
    <ProductListView
      api={api}
      client={client}
      products={products}
      purchases={purchases}
      loading={productsLoading}
      loadError={productError}
      purchasesLoading={purchasesLoading}
      purchasesError={purchaseError}
      onNavigationLockChange={onNavigationLockChange}
      onRefresh={reload}
      onCreated={saveCreated}
      onUpdated={saveUpdated}
    />
  );
}
