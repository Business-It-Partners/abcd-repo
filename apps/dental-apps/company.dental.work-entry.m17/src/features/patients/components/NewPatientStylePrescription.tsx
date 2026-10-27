"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Pill, Plus, Trash2 } from "lucide-react";
import { type RxLine } from "@/features/work-entry/model/caseData";

const QUICK = [
  { label: "Amox · TDS · 5d", rx: { medicine: "Amoxicillin 500mg", dosage: "1 tab", frequency: "TDS (3×/day)", duration: "5 days", instructions: "" } },
  { label: "Ibu · TDS · 3d", rx: { medicine: "Ibuprofen 400mg", dosage: "1 tab", frequency: "TDS (3×/day)", duration: "3 days", instructions: "" } },
  { label: "Metro · TDS · 5d", rx: { medicine: "Metronidazole 400mg", dosage: "1 tab", frequency: "TDS (3×/day)", duration: "5 days", instructions: "" } },
  { label: "PCM · SOS · 3d", rx: { medicine: "Paracetamol 500mg", dosage: "1 tab", frequency: "SOS (as needed)", duration: "3 days", instructions: "" } },
] as const;
const DRUGS = ["Amoxicillin 500mg", "Ibuprofen 400mg", "Paracetamol 500mg", "Metronidazole 400mg", "Augmentin 625mg", "CHX 0.2% Mouthwash"];
const FREQS = ["TDS (3×/day)", "BD (2×/day)", "QD (once/day)", "QID (4×/day)", "SOS (as needed)"];

const EMPTY_DRAFT: RxLine = { medicine: "", dosage: "1 tab", frequency: FREQS[0], duration: "5 days", instructions: "" };

export default function NewPatientStylePrescription({ drugs, onChange, onDraftDirtyChange }: { drugs: RxLine[]; onChange: (drugs: RxLine[]) => void; onDraftDirtyChange?: (dirty: boolean) => void }) {
  const [draft, setDraft] = useState<RxLine>(EMPTY_DRAFT);
  const draftDirty = JSON.stringify(draft) !== JSON.stringify(EMPTY_DRAFT);
  useEffect(() => onDraftDirtyChange?.(draftDirty), [draftDirty, onDraftDirtyChange]);
  const addDrug = (drug: RxLine) => {
    if (!drug.medicine.trim()) return false;
    const saved = { ...drug, medicine: drug.medicine.trim() };
    onChange([...drugs, saved]);
    return true;
  };
  const add = () => {
    if (addDrug(draft)) {
      setDraft(EMPTY_DRAFT);
    }
  };
  const advanceOnEnter = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;
    const target = event.target as HTMLElement;
    if (target.tagName === "BUTTON" || target.tagName === "SELECT") return;
    const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("input, select"))
      .filter((field) => !(field as HTMLInputElement).disabled && field.offsetParent !== null);
    const index = fields.indexOf(target);
    if (index < 0) return;
    event.preventDefault();
    const next = fields[index + 1];
    if (next) {
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
    } else {
      add();
    }
  };
  const fieldLabel: React.CSSProperties = { display: "block", fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "var(--ink-2)", marginBottom: "4px" };
  const control: React.CSSProperties = { width: "100%", boxSizing: "border-box", height: "36px", border: "1px solid var(--field-border)", borderRadius: 0, padding: "7px 10px", fontSize: "var(--fs-14)", background: "#fff" };
  return <div onKeyDown={advanceOnEnter}>
    <div style={{ display: "flex", alignItems: "center", gap: "7px", marginBottom: "10px" }}><span style={{ display: "grid", placeItems: "center", width: 28, height: 28, background: "#f1f5f9", color: "#0284c7" }}><Pill size={14} /></span><strong style={{ fontSize: "var(--fs-14)" }}>Prescription</strong><span style={{ fontSize: "var(--fs-13)", color: "var(--ink-3)", background: "#f1f5f9", padding: "1px 7px" }}>Optional</span></div>
    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>{QUICK.map((r) => <button key={r.label} type="button" onClick={() => addDrug({ ...r.rx, instructions: "" })} style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", padding: "4px 10px", borderRadius: 20, border: "1px solid #ddd6fe", background: "#f5f3ff", color: "#6d28d9", cursor: "pointer" }}>+ {r.label}</button>)}</div>
    {drugs.length > 0 && (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "14px" }}>
        {drugs.map((rx, i) => (
          <div key={`${rx.medicine}-${i}`} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", padding: "10px 12px", background: "#f0fdf4", border: "1px solid #86efac", borderLeft: "4px solid #16a34a" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
              <CheckCircle2 size={16} color="#16a34a" style={{ marginTop: "2px", flexShrink: 0 }} />
              <span>
                <span style={{ display: "block", fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "#15803d", marginBottom: "2px" }}>Ready to save</span>
                <strong>{rx.medicine}</strong>
                <span style={{ display: "block", fontSize: "var(--fs-13)", color: "var(--ink-2)", marginTop: "2px" }}>{rx.dosage} · {rx.frequency} · {rx.duration}</span>
              </span>
            </div>
            <button type="button" onClick={() => onChange(drugs.filter((_, index) => index !== i))} title="Remove prescription" style={{ border: 0, background: "none", color: "#dc2626", cursor: "pointer", padding: 0 }}><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    )}
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
      <div style={{ gridColumn: "1 / -1" }}><label style={fieldLabel}>Drug</label><select style={control} value={draft.medicine} onChange={(e) => setDraft({ ...draft, medicine: e.target.value })}><option value="">Select drug…</option>{DRUGS.map((drug) => <option key={drug}>{drug}</option>)}</select></div>
      <div><label style={fieldLabel}>Dose</label><input style={control} value={draft.dosage} onChange={(e) => setDraft({ ...draft, dosage: e.target.value })} /></div>
      <div><label style={fieldLabel}>Duration</label><input style={control} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })} /></div>
      <div style={{ gridColumn: "1 / -1" }}><label style={fieldLabel}>Frequency</label><select style={control} value={draft.frequency} onChange={(e) => setDraft({ ...draft, frequency: e.target.value })}>{FREQS.map((frequency) => <option key={frequency}>{frequency}</option>)}</select></div>
    </div>
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      {draftDirty && <button type="button" className="btn btn-secondary" onClick={() => setDraft(EMPTY_DRAFT)}>Clear draft</button>}
      <button type="button" className="btn btn-primary" style={{ flex: 1 }} disabled={!draft.medicine.trim()} onClick={add}><Plus size={13} /> Add medication</button>
    </div>
  </div>;
}
