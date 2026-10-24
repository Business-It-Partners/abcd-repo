import { useEffect, useRef } from 'react';

export const FINANCE_MODULES = ['Transaction Record', 'Patient payments', 'General expenses', 'Salary payments', 'Product list', 'Purchases', 'Supplier list', 'Supplier payments'];

export function FinanceApp({ selectedModule }: { selectedModule: string }) {
  const moduleHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => { moduleHeading.current?.focus({ preventScroll: true }); }, [selectedModule]);

  return <div className="finance-body">
    <section className="finance-selected" aria-labelledby="finance-selected-title">
      <main className="finance-selected-screen">
        <h2 ref={moduleHeading} id="finance-selected-title" tabIndex={-1} data-app-focus>{selectedModule}</h2>
      </main>
    </section>
  </div>;
}
