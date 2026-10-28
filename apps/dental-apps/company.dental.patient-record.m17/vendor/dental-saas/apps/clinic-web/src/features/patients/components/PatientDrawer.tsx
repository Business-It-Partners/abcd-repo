"use client";

import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { useClinicRole } from "@/shell/session/ClinicRoleContext";
import styles from "@/features/patients/patient-record.module.css";
import {
  Clock,
  Activity,
  FileText,
  Image as ImageIcon,
  Pill,
  User,
  BellRing,
  WalletCards,
  FlaskConical,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Ban,
  MapPin,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { type CanalChartData } from "@/features/work-entry/model/canalData";
import { type PlanAppendDraft } from "@/features/work-entry/model/draftTypes";
import {
  displayToISO,
  formatDateShort,
  type PatientDetail,
  type LabSupplier,
  type Visit,
  type FollowUp,
  type ProcedureCatalogItem,
} from "@/features/patients/model/domain";
import {
  type XrayImage,
  type XrayDraft,
  type ToothPerioData,
} from "@/features/work-entry/model/chartData";
import RadiographUploader from "@/features/patients/media/RadiographUploader";
import { type Case, type CaseOutcome, type TreatmentProtocol, type FeeScheduleItem } from "@/features/work-entry/model/caseData";
import XRayGallery from "./XRayGallery";
import { type LabOrder } from "@/features/patients/model/domain";
import type { FollowUpCreateInput, OdontogramMark, PatientCanalMeasurement, PatientLedger, PatientFollowUp as WorkerPatientFollowUp, PatientNote, PatientPaymentInput, PatientPrescription, PatientTimelineEvent, PatientTreatmentPlan } from "@/features/patients/types";
import { doctorAccent } from "@/features/patients/model/doctorAccent";
import PatientLabTab from "./PatientLabTab";
import PatientProfileTab from "./PatientProfileTab";
import PatientNotesTab from "./PatientNotesTab";
import CanalDrawer from "@/features/work-entry/components/CanalDrawer";
import PeriodontalChart from "@/features/work-entry/components/PeriodontalChart";
import { Card, CardHeader, CardBody, DataTable, RowActions, EmptyState, Field, Input, Select, Textarea, Modal, ModalBody, ModalError } from "@/shared/ui/workspace-primitives";
import { handleSandboxedFormSubmitClick, handleSandboxedFormSubmitKeyDown } from "@/shared/ui/workspace-primitives/sandboxedFormSubmit";
import { handleFormKeyboardFocus, handleFormKeyboardPointerDown } from "@/shared/ui/workspace-primitives/formKeyboardNavigation";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import { useClinicRouteState } from "@/shell/routing/useClinicRouteState";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import TimePicker from "@/shared/dates/TimePicker";
import { CaseStatusUpdateModal, type CaseStatusValue } from "@/features/work-entry/CaseStatusUpdateModal";
import type { LabOrderAssignmentInput } from "@/features/labs/types";

type TabKey = "profile" | "cases" | "notes" | "timeline" | "periodontal" | "plan" | "lab" | "xrays" | "prescriptions" | "followups" | "ledger";
type VisitWithTreatmentId = Visit & { treatmentId?: string };

/** Group the expanded procedure rows back into their one clinical encounter. */
function groupTimelineDays(visits: Visit[]): Array<{ key: string; date: string; visits: Visit[] }> {
  const days: Array<{ key: string; date: string; visits: Visit[] }> = [];
  const byVisitId = new Map<string, Visit[]>();
  for (const visit of visits) {
    const key = visit.visitId ?? `legacy:${visit.date}`;
    if (!byVisitId.has(key)) {
      byVisitId.set(key, []);
      days.push({ key, date: visit.date, visits: byVisitId.get(key)! });
    }
    byVisitId.get(key)!.push(visit);
  }
  return days.sort((a, b) => (displayToISO(b.date) ?? "").localeCompare(displayToISO(a.date) ?? ""));
}

// Tint a visit by whoever performed it — see doctorAccent. Stable per doctor, no hardcoded roster.

interface PatientDrawerProps {
  selectedPatient: PatientDetail;
  clinicName: string;
  isClosing: boolean;
  onClose: () => void;
  /** Hide the legacy in-content Back control when the host window owns page navigation. */
  showBackButton?: boolean;
  /** Let the Dental OS adapter load only the data required by the active section. */
  onSubTabChange?: (tab: TabKey) => void;
  patientCases?: Case[];
  /** This patient's lab orders, grouped by case in the Lab tab. */
  patientLabOrders: LabOrder[];
  labs?: LabSupplier[];
  onUpdateOrder?: (id: string, patch: Partial<Omit<LabOrder, "id">>) => Promise<void>;
  onUpdateOrderStatus?: (orderId: string, newStatus: LabOrder["status"], paymentDate?: string) => Promise<void>;
  onAssignPendingLabOrder?: (orderId: string, input: Omit<LabOrderAssignmentInput, "expectedRowVersion">) => Promise<void>;
  onAddLabOrder?: (newOrder: Omit<LabOrder, "id">, commandId: string) => Promise<void> | void;
  onRemoveOrder?: (id: string, reason: string) => Promise<void> | void;
  onSetCaseOutcome?: (caseId: string, outcome: CaseOutcome) => void;
  onUpdateCase?: (caseId: string, patch: Partial<Case>) => Promise<void> | void;
  onAppendTrustedPlan?: (clinicalCase: Case, draft: PlanAppendDraft) => Promise<boolean>;
  patientXrays?: XrayImage[];
  patientXraysLoading?: boolean;
  /** Visible error state when the private image list cannot be loaded. */
  xrayLoadError?: string | null;
  onMediaChanged?: () => Promise<void> | void;
  onRemoveXray: (id: string, reason: string) => Promise<void>;
  /** The patient's CURRENT gum readings, merged one-per-tooth across all charting sessions. */
  currentPerio?: Record<string, ToothPerioData>;
  patientPeriodontalLoading?: boolean;
  patientPeriodontalError?: string | null;
  /** When the gums were last charted, for the "charted on" line. */
  lastPerioDate?: string;
  onSavePerioChart: (teeth: Record<string, ToothPerioData>) => Promise<void>;
  patientPrescriptions?: PatientPrescription[];
  patientPrescriptionsLoading?: boolean;
  patientPrescriptionsError?: string | null;
  onWithdrawPrescription?: (prescription: PatientPrescription, reason: string) => Promise<void>;
  onCorrectPrescription?: (prescription: PatientPrescription, items: PatientPrescription["items"], reason: string) => Promise<void>;
  patientNotes?: PatientNote[];
  patientNotesLoading?: boolean;
  patientNotesError?: string | null;
  onCreatePatientNote: (body: string) => Promise<PatientNote>;
  onWithdrawPatientNote: (patientNoteId: string, reason: string) => Promise<PatientNote>;
  patientTimeline?: PatientTimelineEvent[];
  patientTimelineLoading?: boolean;
  patientTimelineError?: string | null;
  onUpdatePatient?: (patientId: string, patch: Partial<PatientDetail>) => Promise<void> | void;
  followUpList: FollowUp[];
  doctorsList: string[];
  procedureCatalog: ProcedureCatalogItem[];
  protocols?: TreatmentProtocol[];
  feeSchedule?: FeeScheduleItem[];
  patientCanalMeasurements?: PatientCanalMeasurement[];
  onSaveCanalMeasurement?: (session: PatientCanalMeasurement, data: CanalChartData) => Promise<void>;
  patientLabLoading?: boolean;
  patientLabError?: string | null;
  patientCanalMeasurementsLoading?: boolean;
  patientCanalMeasurementsError?: string | null;
  canViewBillingLedger: boolean;
  /** Financial facts are loaded from the Worker and displayed read-only. */
  patientLedger?: PatientLedger | null;
  ledgerLoading?: boolean;
  ledgerError?: string | null;
  /** Retained at the adapter boundary while the ledger remains an all-time view. */
  ledgerMonth?: string;
  onLedgerMonthChange?: (month: string) => void;
  onCorrectLedgerEntry?: (entry: PatientLedger["entries"][number], amount: number, reason: string) => Promise<void>;
  onReverseLedgerEntry?: (entry: PatientLedger["entries"][number], reason: string) => Promise<void>;
  onRecordPatientPayment?: (input: Omit<PatientPaymentInput, "patientId">) => Promise<void>;
  patientCoreError?: string | null;
  patientCoreLoading?: boolean;
  patientFollowUps?: WorkerPatientFollowUp[];
  patientFollowUpsLoading?: boolean;
  patientFollowUpsError?: string | null;
  onCreatePatientFollowUp?: (input: Omit<FollowUpCreateInput, "patientId">) => Promise<WorkerPatientFollowUp>;
  patientTreatmentPlans?: PatientTreatmentPlan[];
  patientTreatmentPlansLoading?: boolean;
  patientTreatmentPlansError?: string | null;
  onUpdateCaseStatus?: (caseId: string, input: { patientId: string; expectedRowVersion: number; status: CaseStatusValue; reason: string | null }) => Promise<void>;
  patientOdontogram?: OdontogramMark[];
  patientOdontogramLoading?: boolean;
  patientOdontogramError?: string | null;
}

// The clinical timeline, grouped into episodes of care. Each case is headed by the complaint that
// opened it; visits fall under the case they belong to (Visit.caseId). Open case first, then most
// recent. Visits with no case — legacy rows or ad-hoc entries — collect in a trailing "Other" group.
export function TimelineByCase({ visits, cases, canalHistory, onAmendVisit, onRemoveVisit }: {
  visits: Visit[];
  cases: Case[];
  canalHistory?: CanalChartData[];
  onAmendVisit: (visitId: string, note: string, reason: string) => Promise<void>;
  onRemoveVisit: (visitId: string, reason: string) => Promise<void>;
}) {
  const casesById = new Map(cases.map((c) => [c.id, c]));
  const [activeTimelineIndex, setActiveTimelineIndex] = useState(0);

  // Clinical timeline displays clinical procedures; prescriptions belong in the Prescriptions tab.
  const clinicalVisits = (visits || []).filter((v) => !v.procedure?.toLowerCase().startsWith("prescribed:"));

  const order: string[] = [];
  const byKey = new Map<string, Visit[]>();
  for (const v of clinicalVisits) {
    const key = v.caseId && casesById.has(v.caseId) ? v.caseId : "__none__";
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(v);
  }

  const caseGroups = order
    .filter((k) => k !== "__none__")
    .map((k) => ({ key: k, c: casesById.get(k)!, visits: byKey.get(k)! }))
    .sort((a, b) => {
      const ao = a.c.status === "open" ? 0 : 1;
      const bo = b.c.status === "open" ? 0 : 1;
      if (ao !== bo) return ao - bo; // the live case leads
      return (displayToISO(b.c.createdDate) ?? "").localeCompare(displayToISO(a.c.createdDate) ?? "");
    });
  const noneVisits = byKey.get("__none__") ?? [];

  // Show one encounter at a time. A single encounter can contain several procedure rows, but it
  // must remain together so its treatment note, doctor(s), date and work are never split apart.
  const timelineEntries = [
    ...caseGroups.flatMap(({ key, c, visits: groupedVisits }) =>
      groupTimelineDays(groupedVisits).map((day) => ({
        ...day,
        key: `case:${key}:${day.key}`,
        clinicalCase: c,
      })),
    ),
    ...groupTimelineDays(noneVisits).map((day) => ({
      ...day,
      key: `other:${day.key}`,
      clinicalCase: null,
    })),
  ].sort((a, b) => (displayToISO(b.date) ?? "").localeCompare(displayToISO(a.date) ?? ""));

  useEffect(() => {
    setActiveTimelineIndex((current) => Math.min(Math.max(current, 0), Math.max(timelineEntries.length - 1, 0)));
  }, [timelineEntries.length]);

  if (timelineEntries.length === 0) {
    return (
      <Card>
        <CardHeader title={<><Clock size={16} /> Clinical History Timeline</>} />
        <CardBody>
          <EmptyState message="No visits recorded yet." />
        </CardBody>
      </Card>
    );
  }

  const activeEntry = timelineEntries[activeTimelineIndex] ?? timelineEntries[0];
  if (!activeEntry) return null;
  const activeCase = activeEntry.clinicalCase;
  const hasMultipleTimelineEntries = timelineEntries.length > 1;
  const isNewestTimelineEntry = activeTimelineIndex === 0;
  const isOldestTimelineEntry = activeTimelineIndex === timelineEntries.length - 1;
  const visitNavigator = (
    <div
      style={{
        display: "flex",
        justifyContent: "flex-end",
        alignItems: "center",
        minHeight: "44px",
        marginTop: "var(--sp-3)",
        paddingTop: "var(--sp-3)",
        borderTop: "1px solid var(--line)",
      }}
    >
      {hasMultipleTimelineEntries ? (
        <div style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveTimelineIndex((current) => Math.max(0, current - 1))}
            disabled={isNewestTimelineEntry}
            title={isNewestTimelineEntry ? "This is the newest recorded visit" : "Show the newer visit"}
            style={{ minWidth: "94px" }}
          >
            <ChevronLeft size={15} /> Newer
          </button>
          <span
            aria-live="polite"
            style={{ display: "flex", minWidth: "102px", flexDirection: "column", alignItems: "center", lineHeight: 1.15, fontVariantNumeric: "tabular-nums" }}
          >
            <strong style={{ fontSize: "var(--fs-12)", color: "var(--ink)" }}>Visit {activeTimelineIndex + 1} of {timelineEntries.length}</strong>
            <span style={{ marginTop: "2px", fontSize: "11px", color: "var(--ink-3)" }}>
              {isNewestTimelineEntry ? "Newest" : isOldestTimelineEntry ? "Oldest" : "Earlier visit"}
            </span>
          </span>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setActiveTimelineIndex((current) => Math.min(timelineEntries.length - 1, current + 1))}
            disabled={isOldestTimelineEntry}
            title={isOldestTimelineEntry ? "This is the oldest recorded visit" : "Show the older visit"}
            style={{ minWidth: "94px" }}
          >
            Older <ChevronRight size={15} />
          </button>
        </div>
      ) : (
        <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 10px", borderRadius: "999px", background: "#f1f5f9", color: "#475569", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)" }}>
          <Clock size={14} /> Only one visit recorded
        </span>
      )}
    </div>
  );

  return (
    <Card>
      <CardHeader
        title={
          activeCase ? (
            <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
              <Clock size={16} /> {activeCase.chiefComplaint?.trim() || activeCase.title}
            </span>
          ) : (
            <><Clock size={16} /> Other visit</>
          )
        }
      >
        {activeCase && <CaseStatusPill c={activeCase} />}
      </CardHeader>
      <CardBody>
        {!activeCase && (
          <p style={{ margin: "0 0 10px", fontSize: "var(--fs-12)", color: "#1c1b2e" }}>
            This visit is not linked to a treatment case.
          </p>
        )}
        <VisitDay
          key={activeEntry.key}
          date={activeEntry.date}
          visits={activeEntry.visits}
          canalHistory={canalHistory}
          onAmendVisit={onAmendVisit}
          onRemoveVisit={onRemoveVisit}
        />
        {visitNavigator}
      </CardBody>
    </Card>
  );
}

// A case's Open/Completed pill — kept bespoke rather than <Chip>: "Open" is a fixed blue with no
// match among Chip's five tones (neutral/ok/warn/danger/accent), and remapping it to the theme
// accent would recolour it purple or amber depending on the active route theme. Sizes with an
// exact token match are tokenized; the hex values are pre-existing literals, left untouched.
function CaseStatusPill({ c }: { c: Case }) {
  const open = c.status === "open";
  return (
    <span
      style={{
        fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", padding: "3px 10px", borderRadius: "var(--r-pill)", whiteSpace: "nowrap",
        ...(open
          ? { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }
          : { background: "#f8fafc", color: "#1e293b", border: "1px solid #e2e8f0" }),
      }}
    >
      {open ? "Open" : "Completed"}{c.outcome ? ` · ${c.outcome}` : ""}
    </span>
  );
}

// One case's visits as a compact table — newest first. A left accent stripe on the date cell
// keeps the per-doctor colour coding the old dot-timeline had, without the vertical clutter.
// One VISIT DAY, header plus its procedures. The date is stated once here instead of on every row:
// a day's work repeated the same date down eighteen rows, and the column that never changed was
// eating the width the procedure and note actually needed. The doctor moves up here too whenever a
// whole day was one clinician's — which is nearly always — and drops back to a column only on the
// days two people worked, because then it is real information again.
function VisitDay({ date, visits, canalHistory, onAmendVisit, onRemoveVisit }: {
  date: string;
  visits: Visit[];
  canalHistory?: CanalChartData[];
  onAmendVisit: (visitId: string, note: string, reason: string) => Promise<void>;
  onRemoveVisit: (visitId: string, reason: string) => Promise<void>;
}) {
  // Blanks are counted, NOT filtered out. A day holding one visit by Dr A and one with no doctor
  // recorded is not a one-doctor day — collapsing it would print Dr A's name over work nobody
  // attributed to them. Any blank forces the per-row column back, where the gap shows as a gap.
  const doctors = [...new Set(visits.map((v) => v.doctor?.trim() ?? ""))];
  const oneDoctor = doctors.length === 1 && doctors[0] ? doctors[0] : null;
  const visitId = visits[0]?.visitId;
  // A visit is one encounter that can contain several procedures/teeth. The persisted note is
  // carried only by the first expanded procedure row, so lift it back to the encounter level.
  const treatmentNote = visits.find((visit) => visit.note?.trim())?.note?.trim() ?? "";
  const [busy, setBusy] = useState(false);
  const [amendOpen, setAmendOpen] = useState(false);
  const [amendedNote, setAmendedNote] = useState(treatmentNote);
  const [amendReason, setAmendReason] = useState("");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState("");
  const [actionError, setActionError] = useState("");

  const amend = () => {
    if (!visitId || busy) return;
    setAmendedNote(treatmentNote);
    setAmendReason("");
    setActionError("");
    setAmendOpen(true);
  };

  const saveAmend = async () => {
    if (!visitId || busy || !amendReason.trim()) return;
    setBusy(true);
    try {
      await onAmendVisit(visitId, amendedNote, amendReason.trim());
      setAmendOpen(false);
    } catch (error) {
      setActionError((error as Error).message || "The amendment could not be saved.");
    } finally {
      setBusy(false);
    }
  };

  const remove = () => {
    if (!visitId || busy) return;
    setRemoveReason("");
    setActionError("");
    setRemoveOpen(true);
  };

  const confirmRemove = async () => {
    if (!visitId || busy || !removeReason.trim()) return;
    setBusy(true);
    try {
      await onRemoveVisit(visitId, removeReason.trim());
      setRemoveOpen(false);
    } catch (error) {
      setActionError((error as Error).message || "The encounter could not be removed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.vtDay}>
      <div className={`${styles.vtDayHead} ${oneDoctor ? doctorAccent(oneDoctor) : ""}`}>
        <span className={styles.vtDayDate}>{formatDateShort(date)}</span>
        <span className={styles.vtDayMeta}>
          {visits.length} {visits.length === 1 ? "procedure" : "procedures"}
        </span>
        {oneDoctor && <span className={styles.vtDoctor}>{oneDoctor}</span>}
        {visits[0]?.amended && (
          <span title={visits[0].amendmentReason} style={{ fontSize: "var(--fs-11)", color: "#7c3aed", fontWeight: 700 }}>
            Amended
          </span>
        )}
        {visitId && (
          <span style={{ display: "inline-flex", gap: 4, marginLeft: "auto" }}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={amend} disabled={busy} title="Amend clinical note">
              <Pencil size={13} />
            </button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={remove} disabled={busy} title="Remove with audited reversals" style={{ color: "#dc2626" }}>
              <Trash2 size={13} />
            </button>
          </span>
        )}
      </div>

      {treatmentNote && (
        <div style={{ margin: "10px 0", padding: "10px 12px", border: "1px solid #ddd6fe", background: "#faf5ff", color: "#3b0764" }}>
          <div style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", letterSpacing: "0.05em", textTransform: "uppercase", color: "#7e22ce", marginBottom: "3px" }}>
            Treatment note
          </div>
          <div style={{ fontSize: "var(--fs-13)", lineHeight: 1.5 }}>{treatmentNote}</div>
        </div>
      )}

      <DataTable<{ visit: Visit; index: number }>
        rows={visits.map((visit, index) => ({ visit, index }))}
        rowKey={({ visit, index }) => `${visit.visitId ?? "visit"}:${index}`}
        noun="procedures"
        paginate={false}
        columns={[
          { key: "tooth", header: "Tooth", render: ({ visit }) => { const tooth = visit.tooth?.trim(); return tooth && !isArchTooth(tooth) ? <span className={styles.vtToothChip}>{tooth}</span> : <span className={styles.vtDash}>—</span>; } },
          { key: "procedure", header: "Procedure", render: ({ visit }) => {
              const visitWithTreatmentId = visit as VisitWithTreatmentId;
              const tooth = visit.tooth?.trim();
              const canalData = canalHistory?.find(
                (c) => (tooth && c.tooth === tooth) || (visitWithTreatmentId.treatmentId && c.treatmentId === visitWithTreatmentId.treatmentId)
              );
              const hasCanalData = !!canalData && Array.isArray(canalData.canals) && canalData.canals.length > 0;
              return <div style={{ fontWeight: "var(--fw-medium)", color: "#232333" }}><div>{visit.procedure}</div>
                    {hasCanalData && (
                      <div
                        style={{
                          marginTop: "4px",
                          fontSize: "11px",
                          fontWeight: "700",
                          color: "#6b21a8",
                          background: "#f5f3ff",
                          border: "1px solid #d8b4fe",
                          padding: "2px 7px",
                          borderRadius: "6px",
                          display: "inline-block",
                        }}
                      >
                        Canals: {(canalData.canals || []).map((cn) => `${cn.canal}: ${cn.lengthMm}mm`).join(" · ")}
                      </div>
                    )}
                  </div>;
            } },
          ...(!oneDoctor ? [{ key: "doctor", header: "Doctor", render: ({ visit }: { visit: Visit; index: number }) => <span className={styles.vtDoctor}>{visit.doctor}</span> }] : []),
        ]}
      />
      {amendOpen && (
        <ConfirmDialog
          title="Amend clinical note"
          body={
            <div>
              <Field label="Corrected clinical note"><Input value={amendedNote} onChange={(event) => setAmendedNote(event.target.value)} autoFocus /></Field>
              <Field label="Reason for amendment *" style={{ marginTop: 12 }}><Input value={amendReason} onChange={(event) => setAmendReason(event.target.value)} /></Field>
              {actionError && <p style={{ color: "#b91c1c", margin: "10px 0 0" }}>{actionError}</p>}
            </div>
          }
          confirmLabel="Save amendment"
          busy={busy}
          confirmDisabled={!amendReason.trim()}
          onConfirm={() => void saveAmend()}
          onCancel={() => !busy && setAmendOpen(false)}
        />
      )}
      {removeOpen && (
        <ConfirmDialog
          title="Remove encounter?"
          body={
            <div>
              The active encounter will be removed and audited reversals will be recorded for linked clinical and financial facts; nothing is silently erased.
              <Field label="Reason for removal *" style={{ marginTop: 12 }}><Input value={removeReason} onChange={(event) => setRemoveReason(event.target.value)} autoFocus /></Field>
              {actionError && <p style={{ color: "#b91c1c", margin: "10px 0 0" }}>{actionError}</p>}
            </div>
          }
          confirmLabel="Remove encounter"
          destructive
          busy={busy}
          confirmDisabled={!removeReason.trim()}
          onConfirm={() => void confirmRemove()}
          onCancel={() => !busy && setRemoveOpen(false)}
        />
      )}
    </div>
  );
}

// Arch-level / full-mouth work isn't a single tooth number — show a dash instead of a tooth chip.
function isArchTooth(t: string): boolean {
  return /^(arch|full mouth)$/i.test(t);
}

function formatLedgerAmount(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount);
}

function ledgerDate(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-NP", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function PatientBillingLedgerTab({ ledger, loading, error, onCorrect, onReverse, onRecordPayment }: {
  ledger: PatientLedger | null | undefined;
  loading: boolean;
  error: string | null | undefined;
  onCorrect?: (entry: PatientLedger["entries"][number], amount: number, reason: string) => Promise<void>;
  onReverse?: (entry: PatientLedger["entries"][number], reason: string) => Promise<void>;
  onRecordPayment?: (input: Omit<PatientPaymentInput, "patientId">) => Promise<void>;
}) {
  const role = useClinicRole();
  const canManagePayments = role === "admin";
  const recordPaymentCommand = canManagePayments ? onRecordPayment : undefined;
  const correctLedgerCommand = canManagePayments ? onCorrect : undefined;
  const reverseLedgerCommand = canManagePayments ? onReverse : undefined;
  const summary = ledger?.summary ?? { totalBilled: 0, totalCollected: 0, totalDiscount: 0, outstandingDue: 0 };
  const [paymentDate, setPaymentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDiscount, setPaymentDiscount] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PatientPaymentInput["paymentMethod"]>("cash");
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [correctionTarget, setCorrectionTarget] = useState<PatientLedger["entries"][number] | null>(null);
  const [correctionAmount, setCorrectionAmount] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [reversalTarget, setReversalTarget] = useState<PatientLedger["entries"][number] | null>(null);
  const [reversalReason, setReversalReason] = useState("");
  const [ledgerActionError, setLedgerActionError] = useState<string | null>(null);
  const [ledgerActionSaving, setLedgerActionSaving] = useState(false);

  const recordPayment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!recordPaymentCommand || paymentSaving) return;

    const amount = Number(paymentAmount || "0");
    const discountAmount = Number(paymentDiscount || "0");
    if (!paymentDate) {
      setPaymentError("Choose the payment date.");
      return;
    }
    if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(discountAmount) || amount < 0 || discountAmount < 0 || amount + discountAmount <= 0) {
      setPaymentError("Enter a payment or discount as a whole number.");
      return;
    }
    if (amount + discountAmount > summary.outstandingDue) {
      setPaymentError(`Payment and discount cannot exceed the outstanding balance of ${formatLedgerAmount(summary.outstandingDue)}.`);
      return;
    }

    setPaymentSaving(true);
    setPaymentError(null);
    try {
      await recordPaymentCommand({ paymentDate, amount, discountAmount, paymentMethod });
      setPaymentAmount("");
      setPaymentDiscount("0");
    } catch (cause) {
      setPaymentError(cause instanceof Error ? cause.message : "The payment could not be saved. Please try again.");
    } finally {
      setPaymentSaving(false);
    }
  };

  const closeLedgerActionModal = (force = false) => {
    if (ledgerActionSaving && !force) return;
    setCorrectionTarget(null);
    setReversalTarget(null);
    setLedgerActionError(null);
  };

  const openCorrection = (entry: PatientLedger["entries"][number]) => {
    setCorrectionTarget(entry);
    setCorrectionAmount("");
    setCorrectionReason("");
    setLedgerActionError(null);
  };

  const openReversal = (entry: PatientLedger["entries"][number]) => {
    setReversalTarget(entry);
    setReversalReason("");
    setLedgerActionError(null);
  };

  const submitCorrection = async () => {
    if (!correctionTarget || !correctLedgerCommand || ledgerActionSaving) return;
    const amount = Number(correctionAmount);
    if (!Number.isSafeInteger(amount) || amount === 0) {
      setLedgerActionError("Enter a non-zero whole-number adjustment.");
      return;
    }
    if (!correctionReason.trim()) {
      setLedgerActionError("Enter a reason for this correction.");
      return;
    }
    setLedgerActionSaving(true);
    setLedgerActionError(null);
    try {
      await correctLedgerCommand(correctionTarget, amount, correctionReason.trim());
      closeLedgerActionModal(true);
    } catch (cause) {
      setLedgerActionError(cause instanceof Error ? cause.message : "Could not correct this ledger entry.");
    } finally {
      setLedgerActionSaving(false);
    }
  };

  const submitReversal = async () => {
    if (!reversalTarget || !reverseLedgerCommand || ledgerActionSaving) return;
    if (!reversalReason.trim()) {
      setLedgerActionError("Enter a reason for reversal.");
      return;
    }
    setLedgerActionSaving(true);
    setLedgerActionError(null);
    try {
      await reverseLedgerCommand(reversalTarget, reversalReason.trim());
      closeLedgerActionModal(true);
    } catch (cause) {
      setLedgerActionError(cause instanceof Error ? cause.message : "Could not reverse this ledger entry.");
    } finally {
      setLedgerActionSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "var(--sp-3)" }}>
        <Card><CardBody><div style={{ color: "var(--ink-3)", fontSize: "var(--fs-12)" }}>Total Billed</div><strong style={{ display: "block", marginTop: 5, fontSize: "var(--fs-20)" }}>{formatLedgerAmount(summary.totalBilled)}</strong></CardBody></Card>
        <Card><CardBody><div style={{ color: "var(--ink-3)", fontSize: "var(--fs-12)" }}>Total Collected</div><strong style={{ display: "block", marginTop: 5, fontSize: "var(--fs-20)" }}>{formatLedgerAmount(summary.totalCollected)}</strong>{summary.totalDiscount > 0 && <span style={{ display: "block", marginTop: 4, color: "var(--ink-3)", fontSize: "var(--fs-11)" }}>Discounts recorded: {formatLedgerAmount(summary.totalDiscount)}</span>}</CardBody></Card>
        <Card><CardBody><div style={{ color: "var(--ink-3)", fontSize: "var(--fs-12)" }}>Outstanding Due</div><strong style={{ display: "block", marginTop: 5, fontSize: "var(--fs-20)", color: summary.outstandingDue > 0 ? "#b45309" : "#15803d" }}>{formatLedgerAmount(summary.outstandingDue)}</strong></CardBody></Card>
      </div>

      {error && <div role="alert" style={{ padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: "var(--fs-13)" }}>{error}</div>}

      {recordPaymentCommand ? <Card>
        <CardHeader title={<><WalletCards size={16} /> Record a payment</>} />
        <CardBody>
          {summary.outstandingDue > 0 ? (
            <>
              <p className={styles.paymentIntro}>Outstanding balance: <strong>{formatLedgerAmount(summary.outstandingDue)}</strong></p>
              <form className={styles.paymentForm} onSubmit={(event) => void recordPayment(event)} onClickCapture={handleSandboxedFormSubmitClick} onKeyDown={handleSandboxedFormSubmitKeyDown} onFocusCapture={handleFormKeyboardFocus} onPointerDownCapture={handleFormKeyboardPointerDown}>
                <Field label="Payment date" htmlFor="patient-payment-date" required>
                  <Input
                    id="patient-payment-date"
                    type="date"
                    value={paymentDate}
                    disabled={paymentSaving}
                    onChange={(event) => { setPaymentDate(event.target.value); setPaymentError(null); }}
                  />
                </Field>
                <Field label="Amount" htmlFor="patient-payment-amount" required>
                  <Input
                    id="patient-payment-amount"
                    type="number"
                    min={0}
                    max={summary.outstandingDue}
                    step={1}
                    inputMode="numeric"
                    placeholder="0"
                    value={paymentAmount}
                    disabled={paymentSaving}
                    onChange={(event) => { setPaymentAmount(event.target.value); setPaymentError(null); }}
                  />
                </Field>
                <Field label="Discount" htmlFor="patient-payment-discount">
                  <Input
                    id="patient-payment-discount"
                    type="number"
                    min={0}
                    max={summary.outstandingDue}
                    step={1}
                    inputMode="numeric"
                    value={paymentDiscount}
                    disabled={paymentSaving}
                    onChange={(event) => { setPaymentDiscount(event.target.value); setPaymentError(null); }}
                  />
                </Field>
                <Field label="Payment method" htmlFor="patient-payment-method" required>
                  <Select
                    id="patient-payment-method"
                    value={paymentMethod}
                    disabled={paymentSaving}
                    onChange={(event) => { setPaymentMethod(event.target.value as PatientPaymentInput["paymentMethod"]); setPaymentError(null); }}
                  >
                    <option value="cash">Cash</option>
                    <option value="esewa">eSewa</option>
                    <option value="khalti">Khalti</option>
                    <option value="card">Card</option>
                    <option value="bank_transfer">Bank transfer</option>
                    <option value="cheque">Cheque</option>
                  </Select>
                </Field>
                <div className={styles.paymentActions}>
                  <button type="submit" className="btn btn-primary" disabled={paymentSaving}>
                    {paymentSaving ? "Saving…" : "Save payment"}
                  </button>
                </div>
              </form>
              {paymentError ? <p className={styles.paymentError} role="alert">{paymentError}</p> : null}
            </>
          ) : (
            <p className={styles.paymentIntro}>Nothing outstanding — this patient’s balance is cleared.</p>
          )}
        </CardBody>
      </Card> : null}

      <Card className={styles.ledgerStatementCard}>
        <CardHeader title={<><WalletCards size={16} /> Statement</>} />
        <CardBody className={styles.ledgerStatementBody}>
          <DataTable<PatientLedger["entries"][number]>
            rows={ledger?.entries ?? []}
            rowKey={(entry) => entry.patientLedgerEntryId}
            noun="ledger entries"
            minWidth={900}
            loading={loading}
            loadingLabel="Loading the patient billing ledger…"
            empty={<EmptyState message="No billing ledger entries have been recorded for this patient." />}
            columns={[
              { key: "date", header: "Date", sortable: true, value: (entry) => entry.entryDate, render: (entry) => ledgerDate(entry.entryDate) },
              { key: "type", header: "Type", sortable: true, value: (entry) => entry.entryType, render: (entry) => <span style={{ color: entry.entryType === "charge" ? "#9a3412" : "#166534", fontWeight: "var(--fw-medium)" }}>{entry.entryType === "charge" ? "Charge" : "Payment"}</span> },
              { key: "for", header: "For", render: (entry) => <>{entry.forLabel || "—"}{entry.receiptNumber ? <span data-table-secondary style={{ display: "block", marginTop: 2 }}>{entry.receiptNumber}</span> : null}</> },
              { key: "method", header: "Method", render: (entry) => entry.paymentMethod ? entry.paymentMethod.replace("_", " ") : "—" },
              { key: "discount", header: "Discount", align: "right", value: (entry) => entry.discountAmount, render: (entry) => entry.discountAmount ? formatLedgerAmount(entry.discountAmount) : "—" },
              { key: "amount", header: "Amount", align: "right", sortable: true, value: (entry) => entry.amount, render: (entry) => <strong>{formatLedgerAmount(entry.amount)}</strong> },
              { key: "balance", header: "Balance", align: "right", value: (entry) => entry.runningBalance, render: (entry) => <strong>{formatLedgerAmount(entry.runningBalance)}</strong> },
              { key: "actions", header: "Action", align: "right", render: (entry) => !correctLedgerCommand && !reverseLedgerCommand ? null : entry.entryType === "charge" || entry.entryType === "payment" ? <RowActions><button className="btn btn-secondary btn-sm" type="button" onClick={() => openCorrection(entry)} disabled={!correctLedgerCommand}>Correct</button><button className="btn btn-secondary btn-sm" type="button" onClick={() => openReversal(entry)} disabled={!reverseLedgerCommand}>Reverse</button></RowActions> : <span style={{ color: "var(--ink-3)" }}>Linked</span> },
            ]}
          />
        </CardBody>
      </Card>

      {correctionTarget ? <Modal title={<><WalletCards size={18} /> Correct ledger entry</>} onClose={closeLedgerActionModal} maxWidth={500}>
        <ModalBody as="form" onSubmit={(event) => { event.preventDefault(); void submitCorrection(); }}>
          {ledgerActionError ? <ModalError>{ledgerActionError}</ModalError> : null}
          <p style={{ margin: 0, color: "var(--ink-2)", fontSize: "var(--fs-14)", lineHeight: 1.55 }}>Adjusting <strong>{correctionTarget.forLabel || "this ledger entry"}</strong>. A negative amount lowers the outstanding due; a positive amount raises it.</p>
          <Field label="Signed adjustment *" hint="Enter a whole number, such as -500 or 500." style={{ marginTop: "var(--sp-3)" }}>
            <Input type="number" step={1} inputMode="numeric" value={correctionAmount} onChange={(event) => setCorrectionAmount(event.target.value)} placeholder="0" autoFocus />
          </Field>
          <Field label="Reason for correction *">
            <Input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Why is this amount changing?" maxLength={500} />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button type="button" className="btn btn-secondary" onClick={() => closeLedgerActionModal()} disabled={ledgerActionSaving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={ledgerActionSaving}>{ledgerActionSaving ? "Saving…" : "Save correction"}</button>
          </div>
        </ModalBody>
      </Modal> : null}

      {reversalTarget ? <Modal title={<><WalletCards size={18} /> Reverse ledger entry</>} onClose={closeLedgerActionModal} maxWidth={480}>
        <ModalBody as="form" onSubmit={(event) => { event.preventDefault(); void submitReversal(); }}>
          {ledgerActionError ? <ModalError>{ledgerActionError}</ModalError> : null}
          <p style={{ margin: 0, color: "var(--ink-2)", fontSize: "var(--fs-14)", lineHeight: 1.55 }}>This creates a reversal for <strong>{reversalTarget.forLabel || "this ledger entry"}</strong>; the original entry remains in the audit history.</p>
          <Field label="Reason for reversal *" style={{ marginTop: "var(--sp-3)" }}>
            <Input value={reversalReason} onChange={(event) => setReversalReason(event.target.value)} placeholder="Why is this entry being reversed?" maxLength={500} autoFocus />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
            <button type="button" className="btn btn-secondary" onClick={() => closeLedgerActionModal()} disabled={ledgerActionSaving}>Cancel</button>
            <button type="submit" className="btn btn-danger" disabled={ledgerActionSaving}>{ledgerActionSaving ? "Reversing…" : "Reverse entry"}</button>
          </div>
        </ModalBody>
      </Modal> : null}
    </div>
  );
}

function PatientFollowUpHistoryTab({ followUps, loading, error, onCreate }: {
  followUps: WorkerPatientFollowUp[];
  loading: boolean;
  error: string | null | undefined;
  onCreate?: (input: Omit<FollowUpCreateInput, "patientId">) => Promise<WorkerPatientFollowUp>;
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [dueOn, setDueOn] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const closeModal = () => {
    if (saving) return;
    setShowAddModal(false);
    setSaveError(null);
  };

  const submitFollowUp = async () => {
    if (!onCreate || !dueOn || !reason.trim() || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onCreate({
        chiefComplaintId: null,
        dueOn,
        dueTime: dueTime || null,
        reason: reason.trim(),
        requestedByStaffId: null,
      });
      setDueOn("");
      setDueTime("");
      setReason("");
      setShowAddModal(false);
    } catch (submitError) {
      setSaveError(submitError instanceof Error ? submitError.message : "Could not schedule the follow-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader title={<><BellRing size={16} /> Follow-Up History</>}>
          {onCreate ? <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}><Plus size={14} /> Add follow-up</button> : null}
        </CardHeader>
        <CardBody>
          <p style={{ margin: "0 0 14px", color: "var(--ink-3)", fontSize: "var(--fs-13)" }}>
            Follow-up records are shared with the operational Follow-ups queue.
          </p>
          {error && <div role="alert" style={{ marginBottom: "12px", padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: "var(--fs-13)" }}>{error}</div>}
          <DataTable<WorkerPatientFollowUp>
            rows={followUps}
            rowKey={(followUp) => followUp.followUpId}
            noun="follow-ups"
            loading={loading}
            loadingLabel="Loading patient follow-up history…"
            empty={<EmptyState message="No follow-ups recorded for this patient yet." />}
            columns={[
              { key: "due", header: "Due", sortable: true, value: (followUp) => followUp.dueOn, render: (followUp) => <>{formatDateShort(followUp.dueOn)}{followUp.dueTime ? <span style={{ color: "var(--ink-3)" }}> · {followUp.dueTime}</span> : null}</> },
              { key: "reason", header: "Reason", render: (followUp) => followUp.reason },
              { key: "status", header: "Status", sortable: true, value: (followUp) => followUp.status, render: (followUp) => <span style={{ fontWeight: "var(--fw-medium)", color: followUp.status === "caught" ? "#166534" : followUp.status === "pending" ? "#92400e" : "var(--ink-3)" }}>{followUp.status === "caught" ? "Caught" : followUp.status === "pending" ? "Pending" : followUp.status === "missed" ? "Missed" : "Cancelled"}</span> },
            ]}
          />
        </CardBody>
      </Card>

      {showAddModal ? (
        <Modal title={<><BellRing size={18} /> Add follow-up</>} onClose={closeModal} maxWidth={520}>
          <ModalBody as="form" onSubmit={(event) => { event.preventDefault(); void submitFollowUp(); }}>
            {saveError ? <ModalError>{saveError}</ModalError> : null}
            <Field label="Follow-up date and time *">
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px" }}>
                <DatePicker value={dueOn} onChange={setDueOn} fluid />
                <TimePicker value={dueTime} onChange={setDueTime} fluid />
              </div>
            </Field>
            <Field label="Reason *">
              <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Enter the follow-up reason" required autoFocus />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button type="button" className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={!dueOn || !reason.trim() || saving}>{saving ? "Saving…" : "Schedule follow-up"}</button>
            </div>
          </ModalBody>
        </Modal>
      ) : null}
    </>
  );
}

// Temporary UI-only hold: the audit endpoints and records remain available, but
// prescription withdrawal/correction is not exposed from the patient workspace.
const prescriptionActionsVisible = false;

function PatientPrescriptionHistoryTab({ prescriptions, loading, error, onWithdraw, onCorrect }: {
  prescriptions: PatientPrescription[];
  loading: boolean;
  error: string | null | undefined;
  onWithdraw?: (prescription: PatientPrescription, reason: string) => Promise<void>;
  onCorrect?: (prescription: PatientPrescription, items: PatientPrescription["items"], reason: string) => Promise<void>;
}) {
  const [correctionTarget, setCorrectionTarget] = useState<PatientPrescription | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [withdrawTarget, setWithdrawTarget] = useState<PatientPrescription | null>(null);
  const [withdrawReason, setWithdrawReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const rows = prescriptions.flatMap((prescription) => prescription.items.map((item, itemIndex) => ({ prescription, item, itemIndex })));

  const closeForms = (force = false) => {
    if (saving && !force) return;
    setCorrectionTarget(null);
    setWithdrawTarget(null);
    setFormError(null);
  };

  const openCorrection = (prescription: PatientPrescription) => {
    setCorrectionTarget(prescription);
    setCorrectionDraft(prescription.items.map((item) => [item.medicineName, item.dose ?? "", item.frequency ?? "", item.duration ?? "", item.instructions].join(" | ")).join("\n"));
    setCorrectionReason("");
    setFormError(null);
  };

  const submitCorrection = async () => {
    if (!correctionTarget || !onCorrect || saving) return;
    const items = correctionDraft.split("\n").map((line) => line.split("|").map((part) => part.trim())).filter(([medicine]) => Boolean(medicine)).map(([medicineName, dose, frequency, duration, instructions]) => ({ medicineName, dose: dose || null, frequency: frequency || null, duration: duration || null, instructions: instructions || "" }));
    if (!items.length || items.some((item) => !item.instructions)) {
      setFormError("Add at least one medicine, and include instructions for every medicine.");
      return;
    }
    if (!correctionReason.trim()) {
      setFormError("Enter a reason for this correction.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onCorrect(correctionTarget, items, correctionReason.trim());
      closeForms(true);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not correct this prescription.");
    } finally {
      setSaving(false);
    }
  };

  const openWithdrawal = (prescription: PatientPrescription) => {
    setWithdrawTarget(prescription);
    setWithdrawReason("");
    setFormError(null);
  };

  const submitWithdrawal = async () => {
    if (!withdrawTarget || !onWithdraw || saving) return;
    if (!withdrawReason.trim()) {
      setFormError("Enter a reason for withdrawal.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await onWithdraw(withdrawTarget, withdrawReason.trim());
      closeForms(true);
    } catch (cause) {
      setFormError(cause instanceof Error ? cause.message : "Could not withdraw this prescription.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <Card>
      <CardHeader title={<><Pill size={16} /> Prescription History</>} />
      <CardBody>
        <p style={{ margin: "0 0 14px", color: "var(--ink-3)", fontSize: "var(--fs-13)" }}>
          Issued prescriptions are immutable clinical records.
        </p>
        {error && <div role="alert" style={{ marginBottom: "12px", padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: "var(--fs-13)" }}>{error}</div>}
        <DataTable<(typeof rows)[number]>
          rows={rows}
          rowKey={({ prescription, item, itemIndex }) => `${prescription.prescriptionId}:${item.medicineName}:${itemIndex}`}
          noun="prescription items"
          minWidth={880}
          loading={loading}
          loadingLabel="Loading patient prescriptions…"
          empty={<EmptyState message="No issued prescriptions recorded for this patient." />}
          columns={[
            { key: "date", header: "Date", value: ({ prescription }) => prescription.prescribedOn, render: ({ prescription, itemIndex }) => itemIndex === 0 ? formatDateShort(prescription.prescribedOn) : "" },
            { key: "medication", header: "Medication", render: ({ item }) => item.medicineName },
            { key: "directions", header: "Directions", render: ({ item }) => [item.dose, item.frequency, item.duration].filter(Boolean).join(" · ") || item.instructions || "—" },
            { key: "status", header: "Status", render: ({ prescription, itemIndex }) => itemIndex === 0 ? prescription.status : "" },
            ...(prescriptionActionsVisible ? [{ key: "actions", header: "Action", align: "right" as const, render: ({ prescription, itemIndex }: (typeof rows)[number]) => itemIndex === 0 && prescription.status === "issued" ? <RowActions><button className="btn btn-secondary btn-sm" type="button" disabled={!onWithdraw} onClick={() => openWithdrawal(prescription)}>Withdraw</button><button className="btn btn-secondary btn-sm" type="button" disabled={!onCorrect} onClick={() => openCorrection(prescription)}>Correct</button></RowActions> : "" }] : []),
          ]}
        />
      </CardBody>
    </Card>

    {prescriptionActionsVisible && correctionTarget ? <Modal title={<><Pill size={18} /> Correct prescription</>} onClose={closeForms} maxWidth={640}>
      <ModalBody as="form" onSubmit={(event) => { event.preventDefault(); void submitCorrection(); }}>
        {formError ? <ModalError>{formError}</ModalError> : null}
        <Field label="Corrected medicines *" hint="One medicine per line: medicine | dose | frequency | duration | instructions">
          <Textarea value={correctionDraft} onChange={(event) => setCorrectionDraft(event.target.value)} rows={6} autoFocus aria-label="Corrected medicines" />
        </Field>
        <Field label="Reason for correction *">
          <Input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Why is this prescription being corrected?" maxLength={500} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
          <button type="button" className="btn btn-secondary" onClick={() => closeForms()} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? "Saving…" : "Save correction"}</button>
        </div>
      </ModalBody>
    </Modal> : null}

    {prescriptionActionsVisible && withdrawTarget ? <Modal title={<><Pill size={18} /> Withdraw prescription</>} onClose={closeForms} maxWidth={480}>
      <ModalBody as="form" onSubmit={(event) => { event.preventDefault(); void submitWithdrawal(); }}>
        {formError ? <ModalError>{formError}</ModalError> : null}
        <p style={{ margin: 0, color: "var(--ink-2)", fontSize: "var(--fs-14)", lineHeight: 1.55 }}>The prescription will be withdrawn from active use while its original record remains in the clinical audit history.</p>
        <Field label="Reason for withdrawal *" style={{ marginTop: "var(--sp-3)" }}>
          <Input value={withdrawReason} onChange={(event) => setWithdrawReason(event.target.value)} placeholder="Why is this prescription being withdrawn?" maxLength={500} autoFocus />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
          <button type="button" className="btn btn-secondary" onClick={() => closeForms()} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-danger" disabled={saving}>{saving ? "Withdrawing…" : "Withdraw prescription"}</button>
        </div>
      </ModalBody>
    </Modal> : null}
  </>;
}

type TimelineGroup = {
  key: string;
  occurredOn: string;
  recordedAt: string;
  events: PatientTimelineEvent[];
};

type ClinicalTimelineCase = {
  caseId: string;
  plan: PatientTreatmentPlan | null;
  groups: TimelineGroup[];
};

function caseStatusLabel(status: PatientTreatmentPlan["status"]) {
  return status === "open" ? "Open" : status === "completed" ? "Completed" : "Closed";
}

function caseStatusForPlan(plan: PatientTreatmentPlan) {
  return plan.status === "open" && plan.protocols.some((protocol) => protocol.status !== "cancelled") ? "In progress" : caseStatusLabel(plan.status);
}

function planLocation(toothCode: string | null, treatmentArea: string | null) {
  return toothCode ? `Tooth ${toothCode}` : treatmentArea || "General";
}

function buildClinicalTimelineCases(
  timeline: PatientTimelineEvent[],
  plans: PatientTreatmentPlan[],
): ClinicalTimelineCase[] {
  const planByCase = new Map(plans.map((plan) => [plan.chiefComplaintId, plan]));
  const eventsByCase = new Map<string, PatientTimelineEvent[]>();
  for (const event of timeline) {
    // The Clinical Timeline is deliberately limited to completed treatment
    // stages. Follow-ups, prescriptions, notes, labs, and imaging have their
    // own patient-record sections and would make this treatment history noisy.
    if (event.eventType !== "clinical_work" || !event.chiefComplaintId) continue;
    eventsByCase.set(event.chiefComplaintId, [
      ...(eventsByCase.get(event.chiefComplaintId) ?? []),
      event,
    ]);
  }

  const orderedCaseIds = [
    ...plans.map((plan) => plan.chiefComplaintId),
    ...Array.from(eventsByCase.keys()).filter((caseId) => !planByCase.has(caseId)),
  ];

  return orderedCaseIds.map((caseId) => {
    const events = eventsByCase.get(caseId) ?? [];
    const groups = new Map<string, TimelineGroup>();
    for (const event of events) {
      // Several save operations on one calendar day belong to the same visit.
      const occurredOn = event.occurredOn.slice(0, 10) || event.recordedAt.slice(0, 10);
      const key = `day:${occurredOn}`;
      const group = groups.get(key) ?? { key, occurredOn, recordedAt: event.recordedAt, events: [] };
      group.events.push(event);
      if (event.recordedAt > group.recordedAt) group.recordedAt = event.recordedAt;
      groups.set(key, group);
    }
    return {
      caseId,
      plan: planByCase.get(caseId) ?? null,
      groups: Array.from(groups.values()).sort((left, right) => right.occurredOn.localeCompare(left.occurredOn) || right.recordedAt.localeCompare(left.recordedAt)),
    };
  }).sort((left, right) => {
    const leftOpen = left.plan?.status === "open" ? 0 : 1;
    const rightOpen = right.plan?.status === "open" ? 0 : 1;
    // Preserve the backend's newest-case-first order inside each status group.
    // This makes the patient's current open complaint the default selection.
    return leftOpen - rightOpen;
  });
}

function PatientTimelineHistoryTab({
  timeline,
  plans,
  loading,
  error,
  selectedCaseId,
}: {
  timeline: PatientTimelineEvent[];
  plans: PatientTreatmentPlan[];
  loading: boolean;
  error?: string | null;
  selectedCaseId?: string;
}) {
  const cases = useMemo(() => buildClinicalTimelineCases(timeline, plans), [plans, timeline]);
  const visibleCases = selectedCaseId ? cases.filter((entry) => entry.caseId === selectedCaseId) : cases.slice(0, 1);

  return <div className={styles.clinicalHistory}>
    {error && <div role="alert" className={styles.patientRecordError}>{error}</div>}
    {loading || !cases.length ? <Card>
      <CardHeader title={<><Clock size={16} /> Clinical timeline</>} />
      <CardBody>
        <p style={{ marginTop: 0, color: "#64748b", fontSize: "13px" }}>Review completed treatment stages across this patient&apos;s cases and visits.</p>
        {loading
          ? <DataTable<{ key: string }> rows={[]} rowKey={(row) => row.key} noun="timeline events" paginate={false} loading loadingLabel="Loading clinical timeline…" columns={[{ key: "tooth", header: "Tooth" }, { key: "stage", header: "Stage" }]} />
          : <EmptyState message="No clinical history has been recorded for this patient yet." />}
      </CardBody>
    </Card> : visibleCases.map((entry) => {
      const protocolSummary = entry.plan?.protocols.map((protocol) => `${protocol.protocolName} · ${planLocation(protocol.toothCode, protocol.treatmentArea)}`).join(" + ");
      return <article className={styles.timelineCase} key={entry.caseId}>
        <header className={styles.timelineCaseHeader}>
          <div className={styles.timelineCaseHeading}>
            <div className={styles.timelineCaseTitleRow}>
              <h3><Clock size={17} /> {entry.plan?.chiefComplaint || "Clinical case"}</h3>
              {entry.plan ? <span className={`${styles.caseStatus} ${entry.plan.status === "open" ? styles.caseStatusOpen : styles.caseStatusClosed}`}>{caseStatusLabel(entry.plan.status)}</span> : null}
            </div>
            {entry.plan ? <p>{protocolSummary || "No treatment protocol attached"} · opened {formatDateShort(entry.plan.openedOn)}</p> : null}
          </div>
        </header>
        {!entry.groups.length ? <div className={styles.timelineCaseEmpty}>No treatment stages have been completed for this case yet.</div> : <div className={styles.timelineVisits}>{entry.groups.map((group) => {
          const doctors = Array.from(new Set(group.events.flatMap((event) => event.doctors)));
          return <section className={styles.timelineVisit} key={group.key}>
            <header className={styles.timelineVisitHeader}><div><strong>{formatDateShort(group.occurredOn)}</strong>{doctors.length ? <span className={styles.timelineVisitDoctor}>{doctors.join(", ")}</span> : null}</div></header>
            <DataTable<PatientTimelineEvent>
              rows={group.events}
              rowKey={(event) => event.eventId}
              noun="treatment stages"
              paginate={false}
              columns={[
                { key: "tooth", header: "Tooth", render: (event) => { const matchedProtocol = entry.plan?.protocols.find((protocol) => protocol.patientProtocolId === event.patientProtocolId || protocol.protocolName === (event.protocolName || event.detail)); const toothOrArea = event.toothCode || matchedProtocol?.toothCode || event.treatmentArea || matchedProtocol?.treatmentArea || "—"; return <span className={styles.timelineEventTooth}>{toothOrArea}</span>; } },
                { key: "stage", header: "Stage", render: (event) => <strong>{event.title}</strong> },
              ]}
            />
          </section>;
        })}</div>}
      </article>;
    })}
  </div>;
}

function PatientTreatmentPlansTab({ plans, timeline, canalMeasurements, loading, error, selectedCaseId, onSaveCanalMeasurement }: { plans: PatientTreatmentPlan[]; timeline: PatientTimelineEvent[]; canalMeasurements: PatientCanalMeasurement[]; loading: boolean; error?: string | null; selectedCaseId?: string; onSaveCanalMeasurement?: (session: PatientCanalMeasurement, data: CanalChartData) => Promise<void> }) {
  const [activeCanalSession, setActiveCanalSession] = useState<PatientCanalMeasurement | null>(null);
  const visiblePlans = selectedCaseId ? plans.filter((plan) => plan.chiefComplaintId === selectedCaseId) : plans.slice(0, 1);
  const activeCanalTooth = activeCanalSession?.toothCode || plans.flatMap((plan) => plan.protocols).find((protocol) => protocol.patientProtocolId === activeCanalSession?.patientProtocolId)?.toothCode || "";
  const activeCanalData = useMemo<CanalChartData | undefined>(() => activeCanalSession ? ({
    tooth: activeCanalTooth,
    treatmentId: activeCanalSession.patientProtocolId,
    date: activeCanalSession.recordedOn,
    medicament: activeCanalSession.note ?? undefined,
    obturationMaterial: activeCanalSession.obturationMaterial ?? undefined,
    canals: activeCanalSession.records.map((record) => ({
      canal: record.canalLabel,
      lengthMm: String(record.workingLengthMm),
      referencePoint: record.reference ?? "",
      note: record.fileNumber ?? "",
      date: activeCanalSession.recordedOn,
    })),
  }) : undefined, [activeCanalSession, activeCanalTooth]);
  return <>
  <div className={styles.treatmentPlanList}>
    {error && <div role="alert" className={styles.patientRecordError}>{error}</div>}
    {loading || !plans.length ? <Card>
      <CardHeader title={<><FileText size={16} /> Treatment plan</>} />
      <CardBody>
        <p style={{ marginTop: 0, color: "#64748b", fontSize: "13px" }}>Review the protocols, stages, progress, and recorded canal measurements for this patient.</p>
        <EmptyState message={loading ? "Loading patient treatment plans…" : "No treatment plans recorded for this patient."} />
      </CardBody>
    </Card> : visiblePlans.map((plan) => {
      const allStages = plan.protocols.flatMap((protocol) => protocol.stages);
      const completedStages = allStages.filter((stage) => stage.status === "done").length;
      const activeStages = allStages.filter((stage) => stage.status !== "cancelled").length;
      return <article className={styles.treatmentCase} key={plan.chiefComplaintId}>
        <header className={styles.treatmentCaseHeader}>
          <div><span className={styles.sectionKicker}>TREATMENT CASE</span><h3><FileText size={17} /> {plan.chiefComplaint}</h3><p>Opened {formatDateShort(plan.openedOn)}</p></div>
          <div className={styles.treatmentCaseSummary}><span className={`${styles.caseStatus} ${plan.status === "open" ? styles.caseStatusOpen : styles.caseStatusClosed}`}>{caseStatusLabel(plan.status)}</span><strong>{completedStages} of {activeStages} done</strong></div>
        </header>
        {!plan.protocols.length ? <EmptyState message="No protocol has been attached to this case." /> : <div className={`${styles.protocolGrid} ${plan.protocols.length === 1 ? styles.protocolGridSingle : ""}`}>{plan.protocols.map((protocol) => {
          const stages = [...protocol.stages].sort((left, right) => left.stageOrder - right.stageOrder);
          const completed = stages.filter((stage) => stage.status === "done").length;
          const currentStages = stages.filter((stage) => stage.status !== "cancelled");
          const protocolTotal = currentStages.reduce((sum, stage) => sum + stage.price, 0);
          const canal = canalMeasurements.filter((session) => session.patientProtocolId === protocol.patientProtocolId).sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
          return <section className={`${styles.protocolPlan} ${protocol.status === "cancelled" ? styles.protocolPlanCancelled : ""}`} key={protocol.patientProtocolId}>
            <header className={styles.protocolPlanHeader}><div><h4>{protocol.protocolName}</h4><span><MapPin size={12} /> {planLocation(protocol.toothCode, protocol.treatmentArea)}</span></div><div><strong>{completed}/{currentStages.length}</strong><span>Rs {protocolTotal.toLocaleString("en-IN")}</span></div></header>
            <ol className={styles.protocolStages}>{stages.map((stage) => {
              const fallbackEvent = stage.status === "done" ? timeline.find((event) => event.eventType === "clinical_work" && event.chiefComplaintId === plan.chiefComplaintId && event.title === stage.stageName && (event.patientProtocolId === protocol.patientProtocolId || (event.protocolName || event.detail) === protocol.protocolName)) : null;
              const completedBy = stage.completedBy?.length ? stage.completedBy : fallbackEvent?.doctors ?? [];
              return <li className={`${styles.protocolStage} ${stage.status === "done" ? styles.protocolStageDone : stage.status === "cancelled" ? styles.protocolStageCancelled : styles.protocolStagePending}`} key={stage.stageId}>
                <span className={styles.stageIcon}>{stage.status === "done" ? <CheckCircle2 size={18} /> : stage.status === "cancelled" ? <Ban size={18} /> : <Circle size={18} />}</span>
                <div className={styles.stageBody}><div><strong>{stage.stageOrder}. {stage.stageName}</strong><span className={styles.stageStatus}>{stage.status === "done" ? "Done" : stage.status === "cancelled" ? "Cancelled" : "Pending"}</span></div>{stage.status === "done" ? <small>{completedBy.length ? `Done by ${completedBy.join(", ")}` : "Completed"}{stage.completedOn ? ` · ${formatDateShort(stage.completedOn)}` : ""}</small> : null}</div>
                <strong className={styles.stagePrice}>Rs {stage.price.toLocaleString("en-IN")}</strong>
              </li>;
            })}</ol>
            {canal ? <button
              type="button"
              className={styles.protocolCanal}
              onClick={() => setActiveCanalSession(canal)}
              aria-label={`View canal measurements for tooth ${canal.toothCode || protocol.toothCode || ""}`}
            >
              Canal
            </button> : null}
          </section>;
        })}</div>}
      </article>;
    })}
  </div>
  {activeCanalSession ? <CanalDrawer
    isOpen
    onClose={() => setActiveCanalSession(null)}
    tooth={activeCanalTooth}
    treatmentId={activeCanalSession.patientProtocolId}
    initialData={activeCanalData}
    onSave={async (data) => {
      if (!onSaveCanalMeasurement) throw new Error("Canal measurement editing is unavailable in this session.");
      await onSaveCanalMeasurement(activeCanalSession, data);
    }}
    successMessage="Canal measurements saved."
    notifySaveResult={!onSaveCanalMeasurement}
  /> : null}
  </>;
}

function PatientChiefComplaintsTab({
  patientId,
  plans,
  loading,
  error,
  onUpdateCaseStatus,
}: {
  patientId: string;
  plans: PatientTreatmentPlan[];
  loading: boolean;
  error?: string | null;
  onUpdateCaseStatus?: PatientDrawerProps["onUpdateCaseStatus"];
}) {
  const [target, setTarget] = useState<PatientTreatmentPlan | null>(null);
  return <>
    {error && <div role="alert" className={styles.patientRecordError}>{error}</div>}
    <Card>
      <CardHeader title={<><FileText size={16} /> Chief complaints / cases</>} />
      <CardBody>
        <p style={{ marginTop: 0, color: "#64748b", fontSize: "13px" }}>Review each case and update its durable status. Pending treatment stages are never changed by a status update.</p>
        {loading ? <DataTable<{ key: string }> rows={[]} rowKey={(row) => row.key} noun="cases" paginate={false} loading loadingLabel="Loading patient cases…" columns={[{ key: "title", header: "Case" }]} /> : !plans.length ? <EmptyState message="No cases have been recorded for this patient." /> : <DataTable
          rows={plans}
          rowKey={(plan) => plan.chiefComplaintId}
          noun="cases"
          paginate={false}
          columns={[
            { key: "index", header: "#", render: (_plan, index) => <span>{index + 1}</span> },
            { key: "title", header: "Chief complaint", render: (plan) => <strong>{plan.chiefComplaint}</strong> },
            { key: "opened", header: "Opened", render: (plan) => formatDateShort(plan.openedOn) },
            { key: "status", header: "Status", render: (plan) => <span className={`${styles.caseStatus} ${plan.status === "open" ? styles.caseStatusOpen : styles.caseStatusClosed}`}>{caseStatusForPlan(plan)}</span> },
            { key: "actions", header: "Actions", align: "right", render: (plan) => onUpdateCaseStatus ? <button className="secondaryAction" type="button" onClick={() => setTarget(plan)}>Update status</button> : "—" },
          ]}
        />}
      </CardBody>
    </Card>
    {target && onUpdateCaseStatus ? <CaseStatusUpdateModal
      caseTitle={target.chiefComplaint}
      currentStatus={target.status}
      pendingStageCount={target.protocols.flatMap((protocol) => protocol.stages).filter((stage) => stage.status === "pending").length}
      pendingStageNames={target.protocols.flatMap((protocol) => protocol.stages).filter((stage) => stage.status === "pending").map((stage) => stage.stageName)}
      onClose={() => setTarget(null)}
      onSave={async (status, reason) => onUpdateCaseStatus(target.chiefComplaintId, { patientId, expectedRowVersion: target.rowVersion, status, reason })}
    /> : null}
  </>;
}

export default function PatientDrawer({
  selectedPatient,
  onClose,
  showBackButton = true,
  onSubTabChange,
  patientCases,
  patientLabOrders,
  labs,
  onUpdateOrder,
  onUpdateOrderStatus,
  onAssignPendingLabOrder,
  onAddLabOrder,
  onRemoveOrder,
  patientXrays,
  xrayLoadError,
  onMediaChanged,
  onRemoveXray,
  currentPerio,
  patientXraysLoading = false,
  patientPeriodontalLoading = false,
  patientPeriodontalError,
  lastPerioDate,
  onSavePerioChart,
  patientPrescriptions = [],
  patientPrescriptionsLoading = false,
  patientPrescriptionsError,
  onWithdrawPrescription,
  onCorrectPrescription,
  patientNotes = [],
  patientNotesLoading = false,
  patientNotesError,
  onCreatePatientNote,
  onWithdrawPatientNote,
  patientTimeline = [],
  patientTimelineLoading = false,
  patientTimelineError,
  onUpdatePatient,
  followUpList,
  doctorsList,
  patientCanalMeasurements = [],
  onSaveCanalMeasurement,
  patientLabLoading = false,
  patientLabError,
  canViewBillingLedger,
  patientLedger,
  ledgerLoading = false,
  ledgerError,
  onCorrectLedgerEntry,
  onReverseLedgerEntry,
  onRecordPatientPayment,
  patientCoreError,
  patientCoreLoading = false,
  patientFollowUps = [],
  patientFollowUpsLoading = false,
  patientFollowUpsError,
  onCreatePatientFollowUp,
  patientTreatmentPlans = [],
  patientTreatmentPlansLoading = false,
  patientTreatmentPlansError,
  onUpdateCaseStatus,
}: PatientDrawerProps) {
  const patientProfileUpdater = onUpdatePatient ?? (async () => {
    throw new Error("Patient profile changes are unavailable through the Dental OS app bridge.");
  });
  const { route, patch } = useClinicRouteState();
  const requestedSubTabValue = (["profile", "cases", "notes", "timeline", "periodontal", "plan", "lab", "xrays", "prescriptions", "followups", "ledger"] as const).includes(route.params.subpage as TabKey)
    ? route.params.subpage as TabKey
    : "profile";
  const requestedSubTab = requestedSubTabValue === "ledger" && !canViewBillingLedger ? "profile" : requestedSubTabValue;
  const [activeSubTab, setActiveSubTab] = useState<TabKey>(requestedSubTab);
  const [timelineCaseIndex, setTimelineCaseIndex] = useState(0);
  const [treatmentPlanCaseIndex, setTreatmentPlanCaseIndex] = useState(0);

  useEffect(() => {
    setActiveSubTab(requestedSubTab);
  }, [requestedSubTab]);
  useEffect(() => {
    onSubTabChange?.(activeSubTab);
  }, [activeSubTab, onSubTabChange]);
  useEffect(() => {
    if (route.params.subpage === "odontogram" || (!canViewBillingLedger && route.params.subpage === "ledger")) patch({ subpage: null, month: null }, "replace");
  }, [canViewBillingLedger, patch, route.params.subpage]);
  const selectSubTab = useCallback((tab: TabKey) => {
    if (tab === "ledger" && !canViewBillingLedger) {
      setActiveSubTab("profile");
      patch({ subpage: null, month: null }, "replace");
      return;
    }
    setActiveSubTab(tab);
    patch({ subpage: tab === "profile" ? null : tab }, "push");
  }, [canViewBillingLedger, patch]);
  const [xrayDrafts, setXrayDrafts] = useState<XrayDraft[]>([]);
  // Forms states for adding timeline visit entries
  // Keyboard navigation shortcuts when drawer is active
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (
        activeEl &&
        (activeEl.tagName === "INPUT" ||
          activeEl.tagName === "TEXTAREA" ||
          activeEl.tagName === "SELECT")
      ) {
        return;
      }

      // 1–9 then 0, matching the visible tab order.
      if (e.key === "1") selectSubTab("profile");
      else if (e.key === "2") selectSubTab("timeline");
      else if (e.key === "3") selectSubTab("periodontal");
      else if (e.key === "4") selectSubTab("plan");
      else if (e.key === "5") selectSubTab("lab");
      else if (e.key === "6") selectSubTab("xrays");
      else if (e.key === "7") selectSubTab("prescriptions");
      else if (e.key === "8") selectSubTab("followups");
      else if (e.key === "0" && canViewBillingLedger) selectSubTab("ledger");
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  }, [canViewBillingLedger, selectSubTab]);

  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const activeEl = navRef.current?.querySelector(`[data-tab="${activeSubTab}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
    }
  }, [activeSubTab]);

  const timelineCases = useMemo(
    () => buildClinicalTimelineCases(patientTimeline, patientTreatmentPlans),
    [patientTimeline, patientTreatmentPlans],
  );
  const treatmentPlanCases = useMemo(
    () => [...patientTreatmentPlans].sort((left, right) => Number(right.status === "open") - Number(left.status === "open")),
    [patientTreatmentPlans],
  );

  useEffect(() => {
    setTimelineCaseIndex(0);
    setTreatmentPlanCaseIndex(0);
  }, [selectedPatient.id]);

  useEffect(() => {
    setTimelineCaseIndex((current) => Math.min(current, Math.max(0, timelineCases.length - 1)));
  }, [timelineCases.length]);

  useEffect(() => {
    setTreatmentPlanCaseIndex((current) => Math.min(current, Math.max(0, treatmentPlanCases.length - 1)));
  }, [treatmentPlanCases.length]);

  useEffect(() => {
    const caseId = route.params.caseId;
    if (!caseId) return;
    const timelineIndex = timelineCases.findIndex((entry) => entry.caseId === caseId);
    const planIndex = treatmentPlanCases.findIndex((entry) => entry.chiefComplaintId === caseId);
    if (timelineIndex >= 0) setTimelineCaseIndex(timelineIndex);
    if (planIndex >= 0) setTreatmentPlanCaseIndex(planIndex);
    if (!patientTimelineLoading && !patientTreatmentPlansLoading && timelineIndex < 0 && planIndex < 0) patch({ caseId: null }, "replace");
  }, [patch, patientTimelineLoading, patientTreatmentPlansLoading, route.params.caseId, timelineCases, treatmentPlanCases]);

  const matchingFollowUp = followUpList.find((f) => f.patient === selectedPatient.name);
  return (
    <>
      <div className={styles.patientDetailPage}>
        <div className={styles.fullPageSheet} data-patient-record-layout>
        {/* Left Sidebar */}
        <div className={styles.patientSidebar}>
          <nav ref={navRef} className={styles.tabBar} aria-label="Patient record sections">
            <div className={styles.sidebarHeading}>Patient record</div>
            {showBackButton ? <button
              className={`${styles.tabBtn} ${styles.sidebarBackButton}`}
              onClick={onClose}
              type="button"
            >
              <ChevronLeft aria-hidden="true" size={17} /> Back
            </button> : null}
            <button
              data-tab="profile"
              className={`${styles.tabBtn} ${activeSubTab === "profile" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("profile")}
            >
              <User size={17} /> Patient Profile
            </button>
            <button
              data-tab="cases"
              className={`${styles.tabBtn} ${activeSubTab === "cases" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("cases")}
            >
              <FileText size={17} /> Chief Complaints
            </button>
            <button
              data-tab="notes"
              className={`${styles.tabBtn} ${activeSubTab === "notes" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("notes")}
            >
              <FileText size={17} /> Patient Notes
            </button>
            <button
              data-tab="timeline"
              className={`${styles.tabBtn} ${activeSubTab === "timeline" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("timeline")}
            >
              <Clock size={17} /> Clinical Timeline
            </button>
            <button
              data-tab="periodontal"
              className={`${styles.tabBtn} ${activeSubTab === "periodontal" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("periodontal")}
            >
              <Activity size={17} /> Periodontal Chart
            </button>
            <button
              data-tab="plan"
              className={`${styles.tabBtn} ${activeSubTab === "plan" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("plan")}
            >
              <FileText size={17} /> Treatment Plan
            </button>
            <button
              data-tab="lab"
              className={`${styles.tabBtn} ${activeSubTab === "lab" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("lab")}
            >
              <FlaskConical size={17} /> Lab
            </button>
            <button
              data-tab="xrays"
              className={`${styles.tabBtn} ${activeSubTab === "xrays" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("xrays")}
            >
              <ImageIcon size={17} /> X-Ray Imaging
            </button>
            <button
              data-tab="prescriptions"
              className={`${styles.tabBtn} ${activeSubTab === "prescriptions" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("prescriptions")}
            >
              <Pill size={17} /> Prescriptions
            </button>
            <button
              data-tab="followups"
              className={`${styles.tabBtn} ${activeSubTab === "followups" ? styles.tabBtnActive : ""}`}
              onClick={() => selectSubTab("followups")}
            >
              <BellRing size={17} /> Follow-Ups
            </button>
            {canViewBillingLedger ? (
              <button
                data-tab="ledger"
                className={`${styles.tabBtn} ${activeSubTab === "ledger" ? styles.tabBtnActive : ""}`}
                onClick={() => selectSubTab("ledger")}
              >
                <WalletCards size={17} /> Billing Ledger
              </button>
            ) : null}
          </nav>
        </div>

        {/* Right Content Area */}
        <div className={styles.contentArea}>
          {activeSubTab === "timeline" && timelineCases.length > 1 ? (
            <div className={styles.timelineCaseNavigation} aria-label="Clinical case navigation">
              <button type="button" disabled={timelineCaseIndex === 0} onClick={() => patch({ caseId: timelineCases[timelineCaseIndex - 1]?.caseId ?? null }, "push")}>
                <ChevronLeft aria-hidden="true" size={16} /> Previous case
              </button>
              <button type="button" disabled={timelineCaseIndex === timelineCases.length - 1} onClick={() => patch({ caseId: timelineCases[timelineCaseIndex + 1]?.caseId ?? null }, "push")}>
                Next case <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>
          ) : activeSubTab === "plan" && treatmentPlanCases.length > 1 ? (
            <div className={styles.timelineCaseNavigation} aria-label="Treatment plan case navigation">
              <button type="button" disabled={treatmentPlanCaseIndex === 0} onClick={() => patch({ caseId: treatmentPlanCases[treatmentPlanCaseIndex - 1]?.chiefComplaintId ?? null }, "push")}>
                <ChevronLeft aria-hidden="true" size={16} /> Previous case
              </button>
              <button type="button" disabled={treatmentPlanCaseIndex === treatmentPlanCases.length - 1} onClick={() => patch({ caseId: treatmentPlanCases[treatmentPlanCaseIndex + 1]?.chiefComplaintId ?? null }, "push")}>
                Next case <ChevronRight aria-hidden="true" size={16} />
              </button>
            </div>
          ) : null}
          <div className={styles.body}>
            <div className={styles.tabContent}>
            {activeSubTab === "profile" && (
              <>
                {patientCoreError && (
                  <div role="alert" style={{ marginBottom: "14px", padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: "var(--fs-13)" }}>
                    The authoritative patient profile could not be refreshed. {patientCoreError}
                  </div>
                )}
                {patientCoreLoading
                  ? <p role="status">Loading patient record…</p>
                  : <PatientProfileTab
                      patientName={selectedPatient.name}
                      patientDetail={selectedPatient}
                      phone={selectedPatient.phone || matchingFollowUp?.phone || ""}
                      onUpdatePatient={(patch) => patientProfileUpdater(selectedPatient.id, patch)}
                      doctorsList={doctorsList}
                    />}
              </>
            )}

            {activeSubTab === "cases" && <PatientChiefComplaintsTab
              patientId={selectedPatient.id}
              plans={patientTreatmentPlans}
              loading={patientTreatmentPlansLoading}
              error={patientTreatmentPlansError}
              onUpdateCaseStatus={onUpdateCaseStatus}
            />}

            {activeSubTab === "notes" && (
              <PatientNotesTab
                notes={patientNotes}
                loading={patientNotesLoading}
                error={patientNotesError}
                onCreate={onCreatePatientNote}
                onWithdraw={onWithdrawPatientNote}
              />
            )}

            {activeSubTab === "timeline" && (
              <PatientTimelineHistoryTab timeline={patientTimeline} plans={patientTreatmentPlans} loading={patientTimelineLoading || patientTreatmentPlansLoading} error={patientTimelineError || patientTreatmentPlansError} selectedCaseId={timelineCases[timelineCaseIndex]?.caseId} />
            )}

            {activeSubTab === "periodontal" && (
              <>
                {patientPeriodontalError && <div role="alert" style={{ marginBottom: "14px", padding: "10px 12px", border: "1px solid #fecaca", background: "#fef2f2", color: "#b91c1c", fontSize: "var(--fs-13)" }}>{patientPeriodontalError}</div>}
                {patientPeriodontalLoading
                  ? <p role="status">Loading periodontal chart…</p>
                  : <PeriodontalChart initialPerioData={currentPerio} lastChartedOn={lastPerioDate} onSave={onSavePerioChart} />}
              </>
            )}

             {activeSubTab === "plan" && <PatientTreatmentPlansTab plans={treatmentPlanCases} timeline={patientTimeline} canalMeasurements={patientCanalMeasurements} loading={patientTreatmentPlansLoading || patientTimelineLoading} error={patientTreatmentPlansError || patientTimelineError} selectedCaseId={treatmentPlanCases[treatmentPlanCaseIndex]?.chiefComplaintId} onSaveCanalMeasurement={onSaveCanalMeasurement} />}

            {activeSubTab === "lab" && (
              <PatientLabTab
                orders={patientLabOrders}
                cases={patientCases ?? []}
                labs={labs}
                onUpdateOrder={onUpdateOrder}
                onUpdateOrderStatus={onUpdateOrderStatus}
                onAssignPendingLabOrder={onAssignPendingLabOrder}
                onAddLabOrder={onAddLabOrder}
                onRemoveOrder={onRemoveOrder}
                loading={patientLabLoading}
                loadError={patientLabError}
                patientId={selectedPatient.id}
                patientName={selectedPatient.name}
              />
            )}

            {activeSubTab === "xrays" && (
              <>
                {xrayLoadError && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: "14px",
                      padding: "10px 12px",
                      border: "1px solid #fecaca",
                      background: "#fef2f2",
                      color: "#b91c1c",
                      fontSize: "var(--fs-13)",
                      fontWeight: "var(--fw-medium)",
                    }}
                  >
                    {xrayLoadError}
                  </div>
                )}
                <Card style={{ marginBottom: "14px", maxWidth: "540px" }}>
                  <CardHeader title={<><ImageIcon size={16} /> Add radiograph / image</>} />
                  <CardBody>
                    <RadiographUploader
                      drafts={xrayDrafts}
                      setDrafts={setXrayDrafts}
                      patientId={selectedPatient.id}
                      defaultType="IOPA"
                      onUploaded={onMediaChanged}
                    />
                  </CardBody>
                </Card>
                <XRayGallery
                  xrays={patientXrays}
                  isLoading={patientXraysLoading}
                  onDeleteXray={onRemoveXray}
                />
              </>
            )}

            {activeSubTab === "prescriptions" && (
              <PatientPrescriptionHistoryTab
                prescriptions={patientPrescriptions}
                loading={patientPrescriptionsLoading}
                error={patientPrescriptionsError}
                onWithdraw={onWithdrawPrescription}
                onCorrect={onCorrectPrescription}
              />
            )}

            {activeSubTab === "followups" && (
              <PatientFollowUpHistoryTab
                followUps={patientFollowUps}
                loading={patientFollowUpsLoading}
                error={patientFollowUpsError}
                onCreate={onCreatePatientFollowUp}
              />
            )}

            {canViewBillingLedger && activeSubTab === "ledger" && (
              <PatientBillingLedgerTab
                ledger={patientLedger}
                loading={ledgerLoading}
                error={ledgerError}
                onCorrect={onCorrectLedgerEntry}
                onReverse={onReverseLedgerEntry}
                onRecordPayment={onRecordPatientPayment}
              />
            )}
            </div>
          </div>
        </div>
        </div>
      </div>

    </>
  );
}
