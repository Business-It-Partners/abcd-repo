import { useEffect, useRef, type KeyboardEvent } from 'react';
import './LeaveConfirmationDialog.css';

const brandMark = new URL('./assets/sajilo-dental-mark.svg', import.meta.url).href;

export function LeaveConfirmationDialog({ onCancel, onConfirm }: { onCancel(): void; onConfirm(): void }) {
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

  return <div className="leave-confirm-backdrop">
    <section className="leave-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="leave-confirm-title" onKeyDown={handleKeys}>
      <img className="leave-confirm-mark" src={brandMark} alt=""/>
      <h2 id="leave-confirm-title">Are you sure you want to leave Sajilo Dental?</h2>
      <div className="leave-confirm-actions">
        <button ref={cancelButton} className="leave-confirm-cancel" type="button" onClick={onCancel}>Cancel</button>
        <button ref={confirmButton} className="leave-confirm-ok" type="button" onClick={onConfirm}>OK</button>
      </div>
    </section>
  </div>;
}
