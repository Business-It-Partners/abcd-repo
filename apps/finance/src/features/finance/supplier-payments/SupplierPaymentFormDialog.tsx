import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { ClinicError, type ClinicCommand } from "@/sdk/client";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import { todayISO } from "@/shared/dates/nepaliDate";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { Field, FieldPair, Input, ModalBody, ModalError, Select } from "@/shared/ui/workspace-primitives";
import { formatNpr } from "../internal/lib/domain";
import { SupplierListApi } from "../supplier-list/api";
import { supplierPaymentMethods } from "../supplier-list/types";
import type {
  ClinicPurchase,
  ClinicSupplier,
  ClinicSupplierPayment,
  SupplierPaymentWriteInput,
  SupplierPaymentWriteResponse,
} from "../supplier-list/types";

function writeError(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this payment action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "CONFLICT") return "This supplier payment changed or was already corrected. Refresh the list and reopen the current payment.";
    if (cause.code === "VALIDATION") return "The clinic rejected this payment. Check the active supplier, branch, date, amount, method, and related invoice.";
    if (cause.outcome === "unknown") return "The clinic could not confirm this payment. Keep this dialog open and retry the same request.";
    return cause.message || "The supplier payment could not be saved.";
  }
  return cause instanceof Error ? cause.message : "The supplier payment could not be saved.";
}

function validIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function SupplierPicker({
  suppliers,
  selectedId,
  disabled,
  onSelect,
}: {
  suppliers: ClinicSupplier[];
  selectedId: string;
  disabled: boolean;
  onSelect: (supplierId: string) => void;
}) {
  const selected = suppliers.find((supplier) => supplier.supplierId === selectedId);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const options = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return suppliers.filter((supplier) => supplier.active && (!term || supplier.name.toLocaleLowerCase().includes(term)));
  }, [query, suppliers]);
  const selectionMatchesQuery = Boolean(selected && query.trim() === selected.name);

  useEffect(() => {
    if (selectedId) setQuery(selected?.name ?? "");
  }, [selected?.name, selectedId]);

  const choose = (supplier: ClinicSupplier) => {
    onSelect(supplier.supplierId);
    setQuery(supplier.name);
    setOpen(false);
    const form = inputRef.current?.closest("form");
    const amountInput = form?.querySelector<HTMLInputElement>("#finance-payment-amount-input");
    amountInput?.focus();
    amountInput?.select();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((value) => Math.min(value + 1, Math.max(0, options.length - 1)));
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlight((value) => Math.max(value - 1, 0));
    }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      if (options[highlight]) choose(options[highlight]);
    }
  };

  return (
    <div className="finance-payment-supplier-picker">
      <Input
        ref={inputRef}
        autoFocus
        value={query}
        placeholder="Type supplier name…"
        disabled={disabled}
        aria-label="Supplier"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="finance-payment-supplier-options"
        onFocus={() => { setOpen(true); setHighlight(0); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setHighlight(0);
          if (event.target.value.trim() !== selected?.name) onSelect("");
        }}
      />
      {open && !disabled ? (
        <div id="finance-payment-supplier-options" className="finance-payment-supplier-options" role="listbox">
          {options.length ? options.map((supplier, index) => (
            <button
              key={supplier.supplierId}
              type="button"
              role="option"
              aria-selected={supplier.supplierId === selectedId}
              className={index === highlight ? "finance-payment-supplier-option highlighted" : "finance-payment-supplier-option"}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(supplier)}
            >{supplier.name}</button>
          )) : <p className="finance-payment-supplier-empty">No supplier matching “{query}”</p>}
        </div>
      ) : null}
      {selected && !selected.active ? <p className="finance-payment-field-hint" role="alert">This supplier is inactive. Choose an active supplier before saving.</p> : null}
      {selected && !selectionMatchesQuery ? <p className="finance-payment-field-hint" role="status">Choose a supplier from the list to confirm the selection.</p> : null}
    </div>
  );
}

export default function SupplierPaymentFormDialog({
  api,
  suppliers,
  purchases,
  suppliersLoading,
  purchasesLoading,
  suppliersError,
  purchasesError,
  payment,
  onClose,
  onRefresh,
  onSaved,
}: {
  api: SupplierListApi;
  suppliers: ClinicSupplier[];
  purchases: ClinicPurchase[];
  suppliersLoading: boolean;
  purchasesLoading: boolean;
  suppliersError: string | null;
  purchasesError: string | null;
  payment: ClinicSupplierPayment | null;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onSaved: (payment: ClinicSupplierPayment, replacedPaymentId?: string) => Promise<void>;
}) {
  const { showError } = useClinicSnackbar();
  const [supplierId, setSupplierId] = useState(payment?.supplierId ?? "");
  const [date, setDate] = useState(payment?.paymentDate ?? todayISO());
  const [amountText, setAmountText] = useState(payment ? String(payment.amount) : "");
  const [method, setMethod] = useState(payment?.paymentMethod ?? supplierPaymentMethods[0]);
  const [reference, setReference] = useState(payment?.paymentReference ?? "");
  const [note, setNote] = useState(payment?.note ?? "");
  const [purchaseId, setPurchaseId] = useState(payment?.purchaseId ?? "");
  const [correctionReason, setCorrectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const command = useRef<ClinicCommand<SupplierPaymentWriteResponse> | null>(null);
  const locked = saving || unknownWrite;
  const fieldsLocked = locked || conflicted;
  const selectedSupplier = suppliers.find((supplier) => supplier.supplierId === supplierId);
  const selectedPurchase = purchases.find((purchase) => purchase.purchaseId === purchaseId
    && purchase.supplierId === supplierId && purchase.status === "recorded");
  const linkedPurchases = useMemo(() => purchases.filter((purchase) => purchase.supplierId === supplierId && purchase.status === "recorded"), [purchases, supplierId]);
  const amount = Number(amountText.replaceAll(",", "").trim());
  const amountFormatValid = /^\d+(?:\.\d{1,2})?$/.test(amountText.replaceAll(",", "").trim());
  const paymentScope = selectedPurchase
    ? selectedPurchase.purchaseType === "lab_service" ? "lab" : "general"
    : payment?.paymentScope ?? "general";
  const selectedSupplierIsConfirmed = Boolean(selectedSupplier && selectedSupplier.active);
  const canSave = selectedSupplierIsConfirmed
    && amountFormatValid && Number.isFinite(amount) && amount > 0
    && validIsoDate(date) && date <= todayISO()
    && method.length > 0
    && reference.trim().length <= 160
    && note.trim().length <= 1_000
    && (!purchaseId || Boolean(selectedPurchase))
    && (!payment || correctionReason.trim().length > 0)
    && correctionReason.trim().length <= 500
    && !suppliersLoading && !suppliersError && !purchasesLoading && !conflicted;

  const validate = (): string | null => {
    if (suppliersError || !selectedSupplier) return "Choose an active supplier from the supplier list.";
    if (!selectedSupplier.active) return "Activate this supplier before recording or correcting a payment.";
    if (!validIsoDate(date) || date > todayISO()) return "Choose a valid payment date no later than today.";
    if (!amountFormatValid || !Number.isFinite(amount) || amount <= 0) return "Enter a positive payment amount with no more than two decimal places.";
    if (!supplierPaymentMethods.includes(method)) return "Choose a supported payment method.";
    if (reference.trim().length > 160) return "Reference must be 160 characters or less.";
    if (note.trim().length > 1_000) return "Note must be 1,000 characters or less.";
    if (purchaseId && !selectedPurchase) return "Choose a recorded invoice belonging to the selected supplier, or select No linked invoice.";
    if (payment && !correctionReason.trim()) return "Enter a reason for correcting this payment.";
    if (correctionReason.trim().length > 500) return "The correction reason must be 500 characters or less.";
    return null;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || conflicted) return;
    if (!unknownWrite) {
      const validation = validate();
      if (validation) { setValidationError(validation); return; }
    }
    setSaving(true);
    setError("");
    setValidationError("");
    try {
      if (!command.current) {
        const replacement: SupplierPaymentWriteInput = {
          supplierId,
          paymentDate: date,
          amount,
          paymentMethod: method,
          paymentReference: reference.trim() || null,
          purchaseId: purchaseId || null,
          paymentScope,
          note: note.trim() || null,
        };
        command.current = payment
          ? api.correctPayment(payment.supplierPaymentId, { replacement, reason: correctionReason.trim() })
          : api.createPayment(replacement);
      }
      const response = await command.current.execute();
      command.current = null;
      setUnknownWrite(false);
      await onSaved(response.supplierPayment, payment?.supplierPaymentId);
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        const message = writeError(cause);
        setError(message);
        showError(message);
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        command.current = null;
        setConflicted(true);
        const message = writeError(cause);
        setError(message);
        showError(message);
        void onRefresh().catch(() => {
          const refreshMessage = "This payment changed, and the list refresh failed. Use Refresh before reopening the payment.";
          setError(refreshMessage);
          showError(refreshMessage);
        });
      } else {
        command.current = null;
        const message = writeError(cause);
        setError(message);
        showError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const clearErrors = () => { setError(""); setValidationError(""); };

  return (
    <ClinicModal
      title={payment ? "Correct supplier payment" : "Record payment"}
      onClose={onClose}
      maxWidth={640}
      closeDisabled={locked}
    >
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)} className="finance-payment-form">
        <Field label="Supplier" required>
          {suppliersError ? <ModalError>Supplier choices are unavailable: {suppliersError}. Refresh before saving.</ModalError> : null}
          <SupplierPicker
            suppliers={suppliers}
            selectedId={supplierId}
            disabled={fieldsLocked || suppliersLoading || Boolean(suppliersError)}
            onSelect={(nextId) => { setSupplierId(nextId); setPurchaseId(""); clearErrors(); }}
          />
        </Field>

        {selectedPurchase?.purchaseType === "lab_service" ? (
          <p role="status" className="finance-payment-scope-note">Lab invoice selected — this payment will be recorded in the Lab ledger.</p>
        ) : null}

        <FieldPair>
          <Field label="Date" required>
            <DatePicker value={date} max={todayISO()} disabled={fieldsLocked} onChange={(value) => { setDate(value); clearErrors(); }} fluid />
          </Field>
          <Field label="Amount" required>
            <Input
              id="finance-payment-amount-input"
              inputMode="decimal"
              placeholder="0"
              value={amountText}
              disabled={fieldsLocked}
              onChange={(event) => { setAmountText(event.target.value); clearErrors(); }}
              style={{ textAlign: "right", fontWeight: "var(--fw-bold)" }}
            />
          </Field>
        </FieldPair>

        <Field
          label="Related purchase invoice (optional)"
          hint={purchasesError ? `Purchase list unavailable — ${purchasesError}` : purchasesLoading ? "Loading purchase invoices…" : undefined}
        >
          <Select
            value={purchaseId}
            disabled={fieldsLocked || purchasesLoading}
            onChange={(event) => { setPurchaseId(event.target.value); clearErrors(); }}
          >
            <option value="">No linked invoice</option>
            {payment?.purchaseId && payment.purchaseId === purchaseId && !selectedPurchase ? (
              <option value={payment.purchaseId}>Previously linked invoice is unavailable — choose a current invoice or no link</option>
            ) : null}
            {linkedPurchases.map((row) => (
              <option key={row.purchaseId} value={row.purchaseId}>
                {row.invoiceNumber ? `Invoice ${row.invoiceNumber}` : `Purchase ${row.purchaseDate}`} · {formatNpr(row.totalAmount)}
              </option>
            ))}
          </Select>
          {purchaseId && !selectedPurchase ? <p className="finance-payment-field-hint" role="alert">The selected invoice is not a current purchase for this supplier.</p> : null}
        </Field>

        <FieldPair>
          <Field label="Method" required>
            <Select value={method} disabled={fieldsLocked} onChange={(event) => { setMethod(event.target.value as typeof method); clearErrors(); }}>
              {supplierPaymentMethods.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Reference (optional)">
            <Input
              placeholder="Cheque no., transaction id"
              value={reference}
              maxLength={160}
              disabled={fieldsLocked}
              onChange={(event) => { setReference(event.target.value); clearErrors(); }}
            />
          </Field>
        </FieldPair>

        <Field label="Note (optional)">
          <Input
            placeholder="Anything worth recording"
            value={note}
            maxLength={1_000}
            disabled={fieldsLocked}
            onChange={(event) => { setNote(event.target.value); clearErrors(); }}
          />
        </Field>

        {payment ? (
          <Field label="Reason for correction" required>
            <Input
              placeholder="What was wrong in the original payment?"
              value={correctionReason}
              maxLength={500}
              disabled={fieldsLocked}
              onChange={(event) => { setCorrectionReason(event.target.value); clearErrors(); }}
            />
            <p className="finance-payment-field-hint">Saving creates a replacement payment and retains the original in the audit trail.</p>
          </Field>
        ) : null}

        {conflicted ? <ModalError>This payment is no longer current. Close this form and reopen the refreshed payment list.</ModalError> : null}
        {error ? <ModalError>{error}</ModalError> : null}
        {validationError ? <ModalError>{validationError}</ModalError> : null}
        <button type="submit" disabled={!unknownWrite && !canSave || saving} className="btn btn-primary btn-block">
          {saving
            ? <><Loader2 size={14} className="spin-icon" /> Saving…</>
            : unknownWrite
              ? "Retry original payment"
              : <><Plus size={14} /> {payment ? "Save correction" : "Record payment"}</>}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}
