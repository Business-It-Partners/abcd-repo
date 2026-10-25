import { useLayoutEffect, useRef } from 'react';
import type { WindowId } from './windowGeometry';
import { useWindowManager } from './windowManager';
import './OpenAppLimitDialog.css';

export function OpenAppLimitDialog({ onCloseApp }: { onCloseApp(id: WindowId): void }) {
  const { state, dispatch } = useWindowManager();
  const dialog = useRef<HTMLElement>(null);
  const cancelButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(true);
  const prompt = state.openAppLimit;
  const openApps = Object.values(state.windows).filter(win => win.phase !== 'closed');
  const desktopBusy = Object.values(state.windows).some(win => win.busy || win.interaction !== 'idle');

  useLayoutEffect(() => {
    if (!prompt) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    restoreFocus.current = true;
    (dialog.current?.querySelector<HTMLButtonElement>('.open-app-limit-choice:not([disabled])') ?? cancelButton.current)?.focus();
    return () => {
      if (!restoreFocus.current) return;
      const target = returnFocus.current;
      if (target?.isConnected) requestAnimationFrame(() => {
        if (target.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
      });
    };
  }, [!!prompt]);

  if (!prompt) return null;
  const dismiss = () => dispatch({ type: 'dismiss-open-app-limit' });
  const chooseAppToClose = (id: WindowId) => {
    restoreFocus.current = false;
    onCloseApp(id);
  };
  return <div className="open-app-limit-backdrop" role="presentation">
    <section ref={dialog} className="open-app-limit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="open-app-limit-title" aria-describedby="open-app-limit-description"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
        if (event.key === 'Tab') {
          event.preventDefault();
          const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];
          const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
          buttons[(current + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length]?.focus();
        }
      }}>
      <h2 id="open-app-limit-title">Only two apps can be open at a time</h2>
      <p id="open-app-limit-description">Choose an app to close. {prompt.requestedTitle} will open after it closes.</p>
      <div className="open-app-limit-actions">{openApps.map((win, index) => {
        const disabled = desktopBusy || win.busy || win.modal || win.interaction !== 'idle';
        const color = index === 0 ? 'green' : 'yellow';
        return <button key={win.id} className={`open-app-limit-choice open-app-limit-choice--${color}`} type="button" disabled={disabled}
          title={disabled ? 'Finish the current activity in this app before closing it.' : undefined} onClick={() => chooseAppToClose(win.id)}>Close {win.title}</button>;
      })}<button ref={cancelButton} className="open-app-limit-cancel" type="button" onClick={dismiss}>Cancel</button></div>
    </section>
  </div>;
}
