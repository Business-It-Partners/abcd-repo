"use client";

import { useEffect, useMemo, useState } from "react";
import { useDraftSafety } from '@/draftSafety';
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  AlertTriangle,
  Check,
  CalendarCheck,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  Loader2,
  Phone,
  Plus,
  Stethoscope,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import TimePicker from "@/shared/dates/TimePicker";
import {
  todayLabel,
  todayISO,
  formatDateShort,
  formatTime12,
  addDaysISO,
  dueLabelFor,
  telLink,
  type FollowUp,
} from "@/features/patients/model/domain";
import {
  StatTile,
  TileGrid,
  Page,
  PageHeader,
  SearchBox,
  Field,
  EmptyState,
  DataTable,
  Modal,
  ModalBody,
  ModalError,
} from "@/shared/ui/workspace-primitives";
import { usePagedFollowUps } from "@/features/follow-ups/usePagedFollowUps";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import { useClinicPageLoading } from "@/shared/ui/ClinicLoadingOverlay";
import { useBodyScrollLock } from "@/shared/ui/bodyScrollLock";
import { useClinicRouteState } from "@/shell/routing/useClinicRouteState";
import { useClinicPageRefresh } from "@/shared/ui/ClinicPageRefresh";
import type { FollowUpCreateInput, PatientSummary } from "@/features/patients/types";
import CreateFollowUpModal, { type FollowUpDoctorOption } from "./CreateFollowUpModal";

// The four DATE buckets — the live workload, one axis, mutually exclusive, summing cleanly. Each
// worklist row is a patient's current recall bucketed by its due date. See
// FOLLOWUP_RECALL_UPGRADE_PLAN.md.
type Bucket = "today" | "week" | "upcoming" | "missed";

const DATE_TILES: { key: Bucket; label: string; hint: string; Icon: LucideIcon }[] = [
  { key: "today", label: "Due today", hint: "to follow up today", Icon: CalendarClock },
  { key: "week", label: "This week", hint: "remaining till Saturday", Icon: CalendarDays },
  { key: "upcoming", label: "Upcoming", hint: "after this week", Icon: CalendarRange },
  { key: "missed", label: "Missed", hint: "window passed", Icon: AlertTriangle },
];

// Tone per bucket — drives the tile's icon chip, number colour and active ring. Kept as a JS map
// rather than CSS custom properties: the tiles have no primitive equivalent, so they stay a
// bespoke widget, but the view must not depend on a *.module.css file.
const TILE_TONE: Record<Bucket, { tone: string; toneBg: string; toneNum: string }> = {
  today: { tone: "#d9922a", toneBg: "#fbf0da", toneNum: "#b9791f" },
  week: { tone: "var(--acc)", toneBg: "var(--acc-soft, #ede9fe)", toneNum: "var(--acc)" },
  upcoming: { tone: "#3f8ad1", toneBg: "#e6eef7", toneNum: "#2969b0" },
  missed: { tone: "#d1493f", toneBg: "#fbe6e3", toneNum: "#c0392b" },
};

// Local phone numbers are all Nepal (+977) — drop the prefix so the table reads cleaner.
function localPhone(phone: string): string {
  return phone.replace(/^\+977\s*/, "");
}

// The ‹ / › day-step buttons — mirrors the Appointments book's day nav.
const dayNavBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "38px",
  height: "40px",
  borderRadius: "11px",
  border: "1px solid var(--line-strong)",
  background: "var(--surface)",
  color: "var(--ink-2)",
  cursor: "pointer",
};

// A square check cell like the Lab Tracker's status boxes — click to toggle.
function CheckBox({
  on,
  color,
  title,
  pending = false,
  disabled = false,
  onClick,
}: {
  on: boolean;
  color: string;
  title: string;
  pending?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      data-checkbox-control
      data-checkbox-visual="square"
      data-loading-message="Updating follow-up…"
      title={pending ? "Saving…" : disabled ? "Already recorded" : title}
      onClick={onClick}
      disabled={pending || disabled}
      aria-pressed={on}
      aria-busy={pending || undefined}
      style={{
        "--checkbox-color": color,
        width: "22px",
        height: "22px",
        borderRadius: "6px",
        display: "inline-grid",
        placeItems: "center",
        cursor: pending ? "wait" : disabled ? "not-allowed" : "pointer",
        border: `1.5px solid ${on ? color : "#6b7688"}`,
        background: on ? color : "#fff",
        opacity: pending || disabled ? 0.72 : 1,
        transition: "background .12s ease, border-color .12s ease, opacity .12s ease",
      } as React.CSSProperties}
    >
      {on && <Check size={14} strokeWidth={3} style={{ color: "#fff" }} />}
    </button>
  );
}

// The static, read-only twin of CheckBox — for a caught row, whose ticks are a record of what was
// done, not a control. Muted so it reads as "past", not "click me".
function readonlyMark(on: boolean, color: string) {
  return (
    <span
      style={{
        width: "22px",
        height: "22px",
        borderRadius: "6px",
        display: "inline-grid",
        placeItems: "center",
        border: `1.5px solid ${on ? color : "#e2e8f0"}`,
        background: on ? color : "#fff",
      }}
    >
      {on && <Check size={13} strokeWidth={3} style={{ color: "#fff" }} />}
    </span>
  );
}

const DUE_CHIP: Record<FollowUp["status"], { bg: string; text: string; border: string }> = {
  overdue: { bg: "#fef2f2", text: "#dc2626", border: "#fecaca" },
  "due-today": { bg: "var(--acc-soft, #ede9fe)", text: "var(--acc, #7c3aed)", border: "var(--acc-border, #ddd4fa)" },
  upcoming: { bg: "#f1f5f9", text: "#1e293b", border: "#e2e8f0" },
};

interface FollowUpsViewProps {
  doctors: FollowUpDoctorOption[];
  writeState: 'none' | 'saving' | 'unknown';
  onReconcile: () => Promise<void>;
  onCreate: (input: FollowUpCreateInput) => Promise<void>;
  onSearchPatients: (query: string) => Promise<PatientSummary[]>;
  /** Edit a pending recall's schedule and purpose through the audited Worker command. */
  onReschedule: (followUpId: string, expectedRowVersion: number, newDateISO: string, newTime: string | undefined, reason: string) => Promise<{ rowVersion: number }>;
  onToggle: (followUpId: string, expectedRowVersion: number, field: "called" | "no_answer" | "caught", checked: boolean) => Promise<void>;
}

function FollowUpDetailsModal({ followUp, onClose }: { followUp: FollowUp; onClose: () => void }) {
  const initials = followUp.patient
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((name) => name[0]?.toUpperCase())
    .join("") || "P";
  const sectionLabel: React.CSSProperties = {
    display: "block",
    marginBottom: "9px",
    color: "var(--ink-3)",
    fontSize: "11px",
    fontWeight: "var(--fw-bold)",
    letterSpacing: ".065em",
    textTransform: "uppercase",
  };
  const contextCard: React.CSSProperties = {
    minWidth: 0,
    padding: "13px",
    border: "1px solid var(--line)",
    borderRadius: "11px",
    background: "#fafcff",
  };
  return (
    <Modal title={<><CalendarClock size={18} style={{ color: "#7c3aed" }} /> Follow-up details</>} onClose={onClose} maxWidth={540}>
      <ModalBody>
        <div style={{ display: "grid", gap: "19px" }}>
          <section aria-labelledby="follow-up-patient-heading">
            <span style={sectionLabel}>Patient</span>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "14px", border: "1px solid #ddd4fa", borderRadius: "12px", background: "linear-gradient(135deg, #faf8ff, #f7fbff)" }}>
              <span aria-hidden="true" style={{ display: "grid", width: "42px", height: "42px", flex: "0 0 auto", placeItems: "center", borderRadius: "50%", background: "#7c3aed", color: "#fff", fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)" }}>{initials}</span>
              <div style={{ minWidth: 0, display: "grid", gap: "3px" }}>
                <h4 id="follow-up-patient-heading" style={{ margin: 0, overflow: "hidden", color: "var(--ink-1)", fontSize: "var(--fs-16)", fontWeight: "var(--fw-bold)", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{followUp.patient}</h4>
                <a href={telLink(followUp.phone)} style={{ display: "inline-flex", alignItems: "center", gap: "5px", width: "fit-content", color: "var(--acc)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", textDecoration: "none" }}><Phone size={13} />{localPhone(followUp.phone)}</a>
              </div>
            </div>
          </section>

          <section aria-labelledby="follow-up-schedule-heading">
            <span id="follow-up-schedule-heading" style={sectionLabel}>Follow-up schedule</span>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", margin: 0 }}>
              <div style={contextCard}>
                <dt style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-3)", fontSize: "var(--fs-12)" }}><CalendarDays size={14} /> Due date</dt>
                <dd style={{ margin: "7px 0 0", color: "var(--ink-1)", fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)" }}>{formatDateShort(followUp.dueDate)}</dd>
              </div>
              <div style={contextCard}>
                <dt style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-3)", fontSize: "var(--fs-12)" }}><Clock3 size={14} /> Preferred time</dt>
                <dd style={{ margin: "7px 0 0", color: "var(--ink-1)", fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)" }}>{followUp.time ? formatTime12(followUp.time) : "No time set"}</dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="follow-up-reason-heading">
            <span id="follow-up-reason-heading" style={sectionLabel}>Recall reason</span>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "10px", padding: "13px 14px", borderLeft: "3px solid #7c3aed", borderRadius: "0 10px 10px 0", background: "#faf8ff" }}>
              <ClipboardList size={18} style={{ flex: "0 0 auto", marginTop: "1px", color: "#7c3aed" }} />
              <p style={{ margin: 0, color: "var(--ink-1)", fontSize: "var(--fs-14)", fontWeight: "var(--fw-medium)", lineHeight: 1.5 }}>{followUp.reason || "No follow-up reason was recorded."}</p>
            </div>
          </section>

          <section aria-labelledby="follow-up-care-heading">
            <span id="follow-up-care-heading" style={sectionLabel}>Care context</span>
            <dl style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px", margin: 0 }}>
              <div style={contextCard}>
                <dt style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-3)", fontSize: "var(--fs-12)" }}><Stethoscope size={14} /> Doctor</dt>
                <dd style={{ margin: "7px 0 0", color: "var(--ink-1)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", lineHeight: 1.4 }}>{followUp.doctor || "Not recorded"}</dd>
              </div>
              <div style={contextCard}>
                <dt style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--ink-3)", fontSize: "var(--fs-12)" }}><UserRound size={14} /> Last visit</dt>
                <dd style={{ margin: "7px 0 0", color: "var(--ink-1)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", lineHeight: 1.4 }}>{followUp.lastVisit || "Not recorded"}</dd>
              </div>
            </dl>
          </section>
        </div>
      </ModalBody>
    </Modal>
  );
}

// Confirms the new date back to the desk after a reschedule LANDS. A recall that silently moves is
// one the desk has to re-open the record to verify, so the acknowledgement is explicit — it names
// the patient, because the worklist is a list of many, and it holds until dismissed.
function RescheduledDialog({
  patient,
  date,
  onClose,
}: {
  patient: string;
  date: string;
  onClose: () => void;
}) {
  useBodyScrollLock();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(28,27,46,0.42)", backdropFilter: "blur(3px)" }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Follow-up rescheduled"
        style={{
          position: "fixed",
          zIndex: 501,
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "min(420px, calc(100vw - 40px))",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          boxShadow: "0 24px 60px rgba(28,27,46,0.28)",
          padding: "26px 26px 22px",
          textAlign: "center",
        }}
      >
        <span
          style={{
            display: "inline-grid",
            placeItems: "center",
            width: "52px",
            height: "52px",
            borderRadius: "50%",
            background: "#f2fbf6",
            border: "1px solid #bbf7d0",
            color: "#15803d",
            marginBottom: "14px",
          }}
        >
          <CalendarCheck size={26} />
        </span>
        <h2 style={{ fontSize: "var(--fs-17)", fontWeight: "var(--fw-bold)", color: "var(--ink-1)", margin: "0 0 8px" }}>
          Follow-up rescheduled
        </h2>
        <p style={{ fontSize: "var(--fs-14)", color: "var(--ink-1)", lineHeight: 1.55, margin: 0 }}>
          {patient}&rsquo;s follow-up has been moved to{" "}
          <strong style={{ color: "var(--ink-1)", whiteSpace: "nowrap" }}>{date}</strong>.
        </p>

        <button
          type="button"
          autoFocus
          onClick={onClose}
          className="btn btn-primary btn-block"
          style={{ marginTop: "22px" }}
        >
          OK
        </button>
      </div>
    </>
  );
}

function RescheduleModal({
  followUp,
  onConfirm,
  onClose,
  writeState,
  onReconcile,
}: {
  followUp: FollowUp;
  onConfirm: (dateISO: string, time: string | undefined, reason: string) => Promise<void>;
  onClose: () => void;
  writeState: 'none' | 'saving' | 'unknown';
  onReconcile: () => Promise<void>;
}) {
  const [date, setDate] = useState(followUp.dueDate || "");
  const [time, setTime] = useState(followUp.time || "");
  const [reason, setReason] = useState(followUp.reason || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const safety = useDraftSafety('reschedule-follow-up', date !== followUp.dueDate || time !== (followUp.time || '') || reason !== (followUp.reason || ''), () => { if (!saving) onClose(); });
  const today = useMemo(() => todayISO(), []);

  const handleSave = async () => {
    if (!date || !reason.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      await onConfirm(date, time || undefined, reason.trim());
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The follow-up could not be rescheduled.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <><Modal
      title={<><CalendarClock size={18} style={{ color: "#7c3aed" }} /> Reschedule for {followUp.patient}</>}
      onClose={() => !saving && safety.close()}
      maxWidth={460}
    >
      <ModalBody>
        {error && <ModalError>{error}</ModalError>}
        {writeState === 'unknown' && <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', border: '1px solid #dfcaa0', borderRadius: '8px', background: '#fff9ed' }}>
          <span>The save may have completed. Check the original request before changing this schedule.</span>
          <button type="button" className="btn btn-secondary" onClick={() => { void onReconcile(); }}>Retry original save</button>
        </div>}
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
          <Field label="New Date *" htmlFor="reschedule-follow-up-date">
            <DatePicker id="reschedule-follow-up-date" value={date} onChange={setDate} min={today} disabled={saving} fluid />
          </Field>
          <Field label="New Time (Optional)" htmlFor="reschedule-follow-up-time">
            <TimePicker id="reschedule-follow-up-time" value={time} onChange={setTime} fluid />
          </Field>
          <Field label="Follow-up reason *" htmlFor="reschedule-follow-up-reason">
            <input id="reschedule-follow-up-reason" value={reason} onChange={(event) => setReason(event.target.value)} disabled={saving} maxLength={500} required />
          </Field>
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "24px" }}>
          <button type="button" onClick={safety.close} className="btn btn-secondary" disabled={saving}>
            Cancel
          </button>
          <button type="button" onClick={handleSave} className="btn btn-primary" disabled={!date || !reason.trim() || saving}>
            {saving ? "Saving..." : "Save follow-up"}
          </button>
        </div>
      </ModalBody>
    </Modal>{safety.confirmation}</>
  );
}

export default function FollowUpsView({
  doctors,
  writeState,
  onReconcile,
  onCreate,
  onSearchPatients,
  onReschedule,
  onToggle,
}: FollowUpsViewProps) {
  const today = todayISO();
  const { route, patch } = useClinicRouteState();
  const bucket = route.params.bucket === "week" || route.params.bucket === "upcoming" || route.params.bucket === "missed" ? route.params.bucket : "today";
  // Open on today's recall list and show that date in the picker. Choosing another range tile clears
  // the specific-day override; returning to Due today restores the concrete current date.
  const day = route.params.date ?? (bucket === "today" ? today : "");
  const search = route.params.search ?? "";
  // Set only once a reschedule has persisted — see the dialog's note.
  const [rescheduled, setRescheduled] = useState<{ patient: string; date: string } | null>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<FollowUp | null>(null);
  const [detailTarget, setDetailTarget] = useState<FollowUp | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queue = usePagedFollowUps({ bucket, selectedDate: day || undefined, today, pageSize: 10 });
  useClinicPageLoading("Follow-ups", queue.loading);
  useClinicPageRefresh(useMemo(() => ({
    key: `follow-ups:${bucket}:${day}`,
    label: "Follow-ups",
    refresh: queue.reload,
    successMessage: "Follow-ups are up to date.",
    busy: queue.loading,
    placement: "page-action" as const,
  }), [bucket, day, queue.loading, queue.reload]));
  const { showToast, showError } = useSnackbar();
  // Follow-up actions are independent commands. Keep an individual row disabled while its command
  // is in flight so a single desk action cannot be sent twice.
  const [savingFollowUpIds, setSavingFollowUpIds] = useState<Set<string>>(() => new Set());

  const patchAttempt = async (
    followUp: FollowUp,
    patch: Partial<FollowUp>,
    persist: () => Promise<void>,
    successMessage: string,
    failureMessage: string,
  ) => {
    if (savingFollowUpIds.has(followUp.id)) return;
    setSavingFollowUpIds((current) => new Set(current).add(followUp.id));
    // Render the intended result first. The visible row is never replaced just because this small
    // field is being saved; a rejected write restores the exact previous state below.
    queue.patchFollowUp(followUp.id, { ...patch, rowVersion: followUp.rowVersion + 1 });
    try {
      await persist();
      await queue.reload();
      showToast(successMessage);
    } catch (cause) {
      queue.patchFollowUp(followUp.id, followUp);
      if (cause && typeof cause === 'object' && 'code' in cause && cause.code === 'CONFLICT') await queue.reload();
      showError(cause instanceof Error ? cause.message : failureMessage);
    } finally {
      setSavingFollowUpIds((current) => {
        const next = new Set(current);
        next.delete(followUp.id);
        return next;
      });
    }
  };

  const dayActive = day !== "";

  // Search narrows only the already-bounded queue. A global name/phone search belongs to the
  // Patient Record screen, where it has its own indexed query; it must not silently turn this
  // ten-row operational queue back into a full patient download.
  const term = search.trim().toLowerCase();
  const digits = search.replace(/\D/g, "");
  const passesToolbar = (f: FollowUp): boolean => {
    if (!term) return true;
    if (f.patient.toLowerCase().includes(term)) return true;
    return digits !== "" && f.phone.replace(/\D/g, "").includes(digits);
  };

  const counts: Record<Bucket, number> = queue.counts ?? { today: 0, week: 0, upcoming: 0, missed: 0 };
  const rows = queue.followUps.filter(passesToolbar);

  const emptyText = dayActive
    ? `No follow-ups due on ${formatDateShort(day)}.`
    : bucket === "missed"
    ? "No missed follow-ups — nothing has slipped."
    : "No follow-ups in this range.";

  return (
    <Page sheet>
      <PageHeader title="Follow-ups" subtitle={`${todayLabel()} · patient recall tracker`}>
        <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
          <Plus size={16} /> Create follow-up
        </button>
      </PageHeader>

      <TileGrid>
        {DATE_TILES.map((t) => (
          <StatTile
            key={t.key}
            value={counts[t.key]}
            label={t.label}
            hint={t.hint}
            icon={<t.Icon size={16} strokeWidth={2} />}
            active={(t.key === "today" && day === today) || (!dayActive && bucket === t.key)}
            tone={TILE_TONE[t.key]}
            onClick={() => {
              patch({ bucket: t.key === "today" ? null : t.key, date: t.key === "today" ? today : null });
            }}
          />
        ))}
      </TileGrid>

      {/* Ten columns. Below 1080px the wrapper scrolls sideways rather than wrapping every cell
          onto two lines, which would cost more height than the scrollbar costs dignity. */}
      <DataTable<FollowUp>
        rows={rows}
        rowKey={(f) => f.id}
        noun="follow-ups"
        pageSize={10}
        minWidth={1080}
        loading={queue.loading}
        loadingLabel="Loading follow-ups…"
        error={queue.loadError}
        errorHint="Check the connection, then select the range again."
        filters={
          <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", flexWrap: "wrap" }}>
            <SearchBox
              placeholder="Search patient or phone…"
              value={search}
              onChange={(e) => patch({ search: e.target.value || null })}
            />

            <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", marginLeft: "auto" }}>
              <button type="button" aria-label="Previous day" onClick={() => patch({ date: addDaysISO(day || today, -1) })} style={dayNavBtn}>
                <ChevronLeft size={16} />
              </button>
              <DatePicker value={day} onChange={(date) => patch({ date: date || null })} placeholder="Pick a day" />
              <button type="button" aria-label="Next day" onClick={() => patch({ date: addDaysISO(day || today, 1) })} style={dayNavBtn}>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        }
        empty={(
          <EmptyState
            icon={<CalendarCheck size={28} />}
            message={dayActive && day === today ? "Today’s recall list is clear" : "No follow-ups in this view"}
            hint={emptyText}
          >
            {search ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => patch({ search: null })}>Clear search</button>
            ) : day !== today ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => patch({ bucket: null, date: today })}>Return to today</button>
            ) : null}
          </EmptyState>
        )}
        columns={[
          {
            key: "sn",
            header: "#",
            align: "center",
            width: 40,
            render: (_f, i) => (
              <span style={{ color: "var(--ink-3)", fontWeight: "var(--fw-medium)" }}>{i + 1}</span>
            ),
          },
          {
            key: "patient",
            header: "Patient",
            sortable: true,
            value: (f) => f.patient,
            render: (f) => (
              <span
                onClick={() => setDetailTarget(f)}
                style={{ fontWeight: "var(--fw-bold)", color: "var(--ink-1)", cursor: "pointer" }}
              >
                {f.patient}
              </span>
            ),
          },
          {
            key: "due",
            header: "Due",
            sortable: true,
            value: (f) => f.dueDate,
            render: (f) => {
              // The Due column is about the schedule, not whether the desk has already
              // contacted the patient. Keep a future/today recall immediately actionable
              // with its countdown; show the calendar date only after that due day has gone.
              const dueDateHasPassed = f.dueDate < today;
              const chip = DUE_CHIP[f.status];
              return dueDateHasPassed ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-1)", whiteSpace: "nowrap" }}>
                    {formatDateShort(f.dueDate)}
                  </span>
                  {f.time && (
                    <span style={{ fontSize: "var(--fs-12)", color: "var(--ink-3)" }}>
                      {formatTime12(f.time)}
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "var(--fs-12)",
                      fontWeight: "var(--fw-medium)",
                      padding: "3px 9px",
                      borderRadius: "var(--r-pill)",
                      whiteSpace: "nowrap",
                      background: chip.bg,
                      color: chip.text,
                      border: `1px solid ${chip.border}`,
                      width: "fit-content",
                    }}
                  >
                    {f.dueLabel}
                  </span>
                  {f.time && (
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "var(--ink-3)" }}>
                      {formatTime12(f.time)}
                    </span>
                  )}
                </div>
              );
            },
          },
          {
            key: "doctor",
            header: "Doctor",
            sortable: true,
            value: (f) => f.doctor,
            render: (f) => <span style={{ color: "var(--ink-1)" }}>{f.doctor}</span>,
          },
          {
            key: "lastVisit",
            header: "Last visit",
            nowrap: true,
            render: (f) => <span style={{ color: "var(--ink-1)" }}>{f.lastVisit}</span>,
          },
          {
            key: "phone",
            header: "Phone",
            nowrap: true,
            render: (f) => (
              <a
                href={telLink(f.phone)}
                style={{ color: "var(--ink-2)", fontWeight: "var(--fw-medium)", textDecoration: "none" }}
              >
                {localPhone(f.phone)}
              </a>
            ),
          },
          {
            key: "call",
            header: "Call",
            align: "center",
            render: (f) =>
              f.active || f.caught ? (
                <CheckBox
                  on={f.called}
                  color="var(--acc, #7c3aed)"
                  title={f.called ? "Unmark called" : "Mark as called"}
                  pending={savingFollowUpIds.has(f.id)}
                  onClick={() => void patchAttempt(
                    f,
                    { called: !f.called },
                    () => onToggle(f.id, f.rowVersion ?? 1, "called", !f.called),
                    f.called ? "Call mark removed" : "Call marked",
                    "Could not update the call status. Try again.",
                  )}
                />
              ) : (
                readonlyMark(f.called, "var(--acc, #7c3aed)")
              ),
          },
          {
            key: "noAnswer",
            header: "Un-response",
            align: "center",
            render: (f) =>
              f.active || f.caught ? (
                <CheckBox
                  on={f.noAnswer}
                  color="#d97706"
                  title={f.noAnswer ? "Remove no-response mark" : "Mark as no response"}
                  pending={savingFollowUpIds.has(f.id)}
                  onClick={() => void patchAttempt(
                    f,
                    { noAnswer: !f.noAnswer },
                    () => onToggle(f.id, f.rowVersion ?? 1, "no_answer", !f.noAnswer),
                    f.noAnswer ? "No-response mark removed" : "No response marked",
                    "Could not update the no-response status. Try again.",
                  )}
                />
              ) : (
                readonlyMark(f.noAnswer, "#d97706")
              ),
          },
          {
            key: "caught",
            header: "Caught",
            align: "center",
            render: (f) =>
              f.active || f.caught ? (
                <CheckBox
                  on={f.caught}
                  color="#16a34a"
                  title={f.caught ? "Reopen follow-up" : "Mark as caught"}
                  pending={savingFollowUpIds.has(f.id)}
                  onClick={() => void patchAttempt(
                    f,
                    { active: f.caught, caught: !f.caught },
                    () => onToggle(f.id, f.rowVersion ?? 1, "caught", !f.caught),
                    f.caught ? "Follow-up reopened" : "Follow-up marked as caught",
                    "Could not update the caught status. Try again.",
                  )}
                />
              ) : (
                readonlyMark(f.caught, "#16a34a")
              ),
          },
          {
            key: "action",
            header: "Action",
            align: "center",
            render: (f) => {
              return (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "92px 72px",
                    alignItems: "center",
                    gap: "6px",
                    width: "170px",
                    margin: "0 auto",
                    padding: "2px 0",
                  }}
                >
                    {f.active ? (
                      <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      style={{ minHeight: "26px", padding: "4px 10px", borderRadius: "2px", fontSize: "var(--fs-12)", justifyContent: "center" }}
                      onClick={() => setRescheduleTarget(f)}
                    >
                      Reschedule
                    </button>
                    ) : <span aria-hidden="true" />}
                    <button
                      type="button"
                      onClick={() => setDetailTarget(f)}
                      className="btn btn-primary btn-sm"
                      style={{ minHeight: "26px", padding: "4px 10px", borderRadius: "2px", fontSize: "var(--fs-12)", justifyContent: "center" }}
                    >
                      Details
                    </button>
                </div>
              );
            },
          },
        ]}
      />

      {queue.hasMore && !search && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: "var(--sp-3)" }}>
          <button type="button" className="btn btn-secondary" disabled={queue.loadingMore} onClick={() => void queue.loadMore()}>
            {queue.loadingMore ? <><Loader2 size={15} style={{ animation: "spin .8s linear infinite" }} /> Loading…</> : "Load 10 more"}
          </button>
        </div>
      )}

      {rescheduleTarget && (
        <RescheduleModal
          followUp={rescheduleTarget}
          writeState={writeState}
          onReconcile={onReconcile}
          onClose={() => setRescheduleTarget(null)}
          onConfirm={async (newDateISO, newTime, reason) => {
            const saved = await onReschedule(rescheduleTarget.id, rescheduleTarget.rowVersion ?? 1, newDateISO, newTime, reason);
            const remainingDays = Math.round((Date.parse(`${newDateISO}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
            queue.patchFollowUp(rescheduleTarget.id, {
              dueDate: newDateISO,
              dueLabel: dueLabelFor(remainingDays),
              time: newTime,
              reason,
              called: false,
              noAnswer: false,
              active: true,
              caught: false,
              rowVersion: saved.rowVersion,
            });
            setRescheduled({
              patient: rescheduleTarget.patient,
              date: `${formatDateShort(newDateISO)}${newTime ? ` at ${formatTime12(newTime)}` : ""}`,
            });
            setRescheduleTarget(null);
          }}
        />
      )}

      {rescheduled && (
        <RescheduledDialog
          patient={rescheduled.patient}
          date={rescheduled.date}
          onClose={() => setRescheduled(null)}
        />
      )}

      {detailTarget && <FollowUpDetailsModal followUp={detailTarget} onClose={() => setDetailTarget(null)} />}

      {createOpen && (
        <CreateFollowUpModal
          doctors={doctors}
          today={today}
          writeState={writeState}
          onReconcile={onReconcile}
          onClose={() => setCreateOpen(false)}
          onSearchPatients={onSearchPatients}
          onSubmit={async (input) => {
            await onCreate(input);
            await queue.reload();
            patch({ bucket: null, date: input.dueOn, search: null });
            setCreateOpen(false);
            showToast("Follow-up scheduled.");
          }}
        />
      )}
    </Page>
  );
}
