import { useState } from 'react';
import { PanelsTopLeft } from 'lucide-react';
import './WindowModuleSidebar.css';

export type WindowModule = Readonly<{ id: string; label: string }>;

/** App-owned module navigation styled to match the Dental OS window sidebar. */
export function WindowModuleSidebar({
  title,
  modules,
  activeModuleId,
  disabled = false,
  onSelect,
}: {
  title: string;
  modules: readonly WindowModule[];
  activeModuleId: string;
  disabled?: boolean;
  onSelect(moduleId: string): void | Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function select(moduleId: string) {
    if (disabled || pendingId || moduleId === activeModuleId) return;
    setPendingId(moduleId);
    try {
      await onSelect(moduleId);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <nav className="window-module-sidebar" aria-label={`${title} modules`} aria-busy={!!pendingId}>
      <div className="window-module-sidebar-heading" title={title}>{title}</div>
      <div className="window-module-sidebar-list">
        {modules.map(module => {
          const active = module.id === activeModuleId;
          return (
            <button
              key={module.id}
              type="button"
              className={`window-module-sidebar-item${active ? ' is-active' : ''}`}
              aria-label={module.label}
              aria-current={active ? 'page' : undefined}
              disabled={disabled || !!pendingId}
              onClick={() => void select(module.id)}
              title={module.label}
            >
              <PanelsTopLeft size={17} aria-hidden="true" />
              <span>{module.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
