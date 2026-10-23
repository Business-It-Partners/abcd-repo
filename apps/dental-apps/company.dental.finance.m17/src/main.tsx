import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { ClinicClient, ClinicError } from "./sdk/client";
import type { AppHistory } from "../../../../packages/app-sdk/src/appHistory";
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

const APP_ID = "company.dental.finance.m17";
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
type FinanceModuleId = keyof typeof FINANCE_MODULES;
type FinancePage =
  | { moduleId: FinanceModuleId; screen: "main" }
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
  const financeNavigationLocked = useRef(false);
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
  const closeSupplier = useCallback(() => closeDetail("supplier-list"), [closeDetail]);
  const resetMissingProduct = useCallback(() => resetMissingDetail("product-list"), [resetMissingDetail]);
  const resetMissingSupplier = useCallback(() => resetMissingDetail("supplier-list"), [resetMissingDetail]);

  const setFinanceNavigationLock = useCallback((locked: boolean) => {
    financeNavigationLocked.current = locked;
  }, []);

  useEffect(() => {
    document.title = FINANCE_MODULES[moduleId].label + " · Finance · Dental OS";
  }, [moduleId]);

  useEffect(() => {
    let active = true;
    const bridge = window.dentalApp;
    if (!bridge) {
      setMessage("Open Finance from the Dental OS Store.");
      return;
    }

    let history: AppHistory<FinancePage> | null = null;
    let unsubscribeHistory: (() => void) | null = null;
    const sdk = new ClinicClient(bridge, () => {
      if (!active) return;
      unsubscribeHistory?.();
      history?.dispose();
      historyRef.current = null;
      setPage(null);
      setClient(null);
      capabilitiesRef.current = [];
      setCapabilities([]);
      setMessage("The clinic session changed. Reopen Finance from Dental OS.");
    });
    const unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
      if (!active) return;
      if (!Object.hasOwn(FINANCE_MODULES, moduleId)) {
        setModuleMessage("The selected Finance module is unavailable in this package version.");
      } else {
        const selected = moduleId as FinanceModuleId;
        if (financeNavigationLocked.current && selected !== moduleIdRef.current) {
          setModuleMessage("Finish or close the open Finance dialog, or retry its pending update, before switching modules.");
          throw new Error("Finance module navigation is blocked while a dialog or unresolved update is open.");
        }
        if (capabilitiesRef.current.length && !capabilitiesRef.current.includes(FINANCE_MODULES[selected].capability)) {
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
      }
    });

    void sdk.initialize(APP_ID).then(({ session }) => {
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
      const appHistory = sdk.createHistory<FinancePage>(mainPage(selected), () => !financeNavigationLocked.current);
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
      unsubscribe();
      unsubscribeHistory?.();
      history?.dispose();
      historyRef.current = null;
      sdk.report({ dirty: false, modal: false });
    };
  }, [applyHistoryPage]);

  if (!client) {
    return <main className="finance-open-state" role={message.startsWith("Opening") ? "status" : "alert"}>{message}</main>;
  }

  const productId = page?.moduleId === "product-list" && page.screen === "product-detail" ? page.productId : null;
  const supplierId = page?.moduleId === "supplier-list" && page.screen === "supplier-detail" ? page.supplierId : null;

  return (
    <ClinicLoadingProvider>
      <ClinicPageRefreshProvider>
        <main className="finance-app-shell" data-dental-os-app={APP_ID}>
          <header className="finance-app-toolbar" aria-label="Finance app toolbar">
            <div className="finance-app-toolbar-start">
              <span id="finance-active-module" aria-live="polite">{FINANCE_MODULES[moduleId].label}</span>
              <button
                type="button"
                className="finance-more-apps"
                aria-label="More Finance apps"
                onClick={() => {
                  void window.dentalApp?.openAppExplorer().then((result) => {
                    if (!result.ok && result.error) setModuleMessage(result.error.message);
                  }).catch((cause: unknown) => setModuleMessage(errorMessage(cause)));
                }}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <rect x="1" y="1" width="5" height="5" rx="1" />
                  <rect x="10" y="1" width="5" height="5" rx="1" />
                  <rect x="1" y="10" width="5" height="5" rx="1" />
                  <rect x="10" y="10" width="5" height="5" rx="1" />
                </svg>
                <span>More Apps</span>
              </button>
            </div>
          </header>
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
                onCloseSupplier={closeSupplier}
                onInvalidSupplier={resetMissingSupplier}
              />
            ) : moduleId === "purchases" ? (
              <PurchasesWorkspace client={client} onNavigationLockChange={setFinanceNavigationLock} />
            ) : (
              <SupplierPaymentsWorkspace client={client} onNavigationLockChange={setFinanceNavigationLock} />
            )}
          </section>
        </main>
      </ClinicPageRefreshProvider>
    </ClinicLoadingProvider>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
