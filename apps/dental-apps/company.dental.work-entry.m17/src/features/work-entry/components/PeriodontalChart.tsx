"use client";

import { useEffect, useRef, useState } from "react";
import { ShieldAlert, Check, Loader2 } from "lucide-react";
import { type ToothPerioData } from "@/features/work-entry/model/chartData";
import { Table, TableWrap, Td, Th, Tr } from "@/shared/ui/ClinicTable";
import { handleFormEnterNavigation, handleFormKeyboardFocus, handleFormKeyboardPointerDown } from "@/shared/ui/workspace-primitives/formKeyboardNavigation";

interface PeriodontalChartProps {
  /** The last charting session's readings, so re-probing starts from what was measured before. */
  initialPerioData?: Record<string, ToothPerioData>;
  /** When the readings were last recorded, for the "charted on" line. */
  lastChartedOn?: string;
  /**
   * Save the readings as a new dated snapshot, immediately. Used from the patient record, where
   * the patient already exists.
   */
  onSave?: (teeth: Record<string, ToothPerioData>) => Promise<void>;
  /**
   * Lift the readings to an entry wizard, which submits them with the rest of the visit once the
   * patient exists. `edited` is true only once the clinician has changed a value THIS session — an
   * untouched chart (even one pre-seeded with the patient's existing readings) is not lifted, so a
   * visit that never touched the gums does not re-write them.
   */
  onChange?: (teeth: Record<string, ToothPerioData>, edited: boolean) => void;
}

// Generate default empty record for a tooth. Every value starts at 0 — an un-probed tooth
// must read as blank, not carry a fake baseline depth (a real chart is 0 until measured).
const createEmptyToothData = (tooth: string): ToothPerioData => ({
  tooth,
  probingDepths: { db: 0, b: 0, mb: 0, dl: 0, l: 0, ml: 0 },
  recession: { db: 0, b: 0, mb: 0 },
  bop: { db: false, b: false, mb: false, dl: false, l: false, ml: false },
  mobility: 0,
});

const PERMANENT_TEETH = [
  "18", "17", "16", "15", "14", "13", "12", "11",
  "21", "22", "23", "24", "25", "26", "27", "28",
  "48", "47", "46", "45", "44", "43", "42", "41",
  "31", "32", "33", "34", "35", "36", "37", "38",
];

// A STABLE empty default. `initialPerioData = {}` in the signature would mint a fresh object on
// every render, and the re-seed effect below keys off its reference — so the caller that omits the
// prop (the New Patient perio panel) would fire that effect forever: setState → render → new {} →
// effect → setState. One frozen instance breaks the loop.
const NO_PERIO: Record<string, ToothPerioData> = {};

// Perio is shown as CURRENT state per tooth (like the odontogram): the chart opens pre-seeded with
// the patient's existing readings, the clinician updates whichever teeth they probed, and only the
// touched teeth are saved — merged over the rest, so nothing previously charted is lost.
export default function PeriodontalChart({ initialPerioData = NO_PERIO, lastChartedOn, onSave, onChange }: PeriodontalChartProps) {
  const [perioData, setPerioData] = useState<Record<string, ToothPerioData>>(initialPerioData);
  // True once the clinician edits any value this session. Gates both save and the wizard lift, so a
  // pre-seeded (but untouched) chart is never re-written.
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Re-seed when the stored readings change — a different patient, or our own save landing — but
  // never while the clinician is mid-edit, or their unsaved work would vanish. The parent memoizes
  // `initialPerioData`, so this fires on real changes, not every render.
  useEffect(() => {
    if (!dirty) setPerioData(initialPerioData);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPerioData]);

  // Held in a ref so a parent that passes an inline arrow does not re-fire this effect on every
  // one of its own renders.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => {
    onChangeRef.current?.(perioData, dirty);
  }, [perioData, dirty]);

  const save = async () => {
    if (!onSave || !dirty || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      await onSave(perioData);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError((err as Error).message || "Couldn't save these readings.");
    } finally {
      setSaving(false);
    }
  };

  const [selectedTooth, setSelectedTooth] = useState<string>("11");

  // Get active tooth data or create empty
  const activeToothData = perioData[selectedTooth] || createEmptyToothData(selectedTooth);

  const updateProbingDepth = (site: keyof ToothPerioData["probingDepths"], val: number) => {
    setDirty(true);
    setPerioData((prev) => ({
      ...prev,
      [selectedTooth]: {
        ...activeToothData,
        probingDepths: {
          ...activeToothData.probingDepths,
          [site]: Math.max(0, val),
        },
      },
    }));
  };

  const updateRecession = (site: keyof ToothPerioData["recession"], val: number) => {
    setDirty(true);
    setPerioData((prev) => ({
      ...prev,
      [selectedTooth]: {
        ...activeToothData,
        recession: {
          ...activeToothData.recession,
          [site]: Math.max(0, val),
        },
      },
    }));
  };

  const toggleBop = (site: keyof ToothPerioData["bop"]) => {
    setDirty(true);
    setPerioData((prev) => ({
      ...prev,
      [selectedTooth]: {
        ...activeToothData,
        bop: {
          ...activeToothData.bop,
          [site]: !activeToothData.bop[site],
        },
      },
    }));
  };

  const updateMobility = (val: 0 | 1 | 2 | 3) => {
    setDirty(true);
    setPerioData((prev) => ({
      ...prev,
      [selectedTooth]: {
        ...activeToothData,
        mobility: val,
      },
    }));
  };

  // Mouseless charting: Enter moves to the next reading field (the 6 probing sites → mobility
  // → recession), so a full tooth is chartable without the mouse. Skips the BOP checkboxes
  // (those stay on Space). Opens the next dropdown (mobility) on arrival.
  const advanceOnEnter = (e: React.KeyboardEvent<HTMLElement>) => handleFormEnterNavigation(e);

  const hasPockets = Object.values(perioData).some((t) =>
    Object.values(t.probingDepths).some((depth) => depth >= 4)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", fontFamily: "var(--font-sans), sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "var(--fs-13)", color: "#1e293b", fontWeight: "var(--fw-medium)" }}>
          {lastChartedOn ? `Last charted on ${lastChartedOn}` : "Never charted"}
          {dirty && " \u00b7 unsaved readings"}
        </span>
      </div>

      {/* Gum health indicator card */}
      {hasPockets && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "#fffbeb",
            border: "1px solid #fef3c7",
            borderRadius: "10px",
            padding: "12px 16px",
            color: "#b45309",
            fontSize: "var(--fs-14)",
            fontWeight: "var(--fw-medium)",
          }}
        >
          <ShieldAlert size={16} />
          <span>Active Periodontal Pockets detected (Probing Depth &ge; 4mm). Priority hygiene scaling indicated.</span>
        </div>
      )}

      {/* Main Grid: Selector Left, Entry Panel Right */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.3fr) minmax(300px, 0.8fr)", gap: "24px", alignItems: "start" }}>

        {/* Arch Probing Grid Overview */}
        <div style={{ minWidth: 0, background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px" }}>
          <h3 style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-medium)", color: "#1e293b", margin: "0 0 16px" }}>Periodontal Summary Chart</h3>

          <TableWrap>
            <Table minWidth={680}>
              <thead>
                <Tr><Th>Tooth</Th><Th align="center">DB</Th><Th align="center">B</Th><Th align="center">MB</Th><Th align="center">DL</Th><Th align="center">L</Th><Th align="center">ML</Th><Th align="center">BOP</Th><Th align="center">Mobility</Th></Tr>
              </thead>
              <tbody>
                {PERMANENT_TEETH.map((tooth) => {
                  const data = perioData[tooth] || createEmptyToothData(tooth);
                  const isSelected = selectedTooth === tooth;
                  const activeBop = Object.values(data.bop).some(Boolean);

                  return (
                    <Tr
                      key={tooth}
                      onClick={() => setSelectedTooth(tooth)}
                      style={{
                        borderBottom: "1px solid #f1f5f9",
                        cursor: "pointer",
                        background: isSelected ? "var(--acc-soft)" : "transparent",
                        fontWeight: isSelected ? 700 : 500,
                      }}
                    >
                      <Td style={{ fontWeight: 550, color: isSelected ? "var(--acc)" : "#1e293b" }}>{tooth}</Td>
                      {[data.probingDepths.db, data.probingDepths.b, data.probingDepths.mb, data.probingDepths.dl, data.probingDepths.l, data.probingDepths.ml].map((depth, idx) => (
                        <Td
                          key={idx}
                          align="center"
                          style={{
                            color: depth >= 4 ? "#ef4444" : "#475569",
                            fontWeight: depth >= 4 ? 550 : 400,
                          }}
                        >
                          {depth}
                        </Td>
                      ))}
                      <Td align="center" style={{ color: activeBop ? "#ef4444" : "#9aa3b6" }}>
                        {activeBop ? "🩸" : "—"}
                      </Td>
                      <Td align="center" style={{ fontWeight: 550, color: data.mobility > 0 ? "#d97706" : "#64748b" }}>
                        {data.mobility > 0 ? `G${data.mobility}` : "—"}
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </TableWrap>
        </div>

        {/* Selected Tooth Perio Editor */}
        <div onKeyDown={advanceOnEnter} onFocusCapture={handleFormKeyboardFocus} onPointerDownCapture={handleFormKeyboardPointerDown} style={{ minWidth: 0, background: "#ffffff", borderRadius: "12px", border: "1px solid #e2e8f0", padding: "20px", height: "fit-content" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px", marginBottom: "16px" }}>
            <h4 style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "#1e293b", margin: 0 }}>Tooth {selectedTooth} Readings</h4>
            <span style={{ fontSize: "var(--fs-13)", color: "var(--acc)", background: "var(--acc-soft)", padding: "3px 8px", borderRadius: "12px", fontWeight: "var(--fw-medium)" }}>
              6-Site Charting
            </span>
          </div>

          {/* Probing depths */}
          <div style={{ marginBottom: "18px" }}>
            <span style={{ display: "block", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#1e293b", marginBottom: "8px" }}>
              Pocket Probing Depth (mm)
            </span>

            {/* Buccal Row */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "10px" }}>
              <span style={{ fontSize: "var(--fs-12)", color: "#1e293b", fontWeight: "var(--fw-medium)" }}>Buccal Surfaces (DB / B / MB)</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {(["db", "b", "mb"] as const).map((site) => (
                  <div key={site} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      placeholder="0"
                      value={activeToothData.probingDepths[site] || ""}
                      onChange={(e) => updateProbingDepth(site, parseInt(e.target.value) || 0)}
                      style={{
                        padding: "8px",
                        border: "1px solid #a9b2c2",
                        borderRadius: "6px",
                        textAlign: "center",
                        fontSize: "var(--fs-14)",
                        fontWeight: "var(--fw-medium)",
                        color: activeToothData.probingDepths[site] >= 4 ? "#ef4444" : "#1e293b",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Lingual Row */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "var(--fs-12)", color: "#1e293b", fontWeight: "var(--fw-medium)" }}>Lingual/Palatal (DL / L / ML)</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                {(["dl", "l", "ml"] as const).map((site) => (
                  <div key={site} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <input
                      type="number"
                      min="0"
                      max="15"
                      placeholder="0"
                      value={activeToothData.probingDepths[site] || ""}
                      onChange={(e) => updateProbingDepth(site, parseInt(e.target.value) || 0)}
                      style={{
                        padding: "8px",
                        border: "1px solid #a9b2c2",
                        borderRadius: "6px",
                        textAlign: "center",
                        fontSize: "var(--fs-14)",
                        fontWeight: "var(--fw-medium)",
                        color: activeToothData.probingDepths[site] >= 4 ? "#ef4444" : "#1e293b",
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* BOP and Mobility */}
          <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "12px" }}>
            <div>
              <span style={{ display: "block", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#1e293b", marginBottom: "8px" }}>
                Bleeding on Probing (BOP) Sites
              </span>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {(["db", "b", "mb", "dl", "l", "ml"] as const).map((site) => (
                  <label
                    key={site}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "var(--fs-12)",
                      fontWeight: "var(--fw-medium)",
                      color: activeToothData.bop[site] ? "#dc2626" : "#64748b",
                      border: `1px solid ${activeToothData.bop[site] ? "#fca5a5" : "#e2e8f0"}`,
                      background: activeToothData.bop[site] ? "#fee2e2" : "transparent",
                      padding: "4px 8px",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      data-checkbox-visual="hidden"
                      checked={activeToothData.bop[site]}
                      onChange={() => toggleBop(site)}
                      style={{ display: "none" }}
                    />
                    🩸 {site.toUpperCase()}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1.2fr", gap: "12px", marginTop: "4px" }}>
              <div>
                <label style={{ display: "block", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#1e293b", marginBottom: "6px" }}>
                  Mobility Class
                </label>
                <select
                  value={activeToothData.mobility}
                  onChange={(e) => updateMobility(parseInt(e.target.value, 10) as 0 | 1 | 2 | 3)}
                  style={{ width: "100%", padding: "8px", border: "1px solid #a9b2c2", borderRadius: "6px", fontSize: "var(--fs-13)" }}
                >
                  <option value={0}>Normal (Grade 0)</option>
                  <option value={1}>Grade I</option>
                  <option value={2}>Grade II</option>
                  <option value={3}>Grade III (Severe)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "#1e293b", marginBottom: "6px" }}>
                  Recession DB/B/MB (mm)
                </label>
                <div style={{ display: "flex", gap: "4px" }}>
                  {(["db", "b", "mb"] as const).map((site) => (
                    <input
                      key={site}
                      type="number"
                      min="0"
                      max="10"
                      placeholder={site.toUpperCase()}
                      value={activeToothData.recession[site] || ""}
                      onChange={(e) => updateRecession(site, parseInt(e.target.value) || 0)}
                      style={{
                        width: "100%",
                        padding: "6px",
                        border: "1px solid #a9b2c2",
                        borderRadius: "6px",
                        textAlign: "center",
                        fontSize: "var(--fs-12)",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Cancel & Save Action Buttons below Mobility Class & Recession */}
            {onSave && (
              <div
                style={{
                  marginTop: "20px",
                  paddingTop: "16px",
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  gap: "10px",
                }}
              >
                {saveError && (
                  <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#b91c1c", marginRight: "auto" }}>
                    {saveError}
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setPerioData(initialPerioData);
                    setDirty(false);
                    setSaveError("");
                  }}
                  disabled={!dirty || saving}
                  style={{
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    background: "#ffffff",
                    color: !dirty || saving ? "#94a3b8" : "#334155",
                    fontSize: "var(--fs-13)",
                    fontWeight: "var(--fw-medium)",
                    cursor: !dirty || saving ? "not-allowed" : "pointer",
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  data-wizard-next
                  onClick={() => void save()}
                  disabled={!dirty || saving}
                  title={dirty ? undefined : "Update a reading first"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "7px",
                    padding: "9px 18px",
                    border: "none",
                    borderRadius: "8px",
                    background: dirty && !saving ? "var(--acc, #7c3aed)" : "#9aa3b6",
                    color: "#fff",
                    fontSize: "var(--fs-13)",
                    fontWeight: "var(--fw-bold)",
                    cursor: dirty && !saving ? "pointer" : "not-allowed",
                    boxShadow: dirty && !saving ? "0 2px 4px rgba(124, 58, 237, 0.2)" : "none",
                  }}
                >
                  {saving ? (
                    <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />
                  ) : (
                    <Check size={14} />
                  )}
                  {saving ? "Saving\u2026" : saved ? "Saved" : "Save readings"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
