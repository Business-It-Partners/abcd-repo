import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ClinicClient, ClinicError } from "./sdk/client";
import { connectBrowserRuntime } from "./runtimeBridge";
import { ClinicSnackbarProvider } from "@/shared/ui/ClinicSnackbar";
import type { AppHistory } from "./sdk/client";
import { TransactionRecordWorkspace } from "./features/finance/transaction-record/TransactionRecordWorkspace";
import { PatientPaymentsWorkspace } from "./features/finance/patient-payments/PatientPaymentsWorkspace";
import { GeneralExpensesWorkspace } from "./features/finance/general-expenses/GeneralExpensesWorkspace";
import { SalaryPaymentsWorkspace } from "./features/finance/salary-payments/SalaryPaymentsWorkspace";
import { ProductListWorkspace } from "./features/finance/product-list/ProductListWorkspace";
import { SupplierListWorkspace } from "./features/finance/supplier-list/SupplierListWorkspace";
import { PurchasesWorkspace } from "./features/finance/purchases/PurchasesWorkspace";
import { SupplierPaymentsWorkspace } from "./features/finance/supplier-payments/SupplierPaymentsWorkspace";
import { ClinicLoadingProvider } from "@/shared/ui/ClinicLoadingOverlay";
import { ClinicPageRefreshProvider } from "@/shared/ui/ClinicPageRefresh";
import "@/shared/clinic.css";
import "./styles.css";

const APP_ID = "finance";
const FINANCE_MODULES = {
  "transaction-record": { label: "Transaction Record", capability: "finance.manage" },
  "patient-payments": { label: "Patient payments", capability: "patient_payments.outstanding.read" },
  "general-expenses": { label: "General expenses", capability: "finance.manage" },
  "salary-payments": { label: "Salary payments", capability: "finance.manage" },
  "product-list": { label: "Product list", capability: "finance.manage" },
  purchases: { label: "Purchases", capability: "finance.manage" },
  "supplier-list": { label: "Supplier list", capability: "finance.manage" },
  "supplier-payments": { label: "Supplier payments", capability: "finance.manage" },
} as const;
// Install the one-time app-host handshake before React mounts.
const browserRuntime = connectBrowserRuntime(APP_ID);
type FinanceModuleId = keyof typeof FINANCE_MODULES;
type FinancePage =
  | { moduleId: FinanceModuleId; screen: "main" }
  | { moduleId: "purchases"; screen: "purchase-form" | "purchase-review"; purchaseId?: string }
  | { moduleId: "product-list"; screen: "product-detail"; productId: string }
  | { moduleId: "supplier-list"; screen: "supplier-detail"; supplierId: string };

function mainPage(moduleId: FinanceModuleId): FinancePage {
  return { moduleId, screen: "main" };
}

function errorMessage(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return "Finance is unavailable for this clinic role.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    return cause.message || "Finance could not be opened.";
  }
  return cause instanceof Error ? cause.message : "Finance could not be opened.";
}

function App() {
  const [client, setClient] = useState<ClinicClient | null>(null);
  const [message, setMessage] = useState("Opening Finance…");
  const [moduleMessage, setModuleMessage] = useState("");
  const [moduleId, setModuleId] = useState<FinanceModuleId>("transaction-record");
  const [page, setPage] = useState<FinancePage | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const capabilitiesRef = useRef<string[]>([]);
  const moduleIdRef = useRef<FinanceModuleId>("transaction-record");
  const financeModuleNavigationLocked = useRef(false);
  const historyRef = useRef<AppHistory<FinancePage> | null>(null);

  const applyHistoryPage = useCallback((next: FinancePage) => {
    moduleIdRef.current = next.moduleId;
    setModuleId(next.moduleId);
    setPage(next);
  }, []);
  const openProduct = useCallback((productId: string) => {
    const history = historyRef.current;
    if (!history) return;
    const current = history.current();
    if (current.moduleId === "product-list" && current.screen === "main") {
      history.push({ moduleId: "product-list", screen: "product-detail", productId });
    }
  }, []);
  const openSupplier = useCallback((supplierId: string) => {
    const history = historyRef.current;
    if (!history) return;
    const current = history.current();
    if (current.moduleId === "supplier-list" && current.screen === "main") {
      history.push({ moduleId: "supplier-list", screen: "supplier-detail", supplierId });
    }
  }, []);
  const openPurchaseForm = useCallback((purchaseId?: string) => {
    const history = historyRef.current;
    if (!history) return;
    const current = history.current();
    if (current.moduleId === "purchases" && current.screen === "main") {
      history.push({ moduleId: "purchases", screen: "purchase-form", ...(purchaseId ? { purchaseId } : {}) });
    }
  }, []);
  const reviewPurchase = useCallback(() => {
    const history = historyRef.current;
    const current = history?.current();
    if (!history || current?.moduleId !== "purchases" || current.screen !== "purchase-form") return;
    history.push({ moduleId: "purchases", screen: "purchase-review", ...(current.purchaseId ? { purchaseId: current.purchaseId } : {}) });
  }, []);
  const exitPurchaseForm = useCallback(() => {
    historyRef.current?.reset(mainPage("purchases"));
  }, []);
  const closeDetail = useCallback((owner: "product-list" | "supplier-list") => {
    const history = historyRef.current;
    const current = history?.current();
    if (!history || current?.moduleId !== owner || current.screen === "main") return;
    if (!history.back(true)) history.replace(mainPage(owner));
  }, []);
  const resetMissingDetail = useCallback((owner: "product-list" | "supplier-list") => {
    const history = historyRef.current;
    if (history?.current().moduleId === owner && history.current().screen !== "main") history.replace(mainPage(owner));
  }, []);
  const closeProduct = useCallback(() => closeDetail("product-list"), [closeDetail]);
  const resetMissingProduct = useCallback(() => resetMissingDetail("product-list"), [resetMissingDetail]);
  const resetMissingSupplier = useCallback(() => resetMissingDetail("supplier-list"), [resetMissingDetail]);

  const setFinanceNavigationLock = useCallback((locked: boolean) => {
    financeModuleNavigationLocked.current = locked;
  }, []);

  const selectModule = useCallback((selected: FinanceModuleId) => {
    if (!Object.hasOwn(FINANCE_MODULES, selected)) {
      setModuleMessage("The selected Finance module is unavailable in this package version.");
      return;
    }
    if (financeModuleNavigationLocked.current && selected !== moduleIdRef.current) {
      setModuleMessage("Finish or close the open Finance dialog, or check its pending update, before switching modules.");
      return;
    }
    if (!capabilitiesRef.current.includes(FINANCE_MODULES[selected].capability)) {
      setModuleMessage("Your clinic role cannot open this Finance module.");
      return;
    }
    if (selected !== moduleIdRef.current) {
      const history = historyRef.current;
      if (history) history.reset(mainPage(selected));
      else {
        moduleIdRef.current = selected;
        setModuleId(selected);
      }
    }
    setModuleMessage("");
  }, []);

  useEffect(() => {
    document.title = FINANCE_MODULES[moduleId].label + " · Finance · Dental OS";
  }, [moduleId]);

  useEffect(() => {
    let active = true;
    let history: AppHistory<FinancePage> | null = null;
    let unsubscribeHistory: (() => void) | null = null;
    let sdk: ClinicClient | null = null;
    void browserRuntime.then(async (bridge) => {
      if (!active) return;
      sdk = new ClinicClient(bridge);
      const { session } = await sdk.initialize(APP_ID);
      if (!active) return;
      const nextCapabilities = session.clinicUser.capabilities;
      capabilitiesRef.current = nextCapabilities;
      setCapabilities(nextCapabilities);
      const initialModule: FinanceModuleId | null = nextCapabilities.includes("finance.manage")
        ? "transaction-record"
        : nextCapabilities.includes("patient_payments.outstanding.read")
          ? "patient-payments"
          : null;
      if (!initialModule) {
        throw new ClinicError("FORBIDDEN", "Finance requires an approved Finance module capability.");
      }
      const preferredModule = moduleIdRef.current;
      const selected = nextCapabilities.includes(FINANCE_MODULES[preferredModule].capability)
        ? preferredModule
        : initialModule;
      const appHistory = sdk.createHistory<FinancePage>(
        mainPage(selected),
        // The shared OS runtime guards dirty drafts, modals and pending writes.
        // Finance's module-switch lock must not block page-level window Back.
        () => true,
        (current) => current.moduleId === "purchases" && current.screen === "purchase-review",
      );
      history = appHistory;
      historyRef.current = appHistory;
      unsubscribeHistory = appHistory.subscribe(applyHistoryPage);
      setClient(sdk);
      setMessage("");
    }).catch((cause) => {
      if (active) setMessage(errorMessage(cause));
    });

    return () => {
      active = false;
      unsubscribeHistory?.();
      history?.dispose();
      historyRef.current = null;
      sdk?.report({ dirty: false, modal: false });
    };
  }, [applyHistoryPage]);

  if (!client) {
    return <main className="finance-open-state" role={message.startsWith("Opening") ? "status" : "alert"}>{message}</main>;
  }

  const productId = page?.moduleId === "product-list" && page.screen === "product-detail" ? page.productId : null;
  const supplierId = page?.moduleId === "supplier-list" && page.screen === "supplier-detail" ? page.supplierId : null;

  return (
    <ClinicSnackbarProvider>
      <ClinicLoadingProvider>
        <ClinicPageRefreshProvider>
        <main className="finance-app-shell" data-dental-os-app={APP_ID}>
          <nav className="finance-module-nav" aria-label="Finance modules">
            {Object.entries(FINANCE_MODULES).filter(([, module]) => capabilities.includes(module.capability)).map(([id, module]) => (
              <button
                key={id}
                type="button"
                className={moduleId === id ? "finance-module-tab finance-module-tab-active" : "finance-module-tab"}
                aria-current={moduleId === id ? "page" : undefined}
                onClick={() => selectModule(id as FinanceModuleId)}
              >
                {module.label}
              </button>
            ))}
          </nav>
          <section className="finance-app-content">
            {moduleMessage && <p className="finance-module-message" role="alert">{moduleMessage}</p>}
            {moduleId === "transaction-record" ? (
              <TransactionRecordWorkspace client={client} />
            ) : moduleId === "patient-payments" ? (
              <PatientPaymentsWorkspace client={client} capabilities={capabilities} />
            ) : moduleId === "general-expenses" ? (
              <GeneralExpensesWorkspace client={client} onNavigationLockChange={setFinanceNavigationLock} />
            ) : moduleId === "salary-payments" ? (
              <SalaryPaymentsWorkspace client={client} onNavigationLockChange={setFinanceNavigationLock} />
            ) : moduleId === "product-list" ? (
              <ProductListWorkspace
                client={client}
                onNavigationLockChange={setFinanceNavigationLock}
                selectedProductId={productId}
                onOpenProduct={openProduct}
                onCloseProduct={closeProduct}
                onInvalidProduct={resetMissingProduct}
              />
            ) : moduleId === "supplier-list" ? (
              <SupplierListWorkspace
                client={client}
                onNavigationLockChange={setFinanceNavigationLock}
                selectedSupplierId={supplierId}
                onOpenSupplier={openSupplier}
                onInvalidSupplier={resetMissingSupplier}
              />
            ) : moduleId === "purchases" ? (
              <PurchasesWorkspace
                client={client}
                onNavigationLockChange={setFinanceNavigationLock}
                screen={page?.moduleId === "purchases" ? page.screen : "main"}
                purchaseId={page?.moduleId === "purchases" && page.screen !== "main" ? page.purchaseId : undefined}
                onOpenPurchaseForm={openPurchaseForm}
                onReviewPurchase={reviewPurchase}
                onExitPurchaseForm={exitPurchaseForm}
              />
            ) : (
              <SupplierPaymentsWorkspace client={client} onNavigationLockChange={setFinanceNavigationLock} />
            )}
          </section>
        </main>
        </ClinicPageRefreshProvider>
      </ClinicLoadingProvider>
    </ClinicSnackbarProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
