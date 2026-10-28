"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NoticeTone = "success" | "error" | "loading";
type Notice = { id: number; message: string; tone: NoticeTone };
type ClinicSnackbarApi = {
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showLoading: (message?: string, durationMs?: number) => void;
  dismiss: () => void;
};

const ClinicSnackbarContext = createContext<ClinicSnackbarApi | null>(null);
const successDurationMs = 2_500;

export function ClinicSnackbarProvider({ children }: { children: ReactNode }) {
  const [notice, setNotice] = useState<Notice | null>(null);
  const timer = useRef<number | null>(null);
  const dismiss = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setNotice(null);
  }, []);
  const show = useCallback((message: string, tone: NoticeTone, durationMs = 4_500) => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    const next = { id: Date.now(), message, tone };
    setNotice(next);
    timer.current = window.setTimeout(() => {
      setNotice((current) => current?.id === next.id ? null : current);
      timer.current = null;
    }, durationMs);
  }, []);

  // Native checkboxes are used throughout the forms. Checkbox-shaped controls that are buttons
  // opt in with data-checkbox-control. One delegated listener keeps the interaction feedback
  // consistent without duplicating snackbar state in every feature.
  useEffect(() => {
    const checkboxChanged = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement) || target.type !== "checkbox" || target.disabled || target.readOnly || target.dataset.persistedCheckbox !== "true") return;
      show(target.dataset.loadingMessage || "Updating selection…", "loading", 1_200);
    };
    const checkboxControlClicked = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>("[data-checkbox-control]");
      if (!control || control.getAttribute("aria-disabled") === "true" || control.hasAttribute("disabled")) return;
      show(control.dataset.loadingMessage || "Updating selection…", "loading", 12_000);
    };
    document.addEventListener("change", checkboxChanged);
    document.addEventListener("click", checkboxControlClicked, true);
    return () => {
      document.removeEventListener("change", checkboxChanged);
      document.removeEventListener("click", checkboxControlClicked, true);
    };
  }, [show]);

  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);

  const value = useMemo<ClinicSnackbarApi>(() => ({
    showSuccess: (message) => show(message, "success", successDurationMs),
    showError: (message) => show(message, "error"),
    showLoading: (message = "Updating…", durationMs = 12_000) => show(message, "loading", durationMs),
    dismiss,
  }), [dismiss, show]);

  return <ClinicSnackbarContext.Provider value={value}>
    {children}
    {notice ? <div aria-atomic="true" aria-live="polite" className={`clinicSnackbar ${notice.tone}`} role="status"><span aria-hidden="true" className={notice.tone === "loading" ? "clinicSnackbarSpinner" : undefined}>{notice.tone === "success" ? "✓" : notice.tone === "error" ? "!" : ""}</span><p>{notice.message}</p><button aria-label="Dismiss message" onClick={dismiss} type="button">×</button></div> : null}
  </ClinicSnackbarContext.Provider>;
}

export function useClinicSnackbar(): ClinicSnackbarApi {
  const value = useContext(ClinicSnackbarContext);
  if (!value) throw new Error("useClinicSnackbar must be used within ClinicSnackbarProvider.");
  return value;
}
