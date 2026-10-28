"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import { X, Plus, Trash2, Check, Pencil, Calendar } from "lucide-react";
import { todayShort, displayToISO, formatDateShort, todayISO } from "@/features/patients/model/domain";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import {
  type CanalChartData,
  type CanalReading,
  deriveCanals,
  REFERENCE_POINTS,
  OBTURATION_MATERIALS,
} from "@/features/work-entry/model/canalData";
import { Modal, ModalBody } from "@/shared/ui/workspace-primitives";
import { handleSandboxedFormSubmitClick, handleSandboxedFormSubmitKeyDown } from "@/shared/ui/workspace-primitives/sandboxedFormSubmit";

const ACC = "var(--acc, #7c3aed)";
const INK = "#1b1b27";
const MUTED = "#565660";

const head: React.CSSProperties = {
  fontSize: "var(--fs-12)",
  fontWeight: "var(--fw-bold)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--ink-1)",
};

const cell: React.CSSProperties = {
  width: "100%",
  height: "36px",
  padding: "0 10px",
  border: "1px solid var(--field-border, #cbd5e1)",
  borderRadius: "8px",
  fontSize: "var(--fs-14)",
  color: INK,
  background: "#ffffff",
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
};

const viewCell: React.CSSProperties = {
  height: "36px",
  display: "flex",
  alignItems: "center",
  fontSize: "var(--fs-14)",
  color: INK,
  background: "#f8fafc",
  border: "1px solid #e2e8f0",
  padding: "0 10px",
  borderRadius: "8px",
  boxSizing: "border-box",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

/** canal · working length · file · date · reference · remove */
const GRID = "54px 76px 64px 135px minmax(0,1fr) 24px";
const GRID_VIEW = "54px 76px 64px 135px minmax(0,1fr)";

const numCell: React.CSSProperties = { textAlign: "center", fontVariantNumeric: "tabular-nums" };
const fileCell: React.CSSProperties = { textAlign: "left", fontVariantNumeric: "tabular-nums" };

const withHash = (raw: string) => `#${raw.replace(/#/g, "")}`;

interface CanalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tooth: string;
  treatmentId?: string;
  initialData?: CanalChartData;
  onSave: (data: CanalChartData) => Promise<void> | void;
}

export default function CanalDrawer({
  isOpen,
  onClose,
  tooth,
  treatmentId,
  initialData,
  onSave,
}: CanalDrawerProps) {
  const [canals, setCanals] = useState<CanalReading[]>([]);
  const [obturationMat, setObturationMat] = useState<string>("");
  const [customMatMode, setCustomMatMode] = useState<boolean>(false);
  // A reference point may be anatomical, restorative, or a clinician's own landmark.
  // Keep custom-mode UI separate from the actual clinical text saved on the reading.
  const [customReferenceRows, setCustomReferenceRows] = useState<Set<number>>(new Set());
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const formRef = useRef<HTMLFormElement>(null);
  const pickerOpened = useRef(false);
  const { showToast, showError } = useSnackbar();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const hasData = !!(initialData && initialData.canals.length > 0);
    setIsEditing(!hasData);

    if (hasData) {
      setCanals(initialData!.canals.map((c) => ({
        ...c,
        note: c.note || "#",
        date: c.date || formatDateShort(initialData?.date || todayISO()),
      })));
      setCustomReferenceRows(new Set(initialData!.canals.flatMap((c, i) => c.referencePoint && !REFERENCE_POINTS.includes(c.referencePoint) ? [i] : [])));
      const initMat = initialData!.obturationMaterial || "";
      setObturationMat(initMat);
      setCustomMatMode(initMat !== "" && !OBTURATION_MATERIALS.includes(initMat));
    } else {
      setCanals(
        deriveCanals(tooth).map((name) => ({
          canal: name,
          lengthMm: "",
          referencePoint: "",
          note: "#",
          date: todayShort(),
        })),
      );
      setCustomReferenceRows(new Set());
      setObturationMat("");
      setCustomMatMode(false);
    }
  }, [isOpen, tooth, initialData]);

  const handleSave = useCallback(async () => {
    if (saving) return;
    const measured = canals.filter((canal) => canal.lengthMm.trim());
    if (!measured.length) {
      showError("Enter at least one canal working length.");
      return;
    }
    if (measured.some((canal) => {
      const length = Number(canal.lengthMm);
      return !Number.isFinite(length) || length <= 0 || length > 60;
    })) {
      showError("Each working length must be between 0 and 60 mm.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
      tooth,
      treatmentId: treatmentId || initialData?.treatmentId,
      // CanalChartData.date is a clinic-facing display date, like each reading's date. Keep it
      // in BS and use local time so Nepal's UTC offset cannot stamp the previous AD day.
      date: todayShort(),
      canals,
      obturationMaterial: obturationMat,
      });
      setIsEditing(false);
      showToast("Readings added to this Work Entry");
    } catch (error) {
      showError((error as Error).message || "Could not save canal readings.");
    } finally {
      setSaving(false);
    }
  }, [onSave, tooth, treatmentId, initialData, canals, obturationMat, saving, showToast, showError]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && isEditing) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isEditing, onClose, handleSave, saving]);

  if (!isOpen) return null;

  const updateCanal = (index: number, patch: Partial<CanalReading>) =>
    setCanals((prev) => prev.map((c, i) => (i === index ? { ...c, ...patch } : c)));

  const addCanal = () =>
    setCanals((prev) => [
      ...prev,
      { canal: "", lengthMm: "", referencePoint: "", note: "#" },
    ]);

  const removeCanal = (index: number) => {
    setCanals((prev) => prev.filter((_, i) => i !== index));
    setCustomReferenceRows((prev) => new Set([...prev].filter((i) => i !== index).map((i) => i > index ? i - 1 : i)));
  };

  const goTo = (selector: string): boolean => {
    const el = formRef.current?.querySelector<HTMLElement>(selector);
    if (!el) return false;
    el.focus();
    if (el instanceof HTMLSelectElement && typeof el.showPicker === "function") {
      pickerOpened.current = true;
      try {
        el.showPicker();
      } catch {
        pickerOpened.current = false;
      }
    }
    return true;
  };

  const advanceFrom = (field: string, i: number) => {
    if (field === "wl") goTo(`[data-step="file:${i}"]`);
    else if (field === "file") goTo(`[data-step="ref:${i}"]`);
    else if (field === "ref") {
      if (!goTo(`[data-step="wl:${i + 1}"]`)) goTo(`[data-step="obturation"]`);
    }
  };

  const onFormKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (!isEditing || e.key !== "Enter" || e.ctrlKey || e.metaKey) return;
    const step = (e.target as HTMLElement).getAttribute("data-step");
    if (!step) return;
    e.preventDefault();
    const [field, idxRaw] = step.split(":");
    advanceFrom(field, Number(idxRaw));
  };

  const filled = canals.filter((c) => c.lengthMm.trim()).length;

  const handleCancelEdit = () => {
    const hasData = !!(initialData && initialData.canals.length > 0);
    if (hasData) {
      setCanals(initialData!.canals.map((c) => ({
        ...c,
        note: c.note || "#",
        date: c.date || formatDateShort(initialData?.date || todayISO()),
      })));
      const initMat = initialData!.obturationMaterial || "";
      setObturationMat(initMat);
      setCustomMatMode(initMat !== "" && !OBTURATION_MATERIALS.includes(initMat));
      setIsEditing(false);
    } else {
      onClose();
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Calendar size={18} style={{ color: "#7c3aed" }} />
            <span>Tooth {tooth} · Root Canal Working Length</span>
          </div>
          {!isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="btn btn-secondary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "4px", fontSize: "12px", marginRight: "12px" }}
            >
              <Pencil size={12} /> Edit
            </button>
          )}
        </div>
      }
      onClose={saving ? () => {} : onClose}
      maxWidth={640}
    >
      <ModalBody>
        <form
          ref={formRef}
          onClickCapture={handleSandboxedFormSubmitClick}
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
          onKeyDown={(e) => {
            onFormKeyDown(e);
            if (!e.defaultPrevented) handleSandboxedFormSubmitKeyDown(e);
          }}
        >
        {/* Header Metadata Info */}
        <div style={{ fontSize: "var(--fs-13)", color: MUTED, marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span>{canals.length} {canals.length === 1 ? "canal" : "canals"}</span>
          {filled > 0 && <span>· {filled} measured</span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", background: "#f1f5f9", padding: "2px 8px", borderRadius: "6px", color: "#475569", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-12)" }}>
            <Calendar size={12} /> {formatDateShort(initialData?.date || todayISO())}
          </span>
        </div>

        {/* Column Headers */}
        <div style={{ display: "grid", gridTemplateColumns: isEditing ? GRID : GRID_VIEW, gap: "10px", padding: "10px 14px", borderBottom: `1px solid #ece5d8`, background: "#fbfaf7", borderRadius: "10px 10px 0 0" }}>
          <span style={head}>Canal</span>
          <span style={head}>Length (mm)</span>
          <span style={head}>File</span>
          <span style={head}>Date</span>
          <span style={head}>Reference</span>
          {isEditing && <span />}
        </div>

        {/* Rows */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          {canals.map((c, i) => (
            <div
              key={i}
              style={{
                display: "grid",
                gridTemplateColumns: isEditing ? GRID : GRID_VIEW,
                gap: "10px",
                alignItems: "center",
                padding: isEditing ? "8px 14px" : "12px 14px",
                borderBottom: "1px solid #f4efe4",
                background: "#fff",
                transition: "background 0.2s",
              }}
            >
              {isEditing ? (
                <input
                  style={{ ...cell, fontWeight: "var(--fw-bold)", color: ACC, textAlign: "center", padding: "0 4px", background: "#faf8ff", borderColor: "#ddd4fa" }}
                  value={c.canal}
                  onChange={(e) => updateCanal(i, { canal: e.target.value })}
                  aria-label={`Canal ${i + 1} name`}
                />
              ) : (
                <span style={{ ...viewCell, fontWeight: "var(--fw-bold)", color: ACC, justifyContent: "center" }}>{c.canal || "—"}</span>
              )}

              {isEditing ? (
                <input
                  style={{ ...cell, ...numCell }}
                  data-step={`wl:${i}`}
                  value={c.lengthMm}
                  onChange={(e) => updateCanal(i, { lengthMm: e.target.value })}
                  aria-label={`Working length for ${c.canal || `canal ${i + 1}`}`}
                />
              ) : (
                <span style={{ ...viewCell, ...numCell, justifyContent: "center" }}>
                  {c.lengthMm.trim() || "—"}
                </span>
              )}

              {isEditing ? (
                <input
                  style={{ ...cell, ...fileCell }}
                  data-step={`file:${i}`}
                  value={c.note ?? "#"}
                  onChange={(e) => updateCanal(i, { note: withHash(e.target.value) })}
                  aria-label={`File size for ${c.canal || `canal ${i + 1}`}`}
                />
              ) : (
                <span style={{ ...viewCell, ...fileCell }}>
                  {(c.note ?? "").trim() && c.note !== "#" ? c.note : "—"}
                </span>
              )}

              {isEditing ? (
                <DatePicker
                  value={displayToISO(c.date || initialData?.date || "") || todayISO()}
                  onChange={(iso) => updateCanal(i, { date: formatDateShort(iso) })}
                  fluid
                />
              ) : (
                <span style={{ ...viewCell, color: MUTED }}>
                  {c.date || initialData?.date || todayShort()}
                </span>
              )}

              {isEditing ? (
                <div>
                  {customReferenceRows.has(i) && (
                    <div style={{ position: "relative" }}>
                      <input
                        autoFocus
                        style={{ ...cell, paddingRight: "32px" }}
                        data-step={`ref:${i}`}
                        value={c.referencePoint}
                        onChange={(e) => updateCanal(i, { referencePoint: e.target.value })}
                        placeholder="Type reference point…"
                        aria-label={`Custom reference point for ${c.canal || `canal ${i + 1}`}`}
                      />
                      <button
                        type="button"
                        title="Use the standard reference list"
                        onClick={() => {
                          setCustomReferenceRows((prev) => { const next = new Set(prev); next.delete(i); return next; });
                          updateCanal(i, { referencePoint: "" });
                        }}
                        style={{ position: "absolute", right: "5px", top: "50%", transform: "translateY(-50%)", border: "none", background: "transparent", color: MUTED, cursor: "pointer", padding: "2px" }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  )}
                  {!customReferenceRows.has(i) && (
                    <select
                        style={{ ...cell, cursor: "pointer" }}
                        data-step={`ref:${i}`}
                        value={c.referencePoint || ""}
                        onChange={(e) => {
                          if (e.target.value === "__custom__") {
                            setCustomReferenceRows((prev) => new Set(prev).add(i));
                            updateCanal(i, { referencePoint: "" });
                            return;
                          }
                          updateCanal(i, { referencePoint: e.target.value });
                          if (pickerOpened.current) {
                            pickerOpened.current = false;
                            advanceFrom("ref", i);
                          }
                        }}
                        onBlur={() => { pickerOpened.current = false; }}
                        aria-label={`Reference point for ${c.canal || `canal ${i + 1}`}`}
                      >
                        <option value="">Select reference…</option>
                        {REFERENCE_POINTS.map((r) => <option key={r} value={r}>{r}</option>)}
                        <option value="__custom__">+ Custom write</option>
                      </select>
                  )}
                </div>
              ) : (
                <span style={{ ...viewCell, color: MUTED }}>
                  {c.lengthMm.trim() || (c.note && c.note !== "#") ? (c.referencePoint || "—") : "—"}
                </span>
              )}

              {isEditing && (
                <button
                  type="button"
                  onClick={() => removeCanal(i)}
                  title="Remove canal"
                  style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: 0 }}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>

        {isEditing && (
          <button type="button" onClick={addCanal} className="btn btn-secondary btn-sm" style={{ marginTop: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Plus size={13} /> Add canal
          </button>
        )}

        {/* Obturation Material Section */}
        <div style={{ marginTop: "20px", padding: "16px", border: `1px solid #f0e9dc`, borderRadius: "12px", background: "#fefcf9" }}>
          <span style={{ ...head, display: "block", marginBottom: "8px", color: "#3f3f4e" }}>Obturation Material</span>
          {isEditing ? (
            customMatMode ? (
              <input
                style={cell}
                data-step="obturation"
                autoFocus
                placeholder="Type the material"
                value={obturationMat}
                onChange={(e) => setObturationMat(e.target.value)}
              />
            ) : (
              <select
                style={{ ...cell, cursor: "pointer" }}
                data-step="obturation"
                value={obturationMat}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomMatMode(true);
                    setObturationMat("");
                    return;
                  }
                  setObturationMat(e.target.value);
                }}
              >
                <option value="">Select material…</option>
                {OBTURATION_MATERIALS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="__custom__">Other…</option>
              </select>
            )
          ) : (
            <span style={{ ...viewCell, fontWeight: "var(--fw-medium)", padding: "0 12px" }}>{obturationMat || "—"}</span>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px", marginTop: "24px" }}>
          {isEditing && (
            <span style={{ fontSize: "var(--fs-12)", color: MUTED, marginRight: "auto" }}>
              Enter moves along the row · Ctrl+Enter saves
            </span>
          )}
          <button
            type="button"
            onClick={isEditing ? handleCancelEdit : onClose}
            className="btn btn-secondary"
            disabled={saving}
          >
            {isEditing ? "Cancel" : "Close"}
          </button>
          {isEditing && (
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Check size={14} /> {saving ? "Saving…" : "Save Readings"}
            </button>
          )}
        </div>
        </form>
      </ModalBody>
    </Modal>
  );
}
