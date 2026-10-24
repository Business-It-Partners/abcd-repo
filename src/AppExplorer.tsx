import { useEffect, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { FINANCE_MODULES } from './FinanceApp';
import { dockArtwork } from './dockArtwork';

export type ExplorerModule = Readonly<{ id: string; label: string }>;
export function AppExplorer({ bottom, onClose, onSelect, title = 'Finance', icon = dockArtwork('finance'), modules = FINANCE_MODULES.map(label => ({ id: label, label })), error, returnFocusTarget }: { bottom: number; onClose(): void; onSelect(module: string): void; title?: string; icon?: string; modules?: readonly ExplorerModule[]; error?: string; returnFocusTarget?: HTMLElement | null }) {
  const panel = useRef<HTMLElement>(null);
  // Capture the caller before the parent marks the dock/window stage inert.
  const returnFocus = useRef<HTMLElement | null>(returnFocusTarget ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));

  useEffect(() => {
    panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus({ preventScroll: true });
  }, []);

  function closeExplorer() {
    onClose();
    requestAnimationFrame(() => {
      const canFocus = (element: HTMLElement | null): element is HTMLElement => !!element?.isConnected
        && !element.matches(':disabled')
        && !element.closest('[inert],[hidden],[aria-hidden="true"]')
        && getComputedStyle(element).visibility !== 'hidden'
        && element.getClientRects().length > 0;
      const dockApp = [...document.querySelectorAll<HTMLButtonElement>('[data-dock-app]')]
        .find(button => button.getAttribute('aria-label') === title) ?? null;
      const target = [returnFocus.current, dockApp, document.querySelector<HTMLElement>('[aria-label="Open apps catalog"]')]
        .find(canFocus);
      target?.focus({ preventScroll: true });
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeExplorer();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = [...(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? [])];
    if (!focusable.length) return;
    const first = focusable[0], last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return <>
    <div className="app-explorer-backdrop" aria-hidden="true" onClick={closeExplorer}/>
    <section ref={panel} className="app-explorer" role="dialog" aria-modal="true" aria-labelledby="finance-explorer-title" data-testid={title === 'Finance' ? 'finance-explorer' : 'app-explorer'} style={{ bottom }} onKeyDown={handleKeyDown}>
      <header className="app-explorer-heading">
        <div><img src={icon} alt=""/><h2 id="finance-explorer-title">{title}</h2></div>
        <button className="app-explorer-close" aria-label={`Close ${title} app explorer`} onClick={closeExplorer}><X aria-hidden="true" size={18}/></button>
      </header>
      <nav className="app-explorer-grid" aria-label={`${title} apps`}>
        {modules.map(module => <button key={module.id} className="app-explorer-item" aria-label={module.label} title={`Open ${module.label}`} data-app-module={module.id} {...(title === 'Finance' ? { 'data-finance-module': module.label } : {})} onClick={() => onSelect(module.id)}>
          <img src={icon} alt="" draggable={false}/>
          <span>{module.label}</span>
        </button>)}
      </nav>
      {error && <p className="app-explorer-error" role="alert">{error}</p>}
    </section>
  </>;
}
