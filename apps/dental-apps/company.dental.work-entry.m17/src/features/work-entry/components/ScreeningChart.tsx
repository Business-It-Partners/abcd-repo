"use client";

import { useMemo, useState } from "react";
import styles from "@/features/patients/patient-record.module.css";
import { Activity } from "lucide-react";
import {
  type ChartMarkInput,
  type ToothValues,
  SCREENING_PALETTE,
  stateMeta,
} from "@/features/work-entry/model/chartData";
import ToothArches from "./ToothArches";

// The examination chart, for New Case step 3.
//
// This is a SCREENING pass, not a charting session: gloves on, tooth by tooth, under time
// pressure. ONE tap per tooth — tapping "Crowned" after "Filled" replaces it, exactly as a
// dentist ticking down an arch expects. Layering several findings on one tooth is what the
// patient's record is for, where there is time and a history to read.
//
// But every tap still SAVES, as a slot-scoped `examination` entry. The examination is the only
// moment a whole mouth gets looked at systematically, and the finding ("46 decayed") is the
// diagnosis that justifies the treatment about to be planned. Throw it away and the patient's
// chart stays empty forever, because nobody re-charts a mouth from the record screen later.

export interface ChartMark {
  slot: ChartMarkInput["slot"];
  value: ChartMarkInput["value"];
}

interface ScreeningChartProps {
  /** One finding per tooth, keyed by FDI number. */
  marks: Record<string, ChartMark>;
  onChartTooth: (tooth: string, mark: ChartMark) => void;
  onSelectTooth?: (tooth: string | null) => void;
}

export default function ScreeningChart({ marks, onChartTooth, onSelectTooth }: ScreeningChartProps) {
  const [selectedTooth, setSelectedTooth] = useState<string | null>(null);

  // One finding per tooth, so the drawn state is just that finding in its own slot.
  const values = useMemo(() => {
    const out: Record<string, ToothValues> = {};
    for (const [tooth, mark] of Object.entries(marks)) out[tooth] = { [mark.slot]: mark.value };
    return out;
  }, [marks]);

  const selected = selectedTooth ? marks[selectedTooth] : undefined;

  return (
    <div>
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
        {SCREENING_PALETTE.map(({ label, value }) => (
          <span key={label} style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "3px 9px", borderRadius: "20px", background: "#fff", border: "1px solid #ece3d2" }}>
            <span style={{ width: "10px", height: "10px", borderRadius: "3px", border: `1px solid ${stateMeta(value).border}`, background: stateMeta(value).fill, flexShrink: 0 }} />
            <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#1e293b" }}>{label}</span>
          </span>
        ))}
      </div>

      <div className={styles.odontogramLayout}>
        <div className={styles.chartContainer}>
          <ToothArches
            values={values}
            selectedTooth={selectedTooth}
            onSelect={(tooth) => {
              setSelectedTooth(tooth);
              onSelectTooth?.(tooth);
            }}
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

              <div className={styles.conditionSelector} style={{ marginTop: "14px" }}>
                <span className={styles.conditionSelectorLabel}>Update Condition</span>
                <div className={styles.conditionGrid}>
                  {SCREENING_PALETTE.map(({ label, slot, value }) => {
                    const isSelected = selected?.value === value;
                    return (
                      <button
                        key={label}
                        type="button"
                        style={{
                          padding: "9px 10px",
                          borderRadius: "9px",
                          fontSize: "13px",
                          fontWeight: "700",
                          cursor: "pointer",
                          textAlign: "center",
                          transition: "all 0.15s ease",
                          background: isSelected ? "#7c3aed" : "#ffffff",
                          color: isSelected ? "#ffffff" : "#1e293b",
                          border: isSelected ? "1.5px solid #7c3aed" : "1.5px solid #cbd5e1",
                          boxShadow: isSelected ? "0 4px 12px rgba(124, 58, 237, 0.25)" : "none",
                        }}
                        onClick={() => onChartTooth(selectedTooth, { slot, value })}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "16px", paddingTop: "14px" }}>
                <span className={styles.conditionSelectorLabel} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  <Activity size={14} /> Tooth History
                </span>
                <div style={{ fontSize: "var(--fs-13)", color: "#1e293b", padding: "10px 0", textAlign: "center" }}>
                  No historical entries for this tooth.
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.card} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", padding: "40px 20px", textAlign: "center", color: "#1e293b" }}>
              <span style={{ fontSize: "var(--fs-22)", marginBottom: "8px" }}>🦷</span>
              <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-medium)" }}>Select a tooth to view details and update condition</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
