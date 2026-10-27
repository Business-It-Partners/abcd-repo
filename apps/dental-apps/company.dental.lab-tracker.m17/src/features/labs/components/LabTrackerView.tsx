"use client";

import { useState, useEffect } from "react";
import { Briefcase, Check, Truck, Eye, Edit3, Calendar, Trash2 } from "lucide-react";
import { formatDateShort, type LabOrder, type LabSupplier } from "@/features/labs/model/domain";
import { LAB_WORK_OPTIONS } from "@/features/labs/model/labWork";
import LabsPanel from "./LabsPanel";
import LabSupplierDetailView from "./LabSupplierDetailView";
import MonthPicker from "@/shared/dates/MonthPicker";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import { isInBSMonth, bsMonthLabel } from "@/shared/dates/nepaliDate";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import { useClinicRouteState } from "@/shell/routing/useClinicRouteState";
import { todayNepalISO } from "@/shared/dates/nepaliDate";
import {
  Page,
  PageHeader,
  RowActions,
  EmptyState,
  Field,
  Input,
  Select,
  Textarea,
  DataTable,
  type Column,
  Card,
  CardHeader,
  CardBody,
  Drawer,
  Modal,
  ModalBody,
} from "@/shared/ui/workspace-primitives";
import type { ClinicLabOrder, LabOrderAssignmentInput } from "@/features/labs/types";

interface LabTrackerViewProps {
  onUpdateOrderStatus: (id: string, status: LabOrder["status"]) => Promise<void> | void;
  onUpdateOrder: (id: string, patch: Partial<Omit<LabOrder, "id">>) => Promise<void>;
  onRemoveOrder?: (id: string, reason: string) => Promise<void> | void;
  removedOrders?: LabOrder[];
  /** Tenant-scoped rows supplied by the clinic care workspace. */
  orders?: LabOrder[];
  labs: LabSupplier[];
  onAddLab: (lab: Omit<LabSupplier, "id" | "isLab">) => Promise<void>;
  onUpdateLab: (id: string, patch: Partial<Omit<LabSupplier, "id">>) => Promise<void>;
  labsLoading: boolean;
  ordersRefreshing?: boolean;
  pendingRequests?: ClinicLabOrder[];
  onAssignPendingRequest?: (id: string, input: LabOrderAssignmentInput) => Promise<void>;
  canManageSharedSuppliers?: boolean;
  active?: boolean;
  onLifecycle?: (state: { dirty: boolean; modal: boolean }) => void;
  loadError?: string;
  selectedLabSupplierId?: string | null;
  onOpenLabSupplierDetail?: (supplierId: string) => void;
  onInvalidLabSupplierDetail?: () => void;
}

const PAGE_SIZE = 15;
const LAB_STEPS: LabOrder["status"][] = ["Sent", "Received", "Fitted"];

/** "2083-04" → "Shrawan 2083" */
function monthLabel(ym: string): string {
  return bsMonthLabel(ym);
}

export default function LabTrackerView({
  onUpdateOrderStatus,
  onUpdateOrder,
  onRemoveOrder,
  removedOrders = [],
  orders: activeOrderRows = [],
  labs,
  onAddLab,
  onUpdateLab,
  labsLoading,
  ordersRefreshing = false,
  pendingRequests = [],
  onAssignPendingRequest,
  canManageSharedSuppliers = false,
  active = true,
  onLifecycle,
  loadError = '',
  selectedLabSupplierId = null,
  onOpenLabSupplierDetail,
  onInvalidLabSupplierDetail,
}: LabTrackerViewProps) {
  // The migration adapter owns this in-memory order directory. It resets on refresh.
  const orders = activeOrderRows.filter((order) => !order.voidedAt);
  const { showToast, showError } = useSnackbar();
  const { route, openDetail, closeDetail, patch } = useClinicRouteState();
  const section = route.tab === "labs/suppliers" ? "labs" : "orders";
  const filterTab = ["Pending", "Sent", "Received", "Fitted"].includes(route.params.status ?? "") ? route.params.status! : "all";
  const month = route.params.month ?? "all";
  const detailId = route.params.labOrderId ?? null;
  const [editingOrder, setEditingOrder] = useState<LabOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<LabOrder | null>(null);
  const [removalReason, setRemovalReason] = useState("");
  const [removalBusy, setRemovalBusy] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  // One order has one revision-controlled status journey. Prevent two clicks on the same row
  // from sending stale transitions while its current transition is being stored.
  const [savingStatusOrderIds, setSavingStatusOrderIds] = useState<Set<string>>(() => new Set());
  const [statusConfirm, setStatusConfirm] = useState<{
    order: LabOrder;
    targetStatus: LabOrder["status"];
  } | null>(null);
  const [assigningRequest, setAssigningRequest] = useState<ClinicLabOrder | null>(null);

  const detailOrder = detailId ? orders.find((o) => o.id === detailId) ?? null : null;
  useEffect(() => {
    if (!labsLoading && detailId && !detailOrder) patch({ labOrderId: null }, "replace");
  }, [detailId, detailOrder, labsLoading, patch]);

  const activeOrders = orders
    .filter((o) => {
      const matchesStatus = filterTab === "all" || o.status === filterTab;
      const matchesMonth = month === "all" || isInBSMonth(o.sentDate, month);
      return matchesStatus && matchesMonth;
    })
    .sort((a, b) => b.sentDate.localeCompare(a.sentDate));

  const getStatusColor = (status: LabOrder["status"]) => {
    switch (status) {
      case "Sent":
        return { bg: "#eff6ff", text: "#2563eb", border: "#bfdbfe" };
      case "Received":
        return { bg: "#ecfdf5", text: "#059669", border: "#a7f3d0" };
      case "Fitted":
        return { bg: "#f1f5f9", text: "#1e293b", border: "#9aa3b6" };
      case "Pending":
        return { bg: "#fffbeb", text: "#92400e", border: "#fcd34d" };
      default:
        return { bg: "#f8fafc", text: "#64748b", border: "#e2e8f0" };
    }
  };

  const openLabSupplierId = selectedLabSupplierId;
  const openLabSupplier = openLabSupplierId ? labs.find((l) => l.id === openLabSupplierId) : null;
  useEffect(() => {
    if (!active || section === "labs") return;
    const formOpen = Boolean(editingOrder || deletingOrder || assigningRequest);
    const modalOpen = formOpen || Boolean(statusConfirm) || Boolean(detailId);
    onLifecycle?.({ dirty: formOpen, modal: modalOpen });
  }, [active, assigningRequest, deletingOrder, detailId, editingOrder, onLifecycle, openLabSupplierId, section, statusConfirm]);
  useEffect(() => {
    if (active && section === "labs" && !labsLoading && !loadError && openLabSupplierId && !openLabSupplier) {
      onInvalidLabSupplierDetail?.();
    }
  }, [active, labsLoading, loadError, onInvalidLabSupplierDetail, openLabSupplier, openLabSupplierId, section]);
  if (openLabSupplier) {
    return (
      <LabSupplierDetailView
        lab={openLabSupplier}
        orders={[...orders, ...removedOrders]}
        loading={labsLoading}
      />
    );
  }

  return (
    <Page sheet standardPage>
      {section === "orders" && (
        <PageHeader title="Lab Tracker" icon={<Briefcase size={17} style={{ color: "var(--acc)" }} />}>
          {ordersRefreshing ? <span aria-live="polite" role="status" style={{ color: "var(--ink-3)", fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)" }}>Refreshing…</span> : null}
        </PageHeader>
      )}
      {section === "labs" && (
        <LabsPanel
          labs={labs}
          onAddLab={onAddLab}
          onUpdateLab={onUpdateLab}
          onOpenLabDetail={(lab) => onOpenLabSupplierDetail?.(lab.id)}
          loading={labsLoading}
          canManageSharedSuppliers={canManageSharedSuppliers}
          active={active}
          onLifecycle={onLifecycle}
        />
      )}

      {section === "orders" && (
        <>
          {removedOrders.length > 0 && (
            <Card square style={{ marginTop: "var(--sp-4)" }}>
              <CardHeader title={<><Trash2 size={15} /> Cancelled lab orders ({removedOrders.length})</>}>
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowRemoved((open) => !open)}>
                  {showRemoved ? "Hide" : "View cancelled"}
                </button>
              </CardHeader>
              {showRemoved && (
                <CardBody>
                  <p style={{ margin: "0 0 12px", fontSize: "var(--fs-13)", color: "var(--ink-2)" }}>Cancelled orders remain here for audit history and cannot be restored.</p>
                  <DataTable<LabOrder>
                    rows={removedOrders}
                    rowKey={(order) => order.id}
                    noun="cancelled orders"
                    columns={[
                      { key: "patient", header: "Patient", render: (order) => <span style={{ fontWeight: "var(--fw-bold)" }}>{order.patientName}</span> },
                      { key: "procedure", header: "Lab work", render: (order) => <>{order.procedure}{order.tooth ? ` · Tooth ${order.tooth}` : ""}</> },
                      { key: "reason", header: "Cancellation reason", render: (order) => <span>{order.voidReason || "—"}</span> },
                      { key: "cancelled", header: "Cancelled", render: (order) => <span>{order.voidedAt ? formatDateShort(order.voidedAt.slice(0, 10)) : "—"}</span> },
                    ]}
                  />
                </CardBody>
              )}
            </Card>
          )}
          {/* Table Card View */}
          <DataTable<LabOrder>
            rows={activeOrders}
            rowKey={(o) => o.id}
            noun="orders"
            standardPage
            pageSize={PAGE_SIZE}
            loading={labsLoading}
            filters={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-start", gap: "var(--sp-3)", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)", flexWrap: "wrap" }}>
                  {(["all", "Pending", "Sent", "Received", "Fitted"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => patch({ status: tab === "all" ? null : tab })}
                      style={{
                        background: filterTab === tab ? "#078bc6" : "#ffffff",
                        color: filterTab === tab ? "#ffffff" : "#344e68",
                        border: `1px solid ${filterTab === tab ? "#078bc6" : "#c6d6e5"}`,
                        borderRadius: 0,
                        minHeight: "36px",
                        padding: "0 12px",
                        fontSize: "14px",
                        fontWeight: filterTab === tab ? 700 : 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      type="button"
                    >
                      {tab === "all" ? "All Orders" : tab}
                    </button>
                  ))}
                  <MonthPicker value={month} onChange={(value) => patch({ month: value === "all" ? null : value })} allowAll allLabel="All months" />
                </div>
              </div>
            }
            empty={
              <EmptyState
                icon={<Truck size={26} />}
                message={
                  month === "all"
                    ? "There are no lab orders in this status category."
                    : `No lab orders were sent in ${monthLabel(month)}.`
                }
              />
            }
            columns={[
              {
                key: "sn",
                header: "S.N.",
                emphasis: "regular",
                align: "center",
                width: 44,
                render: (_order, i) => (
                  <span style={{ color: "var(--ink-3)", fontWeight: "var(--fw-medium)" }}>{i + 1}</span>
                ),
              },
              {
                // Patient column with vertically stacked Tooth & Shade
                key: "patientName",
                header: "Patient",
                emphasis: "strong",
                sortable: true,
                value: (order) => order.patientName,
                render: (order) => (
                  <>
                    <div style={{ fontWeight: "var(--fw-bold)", color: "var(--ink-1)" }}>{order.patientName}</div>
                    {/* Tooth and shade sit side by side, not stacked. They are two attributes of
                        ONE piece of work — stacking them read as two separate facts and cost the
                        row an extra line of height for nothing. Wraps only if the cell is squeezed. */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "var(--sp-1)",
                        marginTop: "var(--sp-1)",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--fs-13)",
                          fontWeight: "var(--fw-medium)",
                          color: "#475569",
                          background: "#f1f5f9",
                          padding: "1px 6px",
                          borderRadius: "var(--r-xs)",
                          display: "inline-block",
                        }}
                      >
                        Tooth {order.tooth || "—"}
                      </span>
                      {order.shade && (
                        <span
                          style={{
                            fontSize: "var(--fs-13)",
                            fontWeight: "var(--fw-medium)",
                            color: "#854d0e",
                            background: "#fef9c3",
                            border: "1px solid #fef08a",
                            padding: "1px 6px",
                            borderRadius: "var(--r-xs)",
                            display: "inline-block",
                          }}
                        >
                          Shade {order.shade}
                        </span>
                      )}
                    </div>
                  </>
                ),
              },
              {
                key: "procedure",
                header: "Work",
                sortable: true,
                value: (order) => order.procedure || "Lab details pending",
                render: (order) => (
                  <span style={{ fontWeight: "var(--fw-medium)", color: "var(--acc)" }}>{order.procedure || "Lab details pending"}</span>
                ),
              },
              {
                key: "labName",
                header: "Lab",
                sortable: true,
                nowrap: true,
                // Sorting and search stay on the FULL name — only the display is shortened.
                value: (order) => order.labName,
                /* "Kantipur Dental Clinic" is three words of which one identifies the lab; the
                   other two are the same on every row. Showing the first word buys that width
                   back for the columns that actually differ. The full name is on hover, because
                   two labs can share a first word and the desk must be able to tell them apart. */
                render: (order) => {
                  const full = order.labName || "—";
                  const first = full.split(" ")[0];
                  return <span title={full}>{first === full ? full : `${first}…`}</span>;
                },
              },
              {
                key: "sentDate",
                header: "Sent",
                sortable: true,
                nowrap: true,
                value: (order) => order.sentDate,
                render: (order) => order.sentDate ? formatDateShort(order.sentDate) : "—",
              },
              // Separate column for each status stage, with confirmation on click.
              ...LAB_STEPS.map(
                (step, stepIdx): Column<LabOrder> => ({
                  key: `step-${step}`,
                  header: step,
                  align: "center",
                  width: 56,
                  render: (order) => {
                    const curIdx = LAB_STEPS.indexOf(order.status);
                    const reached = stepIdx <= curIdx;
                    const canClick = order.status !== "Fitted" && order.status !== "Cancelled" && stepIdx === curIdx + 1;
                    const isNext = stepIdx === curIdx + 1;
                    const color = getStatusColor(step).text;
                    const saving = savingStatusOrderIds.has(order.id);
                    return (
                      <button
                        type="button"
                        data-checkbox-control={!(step === "Sent" && order.status === "Pending") && step !== order.status ? "" : undefined}
                        data-checkbox-visual="square"
                        data-loading-message="Updating lab order…"
                        role="checkbox"
                        aria-checked={reached}
                        disabled={!canClick || saving}
                        title={
                          saving
                            ? "Saving…"
                            : isNext
                            ? `Advance to ${step}`
                            : step === order.status
                            ? `Currently ${step}`
                            : `Complete previous stage first`
                        }
                        onClick={async () => {
                          if (!canClick || saving) return;
                          if (step === "Sent" && order.status === "Pending") {
                            const request = pendingRequests.find((item) => item.labOrderId === order.id);
                            if (request) setAssigningRequest(request);
                            else showError("This pending lab request is no longer available. Refresh and try again.");
                            return;
                          }
                          const nextStatus = step;
                          if (nextStatus !== order.status) {
                            setSavingStatusOrderIds((current) => new Set(current).add(order.id));
                            try {
                              await onUpdateOrderStatus(order.id, nextStatus);
                              showToast(nextStatus === "Pending" ? "Lab assignment cleared." : `Order marked as ${nextStatus}`);
                            } catch (err) {
                              showError((err as Error).message || "Could not update the lab order.");
                            } finally {
                              setSavingStatusOrderIds((current) => {
                                const next = new Set(current);
                                next.delete(order.id);
                                return next;
                              });
                            }
                          }
                        }}
                        style={{
                          "--checkbox-color": color,
                          width: "20px",
                          height: "20px",
                          borderRadius: "5px",
                          display: "inline-grid",
                          placeItems: "center",
                          cursor: saving ? "wait" : canClick ? "pointer" : "not-allowed",
                          opacity: saving ? 0.7 : canClick || reached ? 1 : 0.4,
                          border: `1.5px solid ${reached ? color : "#cbd5e1"}`,
                          background: reached ? color : "#ffffff",
                          transition: "all 0.12s ease",
                          padding: 0,
                        } as React.CSSProperties}
                      >
                        {reached && <Check size={12} strokeWidth={3} style={{ color: "#fff" }} />}
                      </button>
                    );
                  },
                }),
              ),
              {
                key: "actions",
                header: "Actions",
                align: "right",
                render: (order) => (
                  <RowActions>
                    <button
                      type="button"
                      onClick={() => openDetail("labOrderId", order.id)}
                      className="btn btn-secondary btn-sm"
                      title="View status timeline & history"
                    >
                      <Eye size={13} /> View
                    </button>
                    {order.status === "Sent" && (
                      <button
                        type="button"
                        onClick={() => void Promise.resolve(onUpdateOrderStatus(order.id, "Pending")).then(() => showToast("Lab assignment returned to pending.")).catch((err: unknown) => showError((err as Error).message || "Could not return this lab order to pending."))}
                        className="btn btn-secondary btn-sm"
                        title="Clear the lab assignment and return this order to pending"
                      >
                        Return to pending
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingOrder(order)}
                      className="btn btn-secondary btn-sm"
                      title="Edit the reception note"
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    {onRemoveOrder && (order.status === "Sent" || order.status === "Received") && (
                      <button
                        type="button"
                        onClick={() => { setDeletingOrder(order); setRemovalReason(""); }}
                        className="btn btn-secondary btn-sm"
                        title="Cancel this lab order and preserve its audit history"
                        style={{ color: "#dc2626", borderColor: "#fca5a5" }}
                      >
                        <Trash2 size={13} /> Cancel
                      </button>
                    )}
                  </RowActions>
                ),
              },
            ]}
          />

        </>
      )}

      {/* View Detail Sheet */}
      {detailOrder && (
        <LabDetailSheet
          order={detailOrder}
          onClose={() => closeDetail("labOrderId")}
          onEdit={() => {
            const o = detailOrder;
            closeDetail("labOrderId");
            setEditingOrder(o);
          }}
        />
      )}

      {/* The Worker allows reception notes to change; clinical request details remain immutable. */}
      {editingOrder && (
        <EditLabOrderModal
          order={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSave={async (patch) => {
            await onUpdateOrder(editingOrder.id, patch);
            setEditingOrder(null);
            showToast("Updated successfully");
          }}
        />
      )}

      {/* Logical removal: keep the clinical/financial history and record why it changed. */}
      {deletingOrder && (
        <ConfirmDialog
          title="Cancel Lab Order?"
          body={
            <div>
              Cancel the lab order for <strong>{deletingOrder.procedure}</strong> ({deletingOrder.patientName})?
              <br />
              <span style={{ fontSize: "var(--fs-13)", color: "var(--ink-3)", marginTop: "6px", display: "inline-block" }}>
                Its clinical and audit history will be preserved. Cancelled orders cannot be restored.
              </span>
              <Field label="Reason for cancellation *" style={{ marginTop: "12px" }}>
                <Input value={removalReason} onChange={(event) => setRemovalReason(event.target.value)} autoFocus />
              </Field>
            </div>
          }
          confirmLabel="Cancel Order"
          destructive
          busy={removalBusy}
          confirmDisabled={!removalReason.trim()}
          onConfirm={async () => {
            setRemovalBusy(true);
            try {
              if (onRemoveOrder) await onRemoveOrder(deletingOrder.id, removalReason.trim());
              setDeletingOrder(null);
              setRemovalReason("");
              showToast("Lab order cancelled and retained in history.");
            } catch (err) {
              showError((err as Error).message || "Could not remove the lab order.");
            } finally {
              setRemovalBusy(false);
            }
          }}
          onCancel={() => { setDeletingOrder(null); setRemovalReason(""); }}
        />
      )}

      {statusConfirm && (
        <ConfirmDialog
          title="Change order status?"
          body={<><p>Mark the lab order for <strong>{statusConfirm.order.patientName}</strong> (<em>{statusConfirm.order.procedure}</em>) as <strong>{statusConfirm.targetStatus}</strong>?</p><p style={{ color: "var(--ink-3)", fontSize: "var(--fs-13)" }}>This changes only the clinical lab journey. Record the lab invoice separately when it is received.</p></>}
          confirmLabel="Confirm"
          onCancel={() => setStatusConfirm(null)}
          onConfirm={async () => {
            try {
              await onUpdateOrderStatus(statusConfirm.order.id, statusConfirm.targetStatus);
              setStatusConfirm(null);
              showToast("Updated successfully");
            } catch (err) {
              showError((err as Error).message || "Could not update the lab order.");
            }
          }}
        />
      )}
      {assigningRequest && (
        <AssignLabRequestModal
          request={assigningRequest}
          labs={labs.filter((lab) => lab.active)}
          onClose={() => setAssigningRequest(null)}
          onAssign={async (input) => {
            try {
              await onAssignPendingRequest?.(assigningRequest.labOrderId, input);
              setAssigningRequest(null);
              showToast("Lab assigned and marked sent.");
            } catch (cause) {
              showError(cause instanceof Error ? cause.message : "Could not assign this lab request.");
            }
          }}
        />
      )}
    </Page>
  );
}

function AssignLabRequestModal({ request, labs, onClose, onAssign }: { request: ClinicLabOrder; labs: LabSupplier[]; onClose: () => void; onAssign: (input: LabOrderAssignmentInput) => Promise<void> }) {
  const [supplierId, setSupplierId] = useState("");
  const [labWorkName, setLabWorkName] = useState(request.labWorkName || "");
  const [toothScope, setToothScope] = useState(request.toothScope || "");
  const [shade, setShade] = useState(request.shade || "");
  const [sentOn, setSentOn] = useState(todayNepalISO());
  const [receptionNote, setReceptionNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!supplierId || !labWorkName.trim() || !sentOn || saving) return;
    setSaving(true);
    try {
      await onAssign({
        supplierId,
        labWorkName: labWorkName.trim(),
        toothScope: toothScope.trim() || null,
        shade: shade.trim() || null,
        sentOn,
        receptionNote: receptionNote.trim() || null,
        expectedRowVersion: request.rowVersion,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Send to lab" onClose={onClose}>
      <ModalBody as="form" onSubmit={submit} aria-busy={saving}>
        <Card square style={{ background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: "var(--sp-3)" }}>
          <CardBody>
            <strong style={{ display: "block" }}>{request.patientName} · {request.patientNumber}</strong>
          </CardBody>
        </Card>
        <Field label="Procedure / work" required>
          <Input list="lab-work-options" value={labWorkName} onChange={(event) => setLabWorkName(event.target.value)} autoFocus disabled={saving} placeholder="Select or type lab work" />
          <datalist id="lab-work-options">{LAB_WORK_OPTIONS.map((work) => <option key={work} value={work} />)}</datalist>
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sp-2)" }}>
          <Field label="Tooth">
            <Input value={toothScope} onChange={(event) => setToothScope(event.target.value)} disabled={saving} placeholder="e.g. 46" />
          </Field>
          <Field label="Shade">
            <Input value={shade} onChange={(event) => setShade(event.target.value)} disabled={saving} placeholder="e.g. A2" />
          </Field>
        </div>
        <Field label="Lab supplier" required>
          <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} disabled={saving}>
            <option value="">Select active lab supplier…</option>
            {labs.map((lab) => <option key={lab.id} value={lab.id}>{lab.name}</option>)}
          </Select>
        </Field>
        <Field label="Sent date" required>
          <DatePicker value={sentOn} onChange={setSentOn} max={todayNepalISO()} fluid disabled={saving} />
        </Field>
        <Field label="Reception / dispatch note" hint="Optional; kept separate from the doctor’s clinical instruction.">
          <Textarea value={receptionNote} onChange={(event) => setReceptionNote(event.target.value)} placeholder="e.g. Pickup requested for afternoon" disabled={saving} />
        </Field>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)" }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!supplierId || !labWorkName.trim() || !sentOn || saving}>{saving ? "Sending…" : "Send to lab"}</button>
        </div>
      </ModalBody>
    </Modal>
  );
}

export function EditLabOrderModal({
  order,
  onClose,
  onSave,
}: {
  order: LabOrder;
  onClose: () => void;
  onSave: (patch: Partial<Omit<LabOrder, "id">>) => Promise<void>;
}) {
  const [notes, setNotes] = useState(order.notes || "");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave({ notes: notes.trim() || undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Edit reception note — ${order.patientName}`} onClose={onClose} maxWidth={500}>
      <ModalBody as="form" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
          <Card square style={{ background: "#f8fafc", border: "1px solid #e2e8f0", marginBottom: "var(--sp-3)" }}>
            <CardBody>
              <strong>{order.procedure}</strong>
              <div style={{ color: "var(--ink-2)", marginTop: "4px" }}>{order.labName || "No supplier"} · Tooth {order.tooth || "—"}{order.shade ? ` · Shade ${order.shade}` : ""}</div>
              {order.clinicalNote && <p style={{ margin: "8px 0 0", color: "var(--ink-2)" }}>Clinical request: {order.clinicalNote}</p>}
            </CardBody>
          </Card>
          <Field label="Reception / lab feedback note (optional)" hint="Clinical request details are read-only after submission.">
            <Textarea autoFocus value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Pickup, delivery, or lab feedback" />
          </Field>

          <button type="submit" disabled={saving} className="btn btn-primary btn-block">
            {saving ? "Saving…" : "Save changes"}
          </button>
      </ModalBody>
    </Modal>
  );
}

// Enhanced Right-Side Drawer Sheet
export function LabDetailSheet({
  order,
  onClose,
  onEdit,
}: {
  order: LabOrder;
  onClose: () => void;
  onEdit?: () => void;
}) {
  const curIdx = LAB_STEPS.indexOf(order.status);
  const history = order.status === "Pending" ? [] : order.statusHistory?.length
    ? order.statusHistory
    : [{ status: "Sent" as LabOrder["status"], date: order.sentDate, by: "" }];
  // Clean history: only consider events for steps up to the CURRENT order.status index
  const validHistory = history.filter((h) => {
    const idx = LAB_STEPS.indexOf(h.status);
    return idx >= 0 && idx <= curIdx;
  });
  const eventFor = (s: LabOrder["status"]) => {
    const idx = LAB_STEPS.indexOf(s);
    if (idx > curIdx) return undefined;
    const found = validHistory.find((h) => h.status === s);
    if (found) return found;
    return { status: s, date: order.sentDate, by: "" };
  };

  return (
    <Drawer
      compact
      title={
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{order.procedure}</span>
          <span
            style={{
              fontSize: "var(--fs-13)",
              fontWeight: "var(--fw-bold)",
              padding: "2px 8px",
              borderRadius: "10px",
              background: order.status === "Pending" ? "#fffbeb" : order.status === "Fitted" ? "#dcfce7" : order.status === "Received" ? "#ecfdf5" : "#eff6ff",
              color: order.status === "Pending" ? "#92400e" : order.status === "Fitted" ? "#15803d" : order.status === "Received" ? "#059669" : "#2563eb",
              border: `1px solid ${order.status === "Pending" ? "#fcd34d" : order.status === "Fitted" ? "#bbf7d0" : order.status === "Received" ? "#a7f3d0" : "#bfdbfe"}`,
            }}
          >
            {order.status}
          </span>
        </div>
      }
      subtitle={`Patient: ${order.patientName || "—"} · Tooth ${order.tooth || "—"}${order.shade ? ` · Shade ${order.shade}` : ""}`}
      onClose={onClose}
      actions={onEdit ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
          <Edit3 size={13} style={{ marginRight: 4 }} /> Edit Order
        </button>
      ) : undefined}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* KPI Summary Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "12px" }}>
          <div
            style={{
              background: "#ffffff",
              padding: "12px 14px",
              borderRadius: "0px",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "var(--ink-2)" }}>
              External Lab
            </div>
            <div style={{ fontSize: "14px", fontWeight: "var(--fw-bold)", color: "var(--ink-1)", marginTop: "4px" }}>
              {order.labName || "—"}
            </div>
          </div>

          <div
            style={{
              background: "#ffffff",
              padding: "12px 14px",
              borderRadius: "0px",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "var(--ink-2)" }}>
                Sent Date
              </span>
              <Calendar size={14} style={{ color: "var(--ink-3)" }} />
            </div>
            <div style={{ fontSize: "14px", fontWeight: "var(--fw-bold)", color: "var(--ink-1)", marginTop: "4px" }}>
              {order.sentDate ? formatDateShort(order.sentDate) : "Not sent"}
            </div>
          </div>

        </div>

        {/* Status Journey Timeline Card */}
        <Card>
          <CardHeader title="Status Journey Timeline" />
          <CardBody>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {LAB_STEPS.map((step, i) => {
                const done = i <= curIdx;
                const ev = done ? eventFor(step) : undefined;
                const isLast = i === LAB_STEPS.length - 1;
                return (
                  <div key={step} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: "14px" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <span
                        style={{
                          width: "22px",
                          height: "22px",
                          borderRadius: "50%",
                          flexShrink: 0,
                          background: done ? "var(--acc)" : "#ffffff",
                          border: `2px solid ${done ? "var(--acc)" : "#cbd5e1"}`,
                          display: "grid",
                          placeItems: "center",
                          boxShadow: done ? "0 2px 8px rgba(124, 58, 237, 0.25)" : "none",
                        }}
                      >
                        {done && <Check size={12} strokeWidth={3} style={{ color: "#ffffff" }} />}
                      </span>
                      {!isLast && (
                        <span
                          style={{
                            width: "2px",
                            flex: 1,
                            minHeight: "26px",
                            background: done ? "var(--acc)" : "#e2e8f0",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ paddingBottom: isLast ? 0 : "16px" }}>
                      <div style={{ fontSize: "14px", fontWeight: "var(--fw-bold)", color: done ? "var(--ink-1)" : "#94a3b8" }}>
                        {step}
                      </div>
                      {ev ? (
                        <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-2)", marginTop: "2px" }}>
                          <span style={{ fontWeight: "var(--fw-medium)" }}>{formatDateShort(ev.date)}</span>
                          {ev.by ? ` · by ${ev.by}` : ""}
                        </div>
                      ) : (
                        <div style={{ fontSize: "var(--fs-13)", color: "var(--ink-3)", marginTop: "2px" }}>Pending stage</div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>

        {/* Always show this card. An empty note is useful information: it tells the clinic no
            special instruction was recorded, rather than making staff wonder if the field failed
            to save. */}
        <Card>
          <CardHeader title="Lab Order Notes" />
          <CardBody>
            {order.clinicalNote && <p style={{ margin: "0 0 8px", color: "var(--ink-1)", lineHeight: 1.5 }}><strong>Clinical request:</strong> {order.clinicalNote}</p>}
            <div style={{ fontSize: "13px", color: order.notes ? "var(--ink-1)" : "var(--ink-3)", lineHeight: 1.5, fontStyle: order.notes ? "normal" : "italic" }}>
              <strong>Reception / lab feedback:</strong> {order.notes?.trim() || "No reception note recorded for this lab order."}
            </div>
          </CardBody>
        </Card>
      </div>
    </Drawer>
  );
}
