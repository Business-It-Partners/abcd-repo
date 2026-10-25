import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { ClinicModal } from '@/shared/ui/ClinicModal';

type GuardContext = { requestNavigation: (proceed: () => void) => void; setBlockerActive: (id: string, active: boolean) => void };
const ClinicNavigationGuardContext = createContext<GuardContext | null>(null);

export function ClinicNavigationGuardProvider({ children }: { children: ReactNode }) {
  const activeBlockers = useRef(new Set<string>());
  const [confirming, setConfirming] = useState(false);
  const pendingNavigation = useRef<(() => void) | null>(null);
  const setBlockerActive = useCallback((id: string, active: boolean) => {
    if (active) activeBlockers.current.add(id);
    else activeBlockers.current.delete(id);
  }, []);
  const requestNavigation = useCallback((proceed: () => void) => {
    if (!activeBlockers.current.size) { proceed(); return; }
    pendingNavigation.current = proceed;
    setConfirming(true);
  }, []);
  const cancelLeave = useCallback(() => { pendingNavigation.current = null; setConfirming(false); }, []);
  const confirmLeave = useCallback(() => {
    const proceed = pendingNavigation.current;
    pendingNavigation.current = null;
    setConfirming(false);
    proceed?.();
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!activeBlockers.current.size) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  const value = useMemo(() => ({ requestNavigation, setBlockerActive }), [requestNavigation, setBlockerActive]);
  return <ClinicNavigationGuardContext.Provider value={value}>
    {children}
    {confirming ? <ClinicModal title="Leave Work Entry?" onClose={cancelLeave} maxWidth={460}>
      <p style={{ margin: '0 0 22px', color: 'var(--ink-2)', lineHeight: 1.55 }}>Any information entered in this case that has not been saved will be lost.</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <button type="button" className="btn btn-secondary" onClick={cancelLeave}>Stay here</button>
        <button type="button" className="btn btn-danger" onClick={confirmLeave}>Leave without saving</button>
      </div>
    </ClinicModal> : null}
  </ClinicNavigationGuardContext.Provider>;
}

export function useClinicNavigationGuard() {
  const value = useContext(ClinicNavigationGuardContext);
  if (!value) throw new Error('Clinic navigation guard is unavailable outside the Work Entry workspace.');
  return value;
}

/** Protects an unsaved Work Entry draft from host navigation and close. */
export function useWorkEntryNavigationBlocker(active: boolean) {
  const { setBlockerActive } = useClinicNavigationGuard();
  const blockerId = useId();
  useEffect(() => {
    setBlockerActive(blockerId, active);
    window.dentalApp?.report({ dirty: active, modal: false });
    return () => {
      setBlockerActive(blockerId, false);
      window.dentalApp?.report({ dirty: false, modal: false });
    };
  }, [active, blockerId, setBlockerActive]);
}
