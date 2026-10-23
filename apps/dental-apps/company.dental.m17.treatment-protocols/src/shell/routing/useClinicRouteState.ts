import { useCallback, useState } from 'react';

/** Detail selection is transient app state; no browser history or cross-app route is involved. */
export function useClinicRouteState() {
  const [params, setParams] = useState<Record<string, string>>({});
  const patch = useCallback((changes: Record<string, string | null | undefined>, _mode?: 'replace' | 'push') => {
    setParams(current => {
      const next = { ...current };
      for (const [key, value] of Object.entries(changes)) {
        if (value == null) delete next[key]; else next[key] = value;
      }
      return next;
    });
  }, []);
  const openDetail = useCallback((key: string, value: string, _mode?: 'replace' | 'push') => patch({ [key]: value }), [patch]);
  const closeDetail = useCallback((key: string) => patch({ [key]: null }), [patch]);
  return { route: { params }, patch, openDetail, closeDetail };
}
