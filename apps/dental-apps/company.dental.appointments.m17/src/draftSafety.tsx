import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ClinicModal } from '@/shared/ui/ClinicModal';

export const DraftSafety = createContext<(key: string, dirty: boolean) => void>(() => {});

export function useDraftSafety(key: string, dirty: boolean, close: () => void): { close: () => void; confirmation: ReactNode } {
  const report = useContext(DraftSafety);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { report(key, dirty); return () => report(key, false); }, [key, dirty, report]);
  return {
    close: () => { if (dirty) setConfirm(true); else close(); },
    confirmation: confirm ? <ClinicModal title="Discard unsaved changes?" onClose={() => setConfirm(false)} maxWidth={420}>
      <p>Your unsaved appointment details will be cleared.</p>
      <div className="appointmentFormActions"><button className="btn btn-secondary" type="button" onClick={() => setConfirm(false)}>Keep editing</button><button className="btn btn-primary" type="button" onClick={close}>Discard changes</button></div>
    </ClinicModal> : null,
  };
}
