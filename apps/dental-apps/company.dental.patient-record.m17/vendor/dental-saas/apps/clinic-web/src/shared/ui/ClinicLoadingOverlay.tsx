"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import styles from "./ClinicLoadingOverlay.module.css";

export type ClinicLoadingCopy = {
  title: string;
  message: string;
};

export const clinicLoadingCopy: Record<string, ClinicLoadingCopy> = {
  "Follow-ups": { title: "Opening follow-ups…", message: "Loading the patient recall queue and contact status." },
  Appointments: { title: "Opening appointments…", message: "Loading the clinic schedule and appointment details." },
  "New Patient": { title: "Preparing patient registration…", message: "Loading clinicians, labs and treatment protocols." },
  "Work Entry": { title: "Opening clinical worklist…", message: "Loading patient cases and treatment plans." },
  "Patient Record": { title: "Opening patient records…", message: "Loading patient profiles and clinical history." },
  "Treatment Progress": { title: "Opening treatment progress…", message: "Loading active treatment plans and return visits." },
  "Lab Tracker": { title: "Opening lab tracker…", message: "Loading lab orders, suppliers and case details." },
  "Lab supplier record": { title: "Opening lab suppliers…", message: "Loading laboratory suppliers and account records." },
  "Transaction Record": { title: "Opening transaction record…", message: "Loading clinic cash activity and monthly totals." },
  "Patient payments": { title: "Opening patient payments…", message: "Loading patient balances and payment records." },
  "General expenses": { title: "Opening general expenses…", message: "Loading clinic expense records." },
  "Salary payments": { title: "Opening salary payments…", message: "Loading staff and salary payout records." },
  "Product list": { title: "Opening product list…", message: "Loading the clinic purchase catalogue." },
  Purchases: { title: "Opening purchases…", message: "Loading purchases, products and suppliers." },
  "Supplier list": { title: "Opening suppliers…", message: "Loading supplier profiles and balances." },
  "Supplier payments": { title: "Opening supplier payments…", message: "Loading supplier invoices and payment records." },
  Staff: { title: "Opening staff directory…", message: "Loading doctors and clinic personnel." },
  "Treatment Protocols": { title: "Opening treatment protocols…", message: "Loading reusable clinical treatment templates." },
  Calendar: { title: "Opening clinic calendar…", message: "Loading this month’s clinic tasks." },
  "Clinic profile": { title: "Opening clinic profile…", message: "Loading clinic identity and workspace settings." },
  "User management": { title: "Opening user management…", message: "Loading clinic login accounts and access status." },
};

type LoadingReporter = { area: string; busy: boolean; copy: ClinicLoadingCopy };
type ActiveLoading = ClinicLoadingCopy & { area: string; startedAt: number; blocking: boolean };
type PageLoadingPhase = { area: string; sawBusy: boolean; initialLoadComplete: boolean };
type LoadingContextValue = {
  beginNavigation: (area: string) => void;
  beginOperation: (area: string, copy?: ClinicLoadingCopy, blocking?: boolean) => () => void;
  reportPageLoading: (reporterId: string, report: LoadingReporter | null) => void;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);
const minimumVisibleMs = 420;
const navigationFallbackMs = 850;

function copyFor(area: string): ClinicLoadingCopy {
  return clinicLoadingCopy[area] ?? {
    title: `Opening ${area.toLocaleLowerCase()}…`,
    message: "Loading the latest clinic information.",
  };
}

export function advancePageLoadingPhase(
  current: PageLoadingPhase,
  area: string,
  busy: boolean,
): { phase: PageLoadingPhase; showOpening: boolean } {
  const phase = current.area === area
    ? { ...current }
    : { area, sawBusy: false, initialLoadComplete: false };

  if (busy) {
    phase.sawBusy = true;
    return { phase, showOpening: !phase.initialLoadComplete };
  }
  if (phase.sawBusy) phase.initialLoadComplete = true;
  return { phase, showOpening: false };
}

export function ClinicLoadingProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveLoading | null>(null);
  const loadingRef = useRef<HTMLDivElement>(null);
  const reporters = useRef(new Map<string, LoadingReporter>());
  const operations = useRef(new Map<string, { area: string; copy: ClinicLoadingCopy }>());
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback((timer: typeof hideTimer) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const areaBusy = useCallback((area: string) => {
    const pageBusy = Array.from(reporters.current.values()).some((report) => report.area === area && report.busy);
    const operationBusy = Array.from(operations.current.values()).some((operation) => operation.area === area);
    return pageBusy || operationBusy;
  }, []);

  const hideWhenReady = useCallback((area: string) => {
    clearTimer(hideTimer);
    setActive((current) => {
      if (!current || current.area !== area || areaBusy(area)) return current;
      const delay = Math.max(0, minimumVisibleMs - (performance.now() - current.startedAt));
      hideTimer.current = setTimeout(() => {
        if (!areaBusy(area)) setActive((latest) => latest?.area === area ? null : latest);
      }, delay);
      return current;
    });
  }, [areaBusy, clearTimer]);

  const show = useCallback((area: string, copy: ClinicLoadingCopy, blocking = false) => {
    clearTimer(hideTimer);
    setActive({ area, ...copy, blocking, startedAt: performance.now() });
  }, [clearTimer]);

  const beginNavigation = useCallback((area: string) => {
    clearTimer(fallbackTimer);
    show(area, copyFor(area));
    fallbackTimer.current = setTimeout(() => hideWhenReady(area), navigationFallbackMs);
  }, [clearTimer, hideWhenReady, show]);

  const beginOperation = useCallback((area: string, copy = copyFor(area), blocking = false) => {
    const operationId = crypto.randomUUID();
    operations.current.set(operationId, { area, copy });
    show(area, copy, blocking);
    return () => {
      operations.current.delete(operationId);
      hideWhenReady(area);
    };
  }, [hideWhenReady, show]);

  const reportPageLoading = useCallback((reporterId: string, report: LoadingReporter | null) => {
    if (!report) {
      const previous = reporters.current.get(reporterId);
      reporters.current.delete(reporterId);
      if (previous) hideWhenReady(previous.area);
      return;
    }
    reporters.current.set(reporterId, report);
    if (report.busy) show(report.area, report.copy);
    else hideWhenReady(report.area);
  }, [hideWhenReady, show]);

  useEffect(() => () => {
    clearTimer(hideTimer);
    clearTimer(fallbackTimer);
  }, [clearTimer]);

  useEffect(() => {
    if (!active?.blocking) return;
    const workspace = document.querySelector<HTMLElement>(".clinicApp");
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const wasInert = workspace?.inert ?? false;
    const previousAriaHidden = workspace?.getAttribute("aria-hidden") ?? null;
    if (workspace) {
      workspace.inert = true;
      workspace.setAttribute("aria-hidden", "true");
    }
    loadingRef.current?.focus();
    return () => {
      if (workspace) {
        workspace.inert = wasInert;
        if (previousAriaHidden === null) workspace.removeAttribute("aria-hidden");
        else workspace.setAttribute("aria-hidden", previousAriaHidden);
      }
      previousFocus?.focus();
    };
  }, [active?.blocking]);

  const value = useMemo(() => ({ beginNavigation, beginOperation, reportPageLoading }), [beginNavigation, beginOperation, reportPageLoading]);
  return (
    <LoadingContext.Provider value={value}>
      {children}
      {active ? (
        <div
          aria-label={active.title}
          aria-live="polite"
          className={`${styles.backdrop} ${active.blocking ? styles.blocking : styles.progress}`}
          ref={loadingRef}
          role="status"
          tabIndex={active.blocking ? -1 : undefined}
        >
          <div className={styles.panel}>
            <span className={styles.spinner} aria-hidden="true" />
            <strong>{active.title}</strong>
            <p>{active.message}</p>
          </div>
        </div>
      ) : null}
    </LoadingContext.Provider>
  );
}

export function useClinicLoading() {
  const context = useContext(LoadingContext);
  if (!context) throw new Error("useClinicLoading must be used inside ClinicLoadingProvider.");
  return context;
}

export function useClinicPageLoading(area: string, busy: boolean, copy: ClinicLoadingCopy = copyFor(area)) {
  const reporterId = useId();
  const { reportPageLoading } = useClinicLoading();
  const phaseRef = useRef<PageLoadingPhase>({ area, sawBusy: false, initialLoadComplete: false });
  const next = advancePageLoadingPhase(phaseRef.current, area, busy);
  phaseRef.current = next.phase;
  const stableCopy = useMemo(() => ({ title: copy.title, message: copy.message }), [copy.message, copy.title]);
  useEffect(() => {
    // The opening overlay belongs to the first authoritative fetch only. Later
    // reloads already have page content, a table skeleton and the shared
    // "Refreshing…" action, so showing both loading surfaces is duplicate feedback.
    reportPageLoading(reporterId, { area, busy: next.showOpening, copy: stableCopy });
    return () => reportPageLoading(reporterId, null);
  }, [area, next.showOpening, reportPageLoading, reporterId, stableCopy]);
}
