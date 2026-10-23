"use client";

import { useMemo, useState } from "react";
import { Activity, Check, ListChecks, Plus, Sparkles, Trash2 } from "lucide-react";
import { type FeeScheduleItem, type TreatmentProtocol, defaultFeeSchedule, priceOf } from "@/features/work-entry/model/caseData";
import { formatNpr } from "@/features/patients/model/domain";
import { Field, Input, Modal, ModalBody, Select } from "@/shared/ui/workspace-primitives";

export interface TreatmentPlanStepDraft {
  label: string;
  procedureCode?: string;
  tooth: string;
  agreedCost: number;
  recordCanals?: boolean;
  grade?: string;
  gradeLabel?: string;
}

interface Props {
  open: boolean;
  protocols: TreatmentProtocol[];
  feeSchedule?: FeeScheduleItem[];
  onClose: () => void;
  onSubmit: (draft: { title: string; tooth: string; toothSpecific: boolean; phase: "urgent" | "basic" | "elective"; steps: TreatmentPlanStepDraft[] }) => void | Promise<void>;
}

const upperRight = ["18", "17", "16", "15", "14", "13", "12", "11"];
const upperLeft = ["21", "22", "23", "24", "25", "26", "27", "28"];
const lowerRight = ["48", "47", "46", "45", "44", "43", "42", "41"];
const lowerLeft = ["31", "32", "33", "34", "35", "36", "37", "38"];
const primaryUpperRight = ["55", "54", "53", "52", "51"];
const primaryUpperLeft = ["61", "62", "63", "64", "65"];
const primaryLowerRight = ["85", "84", "83", "82", "81"];
const primaryLowerLeft = ["71", "72", "73", "74", "75"];
const conditions = ["Healthy", "Decayed", "Filled", "Sealant", "Root canal", "Crowned", "Bridge", "Impacted", "Extracted", "Missing", "Implant", "Mobility"];

/** The single Add Treatment Plan UI used by Patient Detail and Daily Work Entry. */
export default function AddTreatmentPlanModal({ open, protocols, feeSchedule, onClose, onSubmit }: Props) {
  const [protocolId, setProtocolId] = useState("");
  const [custom, setCustom] = useState(false);
  const [condition, setCondition] = useState("");
  const [tooth, setTooth] = useState("14");
  const [title, setTitle] = useState("");
  const [steps, setSteps] = useState<TreatmentPlanStepDraft[]>([{ label: "", procedureCode: "PROC-GENERIC", tooth: "14", agreedCost: 0 }]);
  const [gradeId, setGradeId] = useState("");
  const [submitError, setSubmitError] = useState("");
  const activeProtocols = protocols;
  const toothProtocols = activeProtocols.filter((protocol) => {
    const firstGrade = protocol.grades?.[0];
    return (firstGrade?.stages ?? protocol.stages).every((stage) => stage.toothScope === "tooth");
  });
  const wholeMouthProtocols = activeProtocols.filter((protocol) => {
    const firstGrade = protocol.grades?.[0];
    return (firstGrade?.stages ?? protocol.stages).some((stage) => stage.toothScope !== "tooth");
  });
  const selected = activeProtocols.find((p) => p.id === protocolId);
  const selectedGrade = selected?.grades?.find((grade) => grade.id === gradeId);
  const selectedStages = selectedGrade?.stages ?? selected?.stages ?? [];
  const toothSpecific = selected ? selectedStages.every((s) => s.toothScope === "tooth") : true;
  const total = useMemo(() => steps.reduce((sum, step) => sum + (step.agreedCost || 0), 0), [steps]);
  const fees = feeSchedule?.length ? feeSchedule : defaultFeeSchedule;

  if (!open) return null;

  const selectProtocol = (proto: TreatmentProtocol) => {
    const firstGrade = proto.grades?.[0];
    const protocolStages = firstGrade?.stages ?? proto.stages;
    const isTooth = protocolStages.every((stage) => stage.toothScope === "tooth");
    const currentTooth = tooth || "14";
    setProtocolId(proto.id);
    setGradeId(firstGrade?.id ?? "");
    setCustom(false);
    setTitle(isTooth ? `${proto.name} · ${currentTooth}` : proto.name);
    setSteps(protocolStages.map((stage) => ({
      label: stage.label,
      procedureCode: stage.procedureCode,
      tooth: isTooth ? currentTooth : stage.toothScope === "arch" ? "Arch" : stage.toothScope === "full-mouth" ? "Full mouth" : "",
      agreedCost: stage.defaultCost ?? priceOf(fees, stage.procedureCode),
      recordCanals: Boolean(proto.recordCanals),
      grade: firstGrade?.id,
      gradeLabel: firstGrade?.label,
    })));
  };
  const chooseGrade = (nextGradeId: string) => {
    const grade = selected?.grades?.find((item) => item.id === nextGradeId);
    if (!selected || !grade) return;
    const currentTooth = tooth || "14";
    const isTooth = grade.stages.every((stage) => stage.toothScope === "tooth");
    setGradeId(grade.id);
    setTitle(isTooth ? `${selected.name} · ${currentTooth}` : selected.name);
    setSteps(grade.stages.map((stage) => ({
      label: stage.label,
      procedureCode: stage.procedureCode,
      tooth: isTooth ? currentTooth : stage.toothScope === "arch" ? "Arch" : stage.toothScope === "full-mouth" ? "Full mouth" : "",
      agreedCost: stage.defaultCost ?? priceOf(fees, stage.procedureCode),
      recordCanals: Boolean(selected.recordCanals),
      grade: grade.id,
      gradeLabel: grade.label,
    })));
  };
  const updateTooth = (next: string) => {
    setTooth(next);
    if (selected?.stages.every((stage) => stage.toothScope === "tooth")) {
      setTitle(`${selected.name} · ${next || "14"}`);
      setSteps((old) => old.map((step) => ({ ...step, tooth: next })));
    }
  };
  const chooseCondition = (next: string) => {
    setCondition(next);
    setProtocolId("");
    setGradeId("");
    setCustom(false);
    setTitle("");
    setSteps([{ label: "", procedureCode: "PROC-GENERIC", tooth: tooth || "14", agreedCost: 0 }]);
    requestAnimationFrame(() => document.getElementById("shared-treatment-plan-title")?.focus());
  };
  const submit = async () => {
    const valid = steps.filter((step) => step.label.trim());
    if (!title.trim() || valid.length === 0) return;
    setSubmitError("");
    try {
      await onSubmit({ title: title.trim(), tooth, toothSpecific, phase: selected?.phase || "basic", steps: valid });
      onClose();
    } catch {
      // The trusted Worker adapter deliberately exposes only redacted messages
      // to its callers. Keep this shared modal equally safe for a legacy
      // transaction failure: no provider or Firestore response is displayed.
      setSubmitError("Could not save this treatment plan. Check your connection and retry.");
    }
  };

  return <Modal title={<><ListChecks size={18} style={{ color: "#7c3aed" }} /> Add Treatment Plan</>} onClose={onClose} maxWidth={780}>
    <ModalBody as="form" onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 12, marginBottom: 14 }}>
        <div style={{ background: "#f8fafc", padding: "10px 12px", borderRadius: 0, border: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6, fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#334155" }}><span><Activity size={14} style={{ color: "#7c3aed", verticalAlign: "middle" }} /> FDI Dental Arch Tooth Selector</span><span style={{ color: "#7c3aed", background: "#f3e8ff", padding: "2px 8px" }}>Selected: Tooth {tooth || "14"}</span></div>
          <ArchLabel label="Maxillary arch (upper)" />
          <ToothRow left={upperRight} right={upperLeft} tooth={tooth} onChoose={updateTooth} />
          <ToothRow left={primaryUpperRight} right={primaryUpperLeft} tooth={tooth} onChoose={updateTooth} primary />
          <ArchLabel label="Mandibular arch (lower)" />
          <ToothRow left={primaryLowerRight} right={primaryLowerLeft} tooth={tooth} onChoose={updateTooth} primary />
          <ToothRow left={lowerRight} right={lowerLeft} tooth={tooth} onChoose={updateTooth} />
          {!toothSpecific && <div style={{ marginTop: 8, padding: "7px 9px", background: "#f0fdfa", border: "1px solid #99f6e4", color: "#0f766e", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)" }}>Whole-mouth / arch procedure selected — the tooth chart remains available for the next tooth-level plan.</div>}
        </div>
        <div style={{ background: "#fff", padding: "10px 12px", borderRadius: 0, border: "1px solid #cbd5e1" }}>
          <div style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: "#334155", marginBottom: 8 }}><Sparkles size={14} style={{ color: "#7c3aed", verticalAlign: "middle" }} /> Update Condition / Quick Pick</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>{conditions.map((value) => <button key={value} type="button" onClick={() => chooseCondition(value)} style={{ padding: "6px 8px", borderRadius: 0, fontSize: 11, fontWeight: 700, cursor: "pointer", border: condition === value ? "2px solid #7c3aed" : "1px solid #cbd5e1", background: condition === value ? "#7c3aed" : "#fff", color: condition === value ? "#fff" : "#334155" }}>{value}</button>)}</div>
        </div>
      </div>
      <div style={{ marginBottom: 14, background: "#f0fdfa", padding: "10px 14px", border: "1px solid #99f6e4" }}><div style={{ color: "#0f766e", fontWeight: 700, fontSize: "var(--fs-12)", marginBottom: 8 }}>Whole-Mouth / Arch Procedures</div>{wholeMouthProtocols.map((p) => <button key={p.id} type="button" className="btn btn-secondary btn-sm" style={{ marginRight: 8 }} onClick={() => selectProtocol(p)}><Plus size={13} /> {p.name}</button>)}</div>
      <div style={{ display: "grid", gridTemplateColumns: toothSpecific ? "2.5fr 1fr" : "1fr", gap: 12 }}>
        <Field label="Treatment Plan Title *"><div style={{ display: "flex", flexDirection: "column", gap: 6 }}><Select id="shared-treatment-plan-title" value={protocolId || (custom ? "__custom__" : "")} onChange={(e) => { const value = e.target.value; if (value === "__custom__") { setCustom(true); setProtocolId(""); setGradeId(""); setTitle(""); } else { const p = toothProtocols.find((item) => item.id === value); if (p) selectProtocol(p); } }}><option value="">-- Select Treatment Plan / Protocol --</option>{selected && !toothProtocols.some((p) => p.id === selected.id) && <option value={selected.id} hidden>{selected.name}</option>}<optgroup label="Tooth treatment protocols">{toothProtocols.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</optgroup><option value="__custom__">✏️ Custom Treatment Plan...</option></Select>{(custom || !protocolId) && <Input required placeholder="e.g. Root Canal + Crown · 14" value={title} onChange={(e) => setTitle(e.target.value)} />}</div></Field>
        {toothSpecific && <Field label="Tooth #"><Input value={tooth} onChange={(e) => updateTooth(e.target.value)} /></Field>}
      </div>
      {selected?.grades?.length ? (
        <Field label="Treatment grade">
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${selected.grades.length}, minmax(0, 1fr))`, gap: 8 }}>
            {selected.grades.map((grade) => {
              const active = grade.id === gradeId;
              return (
                <button
                  key={grade.id}
                  type="button"
                  onClick={() => chooseGrade(grade.id)}
                  style={{ padding: "8px 12px", border: active ? "1.5px solid #7c3aed" : "1px solid #cbd5e1", background: active ? "#7c3aed" : "#fff", color: active ? "#fff" : "#334155", fontWeight: 700, cursor: "pointer" }}
                >
                  {grade.label}
                </button>
              );
            })}
          </div>
        </Field>
      ) : null}
      <div style={{ marginTop: 14 }}><div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8, fontWeight: 700, fontSize: "var(--fs-12)" }}><span>Procedure Steps ({steps.length})</span><span style={{ color: "#7c3aed" }}>Total Quote: {formatNpr(total)}</span></div>{steps.map((step, index) => <div key={index} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 32px", gap: 8, marginBottom: 8 }}><Input placeholder={`Step ${index + 1} Procedure Label`} value={step.label} onChange={(e) => setSteps((old) => old.map((item, i) => i === index ? { ...item, label: e.target.value } : item))} /><Input type="number" value={step.agreedCost || ""} onChange={(e) => setSteps((old) => old.map((item, i) => i === index ? { ...item, agreedCost: Number(e.target.value) || 0 } : item))} /><button type="button" disabled={steps.length === 1} onClick={() => setSteps((old) => old.filter((_, i) => i !== index))}><Trash2 size={15} /></button></div>)}<button type="button" className="btn btn-secondary btn-sm" onClick={() => setSteps((old) => [...old, { label: "", procedureCode: "PROC-GENERIC", tooth: toothSpecific ? tooth : "Arch", agreedCost: 0, recordCanals: Boolean(selected?.recordCanals), grade: selectedGrade?.id, gradeLabel: selectedGrade?.label }])}><Plus size={13} /> Add Procedure Step</button></div>
      {submitError ? <p role="alert" style={{ margin: "14px 0 0", color: "#b91c1c", fontSize: "var(--fs-13)" }}>{submitError}</p> : null}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button type="submit" className="btn btn-primary" disabled={!title.trim()}><Check size={14} /> Add Treatment Plan ({formatNpr(total)})</button></div>
    </ModalBody>
  </Modal>;
}

function ArchLabel({ label }: { label: string }) {
  return <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px", margin: "6px 0 3px" }}>{label}</div>;
}

function ToothRow({ left, right, tooth, onChoose, primary = false }: { left: string[]; right: string[]; tooth: string; onChoose: (tooth: string) => void; primary?: boolean }) {
  return <div style={{ display: "flex", justifyContent: "center", gap: 2, marginBottom: 3 }}><div style={{ display: "flex", gap: 2 }}>{left.map((value) => <Tooth key={value} value={value} primary={primary} selected={tooth === value} onClick={() => onChoose(value)} />)}</div><div style={{ width: 1, background: primary ? "#bae6fd" : "#cbd5e1", margin: "0 3px" }} /><div style={{ display: "flex", gap: 2 }}>{right.map((value) => <Tooth key={value} value={value} primary={primary} selected={tooth === value} onClick={() => onChoose(value)} />)}</div></div>;
}

function Tooth({ value, primary, selected, onClick }: { value: string; primary: boolean; selected: boolean; onClick: () => void }) {
  return <button type="button" onClick={onClick} style={{ width: primary ? 25 : 27, height: primary ? 26 : 28, padding: 0, border: selected ? "2px solid #7c3aed" : primary ? "1px solid #bae6fd" : "1px solid #cbd5e1", background: selected ? "#7c3aed" : primary ? "#f0f9ff" : "#fff", color: selected ? "#fff" : primary ? "#0369a1" : "#1e293b", fontSize: primary ? 10 : 11, fontWeight: 700 }}>{value}</button>;
}
