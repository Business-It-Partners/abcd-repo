import { useRef, useState, type FormEvent } from "react";
import { Loader2, Plus } from "lucide-react";
import { ClinicError, type ClinicCommand } from "@/sdk/client";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { Field, FieldPair, Input, InlineCheck, ModalBody, ModalError, Select } from "@/shared/ui/workspace-primitives";
import { todayISO } from "@/shared/dates/nepaliDate";
import { SupplierListApi } from "./api";
import { supplierTypes } from "./types";
import type { ClinicSupplier, SupplierType, SupplierUpdateInput, SupplierWriteInput, SupplierWriteResponse } from "./types";

function errorMessage(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this supplier action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "VALIDATION") return "The clinic rejected this supplier. Review the name, contact details, opening balance, and date.";
    if (cause.code === "CONFLICT") return "This supplier changed in the clinic. The latest supplier was reloaded; close this form and reopen it before editing again.";
    if (cause.outcome === "unknown") return "We could not confirm whether this supplier was saved. Keep this form open and retry the original save to check the same request.";
    return cause.message || "The supplier could not be saved.";
  }
  return cause instanceof Error ? cause.message : "The supplier could not be saved.";
}

function parseAmount(value: string): number | null {
  const normalized = value.replaceAll(",", "").trim();
  if (!normalized) return 0;
  if (!/^-?(?:\d+|\d*\.\d{1,2})$/.test(normalized)) return null;
  const amount = Number(normalized);
  return Number.isFinite(amount) && Math.abs(amount) <= 100_000_000 ? amount : null;
}

export default function SupplierFormModal({
  api,
  supplier,
  onClose,
  onSaved,
  onConflict,
}: {
  api: SupplierListApi;
  supplier?: ClinicSupplier;
  onClose: () => void;
  onSaved: (supplier: ClinicSupplier) => Promise<void>;
  onConflict: () => Promise<void>;
}) {
  const [name, setName] = useState(supplier?.name ?? "");
  const [contactPerson, setContactPerson] = useState(supplier?.contactPerson ?? "");
  const [phone, setPhone] = useState(supplier?.phone ?? "");
  const [email, setEmail] = useState(supplier?.email ?? "");
  const [address, setAddress] = useState(supplier?.address ?? "");
  const [openingBalance, setOpeningBalance] = useState(String(supplier?.openingBalanceAmount ?? 0));
  const [openingAsOf, setOpeningAsOf] = useState(supplier?.openingBalanceAsOf || todayISO());
  const [active, setActive] = useState(supplier?.active ?? true);
  const [supplierType, setSupplierType] = useState<SupplierType>(supplier?.supplierType ?? "goods");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [error, setError] = useState("");
  const [conflicted, setConflicted] = useState(false);
  const command = useRef<ClinicCommand<SupplierWriteResponse> | null>(null);
  const locked = saving || unknownWrite || conflicted;
  const amount = parseAmount(openingBalance);
  const canSave = name.trim().length > 0
    && name.trim().length <= 160
    && contactPerson.trim().length <= 160
    && phone.trim().length <= 40
    && email.trim().length <= 254
    && (!email.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    && address.trim().length <= 500
    && amount !== null;

  const validate = (): boolean => {
    if (!name.trim()) { setValidationError("Enter a supplier name."); return false; }
    if (name.trim().length > 160) { setValidationError("Supplier name must be 160 characters or less."); return false; }
    if (contactPerson.trim().length > 160) { setValidationError("Contact person must be 160 characters or less."); return false; }
    if (phone.trim().length > 40) { setValidationError("Phone must be 40 characters or less."); return false; }
    if (email.trim().length > 254 || (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))) { setValidationError("Enter a valid email address of 254 characters or less."); return false; }
    if (address.trim().length > 500) { setValidationError("Address must be 500 characters or less."); return false; }
    if (amount === null) { setValidationError("Enter an opening balance with no more than two decimal places and within NPR 100,000,000."); return false; }
    if (!openingAsOf) { setValidationError("Choose the opening balance date."); return false; }
    return true;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || conflicted) return;
    if (!unknownWrite && !validate()) return;

    setSaving(true);
    setError("");
    setValidationError("");
    try {
      let activeCommand = command.current;
      if (!activeCommand) {
        const input: SupplierWriteInput = {
          name: name.trim(),
          supplierType,
          contactPerson: contactPerson.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          address: address.trim() || null,
          openingBalanceAmount: amount ?? 0,
          openingBalanceAsOf: openingAsOf,
          active,
        };
        const update: SupplierUpdateInput | undefined = supplier ? { ...input, expectedRowVersion: supplier.rowVersion } : undefined;
        activeCommand = supplier && update
          ? api.updateSupplier(supplier.supplierId, update)
          : api.createSupplier(input);
        command.current = activeCommand;
      }

      const saved = await activeCommand.execute();
      command.current = null;
      await onSaved(saved.supplier);
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        setError(errorMessage(cause));
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        command.current = null;
        setUnknownWrite(false);
        setConflicted(true);
        setError(errorMessage(cause));
        await onConflict();
      } else {
        command.current = null;
        setUnknownWrite(false);
        setError(errorMessage(cause));
      }
    } finally {
      setSaving(false);
    }
  };

  const clearValidation = () => { setValidationError(""); setError(""); };

  return (
    <ClinicModal
      title={supplier ? "Edit supplier" : "New supplier"}
      onClose={onClose}
      maxWidth={520}
      closeDisabled={saving || unknownWrite}
    >
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)}>
        <Field label="Supplier name" required>
          <Input autoFocus placeholder="e.g. Dental Depot" value={name} maxLength={160} disabled={locked} onChange={(event) => { setName(event.target.value); clearValidation(); }} />
        </Field>

        <FieldPair>
          <Field label="Contact person">
            <Input placeholder="Optional" value={contactPerson} maxLength={160} disabled={locked} onChange={(event) => { setContactPerson(event.target.value); clearValidation(); }} />
          </Field>
          <Field label="Phone">
            <Input inputMode="tel" placeholder="Optional" value={phone} maxLength={40} disabled={locked} onChange={(event) => { setPhone(event.target.value); clearValidation(); }} />
          </Field>
        </FieldPair>

        <Field label="Email">
          <Input type="email" inputMode="email" placeholder="Optional" value={email} maxLength={254} disabled={locked} onChange={(event) => { setEmail(event.target.value); clearValidation(); }} />
        </Field>

        <Field label="Address">
          <Input placeholder="Optional" value={address} maxLength={500} disabled={locked} onChange={(event) => { setAddress(event.target.value); clearValidation(); }} />
        </Field>

        <Field label="Supplier type" required>
          <Select value={supplierType} disabled={locked} onChange={(event) => { setSupplierType(event.target.value as SupplierType); clearValidation(); }}>
            {supplierTypes.map((type) => <option key={type} value={type}>{type === "goods" ? "Goods supplier" : type === "lab" ? "Dental lab" : "Goods supplier and dental lab"}</option>)}
          </Select>
        </Field>

        <FieldPair>
          <Field label="Opening balance" hint="Already owed when you started tracking here. Leave 0 if nothing.">
            <Input inputMode="decimal" placeholder="0" value={openingBalance} disabled={locked} onChange={(event) => { setOpeningBalance(event.target.value); clearValidation(); }} />
          </Field>
          <Field label="As of" hint="The date that balance was true.">
            <DatePicker value={openingAsOf} max={todayISO()} disabled={locked} onChange={(value) => { setOpeningAsOf(value); clearValidation(); }} fluid />
          </Field>
        </FieldPair>

        {supplier && <InlineCheck label="Active — offered when recording a purchase" checked={active} onChange={(checked) => { setActive(checked); clearValidation(); }} />}
        {error ? <ModalError>{error}</ModalError> : null}
        {validationError ? <ModalError>{validationError}</ModalError> : null}
        <button type="submit" disabled={saving || conflicted || (!unknownWrite && !canSave)} className="btn btn-primary btn-block">
          {saving ? <><Loader2 size={14} className="spin-icon" /> Saving…</> : unknownWrite ? "Retry original save" : <><Plus size={14} /> {supplier ? "Save supplier" : "Add supplier"}</>}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}
