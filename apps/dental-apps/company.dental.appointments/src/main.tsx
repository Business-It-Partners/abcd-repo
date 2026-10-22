import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { CalendarDays, ChevronDown, Clock3, Plus, RefreshCw, Stethoscope } from 'lucide-react';
import { ClinicClient, ClinicError, type ClinicCommand } from '../../../../packages/app-sdk/src/clinicClient';
import DatePicker from '@/shared/dates/NepaliDatePicker';
import TimePicker from '@/shared/dates/TimePicker';
import { ClinicModal } from '@/shared/ui/ClinicModal';
import { DraftSafety, useDraftSafety } from './draftSafety';
import {
  AppointmentsApi, clinicToday, minuteLabel, openOverlap, parseTime, timeValue,
  type Appointment, type AppointmentBucket, type AppointmentInput, type AppointmentReceipt,
  type AppointmentStatus, type AppointmentSummary, type StaffReference,
} from './appointments';
import '@/shared/clinic.css';
import './styles.css';

declare global { interface Window { dentalApp?: import('../../../../electron/sdk/contracts').AppSdk } }

type BucketChoice = 'day' | AppointmentBucket;
type FormSeed = { appointment?: Appointment; date: string };
type PendingWrite = { command: ClinicCommand<AppointmentReceipt>; label: string; closeModal: boolean };
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
  const [form, setForm] = useState<FormSeed | null>(null);
  const [draftDirty, setDraftDirty] = useState(false);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [notice, setNotice] = useState('');
  const client = useRef<ClinicClient | null>(null);
  const api = useRef<AppointmentsApi | null>(null);
  const activeLoad = useRef(0);

  const reportLifecycle = useCallback(() => client.current?.report({ dirty: draftDirty, modal: !!form }), [draftDirty, form]);
  useEffect(() => { reportLifecycle(); }, [reportLifecycle]);

  useEffect(() => {
    let active = true;
    if (!window.dentalApp) { setError('Open Appointments from the Dental OS Store.'); return; }
    const sdk = new ClinicClient(window.dentalApp, () => {
      activeLoad.current++;
      api.current = null;
      setAppointments([]); setDoctors([]); setSummary(blankSummary); setPending(null); setForm(null); setDraftDirty(false);
      if (active) { setReady(false); setError('The clinic session changed. Reopen Appointments from Dental OS.'); }
    });
    client.current = sdk;
    const unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
      if (moduleId !== 'appointments') setError('The selected Appointments module is unavailable.');
    });
    void sdk.initialize('company.dental.appointments').then(({ session }) => {
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
    if (!api.current || status === appointment.status || pending) return;
    const command = api.current.setStatus(appointment.appointmentId, status, appointment.rowVersion);
    void runWrite(command, 'Appointment status', false).catch(() => {});
  }, [pending, runWrite]);

  const choices = useMemo(() => [
    { label: 'Today booked', value: 'todayBooked' as const, bucket: 'today' as const, count: summary.todayBooked },
    { label: 'This week', value: 'thisWeekBooked' as const, bucket: 'week' as const, count: summary.thisWeekBooked },
    { label: 'Upcoming', value: 'upcomingBooked' as const, bucket: 'upcoming' as const, count: summary.upcomingBooked },
    { label: 'Cancelled', value: 'cancelled' as const, bucket: 'cancelled' as const, count: summary.cancelled },
  ], [summary]);

  if (error && !ready) return <main className="appointmentsMessage" role="alert"><h1>Appointments unavailable</h1><p>{error}</p></main>;
  if (!ready) return <main className="appointmentsMessage" role="status">Opening Appointments…</main>;

  return <DraftSafety.Provider value={(_key, dirty) => setDraftDirty(dirty)}>
    <main className="clinicWorkspaceCanvas appointmentsCanvas" data-dental-os-app="company.dental.appointments">
      <header className="appointmentsHeader">
        <div><span className="appointmentsEyebrow">Clinic diary</span><h1>Appointments</h1><p>Keep the day moving with a clear, doctor-aware schedule.</p></div>
        <div className="appointmentsHeaderActions"><button className="btn btn-secondary" type="button" onClick={() => void refresh()} disabled={loading}><RefreshCw size={16} aria-hidden="true" /> Refresh</button><button className="btn btn-primary" type="button" onClick={() => setForm({ date: bucket === 'day' ? date : clinicDate })} disabled={!!pending || !doctors.length}><Plus size={17} aria-hidden="true" /> Book appointment</button></div>
      </header>

      {(error || referenceError || summaryError || writeError || pending) && <section className={`appointmentAlert ${pending ? 'appointmentAlertPending' : ''}`} role={pending || writeError || error ? 'alert' : 'status'}>
        <div><strong>{pending ? 'Save needs confirmation' : writeError ? 'Appointment not confirmed' : 'Some schedule details are unavailable'}</strong>
          <p>{pending ? 'Keep this original request and check its receipt before making another change.' : writeError || error || referenceError || summaryError}</p></div>
        {pending ? <button className="btn btn-secondary" type="button" onClick={() => void retryOriginal()}>Check original save</button>
          : <button className="btn btn-secondary" type="button" onClick={() => void retryRefresh()}>Retry refresh</button>}
      </section>}

      <section className="appointmentSummary" aria-label="Appointment summary">
        {choices.map(choice => <button className={`appointmentSummaryCard ${bucket === choice.bucket ? 'selected' : ''}`} key={choice.value} type="button" onClick={() => setBucket(choice.bucket)} aria-pressed={bucket === choice.bucket}>
          <span>{choice.label}</span><strong>{choice.count}</strong><small>{choice.value === 'todayBooked' ? 'slots still reserved today' : choice.value === 'thisWeekBooked' ? 'remaining through Saturday' : choice.value === 'upcomingBooked' ? 'after this week' : 'future slots released'}</small>
        </button>)}
      </section>

      <section className="appointmentToolbar" aria-label="Schedule filters">
        <div className="appointmentRange" role="group" aria-label="Appointment range">
          <button className={bucket === 'day' ? 'active' : ''} type="button" onClick={() => setBucket('day')} aria-pressed={bucket === 'day'}><CalendarDays size={15} aria-hidden="true" /> Day</button>
          {(['today', 'week', 'upcoming', 'cancelled'] as const).map(value => <button className={bucket === value ? 'active' : ''} key={value} type="button" onClick={() => setBucket(value)} aria-pressed={bucket === value}>{bucketLabels[value]}</button>)}
        </div>
        {bucket === 'day' && <label className="appointmentDateFilter"><span>Date</span><DatePicker id="schedule-date" value={date} onChange={setDate} /></label>}
        <label className="appointmentDoctorFilter"><span>Doctor</span><select value={doctorFilter} onChange={event => setDoctorFilter(event.target.value)}><option value="">All active doctors</option>{doctors.map(doctor => <option key={doctor.staffId} value={doctor.fullName}>{doctor.fullName}</option>)}</select><ChevronDown size={15} aria-hidden="true" /></label>
      </section>

      <section className="appointmentListPanel" aria-labelledby="schedule-heading">
        <div className="appointmentListHeading"><div><h2 id="schedule-heading">{bucket === 'day' ? 'Day schedule' : bucketLabels[bucket]}</h2><p>{bucket === 'day' ? date : `Clinic day ${clinicDate}`}</p></div>{loading && <span role="status" className="appointmentLoading"><span className="appointmentsSpinner" /> Updating schedule…</span>}</div>
        {appointments.length === 0 && !loading ? <div className="appointmentEmpty"><CalendarDays size={24} aria-hidden="true" /><strong>No appointments in this range</strong><span>Bookings for this clinic and filter will appear here.</span></div> : <div className="appointmentTableWrap"><table className="appointmentTable"><thead><tr><th scope="col">Time</th><th scope="col">Name and contact</th><th scope="col">Doctor</th><th scope="col">Reason</th><th scope="col">Status</th><th scope="col"><span className="visuallyHidden">Actions</span></th></tr></thead><tbody>
          {appointments.map(item => <tr key={item.appointmentId}>
            <td data-label="Time"><strong>{minuteLabel(item.startMinute)}</strong><span>{item.durationMinutes} min{bucket !== 'day' ? ` · ${item.appointmentDate}` : ''}</span></td>
            <td data-label="Name and contact"><strong>{item.patientName}</strong><span>{item.contactPhone || 'No contact added'}</span></td>
            <td data-label="Doctor">{item.doctorName}</td><td data-label="Reason">{item.reason}</td>
            <td data-label="Status"><span className={`appointmentStatus status-${item.status}`}>{statusLabels[item.status]}</span></td>
            <td data-label="Actions" className="appointmentRowActions"><button type="button" className="appointmentTextButton" onClick={() => setForm({ appointment: item, date: item.appointmentDate })} disabled={pending !== null || item.status === 'cancelled' || item.status === 'no_show'}>Reschedule</button><select aria-label={`Set ${item.patientName} appointment status`} value={item.status} onChange={event => updateStatus(item, event.target.value as AppointmentStatus)} disabled={pending !== null}><option value="booked">Booked</option><option value="arrived">Arrived</option><option value="cancelled">Cancelled</option><option value="no_show">No-show</option></select></td>
          </tr>)}
        </tbody></table></div>}
      </section>
      <footer className="appointmentAuthority"><Stethoscope size={16} aria-hidden="true" /><span>The clinic server validates booking conflicts and confirms every change.</span><Clock3 size={15} aria-hidden="true" /><span>Dates follow the clinic timezone.</span></footer>
      {notice && <p className="appointmentNotice" role="status">{notice}</p>}
      {form && <AppointmentForm seed={form} doctors={doctors} rows={appointments} onSave={save} onClose={() => { setForm(null); setDraftDirty(false); }} pending={pending} onRetry={() => void retryOriginal()} />}
    </main>
  </DraftSafety.Provider>;
}

createRoot(document.getElementById('root')!).render(<AppointmentsApp />);
