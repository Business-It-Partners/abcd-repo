import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CalendarDays, CalendarClock, ChevronLeft, ChevronRight, Plus, RefreshCw, Search, X } from 'lucide-react';
import type { WindowController } from './ManagedWindow';

type Bucket = 'today' | 'week' | 'upcoming' | 'missed';
type Patient = { id: number; name: string; phone: string; doctor: string; due: string; time: string; lastVisit: string; reason: string; called: boolean; unanswered: boolean; caught: boolean };
const dayString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = dayString(new Date());
function shifted(day: string, offset: number) { const date = new Date(`${day}T12:00:00`); date.setDate(date.getDate() + offset); return dayString(date); }
const saturday = shifted(today, (6 - new Date(`${today}T12:00:00`).getDay() + 7) % 7);
const dateLabel = (day: string) => new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${day}T12:00:00`));
const timeLabel = (time: string) => new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(`${today}T${time}`));
const names = ['Kalpana Shrestha', 'Ramesh Adhikari', 'Sita Tamang', 'Bikash Thapa', 'Anita Maharjan', 'Prakash Karki', 'Mina Rai', 'Sunil Gurung', 'Asha Sharma', 'Nabin Poudel', 'Sarita KC', 'Dipesh Joshi', 'Puja Basnet'];
const doctors = ['Dr. Lasata Maharjan', 'Dr. Udip Deshar', 'Dr. Rina Shrestha'];
const offsets = [-3, -2, -1, -5, -4, -6, -2, 0, 0, 1, 2, 9, 12];
const seed: Patient[] = names.map((name, i) => ({ id: i + 1, name, phone: `984941${String(4748 + i).padStart(4, '0')}`, doctor: doctors[i % 3], due: shifted(today, offsets[i]), time: i % 2 ? '10:30' : '16:30', lastVisit: shifted(today, -14 - i), reason: ['Routine recall and check-up', 'Review after treatment', 'Appointment confirmation'][i % 3], called: i === 1, unanswered: i === 2, caught: i === 0 }));
function bucketOf(row: Patient): Bucket { return row.due < today ? 'missed' : row.due === today ? 'today' : row.due <= saturday ? 'week' : 'upcoming'; }
const cards = [
  { key: 'today' as const, title: 'Due today', detail: 'to follow up today', Icon: CalendarClock },
  { key: 'week' as const, title: 'This week', detail: 'remaining till Saturday', Icon: CalendarDays },
  { key: 'upcoming' as const, title: 'Upcoming', detail: 'after this week', Icon: CalendarDays },
  { key: 'missed' as const, title: 'Missed', detail: 'window passed', Icon: AlertTriangle },
];
export function FollowupsApp({ controller }: { controller: WindowController }) {
  const [rows, setRows] = useState(seed), [bucket, setBucket] = useState<Bucket>('missed');
  const [search, setSearch] = useState(''), [day, setDay] = useState(''), [page, setPage] = useState(1), [message, setMessage] = useState('');
  const [mode, setMode] = useState<'create' | 'details'>('create'), [selected, setSelected] = useState<Patient | null>(null);
  const dialog = useRef<HTMLDivElement>(null), form = useRef<HTMLFormElement>(null);
  const modal = controller.win.modal;
  useEffect(() => {
    if (modal && controller.active && controller.win.phase === 'visible') dialog.current?.querySelector<HTMLElement>(mode === 'create' ? 'input' : 'button')?.focus({ preventScroll: true });
    else if (!modal && controller.active && controller.win.phase === 'visible') controller.windowRef.current?.querySelector<HTMLElement>('[data-app-focus]')?.focus({ preventScroll: true });
  }, [modal, mode, controller.active, controller.win.phase]);
  const matching = rows.filter(row => (day ? row.due === day : bucketOf(row) === bucket) && `${row.name} ${row.phone}`.toLowerCase().includes(search.trim().toLowerCase()));
  const pages = Math.max(1, Math.ceil(matching.length / 4)), currentPage = Math.min(page, pages), start = (currentPage - 1) * 4;
  const visible = matching.slice(start, start + 4);
  function openCreate() { setMode('create'); form.current?.reset(); setMessage(''); controller.setModal(true); }
  function keys(event: React.KeyboardEvent) {
    if (event.key === 'Escape') { event.stopPropagation(); controller.setModal(false); return; }
    if (event.key !== 'Tab') return;
    const fields = [...(dialog.current?.querySelectorAll<HTMLElement>('button,input,select,textarea') ?? [])];
    if (event.shiftKey && document.activeElement === fields[0]) { event.preventDefault(); fields.at(-1)?.focus(); }
    else if (!event.shiftKey && document.activeElement === fields.at(-1)) { event.preventDefault(); fields[0]?.focus(); }
  }
  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget), name = String(data.get('patient')).trim();
    if (!name) return;
    const row: Patient = { id: Math.max(0, ...rows.map(row => row.id)) + 1, name, phone: String(data.get('phone')).trim(), doctor: String(data.get('doctor')), due: String(data.get('due')), time: String(data.get('time')), lastVisit: String(data.get('lastVisit')), reason: String(data.get('reason')).trim(), called: false, unanswered: false, caught: false };
    setRows(old => [...old, row]); setBucket(bucketOf(row)); setDay(''); setSearch(''); setPage(1); setMessage(`Follow-up created for ${name}.`); controller.setModal(false);
  }
  function toggle(id: number, field: 'called' | 'unanswered' | 'caught') { setRows(old => old.map(row => row.id === id ? { ...row, [field]: !row[field] } : row)); }
  return <>
    <div className="followups-body" inert={modal}>
      <header className="followups-heading"><div><h2>Follow-ups</h2><p>{new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(`${today}T12:00:00`))} · patient recall tracker</p></div><div className="followups-actions"><button className="followups-refresh" onClick={() => setMessage('Follow-ups refreshed. Your session changes are retained.')}><RefreshCw size={16}/>Refresh</button><button className="followups-primary" data-app-focus onClick={openCreate}><Plus size={17}/>Create follow-up</button></div></header>
      <div className="followups-cards">{cards.map(({ key, title, detail, Icon }) => <button key={key} className={`followups-card ${key} ${bucket === key && !day ? 'selected' : ''}`} aria-pressed={bucket === key && !day} onClick={() => { setBucket(key); setDay(''); setPage(1); }}><strong>{rows.filter(row => bucketOf(row) === key).length}</strong><span className="followups-card-icon"><Icon size={18}/></span><span className="followups-card-title">{title}</span><small>{detail}</small></button>)}</div>
      <section className="followups-table-panel" aria-label="Patient follow-ups">
        <div className="followups-filters"><label className="followups-search"><Search size={17}/><input aria-label="Search patient or phone" placeholder="Search patient or phone…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}/></label><div className="followups-day"><button aria-label="Previous day" onClick={() => { setDay(shifted(day || today, -1)); setPage(1); }}><ChevronLeft size={18}/></button><label><CalendarDays size={18}/>{!day && <span>Pick a day</span>}<input aria-label="Filter by day" className={day ? '' : 'empty'} type="date" value={day} onChange={e => { setDay(e.target.value); setPage(1); }}/></label><button aria-label="Next day" onClick={() => { setDay(shifted(day || today, 1)); setPage(1); }}><ChevronRight size={18}/></button>{day && <button aria-label="Clear day filter" onClick={() => { setDay(''); setPage(1); }}><X size={16}/></button>}</div></div>
        <div className="followups-table-scroll"><table aria-label="Follow-ups"><thead><tr>{['#', 'Patient', 'Due', 'Doctor', 'Last visit', 'Phone', 'Call', 'Un-response', 'Caught', 'Action'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{visible.map((row, index) => <tr key={row.id}><td>{start + index + 1}</td><th scope="row">{row.name}</th><td>{dateLabel(row.due)}<small>{timeLabel(row.time)}</small></td><td>{row.doctor}</td><td>{row.lastVisit ? dateLabel(row.lastVisit) : '—'}</td><td>{row.phone}</td><td><input type="checkbox" aria-label={`Call ${row.name}`} checked={row.called} onChange={() => toggle(row.id, 'called')}/></td><td><input type="checkbox" aria-label={`Un-response ${row.name}`} checked={row.unanswered} onChange={() => toggle(row.id, 'unanswered')}/></td><td><input className="caught-check" type="checkbox" aria-label={`Caught ${row.name}`} checked={row.caught} onChange={() => toggle(row.id, 'caught')}/></td><td><button className="followups-primary followups-details" aria-label={`Details for ${row.name}`} onClick={() => { setSelected(row); setMode('details'); controller.setModal(true); }}>Details</button></td></tr>)}{!visible.length && <tr><td colSpan={10} className="followups-empty">No follow-ups match this view.</td></tr>}</tbody></table></div>
        <footer className="followups-pagination"><span>Showing {matching.length ? start + 1 : 0} to {Math.min(start + 4, matching.length)} of {matching.length} follow-ups</span><div><button disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15}/>Previous</button><span className="followups-page" aria-label={`Page ${currentPage} of ${pages}`}>{currentPage}</span><button disabled={currentPage === pages} onClick={() => setPage(currentPage + 1)}>Next<ChevronRight size={15}/></button></div></footer>
      </section>
      <footer className="followups-session"><span>Demo patients · Stored in memory for this session</span><span role="status">{message}</span></footer>
    </div>
    <div className="record-modal-layer followups-modal" hidden={!modal}><div ref={dialog} className="record-dialog" role="dialog" aria-labelledby="followups-dialog-title" onKeyDown={keys}>
      <div className="form-heading"><div><span className="form-context">Follow-ups / {mode === 'create' ? 'New recall' : 'Patient details'}</span><h2 id="followups-dialog-title">{mode === 'create' ? 'Create follow-up' : 'Follow-up details'}</h2></div><button type="button" aria-label="Close follow-up dialog" onClick={() => controller.setModal(false)}><X size={20}/></button></div>
      {mode === 'create' ? <form ref={form} onSubmit={create}>
        <label htmlFor="followups-patient">Patient name</label><input id="followups-patient" name="patient" required maxLength={100} pattern=".*\S.*" placeholder="Patient full name"/>
        <div className="form-pair"><div><label htmlFor="followups-phone">Phone</label><input id="followups-phone" name="phone" type="tel" required maxLength={20} placeholder="e.g. 9800000000"/></div><div><label htmlFor="followups-doctor">Doctor</label><select id="followups-doctor" name="doctor">{doctors.map(doctor => <option key={doctor}>{doctor}</option>)}</select></div></div>
        <div className="form-pair"><div><label htmlFor="followups-due">Due date</label><input id="followups-due" name="due" type="date" required defaultValue={today}/></div><div><label htmlFor="followups-time">Due time</label><input id="followups-time" name="time" type="time" required defaultValue="10:00"/></div></div>
        <label htmlFor="followups-visit">Last visit</label><input id="followups-visit" name="lastVisit" type="date"/>
        <label htmlFor="followups-reason">Reason / notes</label><textarea id="followups-reason" name="reason" rows={2} maxLength={500} placeholder="Reason for this follow-up"/>
        <div className="form-actions"><button type="button" onClick={() => controller.setModal(false)}>Cancel</button><button className="followups-primary" type="submit">Save follow-up</button></div>
      </form> : selected && <><dl className="followups-detail-list"><dt>Patient</dt><dd>{selected.name}</dd><dt>Phone</dt><dd>{selected.phone}</dd><dt>Doctor</dt><dd>{selected.doctor}</dd><dt>Due</dt><dd>{dateLabel(selected.due)} · {timeLabel(selected.time)}</dd><dt>Last visit</dt><dd>{selected.lastVisit ? dateLabel(selected.lastVisit) : '—'}</dd><dt>Reason / notes</dt><dd>{selected.reason || 'No notes added.'}</dd></dl><div className="form-actions"><button className="followups-primary" onClick={() => controller.setModal(false)}>Done</button></div></>}
    </div></div>
  </>;
}
