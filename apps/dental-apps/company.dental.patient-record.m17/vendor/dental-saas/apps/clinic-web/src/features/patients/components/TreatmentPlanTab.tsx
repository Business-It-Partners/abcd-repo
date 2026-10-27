"use client";

import { useState } from "react";
import styles from "@/features/patients/patient-record.module.css";
import { ListChecks, Plus, Pencil, Trash2, Check, Stethoscope, CheckCircle2, Sparkles, X, Hand } from "lucide-react";
import { formatNpr, displayToISO, formatDateShort } from "@/features/patients/model/domain";
import {
  type Case,
  type CaseStage,
  type CaseOutcome,
  defaultProtocols,
  defaultFeeSchedule,
  sortStagesByGrade,
  nextCaseStageOrder,
  type FeeScheduleItem,
  type TreatmentProtocol,
} from "@/features/work-entry/model/caseData";
import { type CanalChartData } from "@/features/work-entry/model/canalData";
import { type PlanAppendDraft } from "@/features/work-entry/model/draftTypes";
import { Modal, ModalBody, Field, Input } from "@/shared/ui/workspace-primitives";
import AddTreatmentPlanModal, { type TreatmentPlanStepDraft } from "@/features/work-entry/components/AddTreatmentPlanModal";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";

import { useSnackbar } from "@/shared/ui/SnackbarProvider";

interface TreatmentPlanTabProps {
  cases?: Case[];
  protocols?: TreatmentProtocol[];
  feeSchedule?: FeeScheduleItem[];
  /** Record/amend the clinical outcome of a CLEARED case. Absent = read-only view. */
  onSetOutcome?: (caseId: string, outcome: CaseOutcome) => void;
  onUpdateCase?: (caseId: string, patch: Partial<Case>) => Promise<void> | void;
  /** Optional append seam supplied by the owning Work Entry workflow. */
  onAppendTrustedPlan?: (clinicalCase: Case, draft: PlanAppendDraft) => Promise<boolean>;
  canalHistory?: CanalChartData[];
  openCanalDrawer?: (tooth: string, treatmentId?: string) => void;
}

type PhaseKey = NonNullable<Case["phase"]>;

const OUTCOME_STYLE: Record<CaseOutcome, { label: string; bg: string; color: string; border: string }> = {
  success: { label: "Success", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" },
  partial: { label: "Partial", bg: "#fffbeb", color: "#d97706", border: "#fde68a" },
  failure: { label: "Failure", bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
};

const OUTCOMES: CaseOutcome[] = ["success", "partial", "failure"];

function lastActivity(c: Case): string {
  const dates = c.stages.map((s) => s.doneDate).filter((d): d is string => !!d);
  if (!dates.length) return c.createdDate;
  return dates.reduce((a, b) => ((displayToISO(b) ?? "") > (displayToISO(a) ?? "") ? b : a));
}

interface StepInput {
  label: string;
  procedureCode?: string;
  tooth: string;
  agreedCost: number;
  grade?: string;
  gradeLabel?: string;
}

export default function TreatmentPlanTab({
  cases,
  protocols,
  feeSchedule,
  onSetOutcome,
  onUpdateCase,
  onAppendTrustedPlan,
  canalHistory,
  openCanalDrawer,
}: TreatmentPlanTabProps) {
  if (!cases || cases.length === 0) {
    return (
      <div className={styles.tabContent}>
        <section className={styles.card}>
          <div className={styles.cardHeader}>
            <h3 className={styles.cardTitle}>
              <ListChecks size={16} /> Treatment Plan
            </h3>
          </div>
          <p style={{ padding: "18px 4px", fontSize: "var(--fs-14)", color: "#1e293b", margin: 0 }}>
            No treatment case open for this patient. Start one from <strong>New Case</strong> to
            build a staged plan with quote-locked costs.
          </p>
        </section>
      </div>
    );
  }

  const ordered = [...cases].sort((a, b) => {
    if (a.status === b.status) return 0;
    return a.status === "open" ? -1 : b.status === "open" ? 1 : 0;
  });

  return (
    <div className={styles.tabContent}>
      {ordered.map((c) => (
        <CaseCard
          key={c.id}
          caseItem={c}
          protocols={protocols}
          feeSchedule={feeSchedule}
          onSetOutcome={onSetOutcome}
          onUpdateCase={onUpdateCase}
          onAppendTrustedPlan={onAppendTrustedPlan}
          canalHistory={canalHistory}
          openCanalDrawer={openCanalDrawer}
        />
      ))}
    </div>
  );
}

function CaseCard({
  caseItem,
  protocols,
  feeSchedule,
  onSetOutcome,
  onUpdateCase,
  onAppendTrustedPlan,
  canalHistory,
  openCanalDrawer,
}: {
  caseItem: Case;
  protocols?: TreatmentProtocol[];
  feeSchedule?: FeeScheduleItem[];
  onSetOutcome?: (caseId: string, outcome: CaseOutcome) => void;
  onUpdateCase?: (caseId: string, patch: Partial<Case>) => Promise<void> | void;
  onAppendTrustedPlan?: (clinicalCase: Case, draft: PlanAppendDraft) => Promise<boolean>;
  canalHistory?: CanalChartData[];
  openCanalDrawer?: (tooth: string, treatmentId?: string) => void;
}) {
  const { showToast } = useSnackbar();
  // Modal state for adding new treatment plan to this case
  const [showAddPlanModal, setShowAddPlanModal] = useState(false);

  // Modal state for editing an existing treatment plan group
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [groupPendingDelete, setGroupPendingDelete] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPhase] = useState<PhaseKey>("basic");
  const [editSteps, setEditSteps] = useState<(StepInput & { order: number; status: CaseStage["status"]; doneDate?: string; doneBy?: string })[]>([]);
  const [editGrade, setEditGrade] = useState<string>("1");

  // Add Stage Popup Modal state
  const [showAddStageModal, setShowAddStageModal] = useState(false);
  const [addingStageGroupKey, setAddingStageGroupKey] = useState<string | null>(null);
  const [newStageGrade, setNewStageGrade] = useState("1");
  const [addStageRows, setAddStageRows] = useState<
    { id: string; label: string; cost: number | string }[]
  >([{ id: "1", label: "", cost: 1000 }]);

  const handleSaveNewStageInline = async (groupKey: string) => {
    const validRows = addStageRows.filter((r) => r.label.trim() !== "");
    if (!onUpdateCase || validRows.length === 0 || !caseItem) return;
    const groupStages = caseItem.stages.filter((s) => (s.group || caseItem.title) === groupKey);
    const toothNum = groupStages.find((s) => s.tooth)?.tooth || "14";
    const isMobility = /mobility/i.test(groupKey);
    const gLabel = newStageGrade === "1" ? "Grade I" : newStageGrade === "2" ? "Grade II" : "Grade III";

    const firstNewOrder = nextCaseStageOrder(caseItem.stages);
    const newStages: CaseStage[] = validRows.map((r, idx) => ({
      order: firstNewOrder + idx,
      label: r.label.trim(),
      procedureCode: "PROC-GENERIC",
      tooth: toothNum,
      agreedCost: Number(r.cost) || 0,
      status: "pending",
      group: groupKey,
      grade: isMobility ? newStageGrade : undefined,
      gradeLabel: isMobility ? gLabel : undefined,
    }));

    const updatedStages = [...caseItem.stages, ...newStages];
    const newAgreedTotal = updatedStages.reduce((sum, s) => sum + s.agreedCost, 0);

    await onUpdateCase(caseItem.id, {
      stages: updatedStages,
      agreedTotal: newAgreedTotal,
    });

    setAddingStageGroupKey(null);
    setShowAddStageModal(false);
    showToast(`Added ${validRows.length} stage(s) to ${groupKey}`);
  };

  const total = caseItem.stages.length;
  const done = caseItem.stages.filter((s) => s.status === "done").length;
  const cleared = done === total && total > 0;

  const statusMeta =
    caseItem.status === "completed"
      ? { label: "Completed", bg: "#f0fdf4", color: "#16a34a", border: "#bbf7d0" }
      : caseItem.status === "cancelled"
        ? { label: "Cancelled", bg: "#f8fafc", color: "#475569", border: "#e2e8f0" }
        : { label: "Open", bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" };
  const outcomeMeta = caseItem.outcome ? OUTCOME_STYLE[caseItem.outcome] : null;

  const complaint = caseItem.chiefComplaint?.trim();
  const started = formatDateShort(caseItem.createdDate);
  const last = formatDateShort(lastActivity(caseItem));
  const subtitle = last && last !== started ? `${started} → ${last}` : started;

  const byOrder = (a: CaseStage, b: CaseStage) => a.order - b.order;

  const groups: { key: string; heading: string; phase: PhaseKey | undefined; stages: CaseStage[] }[] = [];
  for (const stage of [...caseItem.stages].sort(byOrder)) {
    const key = stage.group || caseItem.title;
    const existing = groups.find((g) => g.key === key);
    if (existing) existing.stages.push(stage);
    else groups.push({ key, heading: key, phase: stage.phase, stages: [stage] });
  }

  const treatmentsLabel = groups.map((g) => g.heading).join(" + ");
  const heading = complaint || treatmentsLabel;

  // Match the New Patient flow: clinic-saved protocols and fees are authoritative. The compiled
  // values are only the fallback for a clinic with no configuration document yet.
  const activeProtocols = protocols && protocols.length > 0 ? protocols : defaultProtocols;
  const activeFeeSchedule = feeSchedule && feeSchedule.length > 0 ? feeSchedule : defaultFeeSchedule;

  const handleSharedTreatmentPlan = async (draft: { title: string; tooth: string; toothSpecific: boolean; phase: PhaseKey; steps: TreatmentPlanStepDraft[] }) => {
    if (onAppendTrustedPlan && await onAppendTrustedPlan(caseItem, draft)) {
      setShowAddPlanModal(false);
      return;
    }
    if (!onUpdateCase) return;
    const maxOrder = Math.max(0, ...caseItem.stages.map((stage) => stage.order));
    const newStages: CaseStage[] = draft.steps.map((step, index) => ({
      order: maxOrder + index + 1,
      label: step.label.trim(),
      procedureCode: step.procedureCode || "PROC-GENERIC",
      tooth: draft.toothSpecific ? (step.tooth.trim() || draft.tooth || "14") : step.tooth,
      agreedCost: step.agreedCost || 0,
      status: "pending",
      group: draft.title,
      phase: draft.phase,
      recordCanals: step.recordCanals,
      grade: step.grade,
      gradeLabel: step.gradeLabel,
    }));
    const stages = [...caseItem.stages, ...newStages];
    await onUpdateCase(caseItem.id, { stages, agreedTotal: stages.reduce((sum, stage) => sum + stage.agreedCost, 0) });
    setShowAddPlanModal(false);
  };

  // Save Edit Treatment Plan Group
  const handleSaveEditGroup = async () => {
    if (!editingGroupKey || !onUpdateCase) return;

    const remainingStages = caseItem.stages.filter(
      (s) => (s.group || caseItem.title) !== editingGroupKey
    );

    const updatedGroupStages: CaseStage[] = editSteps
      .filter((s) => s.label.trim() !== "")
      .map((step, idx) => ({
        order: step.order || remainingStages.length + 1 + idx,
        label: step.label.trim(),
        procedureCode: "PROC-GENERIC",
        tooth: step.tooth.trim() || "14",
        agreedCost: step.agreedCost || 0,
        status: step.status || "pending",
        doneDate: step.doneDate,
        doneBy: step.doneBy,
        group: editTitle.trim(),
        phase: editPhase,
        grade: step.grade,
        gradeLabel: step.gradeLabel,
      }));

    const finalStages = [...remainingStages, ...updatedGroupStages].map((stage, idx) => ({
      ...stage,
      order: idx + 1,
    }));
    const newAgreedTotal = finalStages.reduce((sum, s) => sum + s.agreedCost, 0);

    let updatedMobilityGrade = caseItem.mobilityGrade;
    let updatedLog = caseItem.gradeProgressionLog;

    if (/mobility/i.test(editTitle)) {
      const currentG = caseItem.mobilityGrade || "1";
      if (parseInt(editGrade) > parseInt(currentG)) {
        const gradeLabels: Record<string, string> = { "1": "Grade I", "2": "Grade II", "3": "Grade III" };
        const newLogEntry = {
          from: gradeLabels[currentG] || `Grade ${currentG}`,
          to: gradeLabels[editGrade] || `Grade ${editGrade}`,
          date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          by: caseItem.doctor || "Doctor",
        };
        updatedMobilityGrade = editGrade;
        updatedLog = [...(updatedLog || []), newLogEntry];
      }
    }

    await onUpdateCase(caseItem.id, {
      stages: finalStages,
      agreedTotal: newAgreedTotal,
      mobilityGrade: updatedMobilityGrade,
      gradeProgressionLog: updatedLog,
    });

    setEditingGroupKey(null);
  };

  // Delete Treatment Plan Group
  const handleDeleteGroup = async (groupKey: string) => {
    if (!onUpdateCase) return;

    const remainingStages = caseItem.stages.filter(
      (s) => (s.group || caseItem.title) !== groupKey
    );
    const newAgreedTotal = remainingStages.reduce((sum, s) => sum + s.agreedCost, 0);

    await onUpdateCase(caseItem.id, {
      stages: remainingStages,
      agreedTotal: newAgreedTotal,
    });
  };

  const handleDeleteSingleStage = async (stageOrder: number, stageLabel: string) => {
    if (!onUpdateCase) return;
    const remainingStages = caseItem.stages.filter((s) => s.order !== stageOrder);
    const newAgreedTotal = remainingStages.reduce((sum, s) => sum + s.agreedCost, 0);

    await onUpdateCase(caseItem.id, {
      stages: remainingStages,
      agreedTotal: newAgreedTotal,
    });

    showToast(`Stage "${stageLabel}" removed from treatment plan.`);
  };

  const handleReorderStages = async (groupKey: string, fromOrder: number, toOrder: number) => {
    if (!onUpdateCase || fromOrder === toOrder) return;

    const groupStages = caseItem.stages
      .filter((stage) => (stage.group || caseItem.title) === groupKey)
      .sort((a, b) => a.order - b.order);
    const source = groupStages.findIndex((stage) => stage.order === fromOrder);
    const destination = groupStages.findIndex((stage) => stage.order === toOrder);
    if (source < 0 || destination < 0) return;

    const reordered = [...groupStages];
    const [moved] = reordered.splice(source, 1);
    reordered.splice(destination, 0, moved);
    const orderForStage = new Map(reordered.map((stage, index) => [stage.order, groupStages[index].order]));
    const finalStages = caseItem.stages.map((stage) => {
      const nextOrder = orderForStage.get(stage.order);
      return nextOrder == null ? stage : { ...stage, order: nextOrder };
    });

    await onUpdateCase(caseItem.id, { stages: finalStages });
  };

  const editTotalCost = editSteps.reduce((sum, s) => sum + (s.agreedCost || 0), 0);

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(heading);

  const handleSaveTitle = async () => {
    if (onUpdateCase && editedTitle.trim()) {
      await onUpdateCase(caseItem.id, {
        chiefComplaint: editedTitle.trim(),
        title: editedTitle.trim(),
      });
    }
    setIsEditingTitle(false);
  };

  return (
    <section
      className={styles.card}
      style={{
        borderRadius: "0px",
        border: "1px solid #e2e8f0",
        boxShadow: "0 2px 8px rgba(15, 23, 42, 0.035)",
        marginBottom: "16px",
      }}
    >
      <div className={styles.cardHeader} style={{ flexDirection: "column", gap: "12px", alignItems: "stretch" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <h3 className={styles.cardTitle} style={{ fontSize: "var(--fs-17)", fontWeight: "var(--fw-bold)", color: "#1e293b", display: "flex", alignItems: "center", gap: "8px" }}>
              <ListChecks size={18} style={{ color: "var(--acc)" }} />
              {isEditingTitle ? (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Input
                    style={{ fontSize: "14px", height: "30px", width: "240px" }}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveTitle();
                      }
                    }}
                  />
                  <button type="button" onClick={handleSaveTitle} className="btn btn-primary btn-sm" style={{ padding: "2px 8px", fontSize: "12px" }}>
                    <Check size={12} /> Save
                  </button>
                  <button type="button" onClick={() => setIsEditingTitle(false)} className="btn btn-secondary btn-sm" style={{ padding: "2px 8px", fontSize: "12px" }}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{heading}</span>
                  {onUpdateCase && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditedTitle(heading);
                        setIsEditingTitle(true);
                      }}
                      style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b", padding: "2px" }}
                      title="Rename Treatment Case Title"
                    >
                      <Pencil size={13} />
                    </button>
                  )}
                </div>
              )}
            </h3>
            <span style={{ display: "block", marginTop: "4px", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#64748b" }}>
              {subtitle}
            </span>
            {caseItem.gradeProgressionLog && caseItem.gradeProgressionLog.length > 0 && (
              <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#7c3aed" }}>
                  Progression:
                </span>
                {caseItem.gradeProgressionLog.map((log, lIdx) => (
                  <span key={lIdx} style={{ fontSize: "11px", color: "#475569", background: "#f5f3ff", padding: "2px 8px", borderRadius: "12px", border: "1px solid #ddd6fe" }}>
                    {log.from} → <strong>{log.to}</strong> ({formatDateShort(log.date)})
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            <span
              style={{
                fontSize: "var(--fs-12)",
                fontWeight: "var(--fw-medium)",
                padding: "4px 12px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                background: statusMeta.bg,
                color: statusMeta.color,
                border: `1px solid ${statusMeta.border}`,
              }}
            >
              {statusMeta.label}
            </span>

            <span
              style={{
                fontSize: "var(--fs-12)",
                fontWeight: "var(--fw-bold)",
                padding: "4px 12px",
                borderRadius: "20px",
                whiteSpace: "nowrap",
                background: cleared ? "#f0fdf4" : "#fffbeb",
                color: cleared ? "#16a34a" : "#d97706",
                border: `1px solid ${cleared ? "#bbf7d0" : "#fde68a"}`,
              }}
            >
              {done} of {total} done
            </span>

            {onSetOutcome && (
              <select
                value={caseItem.outcome ?? ""}
                onChange={(e) => e.target.value && onSetOutcome(caseItem.id, e.target.value as CaseOutcome)}
                style={{
                  fontSize: "var(--fs-12)",
                  fontWeight: "var(--fw-medium)",
                  padding: "5px 12px",
                  borderRadius: "20px",
                  cursor: "pointer",
                  fontFamily: "inherit",
                  background: outcomeMeta ? outcomeMeta.bg : "#fff",
                  color: outcomeMeta ? outcomeMeta.color : "#64748b",
                  border: `1px solid ${outcomeMeta ? outcomeMeta.border : "#cbd5e1"}`,
                }}
              >
                <option value="" disabled>Set outcome…</option>
                {OUTCOMES.map((o) => (
                  <option key={o} value={o}>{OUTCOME_STYLE[o].label}</option>
                ))}
              </select>
            )}

            {/* + Add Treatment Plan Button */}
            {onUpdateCase && (
              <button
                type="button"
                onClick={() => setShowAddPlanModal(true)}
                className="btn btn-primary"
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-13)" }}
              >
                <Plus size={14} /> Add Treatment Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Grid of Treatment Plans under this case — 2 cards per row on laptop screens (< 1500px) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 360px), 1fr))", gap: "14px", alignItems: "stretch", marginTop: "8px", padding: "14px" }}>
        {groups.map((group) => {
          const gDone = group.stages.filter((s) => s.status === "done").length;
          const gTotal = group.stages.reduce((sum, s) => sum + s.agreedCost, 0);
          const gCleared = gDone === group.stages.length;
          const hasExplicitCanalSetting = group.stages.some((stage) => typeof stage.recordCanals === "boolean");
          const needsCanalDetails = group.stages.some((stage) => stage.recordCanals === true)
            || (!hasExplicitCanalSetting && (/root\s*canal|rct/i.test(group.heading) || group.stages.some((stage) => /root\s*canal|rct/i.test(stage.label))));

          return (
            <div
              key={group.key}
              style={{
                border: "1px solid #e2e8f0",
                borderRadius: "0px",
                background: "#ffffff",
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                height: "100%",
                boxSizing: "border-box",
                boxShadow: "none",
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ paddingBottom: "12px", marginBottom: "10px", borderBottom: "1px solid #f1f5f9" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap", minWidth: 0 }}>
                    <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "#1e293b" }}>
                      {group.heading.replace(/\s*\(\s*Grade\s*(?:I{1,3}|V?I{0,3}|\d+)\s*\)/gi, "")}
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span
                      style={{
                        fontSize: "var(--fs-12)",
                        fontWeight: "var(--fw-bold)",
                        color: gCleared ? "#10b981" : "#64748b",
                        whiteSpace: "nowrap",
                        marginRight: "4px",
                      }}
                    >
                      {gDone}/{group.stages.length}
                    </span>

                    {/* Delete Action Button for Treatment Plan Group */}
                    {onUpdateCase && (
                      <button
                        type="button"
                        onClick={() => setGroupPendingDelete(group.key)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: "3px 7px", color: "#dc2626" }}
                        title="Delete Treatment Plan"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
                  <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>
                    {formatNpr(gTotal)}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                {sortStagesByGrade(group.stages).map((stage, sIdx) => (
                  <StageRow
                    key={`${stage.order}-${stage.label}-${sIdx}`}
                    displayIndex={sIdx + 1}
                    stage={stage}
                    groupHeading={group.heading}
                    onDeleteStage={onUpdateCase ? handleDeleteSingleStage : undefined}
                    onReorderStage={onUpdateCase ? (fromOrder, toOrder) => handleReorderStages(group.key, fromOrder, toOrder) : undefined}
                  />
                ))}
              </div>

              {/* Add Stage Button triggering Popup Modal */}
              {onUpdateCase && (
                <button
                  type="button"
                  onClick={() => {
                    setAddingStageGroupKey(group.key);
                    const lastGraded = [...group.stages].reverse().find((s) => s.grade);
                    setNewStageGrade(lastGraded?.grade || "1");
                    setAddStageRows([{ id: "1", label: "", cost: 1000 }]);
                    setShowAddStageModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ marginTop: needsCanalDetails ? "8px" : "auto", minWidth: "148px", minHeight: "36px", paddingTop: needsCanalDetails ? undefined : "8px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "var(--fs-13)", color: "#6d28d9", borderColor: "#ddd6fe", background: "#fcf8ff" }}
                >
                  <Plus size={13} /> Add Stage
                </button>
              )}

              {/* Root Canal working-length button */}
              {needsCanalDetails && openCanalDrawer && (() => {
                const treatmentId = group.stages.find((s) => s.treatmentId)?.treatmentId;
                const toothNum = group.stages.find((s) => s.tooth)?.tooth || (group.heading.match(/\b(\d{2})\b/)?.[1] ?? "");
                const canalData = canalHistory?.find((c) => (treatmentId && c.treatmentId === treatmentId) || c.tooth === toothNum);
                const hasCanalData = !!canalData && Array.isArray(canalData.canals) && canalData.canals.length > 0;
                return (
                  <div style={{ marginTop: "14px", paddingTop: "12px", borderTop: "1px dashed #cbd5e1" }}>
                    <button
                      type="button"
                      onClick={() => openCanalDrawer(toothNum || "16", treatmentId)}
                      className="btn btn-secondary"
                      style={{
                        width: "fit-content",
                        maxWidth: "100%",
                        minWidth: "228px",
                        border: "1px solid #d8b4fe",
                        background: hasCanalData ? "linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)" : "#ffffff",
                        color: "#6b21a8",
                        padding: "9px 14px",
                        borderRadius: "0px",
                        fontSize: "var(--fs-13)",
                        fontWeight: "var(--fw-bold)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        boxShadow: "0 2px 6px rgba(124, 58, 237, 0.08)",
                        transition: "all 0.2s ease",
                        whiteSpace: "normal",
                      }}
                    >
                      <Stethoscope size={15} style={{ color: "#7c3aed" }} />
                      {hasCanalData ? (
                        <span>Canals: {(canalData?.canals || []).map((cn) => `${cn.canal}: ${cn.lengthMm}mm`).join(" · ")} ✎ Edit</span>
                      ) : (
                        <span>Working Length & Canal Details</span>
                      )}
                    </button>
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Modal: Add Treatment Plan with Categorized Protocol Presets & FDI Tooth Selector */}
      <AddTreatmentPlanModal
        open={showAddPlanModal}
        protocols={activeProtocols}
        feeSchedule={activeFeeSchedule}
        onClose={() => setShowAddPlanModal(false)}
        onSubmit={handleSharedTreatmentPlan}
      />
      {/* Modal: Edit Treatment Plan */}
      {editingGroupKey && (
        <Modal title={<><Pencil size={18} style={{ color: "#7c3aed" }} /> Edit Treatment Plan</>} onClose={() => setEditingGroupKey(null)} maxWidth={760}>
          <ModalBody as="form" onSubmit={(e) => { e.preventDefault(); handleSaveEditGroup(); }}>
            {/* Mobility Grade Progression Selector */}
            {/mobility/i.test(editTitle) && (() => {
              const activeProtocolsList = activeProtocols;
              const mobProto = activeProtocolsList.find((p) => p.id === "PROTO-MOBILITY");
              const gradesList = mobProto?.grades || [
                { id: "1", label: "Grade I", stages: mobProto?.stages || [] },
                { id: "2", label: "Grade II", stages: mobProto?.stages || [] },
                { id: "3", label: "Grade III", stages: mobProto?.stages || [] },
              ];

              const baselineGrade =
                caseItem.mobilityGrade ||
                editSteps.find((s) => s.grade)?.grade ||
                (editTitle.match(/\bGrade\s*III\b/i) ? "3" : editTitle.match(/\bGrade\s*II\b/i) ? "2" : "1");

              return (
                <div style={{ marginBottom: "16px", background: "#fcf5ff", padding: "12px 14px", borderRadius: "12px", border: "1px solid #e9d5ff" }}>
                  <label style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#7c3aed", display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <Sparkles size={14} /> Mobility Grade Selector
                    <span style={{ fontSize: "11px", fontWeight: "var(--fw-normal)", color: "#64748b" }}>
                      (Ascending only · Past grades locked 🔒)
                    </span>
                  </label>

                  <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                    {gradesList.map((gradeItem) => {
                      const isPast = parseInt(gradeItem.id) < parseInt(baselineGrade);
                      const isActive = gradeItem.id === editGrade;
                      const isUp = parseInt(gradeItem.id) > parseInt(baselineGrade);

                      return (
                        <button
                          key={gradeItem.id}
                          type="button"
                          disabled={isPast}
                          onClick={() => {
                            if (isPast) return;
                            setEditGrade(gradeItem.id);
                            const tMatch = editTitle.match(/·\s*(\d+)/);
                            const toothStr = tMatch ? tMatch[1] : (editSteps[0]?.tooth || "21");
                            setEditTitle(`Mobility (${gradeItem.label}) · ${toothStr}`);
                          }}
                          style={{
                            flex: 1,
                            padding: "8px 10px",
                            borderRadius: "8px",
                            fontSize: "var(--fs-12)",
                            fontWeight: "var(--fw-bold)",
                            border: isActive ? "1.5px solid #7c3aed" : isPast ? "1px solid #f1f5f9" : "1px solid #cbd5e1",
                            background: isActive ? "#7c3aed" : isPast ? "#f8fafc" : "#ffffff",
                            color: isActive ? "#ffffff" : isPast ? "#94a3b8" : "#475569",
                            cursor: isPast ? "not-allowed" : "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          {isPast && <span style={{ marginRight: "4px" }}>🔒</span>}
                          {isUp && !isActive && <span style={{ marginRight: "4px", color: "#16a34a" }}>↑</span>}
                          {gradeItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            <Field label="Treatment Plan Title *">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                required
              />
            </Field>

            <div style={{ marginTop: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <label style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#1e293b", margin: 0 }}>
                  Procedure Steps ({editSteps.length})
                </label>
                <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#7c3aed" }}>
                  Total Quote: {formatNpr(editTotalCost)}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {editSteps.map((step, sIdx) => (
                  <div key={sIdx} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 32px", gap: "8px", alignItems: "center", background: "#f8fafc", padding: "8px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <Input
                      placeholder="Step Procedure Label"
                      value={step.label}
                      onChange={(e) => {
                        const next = [...editSteps];
                        next[sIdx].label = e.target.value;
                        setEditSteps(next);
                      }}
                    />
                    <Input
                      type="number"
                      placeholder="Cost (NPR)"
                      value={step.agreedCost || ""}
                      onChange={(e) => {
                        const next = [...editSteps];
                        next[sIdx].agreedCost = Number(e.target.value) || 0;
                        setEditSteps(next);
                      }}
                    />
                    <button
                      type="button"
                      disabled={editSteps.length <= 1}
                      onClick={() => setEditSteps(editSteps.filter((_, i) => i !== sIdx))}
                      style={{ background: "none", border: "none", color: editSteps.length <= 1 ? "#cbd5e1" : "#dc2626", cursor: editSteps.length <= 1 ? "not-allowed" : "pointer", display: "flex" }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setEditSteps([...editSteps, { order: 0, label: "", tooth: "", agreedCost: 500, status: "pending" }])}
                className="btn btn-secondary"
                style={{ marginTop: "10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
              >
                <Plus size={13} /> Add Procedure Step
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button type="button" onClick={() => setEditingGroupKey(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Check size={14} /> Save Changes ({formatNpr(editTotalCost)})
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Modal: Add Procedure Stage */}
      {showAddStageModal && (
        <Modal
          title={<><Plus size={18} style={{ color: "#7c3aed" }} /> Add Procedure Stage</>}
          onClose={() => setShowAddStageModal(false)}
          maxWidth={520}
        >
          <ModalBody as="form" onSubmit={(e) => { e.preventDefault(); handleSaveNewStageInline(addingStageGroupKey || ""); }}>
            {/* Header Banner */}
            <div style={{ marginBottom: "12px", background: "#f8fafc", padding: "12px 14px", borderRadius: "0px", border: "1px solid #e2e8f0", borderLeft: "3px solid var(--acc)" }}>
              <div style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Adding Stage To:
              </div>
              <div style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "#1e293b", marginTop: "2px" }}>
                {(addingStageGroupKey || "").replace(/\s*\(\s*Grade\s*(?:I{1,3}|V?I{0,3}|\d+)\s*\)/gi, "")}
              </div>
            </div>

            {/* Mobility Grade Selection ABOVE the stage rows */}
            {/mobility/i.test(addingStageGroupKey || "") && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#475569", display: "block", marginBottom: "6px" }}>
                  Mobility Grade
                </label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {[
                    { id: "1", label: "Grade I" },
                    { id: "2", label: "Grade II" },
                    { id: "3", label: "Grade III" },
                  ].map((g) => {
                    const active = newStageGrade === g.id;
                    return (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => setNewStageGrade(g.id)}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: "0px",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          border: active ? "1.5px solid #7c3aed" : "1px solid #cbd5e1",
                          background: active ? "#7c3aed" : "#ffffff",
                          color: active ? "#ffffff" : "#475569",
                          boxShadow: "none",
                          transition: "all 0.15s ease",
                          textAlign: "center",
                        }}
                      >
                        {g.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Multi-Stage Rows List */}
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {addStageRows.map((r, index) => (
                <div
                  key={r.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0, 1fr) 128px 34px",
                    gap: "8px",
                    alignItems: "center",
                    background: "#ffffff",
                    padding: "8px 10px",
                    borderRadius: "0px",
                    border: "1px solid #e2e8f0",
                  }}
                >
                  <div>
                    {index === 0 && (
                      <label style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#64748b", display: "block", marginBottom: "3px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Stage Name *
                      </label>
                    )}
                    <input
                      style={{ width: "100%", height: "34px", padding: "0 10px", borderRadius: "0px", border: "1px solid #94a3b8", fontSize: "var(--fs-13)" }}
                      placeholder="e.g. Suture removal, Healing review"
                      value={r.label}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddStageRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, label: val } : item)));
                      }}
                      required={index === 0}
                      autoFocus={index === 0}
                    />
                  </div>

                  <div>
                    {index === 0 && (
                      <label style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#64748b", display: "block", marginBottom: "3px", letterSpacing: "0.04em", textTransform: "uppercase" }}>
                        Price (NPR) *
                      </label>
                    )}
                    <input
                      style={{ width: "100%", height: "34px", padding: "0 10px", borderRadius: "0px", border: "1px solid #94a3b8", fontSize: "var(--fs-13)", textAlign: "right" }}
                      type="number"
                      placeholder="1000"
                      value={r.cost}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAddStageRows((prev) => prev.map((item) => (item.id === r.id ? { ...item, cost: val } : item)));
                      }}
                      required
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (addStageRows.length > 1) {
                        setAddStageRows((prev) => prev.filter((item) => item.id !== r.id));
                      }
                    }}
                    disabled={addStageRows.length <= 1}
                    title="Remove stage row"
                    style={{
                      marginTop: index === 0 ? "17px" : "0",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "34px",
                      border: "1px solid #fecaca",
                      borderRadius: "0px",
                      background: addStageRows.length <= 1 ? "#f1f5f9" : "#fef2f2",
                      color: addStageRows.length <= 1 ? "#cbd5e1" : "#dc2626",
                      cursor: addStageRows.length <= 1 ? "not-allowed" : "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}

              <button
                type="button"
                onClick={() =>
                  setAddStageRows((prev) => [
                    ...prev,
                    { id: `${Date.now()}-${prev.length}`, label: "", cost: 1000 },
                  ])
                }
                className="btn btn-secondary"
                style={{ marginTop: "2px", minWidth: "148px", minHeight: "36px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px", fontSize: "var(--fs-13)", color: "#6d28d9", borderColor: "#c4b5fd", borderStyle: "dashed", background: "#fcf8ff" }}
              >
                <Plus size={13} /> Add Stage
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "8px", paddingTop: "14px", borderTop: "1px solid #e2e8f0" }}>
              <button type="button" onClick={() => setShowAddStageModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={!addStageRows.some((r) => r.label.trim())} className="btn btn-primary">
                <Check size={14} /> Save ({addStageRows.filter((r) => r.label.trim()).length || 1} Stage{addStageRows.filter((r) => r.label.trim()).length > 1 ? "s" : ""})
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}
      {groupPendingDelete && (
        <ConfirmDialog
          title="Delete treatment plan?"
          body={<>Remove <strong>{groupPendingDelete}</strong> and its stages from this patient&apos;s active plan?</>}
          confirmLabel="Delete plan"
          destructive
          onConfirm={() => {
            const group = groupPendingDelete;
            setGroupPendingDelete(null);
            void handleDeleteGroup(group);
          }}
          onCancel={() => setGroupPendingDelete(null)}
        />
      )}
    </section>
  );
}

function StageRow({
  stage,
  displayIndex,
  groupHeading,
  onDeleteStage,
  onReorderStage,
}: {
  stage: CaseStage;
  displayIndex?: number;
  groupHeading?: string;
  onDeleteStage?: (stageOrder: number, label: string) => void;
  onReorderStage?: (fromOrder: number, toOrder: number) => void;
}) {
  const isDone = stage.status === "done";
  const [isDragging, setIsDragging] = useState(false);
  const [isOver, setIsOver] = useState(false);

  return (
    <div
      draggable={Boolean(onReorderStage)}
      onDragStart={(e) => {
        if (!onReorderStage) return;
        e.dataTransfer.setData("text/plain", `${stage.order}`);
        setIsDragging(true);
      }}
      onDragEnd={() => {
        setIsDragging(false);
        setIsOver(false);
      }}
      onDragOver={(e) => {
        if (onReorderStage) {
          e.preventDefault();
          setIsOver(true);
        }
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return;
        setIsOver(false);
      }}
      onDrop={(e) => {
        if (!onReorderStage) return;
        e.preventDefault();
        const fromOrder = Number(e.dataTransfer.getData("text/plain"));
        if (!isNaN(fromOrder) && fromOrder !== stage.order) {
          onReorderStage(fromOrder, stage.order);
        }
        setIsDragging(false);
        setIsOver(false);
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "8px 10px",
        margin: "4px 0",
        borderRadius: "0px",
        background: isDragging ? "#faf5ff" : isOver ? "#f3e8ff" : isDone ? "#ecfdf5" : "#f8fafc",
        borderTop: isOver ? "3px solid #7c3aed" : isDragging ? "1.5px dashed #7c3aed" : `1px solid ${isDone ? "#86efac" : "#e2e8f0"}`,
        borderLeft: isDragging ? "1.5px dashed #7c3aed" : `3px solid ${isDone ? "#16a34a" : "#cbd5e1"}`,
        borderRight: isDragging ? "1.5px dashed #7c3aed" : `1px solid ${isDone ? "#86efac" : "#e2e8f0"}`,
        borderBottom: isDragging ? "1.5px dashed #7c3aed" : `1px solid ${isDone ? "#86efac" : "#e2e8f0"}`,
        opacity: isDragging ? 0.4 : 1,
        transition: "background-color 0.12s ease, border-color 0.12s ease",
        cursor: onReorderStage ? (isDragging ? "grabbing" : "grab") : "default",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1, minWidth: 0 }}>
        {onReorderStage && (
          <div
            title="Click & drag to reorder stage"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "24px",
              height: "24px",
              borderRadius: "0px",
              background: isDragging || isOver ? "#7c3aed" : "#f1f5f9",
              color: isDragging || isOver ? "#ffffff" : "#64748b",
              border: "1px solid #cbd5e1",
              cursor: isDragging ? "grabbing" : "grab",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
          >
            <Hand size={16} />
          </div>
        )}
        <div style={{ paddingTop: "2px", color: isDone ? "#10b981" : "#cbd5e1" }}>
          <CheckCircle2 size={16} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span
              style={{
                fontSize: "var(--fs-13)",
                fontWeight: isDone ? "var(--fw-bold)" : "var(--fw-medium)",
                color: isDone ? "#059669" : "#334155",
                textDecoration: stage.status === "skipped" ? "line-through" : "none",
              }}
            >
              {displayIndex !== undefined ? displayIndex : stage.order}. {stage.label}
            </span>
            <span
              style={{
                fontSize: "10px",
                fontWeight: "var(--fw-bold)",
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                padding: "1px 5px",
                borderRadius: "0px",
                background: isDone ? "#dcfce7" : "#e2e8f0",
                color: isDone ? "#15803d" : "#475569",
                border: `1px solid ${isDone ? "#86efac" : "#cbd5e1"}`,
              }}
            >
              {isDone ? "Done" : "Pending"}
            </span>
            {(stage.gradeLabel || stage.grade || /mobility/i.test(stage.group || "")) && (
              <span style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", background: "#f3e8ff", padding: "1px 6px", borderRadius: "4px", color: "#7c3aed", border: "1px solid #e9d5ff" }}>
                {stage.gradeLabel || (stage.grade ? `Grade ${stage.grade}` : "Grade I")}
              </span>
            )}
            {stage.tooth && !(groupHeading || stage.group || "").includes(stage.tooth) && (
              <span style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", background: "#f1f5f9", padding: "1px 6px", borderRadius: "4px", color: "#475569" }}>
                {stage.tooth.toLowerCase().includes("arch") || stage.tooth.toLowerCase().includes("mouth") ? stage.tooth : `Tooth ${stage.tooth}`}
              </span>
            )}
          </div>
          {isDone && (stage.doneBy || stage.doneDate) && (
            <span style={{ fontSize: "var(--fs-11)", color: "#059669", display: "block", marginTop: "2px" }}>
              Done by {stage.doneBy || "Doctor"}{stage.doneDate ? ` · ${formatDateShort(stage.doneDate)}` : ""}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "#1e293b", fontVariantNumeric: "tabular-nums" }}>
          {formatNpr(stage.agreedCost)}
        </span>
        {!isDone && onDeleteStage && (
          <button
            type="button"
            onClick={() => onDeleteStage(stage.order, stage.label)}
            title={`Remove "${stage.label}" from treatment plan`}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "2px 4px",
              borderRadius: "4px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#dc2626")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            <X size={15} />
          </button>
        )}
      </div>
    </div>
  );
}
