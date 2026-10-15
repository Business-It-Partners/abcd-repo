import { useEffect, useRef, useState } from 'react';
import type { WindowController } from './ManagedWindow';
import { Plus, X } from 'lucide-react';

type RecordRow = { id: number; name: string; category: string; quantity: number; price: number; status: string };
const initialRows: RecordRow[] = [
  { id: 1, name: 'Desk organizer', category: 'Office', quantity: 24, price: 18, status: 'Active' },
  { id: 2, name: 'Wireless keyboard', category: 'Equipment', quantity: 12, price: 65, status: 'Active' },
  { id: 3, name: 'Notebook set', category: 'Office', quantity: 48, price: 12, status: 'Active' },
  { id: 4, name: 'Monitor stand', category: 'Equipment', quantity: 8, price: 42, status: 'Draft' },
  { id: 5, name: 'Reading lamp', category: 'Equipment', quantity: 16, price: 34, status: 'Active' },
  { id: 6, name: 'Storage box', category: 'Supplies', quantity: 30, price: 9, status: 'Draft' },
];
export function RecordsApp({ controller }: { controller: WindowController }) {
  const [rows, setRows] = useState(initialRows);
  const [message, setMessage] = useState('');
  const formOpen = controller.win.modal, setFormOpen = controller.setModal;
  const dialog = useRef<HTMLDivElement>(null);
  const windowRef = controller.windowRef;
  useEffect(() => {
    if (formOpen && controller.active && controller.win.phase === 'visible') dialog.current?.querySelector<HTMLInputElement>('#record-name')?.focus();
    else if (controller.win.phase === 'visible' && controller.active) windowRef.current?.querySelector<HTMLButtonElement>('.add-record')?.focus({ preventScroll: true });
  }, [formOpen, controller.active]);
  function modalKeys(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); setFormOpen(false); return; }
    if (event.key !== 'Tab') return;
    const fields = dialog.current?.querySelectorAll<HTMLElement>('button,input,select');
    if (!fields?.length) return;
    const first = fields[0], last = fields[fields.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  function add(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget, data = new FormData(form), name = String(data.get('name') ?? '').trim();
    const quantity = Number(data.get('quantity')), price = Number(data.get('price'));
    if (!name || !Number.isInteger(quantity) || quantity < 0 || !Number.isFinite(price) || price < 0) return;
    setRows(old => [...old, { id: Math.max(...old.map(row => row.id), 0) + 1, name, category: String(data.get('category')), quantity, price, status: String(data.get('status')) }]);
    setMessage(`${name} added.`); setFormOpen(false); form.reset();
  }
  return <>
      <div className="records-body" inert={formOpen}>
        <div className="records-toolbar"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Records</h2><p>A clear view of your items, all in one table.</p></div><button className="add-record" onClick={() => { setMessage(''); setFormOpen(true); }}><Plus size={18}/>Add record</button></div>
        <div className="table-scroll"><table aria-label="Records"><thead><tr><th scope="col">ID</th><th scope="col">Item name</th><th scope="col">Category</th><th scope="col" className="numeric">Quantity</th><th scope="col" className="numeric">Unit price</th><th scope="col">Status</th></tr></thead>
          <tbody>{rows.map(row => <tr key={row.id}><td className="record-id">{String(row.id).padStart(3, '0')}</td><th scope="row">{row.name}</th><td>{row.category}</td><td className="numeric">{row.quantity}</td><td className="numeric">{row.price.toFixed(2)}</td><td><span className={`record-status ${row.status.toLowerCase()}`}>{row.status}</span></td></tr>)}</tbody>
        </table></div>
        <footer className="records-footer"><span>{rows.length} records · Demo data · Stored in memory for this session</span><span role="status">{message}</span></footer>
      </div>
      <div className="record-modal-layer" hidden={!formOpen}><div ref={dialog} className="record-dialog" role="dialog" aria-labelledby="record-form-title" onKeyDown={modalKeys}><form onSubmit={add}>
        <div className="form-heading"><div><span className="form-context">Records / New item</span><h2 id="record-form-title">Add record</h2><p>Enter the details for a new item.</p></div><button type="button" aria-label="Close add form" onClick={() => setFormOpen(false)}><X size={20}/></button></div>
        <label htmlFor="record-name">Item name</label><input id="record-name" name="name" required maxLength={100} autoFocus placeholder="e.g. Desk organizer" pattern=".*\S.*"/>
        <div className="form-pair"><div><label htmlFor="record-category">Category</label><select id="record-category" name="category"><option>Office</option><option>Equipment</option><option>Supplies</option><option>Other</option></select></div><div><label htmlFor="record-status">Status</label><select id="record-status" name="status"><option>Active</option><option>Draft</option></select></div></div>
        <div className="form-pair"><div><label htmlFor="record-quantity">Quantity</label><input id="record-quantity" name="quantity" type="number" required min="0" step="1" defaultValue="1"/></div><div><label htmlFor="record-price">Unit price</label><input id="record-price" name="price" type="number" required min="0" step="0.01" defaultValue="0.00"/></div></div>
        <div className="form-actions"><button type="button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="add-record">Save record</button></div>
      </form></div></div>
  </>;
}
