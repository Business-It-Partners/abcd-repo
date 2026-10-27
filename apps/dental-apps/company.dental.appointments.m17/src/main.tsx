import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { StandardPageScroll } from '@/shared/ui/StandardPageScroll';
import { ArrowUpDown, CalendarDays, CalendarPlus, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Plus, RefreshCw, Search, Stethoscope } from 'lucide-react';
import { ClinicClient, ClinicError, type ClinicCommand } from '../../../../packages/app-sdk/src/clinicClient';
import DatePicker from '@/shared/dates/NepaliDatePicker';
import TimePicker from '@/shared/dates/TimePicker';
import { ClinicModal } from '@/shared/ui/ClinicModal';
import { formatDateShort } from '@/shared/dates/nepaliDate';
import { DraftSafety, useDraftSafety } from './draftSafety';
import {
  AppointmentsApi, clinicToday, minuteLabel, openOverlap, parseTime, timeValue,
  type Appointment, type AppointmentBucket, type AppointmentInput, type AppointmentReceipt,
  type AppointmentStatus, type AppointmentSummary, type StaffReference,
} from './appointments';
import '@/shared/clinic.css';
import './styles.css';
import '@/shared/standard-app-page.css';

declare global { interface Window { dentalApp?: import('../../../../packages/browser-sdk/src/contracts').AppSdk } }

type BucketChoice = 'day' | AppointmentBucket;
type FormSeed = { appointment?: Appointment; date: string };
type PendingWrite = { command: ClinicCommand<AppointmentReceipt>; label: string; closeModal: boolean };
type SortColumn = 'patient' | 'doctor';
const blankSummary: AppointmentSummary = { todayBooked: 0, thisWeekBooked: 0, upcomingBooked: 0, cancelled: 0 };
const statusLabels: Record<AppointmentStatus, string> = { booked: 'Booked', arrived: 'Arrived', cancelled: 'Cancelled', no_show: 'No-show' };
const bucketLabels: Record<AppointmentBucket, string> = { today: 'Today', week: 'This week', upcoming: 'Upcoming', cancelled: 'Cancelled' };

function friendly(error: unknown, fallback: string): string {
  if (error instanceof ClinicError) return error.message;
  return error instanceof Error && error.message ? error.message : fallback;
}

function statusText(error: unknown): string {
  if (error instanceof ClinicError && error.code === 'CONFLICT') return 'The appointment changed or overlaps another booking. The schedule has been refreshed; review it and try again.';
  if (error instanceof ClinicError && error.outcome === 'unknown') return 'The save result is not confirmed. Check the original save before making another change.';
  return friendly(error, 'The appointment could not be saved. Review the fields and try again.');
}

function AppointmentForm({ seed, doctors, rows, onSave, onClose, pending, onRetry }: {
  seed: FormSeed;
  doctors: StaffReference[];
  rows: Appointment[];
  onSave: (input: AppointmentInput, appointment?: Appointment) => Promise<void>;
  onClose: () => void;
  pending: PendingWrite | null;
  onRetry: () => void;
}) {
  const original = seed.appointment;
  const nameInput = useRef<HTMLInputElement>(null);
  const [patientName, setPatientName] = useState(original?.patientName ?? '');
  const [contactPhone, setContactPhone] = useState(original?.contactPhone ?? '');
  const [date, setDate] = useState(original?.appointmentDate ?? seed.date);
  const [time, setTime] = useState(timeValue(original?.startMinute ?? 540));
  const [duration, setDuration] = useState(String(original?.durationMinutes ?? 30));
  const [doctorId, setDoctorId] = useState(doctors.find(doctor => doctor.fullName === original?.doctorName)?.staffId ?? (original ? 'inactive' : doctors[0]?.staffId ?? ''));
  const [reason, setReason] = useState(original?.reason ?? 'Consultation');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const draftSafety = useDraftSafety('appointment-booking', dirty, onClose);
  const doctor = doctors.find(item => item.staffId === doctorId);
  const startMinute = parseTime(time);
  const durationMinutes = /^\d{1,3}$/.test(duration) ? Number(duration) : NaN;
  const overlapCandidate = startMinute === null ? null : {
    appointmentDate: date, startMinute, durationMinutes, doctorName: doctor?.fullName ?? '',
  };
  const conflicts = overlapCandidate && Number.isSafeInteger(durationMinutes) && durationMinutes > 0
    ? openOverlap(overlapCandidate, rows, original?.appointmentId) : [];
  const markDirty = <T,>(set: (value: T) => void, value: T) => { set(value); setDirty(true); };

  useEffect(() => { nameInput.current?.focus(); }, []);

  const close = useCallback(() => { if (!busy && !pending) draftSafety.close(); }, [busy, draftSafety, pending]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    setError('');
    if (!date) { setError('Choose an appointment date.'); return; }
    if (!patientName.trim()) { setError('Enter the name for the appointment diary.'); return; }
    if (patientName.trim().length > 160) { setError('Name must be 160 characters or fewer.'); return; }
    if (contactPhone.trim().length > 40) { setError('Contact must be 40 characters or fewer.'); return; }
    if (!doctor) { setError('Choose an active doctor from Staff.'); return; }
    if (startMinute === null || startMinute < 540 || startMinute >= 1140) { setError('Appointments start between 9:00 AM and 7:00 PM.'); return; }
    if (!Number.isSafeInteger(durationMinutes) || durationMinutes < 1 || durationMinutes > 720 || startMinute + durationMinutes > 1140) {
      setError('Enter a valid duration that ends by 7:00 PM.'); return;
    }
    if (!reason.trim()) { setError('Enter a reason for the appointment.'); return; }
    if (reason.trim().length > 500) { setError('Reason must be 500 characters or fewer.'); return; }
    if (conflicts.length) { setError('This doctor already has an active appointment during that time.'); return; }
    const input: AppointmentInput = {
      patientName: patientName.trim(), contactPhone: contactPhone.trim() || null, doctorName: doctor.fullName,
      appointmentDate: date, startMinute, durationMinutes, reason: reason.trim(),
    };
    setBusy(true);
    try { await onSave(input, original); }
    catch (cause) { setError(statusText(cause)); setBusy(false); }
  };

  return <ClinicModal title={original ? 'Reschedule appointment' : 'Book appointment'} onClose={close} closeDisabled={busy || !!pending} maxWidth={700}>
    <form className="appointmentForm" onSubmit={event => void submit(event)}>
      <p className="appointmentFormNote">This diary entry keeps its own name and contact. It does not create or link a patient record.</p>
      {error && <p className="appointmentFormError" role="alert">{error}</p>}
      {pending && <div className="appointmentFormActions"><button className="btn btn-secondary" type="button" onClick={onRetry}>Check original save</button></div>}
      <div className="appointmentFormGrid">
        <label className="appointmentField"><span>Name</span><input ref={nameInput} autoComplete="off" maxLength={160} value={patientName} onChange={event => markDirty(setPatientName, event.target.value)} placeholder="Who is coming in" required disabled={!!pending} /></label>
        <label className="appointmentField"><span>Contact <small>optional</small></span><input autoComplete="off" inputMode="tel" maxLength={40} value={contactPhone} onChange={event => markDirty(setContactPhone, event.target.value)} placeholder="For a reminder call" disabled={!!pending} /></label>
        <label className="appointmentField"><span>Date</span><DatePicker id="appointment-date" fluid value={date} onChange={value => markDirty(setDate, value)} disabled={!!pending} /></label>
        <label className="appointmentField"><span>Start time</span><TimePicker id="appointment-time" fluid minuteStep={5} value={time} onChange={value => markDirty(setTime, value)} disabled={!!pending} /></label>
        <label className="appointmentField"><span>Duration in minutes</span><input inputMode="numeric" maxLength={3} value={duration} onChange={event => markDirty(setDuration, event.target.value.replace(/\D/g, '').slice(0, 3))} disabled={!!pending} /></label>
        <label className="appointmentField"><span>Doctor</span><select value={doctorId} onChange={event => markDirty(setDoctorId, event.target.value)} disabled={!doctors.length || !!pending} required>
          {!doctorId && <option value="">Choose an active doctor</option>}
          {original && !doctors.some(item => item.fullName === original.doctorName) && <option value="inactive" disabled>{original.doctorName} · inactive</option>}
          {!doctors.length && <option value="">No active doctors available</option>}
          {doctors.map(item => <option key={item.staffId} value={item.staffId}>{item.fullName}</option>)}
        </select></label>
      </div>
      <label className="appointmentField" htmlFor="appointment-reason"><span id="appointment-reason-label">Reason</span><textarea id="appointment-reason" aria-labelledby="appointment-reason-label" maxLength={500} rows={3} value={reason} onChange={event => markDirty(setReason, event.target.value)} required disabled={!!pending} /></label>
      {conflicts.length > 0 && <div className="appointmentConflict" role="status"><strong>Possible doctor overlap</strong><ul>{conflicts.map(item => <li key={item.appointmentId}>{minuteLabel(item.startMinute)} · {item.patientName}</li>)}</ul><span>The clinic checks the complete schedule again when saving.</span></div>}
      <div className="appointmentFormActions"><button className="btn btn-secondary" disabled={busy || !!pending} onClick={close} type="button">Cancel</button><button className="btn btn-primary" disabled={busy || !!pending || conflicts.length > 0 || !doctors.length} type="submit">{busy ? 'Saving…' : original ? 'Save reschedule' : 'Book appointment'}</button></div>
    </form>
    {draftSafety.confirmation}
  </ClinicModal>;
}

function AppointmentsApp() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [summaryError, setSummaryError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState(blankSummary);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<StaffReference[]>([]);
  const [clinicDate, setClinicDate] = useState('');
  const [date, setDate] = useState('');
  const [bucket, setBucket] = useState<BucketChoice>('day');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<FormSeed | null>(null);
  const [details, setDetails] = useState<Appointment | null>(null);
  const [sort, setSort] = useState<{ column: SortColumn; direction: 'ascending' | 'descending' } | null>(null);
  const [savingStatusIds, setSavingStatusIds] = useState<Set<string>>(() => new Set());
  const [draftDirty, setDraftDirty] = useState(false);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [notice, setNotice] = useState('');
  const client = useRef<ClinicClient | null>(null);
  const api = useRef<AppointmentsApi | null>(null);
  const activeLoad = useRef(0);

  const reportLifecycle = useCallback(() => client.current?.report({ dirty: draftDirty, modal: !!form || !!details }), [draftDirty, details, form]);
  useEffect(() => { reportLifecycle(); }, [reportLifecycle]);

  useEffect(() => {
    let active = true;
    if (!window.dentalApp) { setError('Open Appointments from the Dental OS Store.'); return; }
    const sdk = new ClinicClient(window.dentalApp, () => {
      activeLoad.current++;
      api.current = null;
      setAppointments([]); setDoctors([]); setSummary(blankSummary); setPending(null); setForm(null); setDetails(null); setDraftDirty(false);
      if (active) { setReady(false); setError('The clinic session changed. Reopen Appointments from Dental OS.'); }
    });
    client.current = sdk;
    const unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
      if (moduleId !== 'appointments') setError('The selected Appointments module is unavailable.');
    });
    void sdk.initialize('company.dental.appointments.m17').then(({ session }) => {
      if (!session.clinicUser.capabilities.includes('appointments.access')) throw new ClinicError('FORBIDDEN', 'Appointments is unavailable for this clinic role.');
      if (!active) return;
      api.current = new AppointmentsApi(sdk);
      const today = clinicToday(session.clinic.timezone || 'Asia/Kathmandu');
      setClinicDate(today); setDate(today); setReady(true); setError('');
      void api.current.doctors().then(rows => { if (active) { setDoctors(rows); setReferenceError(''); } })
        .catch(() => { if (active) setReferenceError('Doctor names could not be loaded. Retry refresh before booking.'); });
    }).catch(cause => { if (active) setError(friendly(cause, 'Appointments could not be opened.')); });
    return () => { active = false; activeLoad.current++; unsubscribe(); api.current = null; sdk.report({ dirty: false, modal: false }); };
  }, []);

  const refresh = useCallback(async (clearNotice = true) => {
    if (!api.current || !clinicDate) return;
    const sequence = ++activeLoad.current;
    setLoading(true); setWriteError(''); if (clearNotice) setNotice('');
    const listPromise = bucket === 'day'
      ? api.current.list(date, doctorFilter || null)
      : api.current.listBucket(bucket, clinicDate, doctorFilter || null);
    const [listResult, summaryResult] = await Promise.allSettled([listPromise, api.current.summary(clinicDate)]);
    if (sequence !== activeLoad.current) return;
    if (listResult.status === 'fulfilled') { setAppointments(listResult.value); setError(''); }
    else { setAppointments([]); setError(friendly(listResult.reason, 'The appointment schedule could not be loaded.')); }
    if (summaryResult.status === 'fulfilled') { setSummary(summaryResult.value); setSummaryError(''); }
    else setSummaryError('Appointment summary counts could not be loaded.');
    setLoading(false);
  }, [bucket, clinicDate, date, doctorFilter]);

  useEffect(() => { if (ready) void refresh(false); }, [ready, refresh]);

  const runWrite = useCallback(async (command: ClinicCommand<AppointmentReceipt>, label: string, closeModal: boolean) => {
    setWriteError(''); setNotice(''); setPending(null);
    try {
      await command.execute();
      if (closeModal) { setForm(null); setDraftDirty(false); }
      await refresh(false);
      setNotice(`${label} saved.`);
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === 'unknown') setPending({ command, label, closeModal });
      if (cause instanceof ClinicError && cause.code === 'CONFLICT') await refresh(false);
      setWriteError(statusText(cause));
      throw cause;
    }
  }, [refresh]);

  const retryOriginal = useCallback(async () => {
    if (!pending) return;
    const current = pending;
    setWriteError('');
    try {
      await current.command.execute();
      setPending(null);
      if (current.closeModal) { setForm(null); setDraftDirty(false); }
      await refresh(false);
      setNotice(`${current.label} confirmed.`);
    } catch (cause) {
      if (!(cause instanceof ClinicError && cause.outcome === 'unknown')) setPending(null);
      setWriteError(statusText(cause));
      if (cause instanceof ClinicError && cause.code === 'CONFLICT') await refresh(false);
    }
  }, [pending, refresh]);

  const save = useCallback(async (input: AppointmentInput, existing?: Appointment) => {
    if (!api.current) throw new ClinicError('STALE_SESSION', 'The clinic session is not active.');
    const command = existing
      ? api.current.update(existing.appointmentId, input, existing.rowVersion)
      : api.current.create(input);
    await runWrite(command, existing ? 'Reschedule' : 'Appointment', true);
    setDate(input.appointmentDate);
    setBucket('day');
  }, [runWrite]);

  const retryRefresh = useCallback(async () => {
    await refresh();
    if (!api.current) return;
    try { setDoctors(await api.current.doctors()); setReferenceError(''); }
    catch { setReferenceError('Doctor names could not be loaded. Retry refresh before booking.'); }
  }, [refresh]);

  const updateStatus = useCallback((appointment: Appointment, status: AppointmentStatus) => {
    if (!api.current || status === appointment.status || pending || savingStatusIds.has(appointment.appointmentId)) return;
    const command = api.current.setStatus(appointment.appointmentId, status, appointment.rowVersion);
    setSavingStatusIds(current => new Set(current).add(appointment.appointmentId));
    void runWrite(command, 'Appointment status', false).catch(() => {}).finally(() => {
      setSavingStatusIds(current => { const next = new Set(current); next.delete(appointment.appointmentId); return next; });
    });
  }, [pending, runWrite, savingStatusIds]);

  const setDay = useCallback((next: string) => { setBucket('day'); setDate(next); }, []);
  const moveDay = (amount: number) => {
    const current = new Date(`${date}T12:00:00Z`);
    current.setUTCDate(current.getUTCDate() + amount);
    setDay(current.toISOString().slice(0, 10));
  };
  const dayLabel = (iso: string) => {
    const weekday = new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { weekday: 'long', timeZone: 'UTC' });
    return `${weekday}, ${formatDateShort(iso)}`;
  };
  const sortedAppointments = useMemo(() => {
    if (!sort) return appointments;
    return [...appointments].sort((left, right) => {
      const a = sort.column === 'patient' ? left.patientName : left.doctorName;
      const b = sort.column === 'patient' ? right.patientName : right.doctorName;
      const compared = a.localeCompare(b, undefined, { sensitivity: 'base' })
        || left.appointmentDate.localeCompare(right.appointmentDate)
        || left.startMinute - right.startMinute;
      return sort.direction === 'ascending' ? compared : -compared;
    });
  }, [appointments, sort]);
  const visibleAppointments = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    if (!term) return sortedAppointments;
    return sortedAppointments.filter(item => `${item.patientName} ${item.contactPhone ?? ''} ${item.reason} ${item.doctorName}`.toLocaleLowerCase().includes(term));
  }, [search, sortedAppointments]);
  const toggleSort = (column: SortColumn) => setSort(current => current?.column === column
    ? { column, direction: current.direction === 'ascending' ? 'descending' : 'ascending' }
    : { column, direction: 'ascending' });

  const choices = [
    { label: 'Today booked', value: 'todayBooked' as const, bucket: 'today' as const, count: summary.todayBooked, hint: 'slots still reserved today', Icon: CalendarPlus, tone: 'today' },
    { label: 'This week booked', value: 'thisWeekBooked' as const, bucket: 'week' as const, count: summary.thisWeekBooked, hint: 'remaining through Saturday', Icon: CalendarRange, tone: 'week' },
    { label: 'Upcoming booked', value: 'upcomingBooked' as const, bucket: 'upcoming' as const, count: summary.upcomingBooked, hint: 'after this week', Icon: Clock3, tone: 'upcoming' },
    { label: 'Cancelled', value: 'cancelled' as const, bucket: 'cancelled' as const, count: summary.cancelled, hint: 'future slots released', Icon: CalendarDays, tone: 'cancelled' },
  ];
  if (error && !ready) return <main className="appointmentsMessage" role="alert"><h1>Appointments unavailable</h1><p>{error}</p></main>;
  if (!ready) return <main className="appointmentsMessage" role="status">Opening Appointments…</main>;

  return <DraftSafety.Provider value={(_key, dirty) => setDraftDirty(dirty)}>
    <main className="clinicWorkspaceCanvas appointmentsCanvas" data-dental-os-app="company.dental.appointments.m17" data-sajilo-standard-page="">
      <StandardPageScroll contentClassName="appointmentsPageScrollContent">
      <header className="appointmentsHeader" data-sajilo-page-header>
        <h1>Appointments</h1>
        <div className="appointmentsHeaderActions"><button className="btn btn-secondary" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Refresh</button><button className="btn btn-primary" type="button" onClick={() => setForm({ date: bucket === 'day' ? date : clinicDate })} disabled={!!pending || !doctors.length}><Plus size={17} aria-hidden="true" /> Book appointment</button></div>
      </header>

      {(error || referenceError || summaryError || writeError || pending) && <section className={`appointmentAlert ${pending ? 'appointmentAlertPending' : ''}`} role={pending || writeError || error ? 'alert' : 'status'}>
        <div><strong>{pending ? 'Save needs confirmation' : writeError ? 'Appointment not confirmed' : 'Some schedule details are unavailable'}</strong>
          <p>{pending ? 'Keep this original request and check its receipt before making another change.' : writeError || error || referenceError || summaryError}</p></div>
        {pending ? <button className="btn btn-secondary" type="button" onClick={() => void retryOriginal()}>Check original save</button>
          : <button className="btn btn-secondary" type="button" onClick={() => void retryRefresh()}>Retry refresh</button>}
      </section>}

      <section className="appointmentSummary" aria-label="Appointment summary">
        {choices.map(choice => <button className={`appointmentSummaryCard tone-${choice.tone} ${bucket === choice.bucket ? 'selected' : ''}`} key={choice.value} type="button" onClick={() => setBucket(choice.bucket)} aria-pressed={bucket === choice.bucket}>
          <span className="appointmentSummaryLabel">{choice.label}</span><strong>{choice.count}</strong><small>{choice.hint}</small><span className="appointmentSummaryIcon"><choice.Icon size={17} aria-hidden="true" /></span>
        </button>)}
      </section>

      <section className="appointmentListPanel" aria-label="Appointments" data-clinic-data-table>
        <div className="appointmentToolbar" data-sajilo-table-toolbar="" aria-label="Schedule filters">
          <div className="appointmentDayNav" role="group" aria-label="Appointment day navigation">
            <button type="button" onClick={() => moveDay(-1)} aria-label="Previous day"><ChevronLeft size={16} aria-hidden="true" /></button>
            <button className="appointmentToday" type="button" onClick={() => setDay(clinicDate)}>Today</button>
            <button type="button" onClick={() => moveDay(1)} aria-label="Next day"><ChevronRight size={16} aria-hidden="true" /></button>
          </div>
          <DatePicker id="schedule-date" value={date} onChange={setDay} />
          <label className="appointmentDoctorFilter"><span>Doctor</span><span className="appointmentDoctorSelect"><select aria-label="Doctor" value={doctorFilter} onChange={event => setDoctorFilter(event.target.value)}><option value="">All doctors</option>{doctors.map(doctor => <option key={doctor.staffId} value={doctor.fullName}>{doctor.fullName}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></span></label>
          <label className="appointmentSearch"><Search size={16} aria-hidden="true" /><input type="search" aria-label="Search appointments" placeholder="Search patient, phone, reason…" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <span className="appointmentTableCount" aria-live="polite">{visibleAppointments.length} {visibleAppointments.length === 1 ? 'appointment' : 'appointments'}</span>
        </div>
        {loading && <div role="status" className="appointmentLoading"><span className="appointmentsSpinner" /> Updating schedule…</div>}
        {visibleAppointments.length === 0 && !loading ? <div className="appointmentEmpty"><CalendarDays size={24} aria-hidden="true" /><strong>{search.trim() ? 'No appointments match this search' : 'No appointments in this range'}</strong><span>{search.trim() ? 'Try a different patient, phone, reason, or doctor.' : 'Bookings for this clinic and filter will appear here.'}</span></div> : visibleAppointments.length > 0 ? <div className="appointmentTableWrap"><table className="appointmentTable" data-sajilo-standard-table=""><colgroup>
          <col className="appointmentTimeColumn" /><col className="appointmentPatientColumn" /><col className="appointmentReasonColumn" /><col className="appointmentDoctorColumn" /><col className="appointmentArrivedColumn" /><col className="appointmentCancelColumn" /><col className="appointmentActionColumn" />
        </colgroup><thead><tr>
          <th scope="col">Time</th>
          <th scope="col" aria-sort={sort?.column === 'patient' ? sort.direction : 'none'}><button className="appointmentSort" type="button" onClick={() => toggleSort('patient')}>Patient <ArrowUpDown size={12} aria-hidden="true" /></button></th>
          <th scope="col">Reason</th>
          <th scope="col" aria-sort={sort?.column === 'doctor' ? sort.direction : 'none'}><button className="appointmentSort" type="button" onClick={() => toggleSort('doctor')}>Doctor <ArrowUpDown size={12} aria-hidden="true" /></button></th>
          <th scope="col" className="appointmentCenter">Arrived</th><th scope="col" className="appointmentCenter">Cancel</th><th scope="col" className="appointmentCenter">Action</th>
        </tr></thead><tbody>
          {visibleAppointments.map(item => <tr key={item.appointmentId}>
            <td data-label="Time"><strong>{minuteLabel(item.startMinute)}</strong><span>till {minuteLabel(item.startMinute + item.durationMinutes)}</span></td>
            <td data-label="Patient"><strong>{item.patientName}</strong><span>{item.contactPhone || 'No contact added'}</span></td>
            <td data-label="Reason">{item.reason}</td>
            <td data-label="Doctor">{item.doctorName}</td>
            <td data-label="Arrived" className="appointmentCenter"><StatusToggle appointment={item} status="arrived" color="#16a34a" title="Mark arrived" busy={pending !== null || savingStatusIds.has(item.appointmentId)} onToggle={status => updateStatus(item, status)} /></td>
            <td data-label="Cancel" className="appointmentCenter"><StatusToggle appointment={item} status="cancelled" color="#dc2626" title="Cancel booking" busy={pending !== null || savingStatusIds.has(item.appointmentId)} onToggle={status => updateStatus(item, status)} /></td>
            <td data-label="Action" className="appointmentRowActions"><div>{(item.status === 'booked' || item.status === 'arrived') && <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ appointment: item, date: item.appointmentDate })} disabled={pending !== null}><Clock3 size={13} aria-hidden="true" /> Reschedule</button>}<button type="button" className="btn btn-primary btn-sm" onClick={() => setDetails(item)}>Details</button></div></td>
          </tr>)}
        </tbody></table></div> : null}
      </section>
      {notice && <p className="appointmentNotice" role="status">{notice}</p>}
      </StandardPageScroll>
      {form && <AppointmentForm seed={form} doctors={doctors} rows={appointments} onSave={save} onClose={() => { setForm(null); setDraftDirty(false); }} pending={pending} onRetry={() => void retryOriginal()} />}
      {details && <AppointmentDetails appointment={details} dateLabel={dayLabel(details.appointmentDate)} onClose={() => setDetails(null)} />}
    </main>
  </DraftSafety.Provider>;
}

function StatusToggle({ appointment, status, color, title, busy, onToggle }: {
  appointment: Appointment;
  status: AppointmentStatus;
  color: string;
  title: string;
  busy: boolean;
  onToggle: (next: AppointmentStatus) => void;
}) {
  const checked = appointment.status === status;
  return <button type="button" className="appointmentStatusToggle" role="checkbox" aria-checked={checked} aria-label={checked ? `${title} — click to re-open` : title}
    title={checked ? `${title} — click to re-open` : title} disabled={busy} onClick={() => onToggle(checked ? 'booked' : status)}
    style={{ '--status-color': color } as React.CSSProperties}>
    {checked && <Check size={14} strokeWidth={3} aria-hidden="true" />}
  </button>;
}

function AppointmentDetails({ appointment, dateLabel, onClose }: { appointment: Appointment; dateLabel: string; onClose: () => void }) {
  return <ClinicModal title={appointment.patientName} onClose={onClose} maxWidth={560}>
    <div className="appointmentDetail">
      <div className="appointmentDetailTime"><Clock3 size={18} aria-hidden="true" /><div><strong>{minuteLabel(appointment.startMinute)} – {minuteLabel(appointment.startMinute + appointment.durationMinutes)}</strong><span>{dateLabel} · {appointment.durationMinutes} min</span></div></div>
      <dl><dt>Status</dt><dd>{statusLabels[appointment.status]}</dd><dt>Reason</dt><dd>{appointment.reason}</dd><dt>Doctor</dt><dd>{appointment.doctorName}</dd>{appointment.contactPhone && <><dt>Phone</dt><dd><a href={`tel:${appointment.contactPhone}`}>{appointment.contactPhone}</a></dd></>}</dl>
    </div>
  </ClinicModal>;
}

createRoot(document.getElementById('root')!).render(<AppointmentsApp />);
