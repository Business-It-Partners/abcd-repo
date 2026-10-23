import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Modal, ModalBody } from '@/shared/ui/workspace-primitives';

export const DraftSafety = createContext<(key: string, dirty: boolean) => void>(() => {});

/** App-owned draft decisions; the platform SDK receives only the resulting safety flags. */
export function useDraftSafety(key: string, dirty: boolean, close: () => void): { close: () => void; confirmation: ReactNode } {
  const report = useContext(DraftSafety);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { report(key, dirty); return () => report(key, false); }, [key, dirty, report]);
  return {
    close: () => { if (dirty) setConfirm(true); else close(); },
    confirmation: confirm ? <Modal title="Discard unsaved changes?" onClose={() => setConfirm(false)}>
      <ModalBody><p>Your unsaved form will be cleared.</p><div className="draft-actions">
        <button type="button" className="btn btn-secondary" onClick={() => setConfirm(false)}>Keep editing</button>
        <button type="button" className="btn btn-danger" onClick={close}>Discard changes</button>
      </div></ModalBody>
    </Modal> : null,
  };
}
