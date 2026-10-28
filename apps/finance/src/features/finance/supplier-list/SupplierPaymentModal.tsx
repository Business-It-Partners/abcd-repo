import { useRef, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { ClinicError, type ClinicCommand } from "@/sdk/client";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { Field, FieldPair, Input, ModalBody, ModalError, Select } from "@/shared/ui/workspace-primitives";
import { formatNpr } from "@/features/finance/internal/lib/domain";
import { todayISO } from "@/shared/dates/nepaliDate";
import { SupplierListApi } from "./api";
import { supplierPaymentMethods } from "./types";
import type { ClinicPurchase, ClinicSupplier, SupplierPaymentWriteInput, SupplierPaymentWriteResponse } from "./types";

function errorMessage(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this payment action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "VALIDATION") return "The clinic rejected this payment. Check the active supplier, clinic branch, date, amount, method, and linked purchase.";
    if (cause.code === "CONFLICT") return "The clinic could not match this payment request. Refresh the supplier account before trying again.";
    if (cause.outcome === "unknown") return "We could not confirm whether this payment was recorded. Keep this dialog open and retry the original request to check the same payment.";
    return cause.message || "The supplier payment could not be recorded.";
  }
  return cause instanceof Error ? cause.message : "The supplier payment could not be recorded.";
}

export default function SupplierPaymentModal({
  api,
  supplier,
  purchases,
  purchasesLoading,
  purchasesError,
  onClose,
  onSaved,
}: {
  api: SupplierListApi;
  supplier: ClinicSupplier;
  purchases: ClinicPurchase[];
  purchasesLoading: boolean;
  purchasesError: string | null;
  onClose: () => void;
  onSaved: (payment: SupplierPaymentWriteResponse["supplierPayment"]) => Promise<void>;
}) {
  const { showError } = useClinicSnackbar();
  const [date, setDate] = useState(todayISO());
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<(typeof supplierPaymentMethods)[number]>(supplierPaymentMethods[0]);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [purchaseId, setPurchaseId] = useState("");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const command = useRef<ClinicCommand<SupplierPaymentWriteResponse> | null>(null);
  const normalizedAmount = amountText.replaceAll(",", "").trim();
  const amount = Number(normalizedAmount);
  const amountFormatValid = /^\d+(?:\.\d{1,2})?$/.test(normalizedAmount);
  const selectedPurchase = purchases.find((purchase) => purchase.purchaseId === purchaseId && purchase.supplierId === supplier.supplierId && purchase.status === "recorded");
  const paymentScope = selectedPurchase?.purchaseType === "lab_service" ? "lab" : "general";
  const canSave = supplier.active
    && amountFormatValid && Number.isFinite(amount) && amount > 0
    && reference.trim().length <= 160
    && note.trim().length <= 1_000;
  const locked = saving || unknownWrite;

  const validate = (): boolean => {
    if (!supplier.active) { setValidationError("Activate this supplier before recording a payment."); return false; }
    if (!date || date > todayISO()) { setValidationError("Choose a valid payment date no later than today."); return false; }
    if (!amountFormatValid || !Number.isFinite(amount) || amount <= 0) { setValidationError("Enter a positive payment amount with no more than two decimal places."); return false; }
    if (reference.trim().length > 160) { setValidationError("Reference must be 160 characters or less."); return false; }
    if (note.trim().length > 1_000) { setValidationError("Note must be 1,000 characters or less."); return false; }
    if (purchaseId && !selectedPurchase) { setValidationError("Choose a recorded purchase belonging to this supplier."); return false; }
    return true;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || (!unknownWrite && !validate())) return;
    setSaving(true);
    setError("");
    setValidationError("");
    try {
      let activeCommand = command.current;
      if (!activeCommand) {
        const input: SupplierPaymentWriteInput = {
          supplierId: supplier.supplierId,
          paymentDate: date,
          amount,
          paymentMethod: method,
          paymentReference: reference.trim() || null,
          purchaseId: purchaseId || null,
          paymentScope,
          note: note.trim() || null,
        };
        activeCommand = api.createPayment(input);
        command.current = activeCommand;
      }
      const saved = await activeCommand.execute();
      command.current = null;
      await onSaved(saved.supplierPayment);
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        const message = errorMessage(cause);
        setError(message);
        showError(message);
      } else {
        command.current = null;
        setUnknownWrite(false);
        const message = errorMessage(cause);
        setError(message);
        showError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const clearErrors = () => { setError(""); setValidationError(""); };
  const linkedPurchases = purchases.filter((purchase) => purchase.supplierId === supplier.supplierId && purchase.status === "recorded");

  return (
    <ClinicModal title="Record payment" onClose={onClose} maxWidth={640} closeDisabled={saving || unknownWrite}>
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)}>
        <Field label="Supplier">
          <div className="finance-supplier-locked-name">{supplier.name}</div>
        </Field>
        {!supplier.active ? <ModalError>Activate this supplier before recording a payment.</ModalError> : null}

        {selectedPurchase?.purchaseType === "lab_service" && (
          <p role="status" className="finance-supplier-scope-note">Lab invoice selected — this payment will be recorded in the Lab ledger.</p>
        )}

        <FieldPair>
          <Field label="Date" required>
            <DatePicker value={date} max={todayISO()} disabled={locked} onChange={(value) => { setDate(value); clearErrors(); }} fluid />
          </Field>
          <Field label="Amount" required>
            <Input inputMode="decimal" placeholder="0" value={amountText} disabled={locked} onChange={(event) => { setAmountText(event.target.value); clearErrors(); }} style={{ textAlign: "right", fontWeight: "var(--fw-bold)" }} />
          </Field>
        </FieldPair>

        <Field label="Related purchase invoice (optional)" hint={purchasesError ? `Purchase list unavailable — ${purchasesError}` : purchasesLoading ? "Loading purchase invoices…" : undefined}>
          <Select value={purchaseId} disabled={locked || purchasesLoading} onChange={(event) => { setPurchaseId(event.target.value); clearErrors(); }}>
            <option value="">No linked invoice</option>
            {linkedPurchases.map((purchase) => (
              <option key={purchase.purchaseId} value={purchase.purchaseId}>
                {purchase.invoiceNumber ? `Invoice ${purchase.invoiceNumber}` : `Purchase ${purchase.purchaseDate}`} · {formatNpr(purchase.totalAmount)}
              </option>
            ))}
          </Select>
        </Field>

        <FieldPair>
          <Field label="Method" required>
            <Select value={method} disabled={locked} onChange={(event) => { setMethod(event.target.value as typeof method); clearErrors(); }}>
              {supplierPaymentMethods.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Reference (optional)">
            <Input placeholder="Cheque no., transaction id" value={reference} maxLength={160} disabled={locked} onChange={(event) => { setReference(event.target.value); clearErrors(); }} />
          </Field>
        </FieldPair>

        <Field label="Note (optional)">
          <Input placeholder="Anything worth recording" value={note} maxLength={1_000} disabled={locked} onChange={(event) => { setNote(event.target.value); clearErrors(); }} />
        </Field>

        {error ? <ModalError>{error}</ModalError> : null}
        {validationError ? <ModalError>{validationError}</ModalError> : null}
        <button type="submit" disabled={saving || (!unknownWrite && !canSave)} className="btn btn-primary btn-block">
          {saving ? <><Loader2 size={14} className="spin-icon" /> Saving…</> : unknownWrite ? "Retry original payment" : <><Plus size={14} /> Record payment</>}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}
