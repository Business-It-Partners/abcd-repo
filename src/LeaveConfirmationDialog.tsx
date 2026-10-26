import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import './LeaveConfirmationDialog.css';

const brandMark = new URL('./assets/sajilo-dental-mark.svg', import.meta.url).href;

export function LeaveConfirmationDialog({ onCancel, onConfirm, title = 'Are you sure you want to leave Sajilo Dental?', detail, confirmLabel = 'OK', children, error, busy = false, confirmDisabled = false, dismissOnBackdrop = false }: { onCancel(): void; onConfirm(): void; title?: string; detail?: string; confirmLabel?: string; children?: ReactNode; error?: string; busy?: boolean; confirmDisabled?: boolean; dismissOnBackdrop?: boolean }) {
  const cancelButton = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(document.activeElement instanceof HTMLElement ? document.activeElement : null);

  useEffect(() => {
    cancelButton.current?.focus({ preventScroll: true });
    return () => {
      const target = returnFocus.current;
      requestAnimationFrame(() => {
        if (target?.isConnected && !target.closest('[inert]') && !target.matches(':disabled')) target.focus({ preventScroll: true });
      });
    };
  }, []);

  const handleKeys = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }
    if (event.key === 'Tab') {
      const first = cancelButton.current;
      const last = confirmButton.current;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  };

  return <div className="leave-confirm-backdrop" onClick={event=>{if(dismissOnBackdrop&&!busy&&event.target===event.currentTarget)onCancel();}}>
    <section className="leave-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-confirm-title" aria-describedby={detail ? 'leave-confirm-detail' : undefined} onKeyDown={handleKeys}>
      <img className="leave-confirm-mark" src={brandMark} alt=""/>
      <h2 id="leave-confirm-title">{title}</h2>
      {detail && <p id="leave-confirm-detail" className="leave-confirm-detail">{detail}</p>}
      {children}
      {error && <p className="leave-confirm-error" role="alert">{error}</p>}
      <div className="leave-confirm-actions">
        <button ref={cancelButton} className="leave-confirm-cancel" type="button" onClick={onCancel} disabled={busy}>Cancel</button>
        <button ref={confirmButton} className="leave-confirm-ok" type="button" onClick={onConfirm} disabled={busy || confirmDisabled}>{busy ? 'Please wait…' : confirmLabel}</button>
      </div>
    </section>
  </div>;
}
