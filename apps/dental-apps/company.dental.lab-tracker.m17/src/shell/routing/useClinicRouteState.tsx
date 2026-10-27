import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

type RouteParams = Record<string, string | undefined>;
type RouteContextValue = {
  route: { tab: string; params: RouteParams };
  patch: (values: Record<string, string | null>, mode?: 'push' | 'replace') => void;
  openDetail: (key: string, value: string) => void;
  closeDetail: (key: string) => void;
};

const RouteContext = createContext<RouteContextValue | null>(null);

export function LabRouteProvider({ tab, children }: { tab: string; children: ReactNode }) {
  const [params, setParams] = useState<RouteParams>({});
  const patch = useCallback((values: Record<string, string | null>) => {
    setParams(current => {
      const next = { ...current };
      for (const [key, value] of Object.entries(values)) {
        if (value === null) delete next[key];
        else next[key] = value;
      }
      return next;
    });
  }, []);
  const openDetail = useCallback((key: string, value: string) => patch({ [key]: value }), [patch]);
  const closeDetail = useCallback((key: string) => patch({ [key]: null }), [patch]);
  const value = useMemo(() => ({ route: { tab, params }, patch, openDetail, closeDetail }), [tab, params, patch, openDetail, closeDetail]);
  return <RouteContext.Provider value={value}>{children}</RouteContext.Provider>;
}

export function useClinicRouteState(): RouteContextValue {
  const value = useContext(RouteContext);
  if (!value) throw new Error('Lab Tracker route state must be used inside LabRouteProvider.');
  return value;
}
