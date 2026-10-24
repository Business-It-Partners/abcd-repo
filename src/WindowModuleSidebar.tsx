import { useState } from 'react';
import { PanelsTopLeft } from 'lucide-react';

export type WindowModuleNavigation = Readonly<{
  activeModuleId: string;
  activeLabel: string;
  modules: readonly Readonly<{ id: string; label: string }>[];
}>;

/** OS-owned navigation for a managed window that hosts multiple app modules. */
export function WindowModuleSidebar({ title, navigation, disabled = false, onSelect }: {
  title: string;
  navigation: WindowModuleNavigation;
  disabled?: boolean;
  onSelect(moduleId: string): void | Promise<void>;
}) {
  const [pendingId, setPendingId] = useState<string>();
  const select = async (moduleId: string) => {
    if (disabled || pendingId || moduleId === navigation.activeModuleId) return;
    setPendingId(moduleId);
    try { await onSelect(moduleId); }
    finally { setPendingId(undefined); }
  };

  return <nav className="window-module-sidebar" aria-label={`${title} modules`} aria-busy={!!pendingId}>
    <div className="window-module-sidebar-heading" title={title}>{title}</div>
    <div className="window-module-sidebar-list">
      {navigation.modules.map(module => {
        const active = module.id === navigation.activeModuleId;
        return <button key={module.id} type="button" className={`window-module-sidebar-item${active ? ' is-active' : ''}`}
          aria-current={active ? 'page' : undefined} disabled={disabled || !!pendingId}
          onClick={() => void select(module.id)} title={module.label}>
          <PanelsTopLeft size={16} aria-hidden="true"/><span>{module.label}</span>
        </button>;
      })}
    </div>
  </nav>;
}
