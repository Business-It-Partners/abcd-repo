import { useCallback, useEffect, useRef, useState } from 'react';
import type { AppHistory } from './appHistory';

/** App-local detail state reports opaque page entries to the Dental OS window history. */
export function useClinicRouteState(history: AppHistory<Record<string, string>>) {
  const [params, setParams] = useState<Record<string, string>>(() => history.current());
  const current = useRef(params); current.current = params;
  useEffect(() => history.subscribe(next => { current.current = next; setParams(next); }), [history]);
  const patch = useCallback((changes: Record<string, string | null | undefined>, mode: 'replace' | 'push' = 'push') => {
    const next = { ...current.current };
    for (const [key, value] of Object.entries(changes)) {
      if (value == null) delete next[key]; else next[key] = value;
    }
    current.current = next;
    setParams(next);
    if (mode === 'replace') history.replace(next); else history.push(next);
  }, [history]);
  const openDetail = useCallback((key: string, value: string, mode?: 'replace' | 'push') => patch({ [key]: value }, mode), [patch]);
  const closeDetail = useCallback((key: string) => {
    if (current.current[key] && history.back(true)) return;
    patch({ [key]: null }, 'replace');
  }, [history, patch]);
  return { route: { params }, patch, openDetail, closeDetail };
}
