import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { StandardPageScroll } from '@/shared/ui/StandardPageScroll';
import { CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCheck, Loader2, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { ClinicClient, ClinicError, type ClinicCommand } from './sdk/client';
import { connectBrowserRuntime } from './runtimeBridge';
import { BS_MONTHS_LONG, BS_YEAR_MAX, BS_YEAR_MIN, adToBS, bsMonthToADRange, bsToAD, daysInBSMonth, formatBSMonthYear, todayBS, type BSDate } from '@/shared/dates/bikramSambat';
import { CalendarTasksApi, type CalendarTask, type CalendarTaskCategory, type CalendarTaskReceipt } from './calendarTasks';
import { handleSandboxedFormSubmitClick, handleSandboxedFormSubmitKeyDown } from '@/shared/ui/workspace-primitives/sandboxedFormSubmit';
import '@/shared/clinic.css';
import './styles.css';
import '@/shared/standard-app-page.css';

const APP_ID = 'calendar';
// Install the one-time host listener before React mounts.
const browserRuntime = connectBrowserRuntime(APP_ID);

type PendingWrite = { command: ClinicCommand<CalendarTaskReceipt>; label: string; after: 'create' | 'refresh' };
type Navigation = { year: number; month: number; day: number | null };
const fallbackToday: BSDate = { year: 2083, month: 5, day: 1 };
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const categories: Array<{ value: CalendarTaskCategory; label: string }> = [
  { value: 'clinical', label: 'Clinical' }, { value: 'lab', label: 'Lab' }, { value: 'admin', label: 'Administration' },
];

function clinicToday(timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function message(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function CalendarApp() {
  const today = todayBS() ?? fallbackToday;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [year, setYear] = useState(today.year);
  const [month, setMonth] = useState(today.month);
  const [todayDate, setTodayDate] = useState('');
  const [todayBs, setTodayBs] = useState<BSDate>(today);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState<CalendarTaskCategory>('clinical');
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [pendingNavigation, setPendingNavigation] = useState<Navigation | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CalendarTask | null>(null);
  const api = useRef<CalendarTasksApi | null>(null);
  const client = useRef<ClinicClient | null>(null);
  const activeLoad = useRef(0);
  const range = useMemo(() => bsMonthToADRange(year, month), [month, year]);
  const dirtyDraft = !!draft.trim();

  useEffect(() => {
    client.current?.report({
      dirty: dirtyDraft,
      modal: selectedDay !== null || !!pendingNavigation || !!archiveTarget,
      pendingWrite: writing || !!pending,
    });
  }, [archiveTarget, dirtyDraft, pending, pendingNavigation, selectedDay, writing]);

  useEffect(() => {
    let active = true;
    void browserRuntime.then(bridge => {
      if (!active) return;
      const sdk = new ClinicClient(bridge);
      client.current = sdk;
      api.current = new CalendarTasksApi(sdk);
      const adDate = clinicToday(bridge.clinicTimeZone ?? 'Asia/Kathmandu');
      const bsDate = adToBS(adDate) ?? todayBS() ?? fallbackToday;
      setTodayDate(adDate); setTodayBs(bsDate); setYear(bsDate.year); setMonth(bsDate.month);
      setReady(true); setError('');
    }).catch(cause => { if (active) setError(message(cause, 'Calendar could not be opened.')); });
    return () => {
      active = false; activeLoad.current++; api.current = null;
      client.current?.report({ dirty: false, modal: false, pendingWrite: false });
      client.current = null;
    };
  }, []);

  const reload = useCallback(async () => {
    if (!api.current || !range) return;
    const request = ++activeLoad.current;
    setLoading(true); setLoadError('');
    try {
      const rows = await api.current.list(range.start, range.end);
      if (request === activeLoad.current) { setTasks(rows); setWriteError(''); }
    } catch (cause) {
      if (request === activeLoad.current) { setTasks([]); setLoadError(message(cause, 'Calendar could not be loaded.')); }
    } finally {
      if (request === activeLoad.current) setLoading(false);
    }
  }, [range]);

  useEffect(() => { if (ready) void reload(); }, [ready, reload]);

  const groups = useMemo(() => tasks.reduce<Record<string, CalendarTask[]>>((result, task) => {
    (result[task.date] ??= []).push(task);
    return result;
  }, {}), [tasks]);
  const numberOfDays = daysInBSMonth(year, month);
  const firstAdDate = bsToAD(year, month, 1);
  const leadingCells = firstAdDate ? new Date(`${firstAdDate}T12:00:00Z`).getUTCDay() : 0;
  const cells = Array.from({ length: Math.ceil((leadingCells + numberOfDays) / 7) * 7 }, (_, index) => index - leadingCells + 1);
  const selectedIso = selectedDay ? bsToAD(year, month, selectedDay) : null;
  const selectedTasks = selectedIso ? groups[selectedIso] ?? [] : [];
  const openThisMonth = tasks.filter(task => task.status === 'open').length;
  const isToday = (day: number) => year === todayBs.year && month === todayBs.month && day === todayBs.day;

  const applyNavigation = useCallback((target: Navigation) => {
    setYear(target.year); setMonth(target.month); setSelectedDay(target.day);
    setDraft(''); setCategory('clinical'); setArchiveTarget(null); setPendingNavigation(null);
  }, []);
  const navigate = useCallback((target: Navigation) => {
    if (pending || writing) return;
    if (dirtyDraft) setPendingNavigation(target);
    else applyNavigation(target);
  }, [applyNavigation, dirtyDraft, pending, writing]);
  const moveMonth = (offset: number) => {
    const serial = year * 12 + month - 1 + offset;
    const nextYear = Math.floor(serial / 12), nextMonth = serial % 12 + 1;
    if (nextYear < BS_YEAR_MIN || nextYear > BS_YEAR_MAX) return;
    navigate({ year: nextYear, month: nextMonth, day: null });
  };
  const openDay = (day: number) => navigate({ year, month, day });

  const perform = useCallback(async (command: ClinicCommand<CalendarTaskReceipt>, label: string, after: PendingWrite['after']) => {
    setWriting(true); setWriteError(''); setNotice('');
    try {
      await command.execute();
      setPending(null);
      if (after === 'create') setDraft('');
      setNotice(`${label} saved.`);
      await reload();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === 'unknown') setPending({ command, label, after });
      else setPending(null);
      if (cause instanceof ClinicError && cause.code === 'CONFLICT') await reload();
      setWriteError(message(cause, `${label} could not be saved.`));
    } finally { setWriting(false); }
  }, [reload]);

  const addTask = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!api.current || !selectedIso || !draft.trim() || draft.trim().length > 180 || pending || writing) return;
    void perform(api.current.create({ date: selectedIso, title: draft, category }), 'Calendar task', 'create');
  };
  const setTaskStatus = (task: CalendarTask) => {
    if (!api.current || pending || writing || task.status === 'archived') return;
    const status = task.status === 'completed' ? 'open' : 'completed';
    void perform(api.current.setStatus(task, status), status === 'completed' ? 'Task completion' : 'Task reopen', 'refresh');
  };
  const archiveTask = () => {
    if (!api.current || !archiveTarget || pending || writing) return;
    const target = archiveTarget;
    setArchiveTarget(null);
    void perform(api.current.archive(target), 'Task archive', 'refresh');
  };
  const retryOriginal = () => {
    if (pending) void perform(pending.command, pending.label, pending.after);
  };

  if (error) return <main className="calendarMessage" role="alert"><h1>Calendar unavailable</h1><p>{error}</p></main>;
  if (!ready) return <main className="calendarMessage" role="status">Opening Calendar…</main>;

  return <main className="calendarWorkspace" data-dental-os-app={APP_ID} data-sajilo-standard-page="">
    <StandardPageScroll>
    <header className="calendarPageHeader" data-sajilo-page-header>
      <h1>Calendar</h1>
      <div className="calendarHeaderActions"><span><strong>{openThisMonth}</strong> open this month</span><button type="button" onClick={() => void reload()} disabled={loading}><RefreshCw size={15} className={loading ? 'calendarSpin' : ''} />{loading ? 'Refreshing…' : 'Refresh'}</button></div>
    </header>
    {loadError && <section className="calendarAlert" role="alert"><span>{loadError}</span><button type="button" className="btn btn-secondary" onClick={() => void reload()}>Retry</button></section>}
    {writeError && selectedDay === null && <section className="calendarAlert" role="alert"><span>{writeError}</span></section>}
    {notice && <p className="calendarNotice" role="status">{notice}</p>}
    <section className="calendarCard" aria-busy={loading} aria-label={`${formatBSMonthYear(year, month)} calendar`}>
      <header className="calendarCardHeader"><div><h2>{formatBSMonthYear(year, month)}</h2><span>Bikram Sambat calendar · tasks are saved for your clinic</span></div><div className="calendarMonthControls">
        <button type="button" aria-label="Previous month" onClick={() => moveMonth(-1)} disabled={year === BS_YEAR_MIN && month === 1 || !!pending || writing}><ChevronLeft size={17} /></button>
        <select aria-label="Bikram Sambat month" value={month} onChange={event => navigate({ year, month: Number(event.target.value), day: null })} disabled={!!pending || writing}>{BS_MONTHS_LONG.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
        <select aria-label="Bikram Sambat year" value={year} onChange={event => navigate({ year: Number(event.target.value), month, day: null })} disabled={!!pending || writing}>{Array.from({ length: BS_YEAR_MAX - BS_YEAR_MIN + 1 }, (_, index) => BS_YEAR_MIN + index).map(value => <option key={value} value={value}>{value}</option>)}</select>
        <button type="button" aria-label="Next month" onClick={() => moveMonth(1)} disabled={year === BS_YEAR_MAX && month === 12 || !!pending || writing}><ChevronRight size={17} /></button>
        <button type="button" className="calendarTodayButton" onClick={() => navigate({ year: todayBs.year, month: todayBs.month, day: todayBs.day })} disabled={!todayDate || !!pending || writing}>Today</button>
      </div></header>
      <div className="calendarWeekdays">{weekdays.map(day => <span key={day}>{day}</span>)}</div>
      <div className="calendarGrid">{cells.map((day, index) => {
        if (day < 1 || day > numberOfDays) return <div className="calendarEmptyCell" key={`empty-${index}`} />;
        const iso = bsToAD(year, month, day);
        const dayTasks = iso ? groups[iso] ?? [] : [];
        const openCount = dayTasks.filter(task => task.status === 'open').length;
        const complete = dayTasks.length > 0 && openCount === 0;
        const overdue = year === todayBs.year && month === todayBs.month && day < todayBs.day && openCount > 0;
        return <button key={day} type="button" className={`calendarDay${isToday(day) ? ' isToday' : ''}${selectedDay === day ? ' isSelected' : ''}${overdue ? ' isOverdue' : ''}`} onClick={() => openDay(day)} disabled={loading || !!pending || writing} aria-label={`${day} ${formatBSMonthYear(year, month)}${dayTasks.length ? `, ${dayTasks.length} tasks` : ''}`} aria-pressed={selectedDay === day}>
          <span>{day}</span>{dayTasks.length > 0 && <small className={complete ? 'isComplete' : ''}>{openCount || '✓'}</small>}{openCount > 0 && <i aria-hidden="true" />}
        </button>;
      })}</div>
      {loading && !tasks.length && <p className="calendarLoading" role="status"><Loader2 size={16} className="calendarSpin" /> Loading clinic tasks…</p>}
      <footer className="calendarLegend"><span><i className="openDot" /> Open tasks</span><span><i className="overdueDot" /> Overdue</span><span><i className="doneDot" /> All complete</span></footer>
    </section>
    </StandardPageScroll>

    {selectedDay !== null && <div className="calendarOverlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) navigate({ year, month, day: null }); }}>
      <aside className="calendarDaySheet" role="dialog" aria-modal="true" aria-labelledby="calendarDayTitle">
        <header><div><p className="calendarEyebrow">DAILY WORK PLAN</p><h2 id="calendarDayTitle">{selectedDay} {formatBSMonthYear(year, month)}</h2><span>{isToday(selectedDay) ? 'Today' : 'Plan clinic tasks for this day'}</span></div><button className="calendarClose" type="button" onClick={() => navigate({ year, month, day: null })} aria-label="Close calendar day"><X size={18} /></button></header>
        <div className="calendarTaskSummary"><span>{selectedTasks.filter(task => task.status === 'completed').length} complete</span><span>{selectedTasks.filter(task => task.status === 'open').length} open</span></div>
        {writeError && <section className="calendarSheetError" role="alert"><span>{writeError}</span>{pending && <button type="button" className="btn btn-secondary" disabled={writing} onClick={retryOriginal}>{writing ? 'Checking…' : 'Check original save'}</button>}</section>}
        <div className="calendarTaskList" aria-live="polite">{selectedTasks.length ? selectedTasks.map(task => <div className={`calendarTask${task.status === 'completed' ? ' taskDone' : ''}`} key={task.id}>
          <button type="button" className="calendarCheck" role="checkbox" aria-checked={task.status === 'completed'} aria-label={`${task.status === 'completed' ? 'Reopen' : 'Complete'} ${task.title}`} onClick={() => setTaskStatus(task)} disabled={writing || !!pending}><Check size={14} /></button>
          <span className="calendarTaskLabel">{task.title}</span><small className={`category-${task.category}`}>{categories.find(item => item.value === task.category)?.label}</small>
          <button type="button" className="calendarDelete" aria-label={`Remove task: ${task.title}`} onClick={() => setArchiveTarget(task)} disabled={writing || !!pending}><Trash2 size={15} /></button>
        </div>) : <div className="calendarNoTasks"><ClipboardCheck size={25} /><strong>No tasks for this day</strong><span>Add the first task below.</span></div>}</div>
        <form className="calendarAddTask" onSubmit={addTask} onClickCapture={handleSandboxedFormSubmitClick} onKeyDown={handleSandboxedFormSubmitKeyDown}>
          <label htmlFor="calendar-task-title">Add a task</label>
          <div className="calendarAddControls"><input id="calendar-task-title" value={draft} onChange={event => setDraft(event.target.value.slice(0, 180))} placeholder="e.g. Prepare chairside materials" maxLength={180} autoComplete="off" disabled={!!pending || writing} /><select value={category} onChange={event => setCategory(event.target.value as CalendarTaskCategory)} aria-label="Task category" disabled={!!pending || writing}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select><button type="submit" disabled={!draft.trim() || !!pending || writing}>{writing && pending?.after === 'create' ? <Loader2 size={15} className="calendarSpin" /> : <Plus size={16} />} Add</button></div>
          <p>Tasks are visible to everyone in this clinic workspace.</p>
        </form>
        {archiveTarget && <div className="calendarConfirm" role="alertdialog" aria-modal="true" aria-labelledby="archive-title"><div><strong id="archive-title">Remove this task?</strong><span>{archiveTarget.title}</span><p>It will be archived from the clinic calendar.</p></div><div><button type="button" className="btn btn-secondary" onClick={() => setArchiveTarget(null)} disabled={writing}>Keep task</button><button type="button" className="btn btn-primary" onClick={archiveTask} disabled={writing || !!pending}>{writing ? 'Removing…' : 'Remove task'}</button></div></div>}
        {pendingNavigation && <div className="calendarConfirm" role="alertdialog" aria-modal="true" aria-labelledby="discard-title"><div><strong id="discard-title">Discard unsaved task?</strong><span>Your task draft has not been saved.</span></div><div><button type="button" className="btn btn-secondary" onClick={() => setPendingNavigation(null)}>Keep editing</button><button type="button" className="btn btn-primary" onClick={() => applyNavigation(pendingNavigation)}>Discard draft</button></div></div>}
      </aside>
    </div>}
  </main>;
}

createRoot(document.getElementById('root')!).render(<CalendarApp />);
