import { useEffect, useMemo, useState } from "react";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { ClinicClient, ClinicError, type ClinicCommand } from "@/sdk/client";
import { formatDateShort, isInBSMonth, todayBSMonth, todayISO } from "@/shared/dates/nepaliDate";
import MonthPicker from "@/shared/dates/MonthPicker";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { DataTable, EmptyState, Field, Input, ModalBody, ModalError, Page, PageHeader, RowActions, type Column } from "@/shared/ui/workspace-primitives";
import { formatNpr } from "../internal/lib/domain";
import { SupplierListApi } from "../supplier-list/api";
import SupplierPaymentFormDialog from "./SupplierPaymentFormDialog";
import type {
  ClinicPurchase,
  ClinicSupplier,
  ClinicSupplierPayment,
  SupplierPaymentWriteResponse,
} from "../supplier-list/types";

function writeError(cause: unknown, action: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this payment action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "CONFLICT") return "This payment changed or is no longer recorded. Refresh the list before continuing.";
    if (cause.code === "VALIDATION") return "The clinic rejected this payment. Check the active supplier, branch, payment details, and related invoice.";
    if (cause.outcome === "unknown") return `The clinic could not confirm this ${action}. Keep this dialog open and retry the same request.`;
    return cause.message || `The payment could not be ${action}.`;
  }
  return cause instanceof Error ? cause.message : `The payment could not be ${action}.`;
}

type PendingVoid = {
  payment: ClinicSupplierPayment;
  reason: string;
  command: ClinicCommand<SupplierPaymentWriteResponse>;
};

export default function SupplierPaymentsView({
  api,
  client,
  payments,
  suppliers,
  purchases,
  paymentsLoading,
  suppliersLoading,
  purchasesLoading,
  paymentsError,
  suppliersError,
  purchasesError,
  notice,
  onNavigationLockChange,
  onRefresh,
  onWritten,
}: {
  api: SupplierListApi;
  client: ClinicClient;
  payments: ClinicSupplierPayment[];
  suppliers: ClinicSupplier[];
  purchases: ClinicPurchase[];
  paymentsLoading: boolean;
  suppliersLoading: boolean;
  purchasesLoading: boolean;
  paymentsError: string | null;
  suppliersError: string | null;
  purchasesError: string | null;
  notice: { message: string; error: boolean } | null;
  onNavigationLockChange: (locked: boolean) => void;
  onRefresh: () => Promise<void>;
  onWritten: (payment: ClinicSupplierPayment, replacedPaymentId?: string) => Promise<void>;
}) {
  const [month, setMonth] = useState(() => todayBSMonth());
  const [recording, setRecording] = useState(false);
  const [editing, setEditing] = useState<ClinicSupplierPayment | null>(null);
  const [voiding, setVoiding] = useState<ClinicSupplierPayment | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voidCommand, setVoidCommand] = useState<PendingVoid | null>(null);
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidConflict, setVoidConflict] = useState(false);
  const formOpen = recording || Boolean(editing);
  const modalOpen = formOpen || Boolean(voiding);
  const navigationLocked = modalOpen;
  const activePayments = useMemo(() => payments.filter((payment) => payment.status === "recorded"), [payments]);
  const rows = useMemo(() => [...(month === "all"
    ? activePayments
    : activePayments.filter((payment) => isInBSMonth(payment.paymentDate, month)))]
    .sort((left, right) => right.paymentDate.localeCompare(left.paymentDate) || right.recordedAt.localeCompare(left.recordedAt)), [activePayments, month]);

  useEffect(() => {
    client.report({ dirty: navigationLocked, modal: modalOpen });
    onNavigationLockChange(navigationLocked);
    return () => {
      client.report({ dirty: false, modal: false });
      onNavigationLockChange(false);
    };
  }, [client, modalOpen, navigationLocked, onNavigationLockChange]);

  const finishVoid = async (write: PendingVoid) => {
    setVoidSaving(true);
    setVoidError("");
    try {
      const response = await write.command.execute();
      setVoidCommand(null);
      await onWritten(response.supplierPayment);
      setVoiding(null);
      setVoidReason("");
      setVoidConflict(false);
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setVoidCommand(write);
        setVoidError(writeError(cause, "void"));
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        setVoidCommand(null);
        setVoidConflict(true);
        setVoidError(writeError(cause, "voided"));
        void onRefresh().catch(() => setVoidError("The payment changed, and the list refresh failed. Use Refresh before reopening the payment."));
      } else {
        setVoidCommand(null);
        setVoidError(writeError(cause, "voided"));
      }
    } finally {
      setVoidSaving(false);
    }
  };

  const submitVoid = () => {
    if (!voiding || voidSaving || voidConflict) return;
    if (voidCommand) {
      void finishVoid(voidCommand);
      return;
    }
    const reason = voidReason.trim();
    if (!reason) { setVoidError("Enter a reason so this void is auditable."); return; }
    if (reason.length > 500) { setVoidError("The void reason must be 500 characters or less."); return; }
    void finishVoid({ payment: voiding, reason, command: api.voidPayment(voiding.supplierPaymentId, { reason }) });
  };

  const columns: Column<ClinicSupplierPayment>[] = [
    { key: "sn", header: "S.N.", align: "center", width: 44, render: (_payment, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span> },
    { key: "date", header: "Date", sortable: true, nowrap: true, value: (payment) => payment.paymentDate, render: (payment) => formatDateShort(payment.paymentDate) },
    { key: "supplier", header: "Paid to", sortable: true, value: (payment) => payment.supplierName },
    { key: "method", header: "Method", sortable: true, value: (payment) => payment.paymentMethod },
    { key: "reference", header: "Reference", render: (payment) => payment.paymentReference || "—" },
    { key: "note", header: "Note", render: (payment) => payment.note || "—" },
    { key: "amount", header: "Amount", align: "right", sortable: true, total: true, value: (payment) => payment.amount, totalFormat: (sum) => <strong>{formatNpr(sum)}</strong>, render: (payment) => formatNpr(payment.amount) },
    { key: "actions", header: "Actions", align: "center", width: 100, render: (payment) => (
      <RowActions>
        <div className="finance-payment-row-actions">
          <button type="button" className="btn btn-icon btn-ghost btn-sm" title="Edit supplier payment" aria-label={`Correct payment to ${payment.supplierName}`} onClick={() => setEditing(payment)}><Pencil size={14} /></button>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" title="Remove supplier payment" aria-label={`Void payment to ${payment.supplierName}`} style={{ color: "var(--danger, #b42318)" }} onClick={() => { setVoidError(""); setVoidReason(""); setVoidCommand(null); setVoidConflict(false); setVoiding(payment); }}><Trash2 size={14} /></button>
        </div>
      </RowActions>
    ) },
  ];

  return (
    <Page sheet>
      <PageHeader title="Supplier payments" icon={<Landmark size={17} style={{ color: "var(--acc)" }} />}>
        <ClinicActionButton onClick={() => setRecording(true)} disabled={suppliersLoading || purchasesLoading || Boolean(suppliersError)}>
          <Plus size={14} /> Record payment
        </ClinicActionButton>
      </PageHeader>
      {notice ? <p className={notice.error ? "finance-payment-notice error" : "finance-payment-notice"} role={notice.error ? "alert" : "status"}>{notice.message}</p> : null}
      {suppliersError ? <ModalError>Supplier choices could not be loaded: {suppliersError}. Refresh before recording a payment.</ModalError> : null}
      {purchasesError ? <p className="finance-payment-reference-warning" role="status">Purchase invoices could not be loaded: {purchasesError}. Payments without an invoice link remain available.</p> : null}
      <DataTable<ClinicSupplierPayment>
        rows={rows}
        rowKey={(payment) => payment.supplierPaymentId}
        noun="payments"
        loading={paymentsLoading}
        loadingLabel="Loading payments…"
        error={paymentsError ? `Couldn't load the list — ${paymentsError}` : undefined}
        errorHint="Refresh the supplier payment list before recording or correcting entries."
        filters={<MonthPicker value={month} onChange={setMonth} allowAll allLabel="All months" max={todayISO().slice(0, 7)} />}
        empty={<EmptyState icon={<Landmark size={26} />} message="No payments recorded yet." hint="Record what you pay suppliers and labs so each account stays accurate." />}
        totalsLabel="Total paid"
        columns={columns}
      />

      {recording || editing ? (
        <SupplierPaymentFormDialog
          api={api}
          suppliers={suppliers}
          purchases={purchases}
          suppliersLoading={suppliersLoading}
          purchasesLoading={purchasesLoading}
          suppliersError={suppliersError}
          purchasesError={purchasesError}
          payment={editing}
          onClose={() => { setRecording(false); setEditing(null); }}
          onRefresh={onRefresh}
          onSaved={onWritten}
        />
      ) : null}

      {voiding ? (
        <ClinicModal title="Remove supplier payment?" onClose={() => setVoiding(null)} size="small" closeDisabled={voidSaving || Boolean(voidCommand)}>
          <ModalBody>
            <p>The payment will leave cash-flow and supplier totals but remain in the audit trail.</p>
            <Field label="Reason for removal" required>
              <Input value={voidReason} maxLength={500} placeholder="Reason for removal (required)" disabled={voidSaving || Boolean(voidCommand)} autoFocus onChange={(event) => { setVoidReason(event.target.value); setVoidError(""); }} />
            </Field>
            {voidConflict ? <ModalError>This payment is no longer current. Close this dialog and review the refreshed payment list.</ModalError> : null}
            {voidError ? <ModalError>{voidError}</ModalError> : null}
            <div className="finance-payment-dialog-actions">
              <button type="button" className="btn btn-secondary" disabled={voidSaving || Boolean(voidCommand)} onClick={() => setVoiding(null)}>{voidConflict ? "Close" : "Keep payment"}</button>
              <ClinicActionButton onClick={submitVoid} disabled={voidSaving || voidConflict || (!voidCommand && !voidReason.trim())}>
                {voidSaving ? "Removing…" : voidCommand ? "Retry original removal" : "Remove payment"}
              </ClinicActionButton>
            </div>
          </ModalBody>
        </ClinicModal>
      ) : null}
    </Page>
  );
}
