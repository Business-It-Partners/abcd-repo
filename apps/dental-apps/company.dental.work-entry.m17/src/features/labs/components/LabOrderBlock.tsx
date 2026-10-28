"use client";

import { useState } from "react";
import { CheckCircle2, FlaskConical, Plus, Trash2, X } from "lucide-react";
import { type LabOrderInput } from "@/features/work-entry/model/caseData";
import { type LabSupplier } from "@/features/patients/model/domain";
import { CUSTOM_LAB_WORK, isStandardLabWork, LAB_WORK_OPTIONS } from "@/features/labs/model/labWork";
import { Card, CardHeader, CardBody, Field, Input, Select } from "@/shared/ui/workspace-primitives";
import { handleFormEnterNavigation, handleFormKeyboardFocus, handleFormKeyboardPointerDown } from "@/shared/ui/workspace-primitives/formKeyboardNavigation";

// Optional inline lab orders (CASE_ENTRY_SYSTEM_PLAN §1f/2d). Shared by the New Patient and
// Work Entry flows — usually empty, filled only for crown/bridge/denture work sent out to a
// dental lab. Fully controlled: it never holds the committed list, it reads `orders` and pushes
// every change up through `onChange`.
//
// UX mirrors PrescriptionBlock: one ENTRY card (a draft held locally) on the right, the orders
// added so far as a compact TABLE on the left. A visit can send several pieces of work out.
//
// The lab is PICKED from the registry, never typed. No expected-back date is captured here — it
// is set later from the Lab Tracker, and until then the order is never flagged overdue.

interface LabOrderBlockProps {
  orders: LabOrderInput[];
  onChange: (orders: LabOrderInput[]) => void;
  defaultTooth?: string;
  /** Registered labs. Only active ones can receive new work. */
  labs: LabSupplier[];
  /** Optional Worker adapter. Without it, the legacy new-patient draft stays local. */
  onCreateOrder?: (order: LabOrderInput) => Promise<LabOrderInput>;
  /** Optional Worker adapter for cancelling an already-saved order. */
  onCancelOrder?: (order: LabOrderInput) => Promise<void>;
  /** Work Entry holds these cards locally until its one final commit. */
  deferPersistence?: boolean;
  /** Doctor creates a supplier-free request; reception owns assignment. */
  handoffPreview?: boolean;
}

const SHADES = ["A1", "A2", "A3", "A3.5", "B1", "B2", "C1", "C2", "D2"];

export default function LabOrderBlock({ orders, onChange, defaultTooth, labs, onCreateOrder, onCancelOrder, deferPersistence = false, handoffPreview = false }: LabOrderBlockProps) {
  const activeLabs = labs.filter((l) => l.active);
  const noLabs = activeLabs.length === 0;
  const firstLab = activeLabs[0];

  const blankDraft = (labId?: string, labName?: string): LabOrderInput => ({
    procedure: "",
    tooth: defaultTooth ?? "",
    shade: "",
    labId: labId ?? firstLab?.id ?? "",
    labName: labName ?? firstLab?.name ?? "",
    notes: "",
  });

  const [draft, setDraft] = useState<LabOrderInput>(blankDraft());
  const [customProcedure, setCustomProcedure] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState("");

  if (handoffPreview) {
    const labNeeded = orders.length > 0;
    return (
      <Card>
        <CardHeader title={<><FlaskConical size={15} /> Lab requirement</>} />
        <CardBody>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", fontWeight: "var(--fw-semibold)", color: "var(--ink-1)" }}>
            <input
              type="checkbox"
              checked={labNeeded}
              onChange={(event) => onChange(event.target.checked ? [{ procedure: "", tooth: "", shade: "", labId: "", labName: "", notes: "" }] : [])}
            />
            Lab work needed
          </label>
        </CardBody>
      </Card>
    );
  }

  const procedureIsStandard = isStandardLabWork(draft.procedure);
  const procedureChoice = customProcedure ? CUSTOM_LAB_WORK : procedureIsStandard ? draft.procedure : draft.procedure ? CUSTOM_LAB_WORK : "";

  const patchDraft = (next: Partial<LabOrderInput>) => setDraft((d) => ({ ...d, ...next }));

  const pickLab = (labId: string) => {
    const lab = activeLabs.find((l) => l.id === labId);
    if (lab) patchDraft({ labId: lab.id, labName: lab.name });
  };

  const canAdd = draft.procedure.trim().length > 0 && (handoffPreview || draft.labId !== "");

  const addDraft = async () => {
    if (!canAdd || submitting) return;
    const next = { ...draft, procedure: draft.procedure.trim(), tooth: draft.tooth.trim() };
    setSubmitting(true);
    setActionError("");
    try {
      if (handoffPreview) {
        // Doctor-side lab requirements remain browser draft data until the one
        // Review & commit command persists them atomically with today's work.
        onChange([...orders, { ...next, labId: "", labName: "" }]);
        setDraft(blankDraft());
        setCustomProcedure(false);
        return;
      }
      const saved = onCreateOrder ? await onCreateOrder(next) : next;
      onChange([...orders, saved]);
      // The next piece of work almost always goes to the same lab.
      setDraft(blankDraft(draft.labId, draft.labName));
      setCustomProcedure(false);
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The lab order could not be saved.");
    } finally {
      setSubmitting(false);
    }
  };

  const removeOrder = async (i: number) => {
    const order = orders[i];
    if (!order || submitting) return;
    setSubmitting(true);
    setActionError("");
    try {
      if (onCancelOrder && order.labOrderId) await onCancelOrder(order);
      onChange(orders.filter((_, idx) => idx !== i));
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : "The lab order could not be removed.");
    } finally {
      setSubmitting(false);
    }
  };

  const advanceOnEnter = (event: React.KeyboardEvent<HTMLElement>) => handleFormEnterNavigation(event);

  return (
    <Card>
      <CardHeader title={<><FlaskConical size={15} /> {handoffPreview ? "Clinical lab requirement" : "Lab work (optional)"}</>} />
      <CardBody>
        <div onKeyDown={advanceOnEnter} onFocusCapture={handleFormKeyboardFocus} onPointerDownCapture={handleFormKeyboardPointerDown}>
        {noLabs && !handoffPreview && (
          <p style={{ margin: 0, fontSize: "var(--fs-13)", color: "#1e293b" }}>
            No labs registered yet. Add one under <strong>Lab Tracker → Labs</strong> before sending
            work out.
          </p>
        )}

        {/* The clinical entry deliberately contains no price, rate or quantity. Those facts belong
            to the supplier invoice, recorded separately from Lab Tracker. */}
        {(handoffPreview || !noLabs) && (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
            {orders.map((row, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--sp-3)", padding: "10px 12px", background: "#eff6ff", border: "1px solid #93c5fd", borderLeft: "4px solid #2563eb" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "8px", fontSize: "var(--fs-13)", color: "var(--ink-1)" }}>
                  <CheckCircle2 size={16} color="#2563eb" style={{ marginTop: "2px", flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#1d4ed8", letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "2px" }}>{deferPersistence ? "Ready for Review & commit" : handoffPreview ? "Awaiting receptionist assignment" : "Lab order added"}</div>
                    <strong>{row.procedure}</strong>
                    {row.tooth && <> · Tooth {row.tooth}</>}
                    {row.shade && <> · Shade {row.shade}</>}
                    {row.labName && !deferPersistence && !handoffPreview && <div style={{ color: "#1e40af", fontWeight: "var(--fw-medium)", marginTop: "2px" }}>Sent to {row.labName}</div>}
                    {row.notes.trim() && <div style={{ color: "var(--ink-2)", marginTop: "3px" }}>{row.notes.trim()}</div>}
                  </div>
                </div>
                {(!handoffPreview || !row.labOrderId) && <button type="button" disabled={submitting} onClick={() => void removeOrder(i)} title="Remove lab work" style={{ border: "none", background: "none", color: "var(--danger)", cursor: submitting ? "wait" : "pointer", padding: 0 }}>
                  <Trash2 size={14} />
                </button>}
              </div>
            ))}

            <div>
              <Field label="Procedure / work">
                {customProcedure && (
                  <div style={{ position: "relative" }}>
                    <Input
                      style={{ fontWeight: "var(--fw-medium)", paddingRight: "36px" }}
                      value={draft.procedure}
                      onChange={(e) => patchDraft({ procedure: e.target.value })}
                      placeholder="Type custom lab work"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCustomProcedure(false);
                        patchDraft({ procedure: "" });
                      }}
                      aria-label="Choose a standard lab procedure"
                      title="Choose a standard procedure"
                      style={{
                        position: "absolute",
                        top: "50%",
                        right: "8px",
                        transform: "translateY(-50%)",
                        width: "24px",
                        height: "24px",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "none",
                        borderRadius: "4px",
                        background: "transparent",
                        color: "#64748b",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                )}
                {!customProcedure && (
                  <Select
                    value={procedureChoice}
                    onChange={(e) => {
                      const isCustom = e.target.value === CUSTOM_LAB_WORK;
                      setCustomProcedure(isCustom);
                      patchDraft({ procedure: isCustom ? "" : e.target.value });
                    }}
                  >
                    <option value="">Select procedure / work</option>
                    {LAB_WORK_OPTIONS.map((work) => <option key={work} value={work}>{work}</option>)}
                    <option value={CUSTOM_LAB_WORK}>+ Custom add</option>
                  </Select>
                )}
              </Field>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
                <Field label="Tooth">
                  <Input value={draft.tooth} onChange={(e) => patchDraft({ tooth: e.target.value })} placeholder="e.g. 46" />
                </Field>
                <Field label="Shade">
                  <Input list="lab-shades" value={draft.shade} onChange={(e) => patchDraft({ shade: e.target.value })} placeholder="e.g. A2" />
                </Field>
                {!handoffPreview && <Field label="Lab" style={{ gridColumn: "1 / -1" }}>
                  <Select value={draft.labId} onChange={(e) => pickLab(e.target.value)}>
                    {activeLabs.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </Field>}
              </div>

              <Field label="Notes" style={{ marginTop: "var(--sp-2)" }}>
                <Input value={draft.notes} onChange={(e) => patchDraft({ notes: e.target.value })} placeholder="Margins, occlusion, special instructions…" />
              </Field>

              <button
                type="button"
                data-wizard-next
                onClick={() => void addDraft()}
                disabled={!canAdd || submitting}
                className="btn btn-primary btn-block"
                style={{ marginTop: "var(--sp-3)" }}
              >
                <Plus size={14} /> {submitting ? "Adding…" : handoffPreview ? "Add" : "Add to lab work"}
              </button>
              {actionError ? <p role="alert" style={{ margin: "var(--sp-2) 0 0", color: "var(--danger)", fontSize: "var(--fs-12)" }}>{actionError}</p> : null}
            </div>
          </div>
        )}

        {(handoffPreview || !noLabs) && (
          <p style={{ margin: "var(--sp-3) 0 0", fontSize: "var(--fs-12)", color: "#1e293b" }}>
            {handoffPreview
              ? "Added to this Work Entry. It is sent to reception only when Review & commit succeeds."
              : "Only fill for crown/bridge/denture work sent to the lab. The lab&apos;s cost is recorded later from its supplier invoice, not in this clinical order."}
          </p>
        )}

        <datalist id="lab-shades">
          {SHADES.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        </div>
      </CardBody>
    </Card>
  );
}
