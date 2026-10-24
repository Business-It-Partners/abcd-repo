import type { PointerEventHandler } from 'react';
import { ArrowLeft, Maximize2, Minimize2, Minus, X } from 'lucide-react';

/** Shared macOS-style chrome for every internal app window. */
export function WindowTitleBar({ title, active, maximized, disabled = false, navigationDisabled = false, inert = false, onDrag, onClose, onMinimize, onToggleMaximize, hideMinimize = false, canGoBack, onBack }: {
  title: string; active: boolean; maximized: boolean; disabled?: boolean; navigationDisabled?: boolean; inert?: boolean;
  onDrag: PointerEventHandler<HTMLElement>; onClose(): void; onMinimize(): void; onToggleMaximize(): void; hideMinimize?:boolean;
  canGoBack: boolean; onBack(): void;
}) {
  return <header className={`studio-title mac-titlebar ${active ? 'is-active' : 'is-inactive'}`} inert={inert}
    onPointerDown={onDrag} onDoubleClick={event => {
      if (!disabled && !(event.target as HTMLElement).closest('button')) onToggleMaximize();
    }}>
    <div className="window-controls" role="group" aria-label={`${title} window controls`}>
      <button className="window-control window-control-maximize" aria-label={maximized ? `Restore ${title} size` : `Maximize ${title}`} title={maximized ? 'Restore window size' : 'Maximize window'} disabled={disabled} onClick={onToggleMaximize}>
        {maximized ? <Minimize2 size={8.748} strokeWidth={2.2}/> : <Maximize2 size={8.748} strokeWidth={2.2}/>}
      </button>
      {!hideMinimize && <button className="window-control window-control-minimize" aria-label={`Minimize ${title}`} title={`Minimize ${title}`} disabled={disabled} onClick={onMinimize}><Minus size={10.206} strokeWidth={2.4}/></button>}
      <button className="window-control window-control-close" aria-label={`Close ${title}`} title={`Close ${title}`} disabled={disabled} onClick={onClose}><X size={10.206} strokeWidth={2.4}/></button>
    </div>
    <div className="window-titlebar-leading">
      <div className="window-history-controls" role="group" aria-label="Page navigation">
        <button type="button" aria-label="Back" title="Back" disabled={disabled || navigationDisabled || !canGoBack} onClick={onBack}><ArrowLeft size={19} strokeWidth={1.8}/></button>
      </div>
    </div>
    <span className="window-title">{title}</span>
  </header>;
}
