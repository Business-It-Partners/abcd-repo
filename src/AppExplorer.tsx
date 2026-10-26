import { useEffect, useRef, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { StoreArtwork } from './StoreArtwork';
import { dockArtwork } from './dockArtwork';

export type ExplorerApp = Readonly<{
  id: string;
  title: string;
  iconSha256?: string;
}>;

const brandMark = new URL('./assets/sajilo-dental-mark.svg', import.meta.url).href;
const systemApps = [
  { id: 'store', title: 'App Store' },
  { id: 'standard-window-1', title: 'Standard Window 1' },
] as const;

export function AppExplorer({ apps, loading = false, onClose, onSelect, returnFocusTarget }: {
  apps: readonly ExplorerApp[];
  loading?: boolean;
  onClose(): void;
  onSelect(id: string): void;
  returnFocusTarget?: HTMLElement | null;
}) {
  const panel = useRef<HTMLElement>(null);
  const returnFocus = useRef<HTMLElement | null>(returnFocusTarget ?? (document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));

  useEffect(() => {
    (panel.current?.querySelector<HTMLButtonElement>('.app-explorer-item:not(:disabled)')
      ?? panel.current?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus({ preventScroll: true });
  }, []);

  function closeExplorer() {
    onClose();
    requestAnimationFrame(() => {
      const canFocus = (element: HTMLElement | null): element is HTMLElement => !!element?.isConnected
        && !element.matches(':disabled')
        && !element.closest('[inert],[hidden],[aria-hidden="true"]')
        && getComputedStyle(element).visibility !== 'hidden'
        && element.getClientRects().length > 0;
      const target = [returnFocus.current, document.querySelector<HTMLElement>('[aria-label="Explore apps"]')]
        .find(canFocus);
      target?.focus({ preventScroll: true });
    });
  }

  function selectApp(id: string) {
    closeExplorer();
    onSelect(id);
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
    <section ref={panel} className="app-explorer" role="dialog" aria-modal="true" aria-labelledby="app-explorer-title" data-testid="app-explorer" onKeyDown={handleKeyDown}>
      <header className="app-explorer-heading">
        <div className="app-explorer-title-block">
          <img src={brandMark} alt=""/>
          <div><span>SAJILO DENTAL</span><h2 id="app-explorer-title">Explore apps</h2></div>
        </div>
        <button className="app-explorer-close" aria-label="Close app explorer" onClick={closeExplorer}><X aria-hidden="true" size={18}/></button>
      </header>
      <div className="app-explorer-content">
        <section className="app-explorer-section" aria-labelledby="app-explorer-system-title">
          <h3 id="app-explorer-system-title">System apps</h3>
          <div className="app-explorer-grid" aria-label="System apps">
            {systemApps.map(app => <button key={app.id} className="app-explorer-item" aria-label={app.title} title={`Open ${app.title}`} data-explorer-app={app.id} onClick={() => selectApp(app.id)}>
              <span className="app-explorer-icon"><img src={dockArtwork(app.id)} alt="" draggable={false}/></span>
              <span>{app.title}</span>
            </button>)}
          </div>
        </section>
        <section className="app-explorer-section" aria-labelledby="app-explorer-installed-title">
          <h3 id="app-explorer-installed-title">Installed apps</h3>
          {apps.length ? <div className="app-explorer-grid" aria-label="Installed apps">
            {apps.map(app => <button key={app.id} className="app-explorer-item" aria-label={app.title} title={`Open ${app.title}`} data-explorer-app={app.id} onClick={() => selectApp(app.id)}>
              <span className="app-explorer-icon"><StoreArtwork appId={app.id} artworkSha256={app.iconSha256} className="app-explorer-artwork"/></span>
              <span>{app.title}</span>
            </button>)}
          </div> : <p className="app-explorer-empty" role="status">{loading ? 'Checking installed apps…' : 'Installed clinic apps will appear here. Browse the App Store to get started.'}</p>}
        </section>
      </div>
    </section>
  </>;
}
