"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";

type RefreshRegistration = {
  key: string;
  label: string;
  refresh: () => Promise<void>;
  successMessage: string;
  busy?: boolean;
  /** Where the owning screen wants its one refresh action rendered. */
  placement?: "utility-bar" | "page-action" | "page-bottom";
};

type PageRefreshContextValue = {
  registration: RefreshRegistration | null;
  register: (ownerId: string, registration: RefreshRegistration | null) => void;
};

const PageRefreshContext = createContext<PageRefreshContextValue | null>(null);

export function ClinicPageRefreshProvider({ children }: { children: ReactNode }) {
  const [entry, setEntry] = useState<{ ownerId: string; registration: RefreshRegistration } | null>(null);
  const register = useCallback((ownerId: string, registration: RefreshRegistration | null) => {
    setEntry((current) => {
      if (!registration) return current?.ownerId === ownerId ? null : current;
      // Screens commonly create their reload callback inline. Do not turn a new
      // callback identity with the same visible refresh state into another
      // provider update, or the consumer effect and this setter will loop.
      if (
        current?.ownerId === ownerId
        && current.registration.key === registration.key
        && current.registration.label === registration.label
        && current.registration.successMessage === registration.successMessage
        && current.registration.busy === registration.busy
        && current.registration.placement === registration.placement
      ) return current;
      return { ownerId, registration };
    });
  }, []);
  const value = useMemo<PageRefreshContextValue>(() => ({ registration: entry?.registration ?? null, register }), [entry, register]);
  return <PageRefreshContext.Provider value={value}>{children}</PageRefreshContext.Provider>;
}

export function useClinicPageRefresh(registration: RefreshRegistration | null): void {
  const context = useContext(PageRefreshContext);
  if (!context) throw new Error("useClinicPageRefresh must be used inside ClinicPageRefreshProvider.");
  const { register } = context;
  const ownerId = useId();
  useEffect(() => {
    register(ownerId, registration);
  }, [ownerId, register, registration]);
  // Only unregister when this screen really unmounts. Cleaning up on every
  // registration-object change briefly clears the provider, then re-adds it;
  // inline callbacks can therefore create an update loop.
  useEffect(() => () => register(ownerId, null), [ownerId, register]);
}

export function ClinicPageRefreshAction({ placement = "utility-bar" }: { placement?: RefreshRegistration["placement"] }) {
  const context = useContext(PageRefreshContext);
  const { showError, showLoading, showSuccess } = useClinicSnackbar();
  const [busy, setBusy] = useState(false);
  const registration = context?.registration ?? null;

  useEffect(() => setBusy(false), [registration?.key]);
  if (!registration || (registration.placement ?? "utility-bar") !== placement) return null;
  const refreshing = busy || registration.busy === true;

  const refresh = async () => {
    if (refreshing) return;
    setBusy(true);
    showLoading(`Refreshing ${registration.label.toLocaleLowerCase()}…`, 60_000);
    try {
      await registration.refresh();
      showSuccess(registration.successMessage);
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : `${registration.label} could not be refreshed.`);
    } finally {
      setBusy(false);
    }
  };

  const button = (
    <button
      aria-label={`Refresh ${registration.label}`}
      className="clinicPageRefreshButton"
      disabled={refreshing}
      onClick={() => void refresh()}
      type="button"
    >
      <RefreshCw aria-hidden="true" className={refreshing ? "refreshing" : undefined} size={15} />
      {refreshing ? "Refreshing…" : "Refresh"}
    </button>
  );

  if (placement === "utility-bar") return <div className="clinicPageUtilityBar">{button}</div>;
  if (placement === "page-bottom") return <div className="clinicPageBottomRefresh">{button}</div>;
  return button;
}
