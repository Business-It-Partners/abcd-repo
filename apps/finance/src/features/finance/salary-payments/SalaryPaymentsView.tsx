import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import { bsMonthLabel, todayBSMonth, todayISO, formatDateShort } from "@/shared/dates/nepaliDate";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import MonthPicker from "@/shared/dates/MonthPicker";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import {
  DataTable,
  EmptyState,
  Field,
  FieldPair,
  Input,
  ModalBody,
  ModalError,
  Page,
  PageHeader,
  Select,
  type Column,
} from "@/shared/ui/workspace-primitives";
import { formatNpr } from "@/features/finance/internal/lib/domain";
import { decimalInput, decimalNumber, roundMoney } from "@/features/finance/patient-payments/money";
import { SalaryPaymentsApi } from "./api";
import type {
  ClinicSalaryPayout,
  ClinicStaffProfile,
  SalaryPaymentMethod,
  SalaryPayoutType,
  SalaryPayoutWriteInput,
  SalaryPayoutWriteResponse,
} from "./types";

const payoutTypeOptions: Array<{ value: SalaryPayoutType; label: string }> = [
  { value: "salary", label: "Salary" },
  { value: "advance", label: "Advance" },
  { value: "adjustment", label: "Adjustment" },
  { value: "other", label: "Other" },
];

const paymentMethodLabels: Record<SalaryPaymentMethod, string> = {
  cash: "Cash",
  bank_transfer: "Bank transfer",
  other: "Other",
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;

function validISODate(value: string): boolean {
  if (!datePattern.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return "Your clinic role does not permit this salary action. The staff list also requires staff.manage.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    if (cause.code === "VALIDATION") {
      return "The clinic rejected this payout. Review the active staff member, payout values, and clinic setup, then refresh before trying again.";
    }
    if (cause.code === "CONFLICT") {
      return "This salary payout changed. Refresh the list and review the current record before continuing.";
    }
    if (cause.outcome === "unknown") {
      return "We could not confirm whether this payout was recorded. Keep this dialog open and retry the original request to check the same operation.";
    }
    return cause.message || fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

function staffRole(staff: ClinicStaffProfile): string {
  return staff.jobTitle?.trim() || staff.staffType[0].toUpperCase() + staff.staffType.slice(1);
}

export default function SalaryPaymentsView({
  api,
  client,
  payouts,
  staff,
  loading,
  staffLoading,
  loadError,
  staffError,
  onNavigationLockChange,
  onRefresh,
  onWriteAccepted,
}: {
  api: SalaryPaymentsApi;
  client: ClinicClient;
  payouts: ClinicSalaryPayout[];
  staff: ClinicStaffProfile[];
  loading: boolean;
  staffLoading: boolean;
  loadError: string | null;
  staffError: string | null;
  onNavigationLockChange: (locked: boolean) => void;
  onRefresh: () => Promise<void>;
  onWriteAccepted: () => Promise<void>;
}) {
  const [month, setMonth] = useState(todayBSMonth);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClinicSalaryPayout | null>(null);
  const [voiding, setVoiding] = useState<ClinicSalaryPayout | null>(null);
  const modalOpen = adding || Boolean(editing) || Boolean(voiding);

  const listed = useMemo(() => payouts
    .filter((payout) => payout.status === "recorded" && (month === "all" || payout.payPeriod === month))
    .slice()
    .sort((a, b) => b.paidOn.localeCompare(a.paidOn) || b.createdAt.localeCompare(a.createdAt)), [month, payouts]);
  const staffById = useMemo(() => new Map(staff.map((profile) => [profile.staffId, profile])), [staff]);

  useEffect(() => {
    client.report({ dirty: modalOpen, modal: modalOpen });
    onNavigationLockChange(modalOpen);
    return () => {
      client.report({ dirty: false, modal: false });
      onNavigationLockChange(false);
    };
  }, [client, modalOpen, onNavigationLockChange]);

  const columns: Column<ClinicSalaryPayout>[] = [
    {
      key: "sn",
      header: "S.N.",
      align: "center",
      width: 44,
      render: (_payout, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span>,
    },
    {
      key: "date",
      header: "Issue date",
      sortable: true,
      value: (payout) => payout.paidOn,
      render: (payout) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateShort(payout.paidOn)}</span>,
    },
    { key: "staff", header: "Staff", render: (payout) => staffById.get(payout.staffId)?.fullName ?? payout.staffName ?? "—" },
    { key: "month", header: "Salary month", render: (payout) => payout.payPeriod || "—" },
    {
      key: "base",
      header: "Base",
      align: "right",
      render: (payout) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatNpr(payout.baseAmount)}</span>,
    },
    {
      key: "bonus",
      header: "Bonus",
      align: "right",
      render: (payout) => <span style={{ color: "#16a34a", fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums" }}>+{formatNpr(payout.bonusAmount)}</span>,
    },
    {
      key: "amount",
      header: "Total",
      align: "right",
      sortable: true,
      value: (payout) => payout.amount,
      render: (payout) => <span style={{ fontWeight: "var(--fw-bold)", color: "#c0392b", fontVariantNumeric: "tabular-nums" }}>{formatNpr(payout.amount)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      width: 90,
      render: (payout) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            onClick={() => setEditing(payout)}
            title="Edit salary payment"
            aria-label={`Edit salary payment for ${payout.staffName}`}
            style={{ color: "#7c3aed", padding: "4px" }}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            onClick={() => setVoiding(payout)}
            title="Remove salary payment"
            aria-label={`Remove salary payment for ${payout.staffName}`}
            style={{ color: "#dc2626", padding: "4px" }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <Page sheet standardPage>
      <PageHeader
        title="Salary payments"
        icon={<Wallet size={17} style={{ color: "var(--acc)" }} />}
      >
        <ClinicActionButton onClick={() => setAdding(true)}><Plus size={14} /> Record salary</ClinicActionButton>
      </PageHeader>

      {staffError ? (
        <p role="alert" style={{ margin: "0 0 var(--sp-3)", color: "var(--danger, #b42318)", fontSize: "var(--fs-13)" }}>
          Couldn't load active staff — {staffError}
        </p>
      ) : !staffLoading && staff.length === 0 ? (
        <p role="status" style={{ margin: "0 0 var(--sp-3)", color: "var(--ink-2)", fontSize: "var(--fs-13)" }}>
          No active staff are available for a salary payout. The staff directory requires staff.manage.
        </p>
      ) : null}

      <DataTable<ClinicSalaryPayout>
        rows={listed}
        rowKey={(payout) => payout.salaryPayoutId}
        noun="salary payments"
        standardPage
        loading={loading}
        loadingLabel="Loading salary records…"
        error={loadError ? `Couldn't load the list — ${loadError}` : undefined}
        empty={<EmptyState message="No salary payments for this salary month." />}
        filters={<MonthPicker value={month} onChange={setMonth} allowAll allLabel="All salary months" max={todayISO().slice(0, 7)} />}
        columns={columns}
      />

      {adding ? (
        <SalaryPayoutFormModal api={api} staff={staff} onClose={() => setAdding(false)} onRefresh={onRefresh} onWriteAccepted={onWriteAccepted} />
      ) : null}
      {editing ? (
        <SalaryPayoutFormModal api={api} payout={editing} staff={staff} onClose={() => setEditing(null)} onRefresh={onRefresh} onWriteAccepted={onWriteAccepted} />
      ) : null}
      {voiding ? (
        <VoidSalaryPayoutModal payout={voiding} api={api} onClose={() => setVoiding(null)} onRefresh={onRefresh} onWriteAccepted={onWriteAccepted} />
      ) : null}
    </Page>
  );
}

function SalaryPayoutFormModal({
  api,
  payout,
  staff,
  onClose,
  onRefresh,
  onWriteAccepted,
}: {
  api: SalaryPaymentsApi;
  payout?: ClinicSalaryPayout;
  staff: ClinicStaffProfile[];
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onWriteAccepted: () => Promise<void>;
}) {
  const { showSuccess, showError } = useClinicSnackbar();
  const editing = Boolean(payout);
  const [paidOn, setPaidOn] = useState(payout?.paidOn ?? todayISO());
  const [staffId, setStaffId] = useState(payout?.staffId ?? "");
  const [payPeriod, setPayPeriod] = useState(payout?.payPeriod ?? todayBSMonth());
  const [base, setBase] = useState(payout ? String(payout.baseAmount) : "");
  const [bonus, setBonus] = useState(payout ? String(payout.bonusAmount) : "");
  const [payoutType, setPayoutType] = useState<SalaryPayoutType>(payout?.payoutType ?? "salary");
  const [paymentMethod, setPaymentMethod] = useState<SalaryPaymentMethod>(payout?.paymentMethod ?? "cash");
  const [paymentReference, setPaymentReference] = useState(payout?.paymentReference ?? "");
  const [note, setNote] = useState(payout?.note ?? "");
  const [correctionReason, setCorrectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const command = useRef<ClinicCommand<SalaryPayoutWriteResponse> | null>(null);
  const locked = saving || unknownWrite || conflicted;
  const total = roundMoney(decimalNumber(base) + decimalNumber(bonus));
  const selectedStaff = staff.find((profile) => profile.staffId === staffId);

  const pickStaff = (id: string) => {
    setStaffId(id);
    const profile = staff.find((item) => item.staffId === id);
    setBase(profile?.baseSalaryAmount == null ? "" : String(profile.baseSalaryAmount));
    setValidationError("");
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || conflicted) return;

    if (!unknownWrite) {
      const validMoney = (value: string) => value === "" || /^\d+(?:\.\d{0,2})?$/.test(value);
      if (!validISODate(paidOn) || paidOn > todayISO()) {
        setValidationError("Choose a valid paid date that is today or earlier.");
        return;
      }
      if (!selectedStaff) {
        setValidationError("Choose an active staff member.");
        return;
      }
      if (!monthPattern.test(payPeriod)) {
        setValidationError("Choose a valid salary month.");
        return;
      }
      if (!validMoney(base) || !validMoney(bonus) || total <= 0 || total > 100_000_000) {
        setValidationError("Base and bonus must total a positive NPR amount up to Rs 100,000,000, with at most two decimal places.");
        return;
      }
      if (paymentReference.trim().length > 160 || note.trim().length > 1_000) {
        setValidationError("Payment reference must be 160 characters or less and note must be 1,000 characters or less.");
        return;
      }
      if (editing && !correctionReason.trim()) {
        setValidationError("Enter a reason for the correction.");
        return;
      }
      if (correctionReason.trim().length > 500) {
        setValidationError("The correction reason must be 500 characters or less.");
        return;
      }
    }

    setSaving(true);
    setError("");
    setValidationError("");
    try {
      let activeCommand = command.current;
      if (!activeCommand) {
        const input: SalaryPayoutWriteInput = {
          staffId,
          payPeriod,
          payoutType,
          baseAmount: roundMoney(decimalNumber(base)),
          bonusAmount: roundMoney(decimalNumber(bonus)),
          paidOn,
          paymentMethod,
          paymentReference: paymentReference.trim() || null,
          note: note.trim() || null,
        };
        activeCommand = editing && payout
          ? api.correct(payout.salaryPayoutId, input, correctionReason.trim())
          : api.create(input);
        command.current = activeCommand;
      }

      await activeCommand.execute();
      command.current = null;
      await onWriteAccepted();
      showSuccess(editing ? "Salary payment updated successfully." : "Salary payment recorded successfully.");
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        const message = errorMessage(cause, "The salary save could not be confirmed.");
        setError(message);
        showError(message);
      } else {
        command.current = null;
        setUnknownWrite(false);
        if (cause instanceof ClinicError && cause.code === "CONFLICT") {
          setConflicted(true);
          try { await onRefresh(); } catch { /* Keep the conflict visible if the list also fails. */ }
        }
        const message = errorMessage(cause, editing ? "The salary payout could not be corrected." : "The salary payout could not be recorded.");
        setError(message);
        showError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClinicModal
      title={editing ? "Edit salary payment" : "Record salary"}
      onClose={onClose}
      maxWidth={440}
      closeDisabled={saving || unknownWrite}
    >
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)}>
        <Field label="Date" required>
          <DatePicker value={paidOn} onChange={(value) => { setPaidOn(value); setValidationError(""); }} max={todayISO()} fluid disabled={locked} />
        </Field>
        <Field label="Staff member" required>
          <Select value={staffId} onChange={(event) => pickStaff(event.target.value)} disabled={locked}>
            <option value="">Select staff…</option>
            {payout && !staff.some((profile) => profile.staffId === payout.staffId) ? (
              <option value={payout.staffId} disabled>{payout.staffName} · no longer active</option>
            ) : null}
            {staff.map((profile) => <option key={profile.staffId} value={profile.staffId}>{profile.fullName} · {staffRole(profile)}</option>)}
          </Select>
        </Field>
        <FieldPair>
          <Field label="Base salary (NPR)" required>
            <Input inputMode="decimal" placeholder="0" value={base} onChange={(event) => { setBase(decimalInput(event.target.value, 2)); setValidationError(""); }} style={{ textAlign: "right", fontWeight: "var(--fw-bold)" }} disabled={locked} />
          </Field>
          <Field label="Bonus (NPR)" required>
            <Input inputMode="decimal" placeholder="0" value={bonus} onChange={(event) => { setBonus(decimalInput(event.target.value, 2)); setValidationError(""); }} style={{ textAlign: "right", fontWeight: "var(--fw-bold)" }} disabled={locked} />
          </Field>
        </FieldPair>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "var(--sp-2) var(--sp-3)", background: "#faf7ef", border: "1px solid #ece3d2", borderRadius: "var(--r-md)" }}>
          <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", color: "var(--ink-1)" }}>Total to pay</span>
          <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "var(--ink-1)", fontVariantNumeric: "tabular-nums" }}>{formatNpr(total)}</span>
        </div>
        <FieldPair>
          <Field label="Payout type" required>
            <Select value={payoutType} onChange={(event) => setPayoutType(event.target.value as SalaryPayoutType)} disabled={locked}>
              {payoutTypeOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </Field>
          <Field label="For month" required>
            {locked ? (
              <Input value={bsMonthLabel(payPeriod)} disabled />
            ) : (
              <MonthPicker value={payPeriod} onChange={(value) => { setPayPeriod(value); setValidationError(""); }} max={todayISO().slice(0, 7)} fluid />
            )}
          </Field>
        </FieldPair>
        <Field label="Paid by" required>
          <Select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as SalaryPaymentMethod)} disabled={locked}>
            {Object.entries(paymentMethodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Payment reference (optional)">
          <Input placeholder="Receipt, bank, or transfer reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={160} disabled={locked} />
        </Field>
        <Field label="Note (optional)">
          <Input placeholder="Anything worth recording" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1_000} disabled={locked} />
        </Field>
        {editing ? (
          <Field label="Reason for correction" required>
            <Input placeholder="What was wrong in the original entry?" value={correctionReason} onChange={(event) => { setCorrectionReason(event.target.value); setValidationError(""); }} maxLength={500} disabled={locked} />
          </Field>
        ) : null}
        {error ? <ModalError>{error}</ModalError> : null}
        {validationError ? <ModalError>{validationError}</ModalError> : null}
        <button type="submit" disabled={saving || conflicted} className="btn btn-primary">
          {saving ? "Saving…" : unknownWrite ? "Retry original save" : editing ? "Save correction" : "Record salary"}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}

function VoidSalaryPayoutModal({
  payout,
  api,
  onClose,
  onRefresh,
  onWriteAccepted,
}: {
  payout: ClinicSalaryPayout;
  api: SalaryPaymentsApi;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onWriteAccepted: () => Promise<void>;
}) {
  const { showSuccess, showError } = useClinicSnackbar();
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [error, setError] = useState("");
  const command = useRef<ClinicCommand<SalaryPayoutWriteResponse> | null>(null);
  const locked = saving || unknownWrite || conflicted;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || conflicted) return;
    if (!unknownWrite) {
      if (!reason.trim()) {
        setError("Enter a reason so this void is auditable.");
        return;
      }
      if (reason.trim().length > 500) {
        setError("The void reason must be 500 characters or less.");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const activeCommand = command.current ?? api.voidPayout(payout.salaryPayoutId, reason.trim());
      command.current = activeCommand;
      await activeCommand.execute();
      command.current = null;
      await onWriteAccepted();
      showSuccess("Salary payment removed.");
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        const message = errorMessage(cause, "We could not confirm whether this payout was removed. Keep this dialog open and retry the original request.");
        setError(message);
        showError(message);
      } else {
        command.current = null;
        setUnknownWrite(false);
        if (cause instanceof ClinicError && cause.code === "CONFLICT") {
          setConflicted(true);
          try { await onRefresh(); } catch { /* Keep the conflict visible if the list also fails. */ }
        }
        const message = errorMessage(cause, "Could not void this salary payout. Review the current salary list before trying again.");
        setError(message);
        showError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClinicModal title="Remove salary payment?" onClose={onClose} maxWidth={440} closeDisabled={saving || unknownWrite}>
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)}>
        <p>This removes the payout from active salary records while preserving its audit history.</p>
        <Field label="Reason for removal" required>
          <Input value={reason} onChange={(event) => { setReason(event.target.value); setError(""); }} placeholder="Reason for removal (required)" maxLength={500} autoFocus disabled={locked} />
        </Field>
        {error ? <ModalError>{error}</ModalError> : null}
        <button type="submit" disabled={saving || conflicted} className="btn btn-danger">
          {saving ? "Removing…" : unknownWrite ? "Retry original request" : "Remove salary payment"}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}
