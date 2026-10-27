"use client";

import { useMemo, useState } from "react";
import styles from "@/features/patients/patient-record.module.css";
import { Activity, Loader2, Plus, Undo2 } from "lucide-react";
import { formatDateShort, personLabel } from "@/features/patients/model/domain";
import {
  type ToothHistoryEntry,
  type ToothSlot,
  type ToothStateValue,
  type ToothValues,
  deriveToothChart,
  stateMeta,
  toothValues,
  treatedTeeth,
} from "@/features/work-entry/model/chartData";
import ToothArches from "./ToothArches";

// The chairside odontogram. Used by Work Entry and by the patient record.
//
// Standalone by design: no treatment plan, no open case, no completed stage. Click a tooth, write
// what you did, press Add. A walk-in with pain is charted the same as a scheduled crown fitting.
//
// v1 records a NOTE only. `ChairsideEntry` already carries an optional slot + value so the
// condition dropdown can be added later without a migration — and until it is, nothing typed here
// recolours a tooth. Completed case stages still write their own structured outcome, which is what
// keeps the chart honest about extractions.

export interface ChairsideEntry {
  slot?: ToothSlot;
  value?: ToothStateValue;
  note?: string;
}

interface ChairsideChartProps {
  /** The patient's chart so far, so the dentist charts against what is already known. */
  toothHistory: ToothHistoryEntry[];
  /**
   * Appends one dated entry. Resolves once Firestore has taken it. `doctor` is set only where the
   * chart asks who did the work; the entry wizards already know, and pass it themselves.
   */
  onSave: (tooth: string, entry: ChairsideEntry, doctor?: string) => Promise<void>;
  /**
   * Teeth with work PLANNED on them, read live from the patient's open cases. Drawn as a dashed
   * outline. Deliberately not stored: a plan is an intention, and the chart records only what
   * has actually happened.
   */
  plannedTeeth?: Record<string, string>;
  /** Void an entry made in error. Absent in the entry wizards, where there is nothing to void yet. */
  onVoidEntry?: (entry: ToothHistoryEntry) => void;
  /**
   * Offer a doctor picker. Absent in the entry wizards, which already carry the treating doctor.
   * Without it a record edit is attributed to whoever is signed in — an email, not a clinician.
   */
  doctors?: string[];
  defaultDoctor?: string;
}

export default function ChairsideChart({
  toothHistory,
  onSave,
  plannedTeeth,
  onVoidEntry,
  doctors,
  defaultDoctor,
}: ChairsideChartProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [selectedDoctors, setSelectedDoctors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const presetDoctor = defaultDoctor && doctors?.includes(defaultDoctor) ? defaultDoctor : "";
  const who = selectedDoctors.length > 0 ? selectedDoctors.join(", ") : presetDoctor;

  const charts = useMemo(() => deriveToothChart(toothHistory), [toothHistory]);
  const values = useMemo(
    () => Object.fromEntries(Object.entries(charts).map(([t, c]) => [t, toothValues(c)])) as Record<string, ToothValues>,
    [charts],
  );
  const treated = useMemo(() => treatedTeeth(toothHistory), [toothHistory]);

  // A correction is a tombstone entry pointing at the one it voids. Both stay in the record, but
  // only the voided ORIGINAL is listed — the tombstone's own note is the words "Entered in error",
  // so rendering it as a row says the same thing twice. Its date and author ride on the label.
  const voidedBy = useMemo(() => {
    const m = new Map<string, ToothHistoryEntry>();
    for (const e of toothHistory) if (e.supersedes) m.set(e.supersedes, e);
    return m;
  }, [toothHistory]);

  const entries = selectedTooth
    ? toothHistory.filter((e) => e.tooth === selectedTooth && e.supersedes == null)
    : [];
  const canAdd =
    Boolean(selectedTooth) && note.trim().length > 0 && (!doctors?.length || Boolean(who));

  const pick = (tooth: string) => {
    setSelectedTooth(tooth);
    setNote("");
    setError("");
  };

  const add = async () => {
    if (!selectedTooth || !canAdd || saving) return;
    setSaving(true);
    setError("");
    try {
      await onSave(selectedTooth, { note: note.trim() }, who || undefined);
      setNote("");
    } catch (err) {
      setError((err as Error).message || "Couldn't save this entry.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.odontogramLayout}>
      <div className={styles.chartContainer}>
        <ToothArches
          values={values}
          selectedTooth={selectedTooth}
          onSelect={pick}
          treated={treated}
          plannedTeeth={plannedTeeth}
        />
      </div>

      <div className={styles.toothDetailPane}>
        {selectedTooth ? (
          <div className={styles.card}>
            <div className={styles.toothHeader}>
              <span className={styles.toothTitle}>Tooth {selectedTooth}</span>
              <span className={styles.toothType}>
                {parseInt(selectedTooth) >= 51
                  ? "Deciduous / Primary Tooth"
                  : parseInt(selectedTooth) % 10 <= 3
                    ? "Anterior (Incisor/Canine)"
                    : "Posterior (Premolar/Molar)"}
              </span>
            </div>

            {plannedTeeth?.[selectedTooth] && (
              <div style={{ marginTop: "12px", padding: "8px 11px", borderRadius: "9px", border: "1px dashed #c4b5fd", background: "var(--acc-soft, #ede9fe)", color: "var(--acc, #7c3aed)", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)" }}>
                Planned: {plannedTeeth[selectedTooth]}
              </div>
            )}

            {doctors && doctors.length > 0 && (
              <div style={{ marginTop: "14px" }}>
                <span className={styles.conditionSelectorLabel}>Doctor(s)</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "6px", alignItems: "center" }}>
                  {doctors.map((d) => {
                    const isSelected = selectedDoctors.length > 0 ? selectedDoctors.includes(d) : presetDoctor === d;
                    return (
                      <label
                        key={d}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "5px 11px",
                          fontSize: "var(--fs-13)",
                          fontWeight: isSelected ? 750 : 600,
                          borderRadius: "8px",
                          border: isSelected ? "1.5px solid #7c3aed" : "1.5px solid #cbd5e1",
                          background: isSelected ? "#ede9fe" : "#ffffff",
                          color: isSelected ? "#5b21b6" : "#334155",
                          cursor: "pointer",
                          userSelect: "none",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            let updated: string[];
                            if (selectedDoctors.length === 0 && presetDoctor) {
                              updated = presetDoctor === d ? [] : [presetDoctor, d];
                            } else if (selectedDoctors.includes(d)) {
                              updated = selectedDoctors.filter((doc) => doc !== d);
                            } else {
                              updated = [...selectedDoctors, d];
                            }
                            setSelectedDoctors(updated);
                          }}
                          style={{
                            "--checkbox-color": "#7c3aed",
                            width: "15px",
                            height: "15px",
                            cursor: "pointer",
                          } as React.CSSProperties}
                        />
                        <span>{d}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ marginTop: "14px" }}>
              <span className={styles.conditionSelectorLabel}>What was done today</span>
              <div style={{ display: "flex", gap: "7px", marginTop: "6px" }}>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void add();
                    }
                  }}
                  placeholder="e.g. RCT — 3 canals, temporary filling"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    padding: "9px 11px",
                    border: "1px solid #a9b2c2",
                    borderRadius: "8px",
                    fontSize: "var(--fs-14)",
                    color: "#1e293b",
                    fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void add()}
                  disabled={!canAdd || saving}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "9px 14px",
                    border: "none",
                    borderRadius: "8px",
                    background: canAdd && !saving ? "var(--acc, #7c3aed)" : "#9aa3b6",
                    color: "#fff",
                    fontSize: "var(--fs-13)",
                    fontWeight: "var(--fw-bold)",
                    cursor: canAdd && !saving ? "pointer" : "not-allowed",
                    flexShrink: 0,
                  }}
                >
                  {saving ? <Loader2 size={13} style={{ animation: "spin 0.8s linear infinite" }} /> : <Plus size={13} />}
                  Add
                </button>
              </div>
              {error && (
                <div style={{ marginTop: "7px", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#b91c1c" }}>{error}</div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "16px", paddingTop: "14px" }}>
              <span className={styles.conditionSelectorLabel} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <Activity size={14} /> Tooth History
              </span>
              {entries.length > 0 ? (
                <ul className={styles.toothHistoryList}>
                  {entries.map((item) => {
                    const voided = voidedBy.get(item.id);
                    return (
                      <li
                        key={item.id}
                        className={styles.toothHistoryItem}
                        style={voided ? { background: "#fef6f6", borderColor: "#f6dede" } : undefined}
                      >
                        <div className={styles.toothHistoryHeader}>
                          <span>{formatDateShort(item.date)}</span>
                          <span>{personLabel(item.doctor)}</span>
                        </div>
                        <div
                          className={styles.toothHistoryNote}
                          style={voided ? { textDecoration: "line-through", color: "#4c4c56" } : undefined}
                        >
                          {item.note || (item.value ? stateMeta(item.value).label : "—")}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "5px" }}>
                          {voided ? (
                            <span
                              title={`Voided ${formatDateShort(voided.date)} by ${personLabel(voided.doctor)}`}
                              style={{ display: "inline-flex", alignItems: "center", gap: "4px", color: "#b91c1c", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)" }}
                            >
                              <Undo2 size={11} /> Entered in error
                            </span>
                          ) : (
                            onVoidEntry && (
                              <button
                                type="button"
                                onClick={() => onVoidEntry(item)}
                                title="Mark this entry as made in error. It stays in the record, struck through."
                                style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "none", border: "none", padding: 0, color: "#dc2626", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", cursor: "pointer" }}
                              >
                                <Undo2 size={11} /> Entered in error
                              </button>
                            )
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div style={{ fontSize: "var(--fs-13)", color: "#1e293b", padding: "10px 0", textAlign: "center" }}>
                  No historical entries for this tooth.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.card} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "300px", padding: "40px 20px", textAlign: "center", color: "#1e293b" }}>
            <span style={{ fontSize: "var(--fs-22)", marginBottom: "8px" }}>🦷</span>
            <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-medium)" }}>Select a tooth to record what you did</span>
          </div>
        )}
      </div>
    </div>
  );
}
