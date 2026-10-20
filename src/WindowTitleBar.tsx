import type { PointerEventHandler } from 'react';
import { Maximize2, Minimize2, Minus, X } from 'lucide-react';

/** Shared macOS-style chrome for every internal app window. */
export function WindowTitleBar({ title, active, maximized, disabled = false, inert = false, onDrag, onClose, onMinimize, onToggleMaximize }: {
  title: string; active: boolean; maximized: boolean; disabled?: boolean; inert?: boolean;
  onDrag: PointerEventHandler<HTMLElement>; onClose(): void; onMinimize(): void; onToggleMaximize(): void;
}) {
  return <header className={`studio-title mac-titlebar ${active ? 'is-active' : 'is-inactive'}`} inert={inert}
    onPointerDown={onDrag} onDoubleClick={event => {
      if (!disabled && !(event.target as HTMLElement).closest('button')) onToggleMaximize();
    }}>
    <div className="window-controls" role="group" aria-label={`${title} window controls`}>
      <button className="window-control window-control-maximize" aria-label={maximized ? `Restore ${title} size` : `Maximize ${title}`} title={maximized ? 'Restore window size' : 'Maximize window'} disabled={disabled} onClick={onToggleMaximize}>
        {maximized ? <Minimize2 size={8.748} strokeWidth={2.2}/> : <Maximize2 size={8.748} strokeWidth={2.2}/>}
      </button>
      <button className="window-control window-control-minimize" aria-label={`Minimize ${title}`} title={`Minimize ${title}`} disabled={disabled} onClick={onMinimize}><Minus size={10.206} strokeWidth={2.4}/></button>
      <button className="window-control window-control-close" aria-label={`Close ${title}`} title={`Close ${title}`} disabled={disabled} onClick={onClose}><X size={10.206} strokeWidth={2.4}/></button>
    </div>
    <span className="window-title">{title}</span>
  </header>;
}
