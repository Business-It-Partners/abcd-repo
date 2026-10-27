"use client";

import { useState } from "react";
import { Pill, Plus, Trash2, AlertTriangle, X } from "lucide-react";
import { type RxLine } from "@/features/work-entry/model/caseData";
import { checkDrugAllergyConflict } from "@/features/patients/model/domain";
import { Card, CardHeader, CardBody, Field, Input, Select, TableWrap, Table, Th, Td, Tr, Chip } from "@/shared/ui/workspace-primitives";

// A reusable, fully controlled multi-drug prescription block, presented as a self-contained
// card (mirrors LabOrderBlock). It NEVER owns the committed list — it reads `drugs` and pushes
// every change up through `onChange`. An empty `drugs` is what "no prescription" means; there is
// no separate enabled flag to disagree with it.
//
// UX: one ENTRY card (a draft line held in local state) with an "Add" button, and the added
// drugs listed compactly as a TABLE below — no full editable card per drug. Quick-add regimen
// chips drop a common script straight into the table.

interface PrescriptionBlockProps {
  drugs: RxLine[];
  onChange: (drugs: RxLine[]) => void;
  patientAlerts: string[];
}

const COMMON_DRUGS = [
  "Amoxicillin 500mg",
  "Ibuprofen 400mg",
  "Paracetamol 500mg",
  "Metronidazole 400mg",
  "Augmentin 625mg",
  "Chlorhexidine 0.2% Mouthwash",
];

const FREQUENCIES = [
  "Three times daily (TDS)",
  "Twice daily (BD)",
  "Once daily (QD)",
  "Four times daily (QID)",
  "As needed (SOS)",
];

const DOSE_SUGGESTIONS = ["1 tablet", "2 tablets", "1 capsule", "5 ml", "10 ml rinse"];
const DURATION_SUGGESTIONS = ["3 days", "5 days", "7 days", "10 days"];

// The regimens a general dental practice writes over and over — one tap adds a whole line.
const REGIMENS: { short: string; rx: RxLine }[] = [
  { short: "Amoxicillin · TDS · 5d", rx: { medicine: "Amoxicillin 500mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "5 days", instructions: "" } },
  { short: "Ibuprofen · TDS · 3d", rx: { medicine: "Ibuprofen 400mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "3 days", instructions: "" } },
  { short: "Metronidazole · TDS · 5d", rx: { medicine: "Metronidazole 400mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "5 days", instructions: "" } },
  { short: "Paracetamol · SOS · 3d", rx: { medicine: "Paracetamol 500mg", dosage: "1 tablet", frequency: "As needed (SOS)", duration: "3 days", instructions: "" } },
  { short: "CHX rinse · BD · 7d", rx: { medicine: "Chlorhexidine 0.2% Mouthwash", dosage: "10 ml rinse", frequency: "Twice daily (BD)", duration: "7 days", instructions: "" } },
];

const blankLine = (): RxLine => ({
  medicine: "",
  dosage: "1 tablet",
  frequency: "Three times daily (TDS)",
  duration: "5 days",
  instructions: "",
});

// A section caption above a non-form block (the quick-add row, the accumulated-list table) — not
// a Field, since there's no control beside it, but the same small/uppercase/tracked/muted look
// Field uses for its own label, so the two read as one family.
const sectionCaption: React.CSSProperties = {
  display: "block",
  fontSize: "var(--fs-11)",
  fontWeight: "var(--fw-medium)",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--ink-3)",
  marginBottom: "var(--sp-1)",
};

// The highlighted draft-entry callout — a shape ./ui has no primitive for (an accent-left-border
// panel), so it stays bespoke. Sizes with no exact token match (padding, radius) are left as the
// pre-existing literals rather than invented approximations.
const entryCard: React.CSSProperties = {
  border: "1px solid #ece3d2",
  borderLeft: "3px solid var(--acc, #7c3aed)",
  borderRadius: "11px",
  background: "#faf7ef",
  padding: "13px 14px",
};

export default function PrescriptionBlock({ drugs, onChange, patientAlerts }: PrescriptionBlockProps) {
  const [draft, setDraft] = useState<RxLine>(blankLine());

  const patchDraft = (next: Partial<RxLine>) => setDraft((d) => ({ ...d, ...next }));

  const isCustom = draft.medicine !== "" && !COMMON_DRUGS.includes(draft.medicine);
  const draftConflict = checkDrugAllergyConflict(draft.medicine, patientAlerts);
  const canAdd = draft.medicine.trim().length > 0;

  const addDraft = () => {
    if (!canAdd) return;
    onChange([...drugs, { ...draft, medicine: draft.medicine.trim() }]);
    setDraft(blankLine());
  };

  const addRegimen = (rx: RxLine) => onChange([...drugs, { ...rx, instructions: "" }]);
  const removeDrug = (i: number) => onChange(drugs.filter((_, idx) => idx !== i));

  const onMedicinePick = (value: string) => patchDraft({ medicine: value === "__custom__" ? " " : value });

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
      addDraft();
    }
  };

  return (
    <Card>
      <CardHeader title={<><Pill size={15} /> Prescription (optional)</>} />
      <CardBody>
        <div onKeyDown={advanceOnEnter}>
        {/* Quick-add regimens — one tap adds a row to the list below */}
        <div style={{ marginBottom: "var(--sp-4)" }}>
          <span style={sectionCaption}>Quick add</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2)" }}>
            {REGIMENS.map((r) => (
              <button
                key={r.short}
                type="button"
                onClick={() => addRegimen(r.rx)}
                style={{ display: "inline-flex", alignItems: "center", gap: "5px", padding: "6px 11px", borderRadius: "var(--r-pill)", border: "1px solid #ddd6fe", background: "var(--acc-soft, #ede9fe)", color: "var(--acc, #7c3aed)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", cursor: "pointer", whiteSpace: "nowrap" }}
              >
                <Plus size={12} /> {r.short}
              </button>
            ))}
          </div>
        </div>

        {/* Side by side: the prescription list (left) and the entry card (right) */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(300px, 0.9fr)", gap: "var(--sp-4)", alignItems: "start" }}>
          {/* LEFT — the prescription so far, as a compact table */}
          <div>
            <span style={sectionCaption}>Prescription</span>
            {drugs.length > 0 ? (
              <TableWrap>
                <Table>
                  <thead>
                    <tr>
                      <Th style={{ width: "26px" }}>#</Th>
                      <Th>Medicine</Th>
                      <Th>Dose</Th>
                      <Th>Frequency</Th>
                      <Th>Duration</Th>
                      <Th style={{ width: "34px" }} />
                    </tr>
                  </thead>
                  <tbody>
                    {drugs.map((row, i) => {
                      const conflict = checkDrugAllergyConflict(row.medicine, patientAlerts);
                      return (
                        <Tr key={i}>
                          <Td style={{ color: "#1e293b", fontWeight: "var(--fw-medium)" }}>{i + 1}</Td>
                          <Td>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "var(--fw-medium)", color: "#1e293b" }}>
                              {row.medicine}
                              {conflict && (
                                <span title={conflict}>
                                  <Chip tone="danger">
                                    <AlertTriangle size={11} /> Allergy
                                  </Chip>
                                </span>
                              )}
                            </div>
                          </Td>
                          <Td>{row.dosage}</Td>
                          <Td>{row.frequency}</Td>
                          <Td>{row.duration}</Td>
                          <Td align="right">
                            <button
                              type="button"
                              onClick={() => removeDrug(i)}
                              title="Remove"
                              style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", border: "none", background: "none", color: "var(--danger)", cursor: "pointer", padding: 0 }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </Td>
                        </Tr>
                      );
                    })}
                  </tbody>
                </Table>
              </TableWrap>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "34px 16px", border: "1px dashed #e2d9c8", borderRadius: "11px", color: "#1e293b", background: "#fdfbf6" }}>
                <Pill size={22} style={{ marginBottom: "7px", opacity: 0.6 }} />
                <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)" }}>No medicines yet</span>
                <span style={{ fontSize: "var(--fs-12)", marginTop: "2px" }}>Fill the card on the right (or tap a quick-add) and press Add.</span>
              </div>
            )}
          </div>

          {/* RIGHT — single ENTRY card: fill it, then Add */}
          <div style={entryCard}>
            <Field label="Medicine">
              {!isCustom ? (
                <Select
                  style={{ fontWeight: "var(--fw-medium)" }}
                  value={COMMON_DRUGS.includes(draft.medicine) ? draft.medicine : ""}
                  onChange={(e) => onMedicinePick(e.target.value)}
                >
                  <option value="" disabled>Select a drug…</option>
                  {COMMON_DRUGS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                  <option value="__custom__">✏️ Custom drug…</option>
                </Select>
              ) : (
                // Typing a custom drug is a one-way door without this: `isCustom` is derived from
                // the medicine text, so only clearing it puts the dropdown back.
                <div style={{ position: "relative" }}>
                  <Input
                    style={{ fontWeight: "var(--fw-medium)", paddingRight: "34px" }}
                    autoFocus
                    placeholder="Drug name & strength"
                    value={draft.medicine.trim()}
                    onChange={(e) => patchDraft({ medicine: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => patchDraft({ medicine: "" })}
                    title="Back to the drug list"
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: "8px",
                      transform: "translateY(-50%)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "22px",
                      height: "22px",
                      border: "none",
                      borderRadius: "var(--r-sm)",
                      background: "#f1f5f9",
                      color: "#1e293b",
                      cursor: "pointer",
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              )}
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
              <Field label="Dose">
                <Input list="rx-doses" value={draft.dosage} onChange={(e) => patchDraft({ dosage: e.target.value })} placeholder="1 tablet" />
              </Field>
              <Field label="Duration">
                <Input list="rx-durations" value={draft.duration} onChange={(e) => patchDraft({ duration: e.target.value })} placeholder="5 days" />
              </Field>
              <Field label="Frequency" style={{ gridColumn: "1 / -1" }}>
                <Select value={draft.frequency} onChange={(e) => patchDraft({ frequency: e.target.value })}>
                  {FREQUENCIES.map((f) => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                </Select>
              </Field>
            </div>

            {draftConflict && (
              <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--sp-2)", marginTop: "var(--sp-3)", background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", padding: "var(--sp-2) var(--sp-3)", borderRadius: "9px", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)" }}>
                <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: "1px" }} />
                <span>{draftConflict}</span>
              </div>
            )}

            <button
              type="button"
              onClick={addDraft}
              disabled={!canAdd}
              className="btn btn-primary btn-block"
              style={{ marginTop: "var(--sp-3)" }}
            >
              <Plus size={14} /> Add to prescription
            </button>
          </div>
        </div>

        {/* Shared suggestion lists for the dose/duration inputs. */}
        <datalist id="rx-doses">
          {DOSE_SUGGESTIONS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        <datalist id="rx-durations">
          {DURATION_SUGGESTIONS.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>
        </div>
      </CardBody>
    </Card>
  );
}
