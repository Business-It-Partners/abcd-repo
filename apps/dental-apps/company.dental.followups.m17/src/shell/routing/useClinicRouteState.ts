import { useCallback, useState } from 'react';

/** Follow-ups filters are transient app UI state; no Next server or cross-app route is involved. */
export function useClinicRouteState() {
  const [params, setParams] = useState<Record<string, string>>({});
  const patch = useCallback((changes: Record<string, string | null | undefined>) => {
    setParams(current => {
      const next = { ...current };
      for (const [key, value] of Object.entries(changes)) {
        if (value == null) delete next[key]; else next[key] = value;
      }
      return next;
    });
  }, []);
  return { route: { params }, patch };
}
