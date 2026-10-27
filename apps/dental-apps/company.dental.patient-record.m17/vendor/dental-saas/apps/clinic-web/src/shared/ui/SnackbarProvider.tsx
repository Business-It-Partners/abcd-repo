"use client";

import React, { createContext, useContext, useCallback } from "react";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";

type ToastType = "success" | "error";

interface SnackbarContextType {
  showToast: (message?: string, type?: ToastType) => void;
  showError: (message: string) => void;
  showLoading: (message?: string, durationMs?: number) => void;
  dismiss: () => void;
}

const SnackbarContext = createContext<SnackbarContextType>({
  showToast: () => {},
  showError: () => {},
  showLoading: () => {},
  dismiss: () => {},
});

export function SnackbarProvider({ children }: { children: React.ReactNode }) {
  const { showError: showClinicError, showSuccess, showLoading, dismiss } = useClinicSnackbar();

  const showToast = useCallback((message: string = "Added successfully", type: ToastType = "success") => {
    if (type === "error") showClinicError(message);
    else showSuccess(message);
  }, [showClinicError, showSuccess]);

  const showError = useCallback(
    (message: string) => {
      showToast(message, "error");
    },
    [showToast]
  );

  return <SnackbarContext.Provider value={{ showToast, showError, showLoading, dismiss }}>{children}</SnackbarContext.Provider>;
}

export function useSnackbar() {
  return useContext(SnackbarContext);
}
