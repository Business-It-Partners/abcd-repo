import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowLeft, FileText, Plus, Search, Users, X } from 'lucide-react';
import type { WindowController } from './ManagedWindow';

const roles = ['Doctor', 'Helper', 'Support', 'Receptionist'] as const;
type Role = typeof roles[number];
type Staff = { id: number; name: string; contact: string; joined: string; role: Role; salary: number; email: string; address: string; notes: string; registration: string };
type Tab = 'Overview' | 'Salary history' | 'Work done' | 'Documents';
const money = (amount: number) => `NPR ${amount.toLocaleString('en-NP')}`;
const date = (value: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T12:00:00`));
const seed: Staff[] = [
  { id: 1, name: 'Dr. Lasata Maharjan', contact: '9841002101', joined: '2023-04-16', role: 'Doctor', salary: 65000, email: 'lasata@example.com', address: 'Patan, Lalitpur', notes: 'General dentistry and restorative care.', registration: 'NMC-DEMO-1042' },
  { id: 2, name: 'Dr. Udip Deshar', contact: '9841002102', joined: '2024-01-08', role: 'Doctor', salary: 72000, email: 'udip@example.com', address: 'Kirtipur, Kathmandu', notes: 'Endodontics and complex case reviews.', registration: 'NMC-DEMO-1186' },
  { id: 3, name: 'Sita Tamang', contact: '9841002103', joined: '2024-06-12', role: 'Helper', salary: 24000, email: 'sita@example.com', address: 'Baneshwor, Kathmandu', notes: 'Chairside assistance and instrument preparation.', registration: '' },
  { id: 4, name: 'Bikash Thapa', contact: '9841002104', joined: '2025-02-03', role: 'Support', salary: 28000, email: 'bikash@example.com', address: 'Bhaktapur', notes: 'Clinic supplies and daily operations.', registration: '' },
  { id: 5, name: 'Anita Shrestha', contact: '9841002105', joined: '2025-08-18', role: 'Receptionist', salary: 30000, email: 'anita@example.com', address: 'Jawalakhel, Lalitpur', notes: 'Appointments, patient reception, and phone enquiries.', registration: '' },
];
const work = [
  { date: '2026-10-12', patient: 'Kalpana Shrestha', case: 'Upper molar restoration', procedure: 'Composite filling', amount: 3500, support: 'Dr. Rina Shrestha' },
  { date: '2026-10-10', patient: 'Ramesh Adhikari', case: 'Lower molar pain', procedure: 'Root canal — visit 1', amount: 8000, support: 'Dr. Rina Shrestha, Dr. Nabin Rai' },
  { date: '2026-10-08', patient: 'Mina Rai', case: 'Routine hygiene', procedure: 'Scaling and polishing', amount: 2500, support: '—' },
];

export function StaffApp({ controller }: { controller: WindowController }) {
  const [staff, setStaff] = useState(seed), [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState(''), [role, setRole] = useState('All types'), [tab, setTab] = useState<Tab>('Overview');
  const [notice, setNotice] = useState(''), [preview, setPreview] = useState<string | null>(null);
  const dialog = useRef<HTMLDivElement>(null), addButton = useRef<HTMLButtonElement>(null), navigation = useRef<HTMLDivElement>(null);
  const staffMember = staff.find(person => person.id === selectedId);
  const tabs: Tab[] = staffMember?.role === 'Doctor' ? ['Overview', 'Salary history', 'Work done', 'Documents'] : ['Overview', 'Salary history', 'Documents'];
  const modal = controller.win.modal;
  const filtered = staff.filter(person => (role === 'All types' || person.role === role) && `${person.name} ${person.contact}`.toLowerCase().includes(search.trim().toLowerCase()));
  useEffect(() => {
    if (modal && controller.active && controller.win.phase === 'visible') dialog.current?.querySelector<HTMLElement>('input,button')?.focus({ preventScroll: true });
  }, [modal, preview, controller.active, controller.win.phase]);
  function closeModal() { controller.setModal(false); if (!preview) addButton.current?.focus({ preventScroll: true }); }
  function modalKeys(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.stopPropagation(); closeModal(); }
    if (event.key !== 'Tab') return;
    const fields = [...(dialog.current?.querySelectorAll<HTMLElement>('button,input,select,textarea') ?? [])].filter(element => !element.matches(':disabled'));
    if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0]?.focus(); }
  }
  function navigate(event: KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    event.preventDefault();
    const index = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (tabs.indexOf(tab) + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    setTab(tabs[index]); navigation.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus();
  }
  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget);
    const name = String(data.get('name')).trim(), contact = String(data.get('contact')).trim();
    if (!name || !contact) return;
    const person: Staff = { id: Math.max(...staff.map(person => person.id)) + 1, name, contact, joined: String(data.get('joined')), role: String(data.get('role')) as Role, salary: Number(data.get('salary')), email: String(data.get('email')).trim(), address: String(data.get('address')).trim(), notes: String(data.get('notes')).trim(), registration: '' };
    setStaff(previous => [...previous, person]); setSearch(''); setRole('All types'); setNotice(`${name} added to staff.`); closeModal();
  }
  const initials = staffMember?.name.replace(/^Dr\.\s*/, '').split(' ').slice(0, 2).map(word => word[0]).join('');
  return <>
    <div className="staff-body" inert={modal}>
      {!staffMember ? <>
        <header className="staff-heading"><div><span className="staff-eyebrow">CLINIC TEAM</span><h2>Staff</h2><p>People who keep your clinic running.</p></div><button ref={addButton} className="staff-primary" data-app-focus onClick={() => { setPreview(null); controller.setModal(true); }}><Plus size={17}/>Add staff</button></header>
        <div className="staff-toolbar"><label className="staff-search"><Search size={17}/><input aria-label="Search staff" placeholder="Search name or contact…" value={search} onChange={event => setSearch(event.target.value)}/></label><select aria-label="Filter staff type" value={role} onChange={event => setRole(event.target.value)}><option>All types</option>{roles.map(type => <option key={type}>{type}</option>)}</select><span><Users size={16}/>{staff.length} team members</span></div>
        <div className="staff-table-wrap"><table aria-label="Staff list"><thead><tr>{['Name', 'Contact', 'Join date', 'Type', 'Base salary', 'Action'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{filtered.map(person => <tr key={person.id}><th scope="row">{person.name}</th><td>{person.contact}</td><td>{date(person.joined)}</td><td><span className={`staff-role ${person.role.toLowerCase()}`}>{person.role}</span></td><td>{money(person.salary)}<small>per month</small></td><td><button className="staff-detail-button" aria-label={`Details for ${person.name}`} onClick={() => { setSelectedId(person.id); setTab('Overview'); }}>Details</button></td></tr>)}{!filtered.length && <tr><td colSpan={6} className="staff-empty">No staff match your search.</td></tr>}</tbody></table></div>
      </> : <>
        <button className="staff-back" data-app-focus onClick={() => setSelectedId(null)}><ArrowLeft size={16}/>Back to staff</button>
        <header className="staff-profile"><div className="staff-avatar" aria-hidden="true">{initials}</div><div><h2>{staffMember.name}</h2><p>{staffMember.contact} · {staffMember.email || 'Email not added'}</p><div className="staff-profile-tags"><span className={`staff-role ${staffMember.role.toLowerCase()}`}>{staffMember.role}</span><span className="staff-active">Active</span></div></div></header>
        <div ref={navigation} className="staff-tabs" role="tablist" aria-label="Staff profile sections">{tabs.map(name => <button key={name} id={`staff-tab-${name.replaceAll(' ', '-')}`} role="tab" aria-selected={tab === name} aria-controls="staff-panel" tabIndex={tab === name ? 0 : -1} onClick={() => setTab(name)} onKeyDown={navigate}>{name}</button>)}</div>
        <section className="staff-panel" id="staff-panel" role="tabpanel" aria-labelledby={`staff-tab-${tab.replaceAll(' ', '-')}`} tabIndex={0}>
          {tab === 'Overview' && <div className="staff-overview"><section><h3>Personal information</h3><dl><dt>Full name</dt><dd>{staffMember.name}</dd><dt>Contact</dt><dd>{staffMember.contact}</dd><dt>Email</dt><dd>{staffMember.email || 'Not added'}</dd><dt>Address</dt><dd>{staffMember.address || 'Not added'}</dd></dl></section><section><h3>Employment information</h3><dl><dt>Staff type</dt><dd>{staffMember.role}</dd><dt>Join date</dt><dd>{date(staffMember.joined)}</dd><dt>Base salary</dt><dd>{money(staffMember.salary)} / month</dd><dt>Status</dt><dd>Active</dd>{staffMember.role === 'Doctor' && <><dt>Registration</dt><dd>{staffMember.registration || 'Not added'}</dd></>}</dl></section><section className="staff-notes"><h3>Notes</h3><p>{staffMember.notes || 'No notes added.'}</p></section></div>}
          {tab === 'Salary history' && <><div className="staff-section-heading"><h3>Salary history</h3><span>Monthly base salary: {money(staffMember.salary)}</span></div>{staffMember.id > seed.length ? <p className="staff-empty">No salary payments recorded for this staff member yet.</p> : <div className="staff-table-wrap"><table aria-label="Salary history"><thead><tr>{['Period', 'Amount due', 'Paid', 'Balance', 'Payment date', 'Status'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{['September 2026', 'August 2026', 'July 2026'].map((period, index) => { const paid = index === 0 ? staffMember.salary - 5000 : staffMember.salary; return <tr key={period}><th scope="row">{period}</th><td>{money(staffMember.salary)}</td><td>{money(paid)}</td><td>{money(staffMember.salary - paid)}</td><td>{date(['2026-10-01', '2026-09-01', '2026-08-01'][index])}</td><td><span className={`staff-status ${index === 0 ? 'partial' : ''}`}>{index === 0 ? 'Partial' : 'Paid'}</span></td></tr>; })}</tbody></table></div>}</>}
          {tab === 'Work done' && <><div className="staff-section-heading"><h3>Dental work done</h3><span>Amount is the treatment charge, not doctor earnings.</span></div>{staffMember.id > seed.length ? <p className="staff-empty">No dental work recorded yet.</p> : <div className="staff-table-wrap"><table aria-label="Doctor work done"><thead><tr>{['Date', 'Patient', 'Case', 'Dental work', 'Amount', 'Supporting doctors'].map(label => <th key={label}>{label}</th>)}</tr></thead><tbody>{work.map(row => <tr key={row.date}><td>{date(row.date)}</td><th scope="row">{row.patient}</th><td>{row.case}</td><td>{row.procedure}</td><td>{money(row.amount)}</td><td>{row.support}</td></tr>)}</tbody></table></div>}</>}
          {tab === 'Documents' && <><div className="staff-section-heading"><h3>Documents</h3><span>Sample records for this demo</span></div>{staffMember.id > seed.length ? <p className="staff-empty">No documents added for this staff member yet.</p> : <div className="staff-documents">{['Employment agreement', 'Identity document', ...(staffMember.role === 'Doctor' ? ['Professional registration'] : [])].map((name, index) => <article key={name}><div className="staff-document-icon"><FileText size={24}/></div><div><h4>{name}</h4><p>{index === 1 ? 'Image' : 'PDF'} · Added {date(staffMember.joined)}</p></div><button aria-label={`Preview ${name}`} onClick={() => { setPreview(name); controller.setModal(true); }}>Preview</button></article>)}</div>}</>}
        </section>
      </>}
      <footer className="staff-footer"><span>Demo staff · Stored in memory for this session</span><span role="status">{notice}</span></footer>
    </div>
    {modal && <div className="record-modal-layer staff-modal"><div ref={dialog} className="record-dialog" role="dialog" aria-labelledby="staff-dialog-title" onKeyDown={modalKeys}><div className="form-heading"><div><span className="form-context">Staff / {preview ? 'Document preview' : 'New team member'}</span><h2 id="staff-dialog-title">{preview || 'Add staff'}</h2></div><button aria-label="Close staff dialog" onClick={closeModal}><X size={20}/></button></div>
      {preview ? <div className="staff-document-preview"><FileText size={44}/><h3>{preview}</h3><p>{staffMember?.name}</p><p>This is a dummy document record. No actual staff file is attached.</p><button className="staff-primary" onClick={closeModal}>Done</button></div> : <form onSubmit={create}><label htmlFor="staff-name">Name</label><input id="staff-name" name="name" required pattern=".*\S.*" maxLength={100} placeholder="Full name"/><div className="form-pair"><div><label htmlFor="staff-contact">Contact</label><input id="staff-contact" name="contact" type="tel" required pattern=".*\S.*" maxLength={20} placeholder="Phone number"/></div><div><label htmlFor="staff-email">Email (optional)</label><input id="staff-email" name="email" type="email" maxLength={150}/></div></div><div className="form-pair"><div><label htmlFor="staff-joined">Join date</label><input id="staff-joined" name="joined" type="date" required/></div><div><label htmlFor="staff-role">Type</label><select id="staff-role" name="role">{roles.map(type => <option key={type}>{type}</option>)}</select></div></div><label htmlFor="staff-salary">Base salary (NPR / month)</label><input id="staff-salary" name="salary" type="number" min="0" max="10000000" step="0.01" required placeholder="e.g. 30000"/><label htmlFor="staff-address">Address (optional)</label><input id="staff-address" name="address" maxLength={200}/><label htmlFor="staff-notes">Notes (optional)</label><textarea id="staff-notes" name="notes" rows={2} maxLength={500}/><div className="form-actions"><button type="button" onClick={closeModal}>Cancel</button><button className="staff-primary" type="submit">Save staff</button></div></form>}
    </div></div>}
  </>;
}
