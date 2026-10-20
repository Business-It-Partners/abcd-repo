import { useEffect, useRef } from 'react';
import { Grid2X2 } from 'lucide-react';

export const FINANCE_MODULES = ['Transaction Record', 'Patient payments', 'General expenses', 'Salary payments', 'Product list', 'Purchases', 'Supplier list', 'Supplier payments'];

export function FinanceApp({ selectedModule, onOpenExplorer }: { selectedModule: string; onOpenExplorer(trigger: HTMLElement): void }) {
  const moduleHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { moduleHeading.current?.focus({ preventScroll: true }); }, [selectedModule]);

  return <div className="finance-body">
    <header className="finance-window-statusbar" aria-label="Finance app toolbar">
      <span className="finance-current-module" aria-live="polite" data-testid="finance-current-module">{selectedModule}</span>
      <button className="finance-more-apps" type="button" aria-label="More Finance apps" onClick={event => onOpenExplorer(event.currentTarget)}>
        <Grid2X2 size={15} aria-hidden="true"/><span>More Apps</span>
      </button>
    </header>
    <section className="finance-selected" aria-labelledby="finance-selected-title">
      <main className="finance-selected-screen">
        <h2 ref={moduleHeading} id="finance-selected-title" tabIndex={-1} data-app-focus>{selectedModule}</h2>
      </main>
    </section>
  </div>;
}
