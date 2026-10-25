import { useLayoutEffect, useRef } from 'react';
import { useWindowManager } from './windowManager';
import './OpenAppLimitDialog.css';

export function OpenAppLimitDialog() {
  const { state, dispatch } = useWindowManager();
  const confirmButton = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const prompt = state.openAppLimit;

  useLayoutEffect(() => {
    if (!prompt) return;
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    confirmButton.current?.focus();
    return () => {
      const target = returnFocus.current;
      if (target?.isConnected) requestAnimationFrame(() => {
        if (target.isConnected && !target.closest('[inert]')) target.focus({ preventScroll: true });
      });
    };
  }, [!!prompt]);

  if (!prompt) return null;
  const dismiss = () => dispatch({ type: 'dismiss-open-app-limit' });
  return <div className="open-app-limit-backdrop" role="presentation">
    <section className="open-app-limit-dialog" role="alertdialog" aria-modal="true" aria-labelledby="open-app-limit-title" aria-describedby="open-app-limit-description"
      onKeyDown={event => {
        if (event.key === 'Escape') { event.preventDefault(); dismiss(); }
        if (event.key === 'Tab') { event.preventDefault(); confirmButton.current?.focus(); }
      }}>
      <h2 id="open-app-limit-title">Only two apps can be open at a time</h2>
      <p id="open-app-limit-description">Close an app you are not using, then try opening {prompt.requestedTitle} again.</p>
      <div className="open-app-limit-open-apps"><span>Currently open</span><ul>{prompt.openAppTitles.map((title, index) => <li key={`${title}-${index}`}>{title}</li>)}</ul></div>
      <div className="open-app-limit-actions"><button ref={confirmButton} type="button" onClick={dismiss}>OK</button></div>
    </section>
  </div>;
}
