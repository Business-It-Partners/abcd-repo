"use client";

import { useState, useEffect } from "react";
import styles from "@/features/patients/patient-record.module.css";
import { FlaskConical, Check, Plus, Eye, Pencil, Trash2 } from "lucide-react";
import { normaliseLabStatus, type LabOrder, type LabSupplier, todayISO, formatDateShort } from "@/features/patients/model/domain";
import { CUSTOM_LAB_WORK, isStandardLabWork, LAB_WORK_OPTIONS } from "@/features/labs/model/labWork";
import { type Case } from "@/features/work-entry/model/caseData";
import { EditLabOrderModal, LabDetailSheet } from "@/features/labs/components/LabTrackerView";
import { Card, CardHeader, DataTable, RowActions, EmptyState, Modal, ModalBody, Field, Input, Select } from "@/shared/ui/workspace-primitives";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import { newClientCommandId } from "@/features/work-entry/model/draftTypes";
import type { LabOrderAssignmentInput } from "@/features/labs/types";

type PendingLabAssignment = Omit<LabOrderAssignmentInput, "expectedRowVersion">;

interface PatientLabTabProps {
  orders: LabOrder[];
  cases: Case[];
  labs?: LabSupplier[];
  onUpdateOrder?: (id: string, patch: Partial<Omit<LabOrder, "id">>) => Promise<void>;
  onUpdateOrderStatus?: (orderId: string, newStatus: LabOrder["status"], paymentDate?: string) => Promise<void>;
  onAssignPendingLabOrder?: (orderId: string, input: PendingLabAssignment) => Promise<void>;
  /** The browser-session adapter owns this local preview id. */
  onAddLabOrder?: (newOrder: Omit<LabOrder, "id">, commandId: string) => Promise<void> | void;
  onRemoveOrder?: (id: string, reason: string) => Promise<void> | void;
  patientId?: string;
  patientName?: string;
}

export default function PatientLabTab({
  orders: initialOrders,
  labs = [],
  onUpdateOrder,
  onUpdateOrderStatus,
  onAssignPendingLabOrder,
  onAddLabOrder,
  onRemoveOrder,
  patientId = "",
  patientName = "",
}: PatientLabTabProps) {
  const { showToast, showError } = useSnackbar();
  const readOnly = !onUpdateOrder && !onUpdateOrderStatus && !onAddLabOrder && !onRemoveOrder;
  const [orders, setOrders] = useState<LabOrder[]>(initialOrders);
  const [editingOrder, setEditingOrder] = useState<LabOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<LabOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<LabOrder | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalBusy, setRemovalBusy] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingStatusOrderIds, setSavingStatusOrderIds] = useState<Set<string>>(() => new Set());
  const [dispatchingOrder, setDispatchingOrder] = useState<LabOrder | null>(null);

  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  const handleCheckboxClick = async (o: LabOrder, targetStatus: LabOrder["status"], isCurrentlyChecked: boolean) => {
    if (targetStatus === "Sent" && normaliseLabStatus(o.status) === "Pending") {
      if (!onAssignPendingLabOrder) showError("Lab dispatch is unavailable. Reload the patient record and try again.");
      else setDispatchingOrder(o);
      return;
    }
    if (!onUpdateOrderStatus || savingStatusOrderIds.has(o.id)) {
      if (!onUpdateOrderStatus) showError("Lab order status changes are available from Lab Tracker.");
      return;
    }
    let nextStatus: LabOrder["status"] = targetStatus;
    if (isCurrentlyChecked) {
      if (targetStatus === "Fitted") nextStatus = "Received";
      else if (targetStatus === "Received") nextStatus = "Sent";
      else if (targetStatus === "Sent" && normaliseLabStatus(o.status) === "Sent") nextStatus = "Pending";
    }

    setSavingStatusOrderIds((current) => new Set(current).add(o.id));
    // Update this row before the network round-trip. The parent owns the authoritative
    // lab-order list and will either confirm this status or restore it after a rejected write.
    setOrders((current) => current.map((item) => item.id === o.id ? { ...item, status: nextStatus } : item));
    try {
      await onUpdateOrderStatus(o.id, nextStatus);
      showToast(`Order marked as ${nextStatus}`);
    } catch (err) {
      setOrders((current) => current.map((item) => item.id === o.id ? o : item));
      showError((err as Error).message || "Could not update the lab order.");
    } finally {
      setSavingStatusOrderIds((current) => {
        const next = new Set(current);
        next.delete(o.id);
        return next;
      });
    }
  };

  const statusToggle = (order: LabOrder, targetStatus: LabOrder["status"], active: boolean, color: string) => <button
    type="button"
    data-checkbox-control
    data-checkbox-visual="square"
    data-loading-message="Updating lab order…"
    role="checkbox"
    aria-checked={active}
    onClick={() => void handleCheckboxClick(order, targetStatus, active)}
    disabled={readOnly || savingStatusOrderIds.has(order.id)}
    aria-busy={savingStatusOrderIds.has(order.id) || undefined}
    title={savingStatusOrderIds.has(order.id) ? "Saving…" : undefined}
    style={{ "--checkbox-color": color, width: "22px", height: "22px", borderRadius: "6px", border: active ? "none" : "1.5px solid #cbd5e1", background: active ? color : "#ffffff", color: "#ffffff", display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: readOnly || savingStatusOrderIds.has(order.id) ? "wait" : "pointer", opacity: readOnly || savingStatusOrderIds.has(order.id) ? .65 : 1 } as React.CSSProperties}
  >{active ? <Check size={14} /> : null}</button>;

  return (
    <div className={styles.tabContent}>
      {/* Top Header Card */}
      <Card style={{ marginBottom: "16px" }}>
        <CardHeader title={<><FlaskConical size={18} style={{ color: "#7c3aed" }} /> Lab Work Tracker</>}>
          {!readOnly ? <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
            style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-13)" }}
          >
            <Plus size={14} /> Add lab order
          </button> : <span style={{ color: "var(--ink-3)", fontSize: "var(--fs-12)" }}>Changes are managed in Lab Tracker</span>}
        </CardHeader>
      </Card>

      {/* Unified Single Data Table for All Patient Lab Orders */}
      <DataTable<LabOrder>
        rows={orders}
        rowKey={(order) => order.id}
        noun="lab orders"
        minWidth={980}
        empty={<EmptyState message="No lab work recorded for this patient yet." />}
        columns={[
          { key: "sn", header: "S.N.", width: 45, render: (_order, index) => index + 1 },
          { key: "work", header: "Lab work", sortable: true, value: (order) => order.procedure, render: (order) => <strong>{order.procedure}</strong> },
          { key: "tooth", header: "Tooth", width: 70, render: (order) => order.tooth ? <span style={{ background: "#f1f5f9", padding: "2px 8px", borderRadius: "6px", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)" }}>{order.tooth}</span> : "—" },
          { key: "lab", header: "Lab name", render: (order) => order.labName || "—" },
          { key: "shade", header: "Shade", width: 70, render: (order) => order.shade || "—" },
          { key: "sentDate", header: "Sent date", width: 95, sortable: true, value: (order) => order.sentDate, render: (order) => order.sentDate ? formatDateShort(order.sentDate) : "—" },
          { key: "sent", header: "Sent", width: 56, align: "center", render: (order) => { const status = normaliseLabStatus(order.status); return statusToggle(order, "Sent", status === "Sent" || status === "Received" || status === "Fitted", "#2563eb"); } },
          { key: "received", header: "Received", width: 76, align: "center", render: (order) => { const status = normaliseLabStatus(order.status); return statusToggle(order, "Received", status === "Received" || status === "Fitted", "#059669"); } },
          { key: "fitted", header: "Fitted", width: 56, align: "center", render: (order) => statusToggle(order, "Fitted", normaliseLabStatus(order.status) === "Fitted", "#16a34a") },
          { key: "actions", header: "Action", align: "right", render: (order) => <RowActions><button type="button" onClick={() => setViewingOrder(order)} className="btn btn-secondary btn-sm"><Eye size={12} /> View</button>{onUpdateOrder ? <button type="button" onClick={() => setEditingOrder(order)} className="btn btn-secondary btn-sm"><Pencil size={12} /> Edit</button> : null}{onRemoveOrder ? <button type="button" onClick={() => { setDeletingOrder(order); setRemovalReason(""); }} className="btn btn-secondary btn-sm" style={{ color: "#dc2626", borderColor: "#fca5a5" }} title="Remove lab order from active records"><Trash2 size={12} /> Remove</button> : null}</RowActions> },
        ]}
      />

      {/* Add Lab Order Popup Input Form Modal */}
      {showAddModal && (
        <AddPatientLabOrderModal
          labs={labs}
          patientId={patientId}
          patientName={patientName}
          onClose={() => setShowAddModal(false)}
          onAdd={async (newOrderData, commandId) => {
            try {
              if (!onAddLabOrder) throw new Error("Secure lab ordering is unavailable.");
              await onAddLabOrder(newOrderData, commandId);
              // The parent reloads the server-created record. Do not invent a
              // browser-only id: a lost response must never show two orders.
              setShowAddModal(false);
              showToast("Lab order created successfully");
            } catch (error) {
              showError((error as Error).message || "Could not send the lab order.");
              throw error;
            }
          }}
        />
      )}

      {/* Edit Modal */}
      {editingOrder && onUpdateOrder && (
        <EditLabOrderModal
          order={editingOrder}
          labs={labs}
          onClose={() => setEditingOrder(null)}
          onSave={async (patch) => {
            await onUpdateOrder(editingOrder.id, patch);
            setOrders((prev) =>
              prev.map((item) => (item.id === editingOrder.id ? { ...item, ...patch } : item))
            );
            setEditingOrder(null);
            showToast("Lab order updated");
          }}
        />
      )}

      {/* The View action must render a detail panel; previously it only set
          viewingOrder state, leaving the patient lab tab with no visible result. */}
      {viewingOrder && (
        <LabDetailSheet
          order={viewingOrder}
          onClose={() => setViewingOrder(null)}
          onEdit={onUpdateOrder ? () => {
            const order = viewingOrder;
            setViewingOrder(null);
            setEditingOrder(order);
          } : undefined}
        />
      )}

      {dispatchingOrder && onAssignPendingLabOrder && (
        <DispatchPendingLabOrderModal
          order={dispatchingOrder}
          labs={labs.filter((lab) => lab.active)}
          onClose={() => setDispatchingOrder(null)}
          onAssign={async (input) => {
            try {
              await onAssignPendingLabOrder(dispatchingOrder.id, input);
              setDispatchingOrder(null);
              showToast("Lab assigned and marked sent.");
            } catch (error) {
              showError((error as Error).message || "Could not assign the lab supplier.");
              throw error;
            }
          }}
        />
      )}

      {/* Logical removal keeps the lab journey available for audit. */}
      {deletingOrder && (
        <ConfirmDialog
          title="Remove Lab Order?"
          body={
            <div>
              Remove the lab order for <strong>{deletingOrder.procedure}</strong> ({deletingOrder.patientName || patientName}) from active records?
              <br />
              <span style={{ fontSize: "12px", color: "#64748b", marginTop: "6px", display: "inline-block" }}>
                Its history is preserved. This does not change the lab supplier&apos;s financial statement.
              </span>
              <Field label="Reason for removal *" style={{ marginTop: "12px" }}>
                <Input value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} autoFocus />
              </Field>
            </div>
          }
          confirmLabel="Remove Order"
          destructive
          busy={removalBusy}
          confirmDisabled={!removalReason.trim()}
          onConfirm={async () => {
            setRemovalBusy(true);
            try {
              if (onRemoveOrder) await onRemoveOrder(deletingOrder.id, removalReason.trim());
              setOrders((prev) => prev.filter((item) => item.id !== deletingOrder.id));
              setDeletingOrder(null);
              setRemovalReason("");
              showToast("Lab order removed from active records");
            } catch (err) {
              showError((err as Error).message || "Could not remove the lab order.");
            } finally {
              setRemovalBusy(false);
            }
          }}
          onCancel={() => { setDeletingOrder(null); setRemovalReason(""); }}
        />
      )}
    </div>
  );
}

function DispatchPendingLabOrderModal({ order, labs, onClose, onAssign }: { order: LabOrder; labs: LabSupplier[]; onClose: () => void; onAssign: (input: PendingLabAssignment) => Promise<void> }) {
  const [supplierId, setSupplierId] = useState("");
  const [labWorkName, setLabWorkName] = useState(order.procedure || "");
  const [toothScope, setToothScope] = useState(order.tooth || "");
  const [shade, setShade] = useState(order.shade || "");
  const [sentOn, setSentOn] = useState(todayISO());
  const [saving, setSaving] = useState(false);
  return (
    <Modal title="Send to lab" onClose={onClose} maxWidth={520}>
      <ModalBody as="form" onSubmit={(event) => { event.preventDefault(); if (!supplierId || !labWorkName.trim() || saving) return; setSaving(true); void onAssign({ supplierId, labWorkName: labWorkName.trim(), toothScope: toothScope.trim() || null, shade: shade.trim() || null, sentOn, receptionNote: null }).catch(() => setSaving(false)); }}>
        <Field label="Procedure / work" required>
          <Input list="patient-lab-work-options" value={labWorkName} onChange={(event) => setLabWorkName(event.target.value)} autoFocus placeholder="Select or type lab work" />
          <datalist id="patient-lab-work-options">{LAB_WORK_OPTIONS.map((work) => <option key={work} value={work} />)}</datalist>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
          <Field label="Tooth"><Input value={toothScope} onChange={(event) => setToothScope(event.target.value)} placeholder="e.g. 46" /></Field>
          <Field label="Shade"><Input value={shade} onChange={(event) => setShade(event.target.value)} placeholder="e.g. A2" /></Field>
        </div>
        <Field label="Lab supplier" required>
          <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            <option value="">Select active lab supplier…</option>
            {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
          </Select>
        </Field>
        <Field label="Sent date" required>
          <DatePicker value={sentOn} onChange={setSentOn} max={todayISO()} fluid />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)" }}>
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!supplierId || !labWorkName.trim() || saving}>{saving ? "Sending…" : "Send to lab"}</button>
        </div>
      </ModalBody>
    </Modal>
  );
}

// Popup Input Form Modal for Adding Lab Orders
function AddPatientLabOrderModal({
  labs,
  patientId,
  patientName,
  onClose,
  onAdd,
}: {
  labs: LabSupplier[];
  patientId: string;
  patientName: string;
  onClose: () => void;
  onAdd: (newOrder: Omit<LabOrder, "id">, commandId: string) => Promise<void>;
}) {
  const [procedure, setProcedure] = useState("");
  const [tooth, setTooth] = useState("");
  const [shade, setShade] = useState("A2");
  const activeLabs = labs.filter((lab) => lab.active);
  const [selectedLabId, setSelectedLabId] = useState(activeLabs[0]?.id || "");
  const [sentDate, setSentDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [customProcedure, setCustomProcedure] = useState(false);
  // Retained when a request times out, reset only when this modal closes after
  // success or the user deliberately cancels it.
  const [commandId] = useState(() => newClientCommandId("lab_order"));

  const procedureIsStandard = isStandardLabWork(procedure);
  const procedureChoice = customProcedure ? CUSTOM_LAB_WORK : procedureIsStandard ? procedure : procedure ? CUSTOM_LAB_WORK : "";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!procedure.trim() || saving || activeLabs.length === 0) return;
    setSaving(true);

    const selectedLabObj = activeLabs.find((l) => l.id === selectedLabId);
    try {
      await onAdd({
        patientId,
        patientName,
        procedure: procedure.trim(),
        tooth: tooth.trim() || "",
        shade: shade.trim() || "",
        labId: selectedLabId || (activeLabs[0]?.id ?? ""),
        labName: selectedLabObj?.name || "Default Dental Lab",
        sentDate: sentDate || todayISO(),
        status: "Sent",
        notes: notes.trim() || "",
      }, commandId);
    } catch {
      setSaving(false);
    }
  };

  return (
    <Modal title="Send New Lab Order" onClose={onClose} maxWidth={520}>
      <ModalBody as="form" onSubmit={handleSubmit}>
        <Field label="Procedure / Lab Work *">
          <Select
            value={procedureChoice}
            onChange={(e) => {
              const isCustom = e.target.value === CUSTOM_LAB_WORK;
              setCustomProcedure(isCustom);
              setProcedure(isCustom ? "" : e.target.value);
            }}
            autoFocus
          >
            <option value="">Select procedure / work</option>
            {LAB_WORK_OPTIONS.map((work) => <option key={work} value={work}>{work}</option>)}
            <option value={CUSTOM_LAB_WORK}>+ Custom add</option>
          </Select>
          {customProcedure && (
            <Input
              placeholder="Type custom lab work"
              value={procedure}
              onChange={(e) => setProcedure(e.target.value)}
              required
              autoFocus
              style={{ marginTop: "var(--sp-2)" }}
            />
          )}
        </Field>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <Field label="Tooth Scope">
            <Input placeholder="e.g. 14, 26" value={tooth} onChange={(e) => setTooth(e.target.value)} />
          </Field>
          <Field label="Shade">
            <Input placeholder="e.g. A2" value={shade} onChange={(e) => setShade(e.target.value)} />
          </Field>
        </div>

        <Field label="Lab Supplier">
          <Select value={selectedLabId} onChange={(e) => setSelectedLabId(e.target.value)}>
            {activeLabs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
            {activeLabs.length === 0 && <option value="">No active lab supplier</option>}
          </Select>
        </Field>

        <Field label="Sent Date">
          <DatePicker value={sentDate} onChange={setSentDate} fluid />
        </Field>

        <Field label="Lab Notes / Special Instructions (optional)">
          <Input placeholder="e.g. High aesthetic translucent ceramic" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={!procedure.trim() || saving || activeLabs.length === 0} className="btn btn-primary">
            {saving ? "Sending…" : "Send Lab Order"}
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
