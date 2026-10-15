import { useRef, useState, type KeyboardEvent } from 'react';
import { dockArtwork } from './dockArtwork';

const modules = ['Transaction Record', 'Patient payments', 'General expenses', 'Salary payments', 'Product list', 'Purchases', 'Supplier list', 'Supplier payments'];

export function FinanceApp() {
  const [selected, setSelected] = useState(0);
  const navigation = useRef<HTMLDivElement>(null);
  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? modules.length - 1 : (selected + (event.key === 'ArrowRight' ? 1 : -1) + modules.length) % modules.length;
    setSelected(next);
    navigation.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus({ preventScroll: true });
  }
  return <div className="finance-body">
    <div ref={navigation} className="finance-navigation" role="tablist" aria-label="Finance submodules">
      {modules.map((name, index) => <button key={name} id={`finance-tab-${index}`} role="tab" aria-selected={selected === index} aria-controls="finance-content" tabIndex={selected === index ? 0 : -1} data-app-focus={selected === index ? true : undefined} onClick={() => setSelected(index)} onKeyDown={navigate}>{name}</button>)}
    </div>
    <section className="finance-content" id="finance-content" role="tabpanel" aria-labelledby={`finance-tab-${selected}`} tabIndex={0}>
      <div className="finance-placeholder"><img src={dockArtwork('finance')} alt=""/><h2>{modules[selected]}</h2><p>Coming soon</p></div>
    </section>
  </div>;
}
