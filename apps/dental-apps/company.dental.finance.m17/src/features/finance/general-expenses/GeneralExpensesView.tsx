import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2, Wallet } from "lucide-react";
import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import { bsMonthToADRange, formatDateShort, todayBSMonth, todayISO } from "@/shared/dates/nepaliDate";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import MonthPicker from "@/shared/dates/MonthPicker";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { ClinicModal } from "@/shared/ui/ClinicModal";
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
import { GeneralExpensesApi } from "./api";
import type {
  ClinicOperatingExpense,
  OperatingExpenseCategory,
  OperatingExpensePaymentMethod,
  OperatingExpenseWriteInput,
  OperatingExpenseWriteResponse,
} from "./types";

const categoryLabels: Record<OperatingExpenseCategory, string> = {
  rent: "Rent",
  utilities: "Utilities",
  marketing: "Marketing",
  maintenance: "Maintenance",
  equipment: "Equipment",
  taxes_fees: "Taxes & fees",
  other: "Other",
};

const paymentMethods: Array<{ value: OperatingExpensePaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "eSewa", label: "eSewa" },
  { value: "Khalti", label: "Khalti" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
];

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return "Your clinic role does not permit this expense action.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    if (cause.code === "VALIDATION") {
      return "The clinic rejected this request. Refresh the expense list and review the record, required fields, and clinic setup before trying again.";
    }
    if (cause.code === "CONFLICT") {
      return "This expense changed. Close this dialog, refresh the list, and review the current record.";
    }
    if (cause.outcome === "unknown") {
      return "We could not confirm whether this expense was recorded. Keep this dialog open and retry the original save to check the same request.";
    }
    return cause.message || fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

function inSelectedMonth(expenseDate: string, month: string): boolean {
  if (month === "all") return true;
  const [year, monthNumber] = month.split("-").map(Number);
  const range = bsMonthToADRange(year, monthNumber);
  return Boolean(range && expenseDate >= range.start && expenseDate <= range.end);
}

export default function GeneralExpensesView({
  expenses,
  loading,
  loadError,
  api,
  client,
  onNavigationLockChange,
  onRefresh,
  onWriteAccepted,
}: {
  expenses: ClinicOperatingExpense[];
  loading: boolean;
  loadError: string | null;
  api: GeneralExpensesApi;
  client: ClinicClient;
  onNavigationLockChange: (locked: boolean) => void;
  onRefresh: () => Promise<void>;
  onWriteAccepted: () => Promise<void>;
}) {
  const [month, setMonth] = useState(todayBSMonth);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClinicOperatingExpense | null>(null);
  const [voiding, setVoiding] = useState<ClinicOperatingExpense | null>(null);
  const modalOpen = adding || Boolean(editing) || Boolean(voiding);
  const listed = useMemo(() => expenses
    .filter((expense) => expense.status === "recorded" && inSelectedMonth(expense.expenseDate, month))
    .slice()
    .sort((a, b) => b.expenseDate.localeCompare(a.expenseDate)), [expenses, month]);

  useEffect(() => {
    client.report({ dirty: modalOpen, modal: modalOpen });
    onNavigationLockChange(modalOpen);
    return () => {
      client.report({ dirty: false, modal: false });
      onNavigationLockChange(false);
    };
  }, [client, modalOpen, onNavigationLockChange]);

  const closeEdit = useCallback(() => setEditing(null), []);

  const columns: Column<ClinicOperatingExpense>[] = [
    {
      key: "sn",
      header: "S.N.",
      align: "center",
      width: 44,
      render: (_expense, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      value: (expense) => expense.expenseDate,
      render: (expense) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateShort(expense.expenseDate)}</span>,
    },
    { key: "category", header: "Category", render: (expense) => categoryLabels[expense.category] },
    { key: "payee", header: "Payee", render: (expense) => expense.payee || "—" },
    { key: "method", header: "Method", render: (expense) => paymentMethods.find((method) => method.value === expense.paymentMethod)?.label ?? expense.paymentMethod },
    { key: "note", header: "Note", render: (expense) => <span style={{ color: "var(--ink-2)" }}>{expense.note || "—"}</span> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (expense) => expense.amount,
      total: true,
      totalFormat: (sum) => <span style={{ fontWeight: "var(--fw-bold)", color: "var(--ink-1)", fontVariantNumeric: "tabular-nums" }}>{formatNpr(sum)}</span>,
      render: (expense) => <span style={{ fontWeight: "var(--fw-bold)", color: "#c0392b", fontVariantNumeric: "tabular-nums" }}>{formatNpr(expense.amount)}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      align: "center",
      width: 90,
      render: (expense) => (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            onClick={() => setEditing(expense)}
            title="Edit record"
            aria-label={`Edit expense from ${formatDateShort(expense.expenseDate)}`}
            style={{ color: "#7c3aed", padding: "4px" }}
          >
            <Pencil size={15} />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost btn-sm"
            onClick={() => setVoiding(expense)}
            title="Delete record"
            aria-label={`Remove expense from ${formatDateShort(expense.expenseDate)}`}
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
        title="General expenses"
        icon={<Wallet size={17} style={{ color: "var(--acc)" }} />}
      >
        <ClinicActionButton onClick={() => setAdding(true)}><Plus size={14} /> Add expense</ClinicActionButton>
      </PageHeader>

      <DataTable<ClinicOperatingExpense>
        rows={listed}
        rowKey={(expense) => expense.operatingExpenseId}
        noun="expenses"
        standardPage
        loading={loading}
        loadingLabel="Loading financial records…"
        error={loadError ? `Couldn't load the list — ${loadError}` : undefined}
        empty={<EmptyState message="Nothing recorded this month." />}
        totalsLabel="Total"
        totalsAlign="left"
        filters={<MonthPicker value={month} onChange={setMonth} allowAll allLabel="All months" max={todayISO().slice(0, 7)} />}
        columns={columns}
      />

      {adding ? (
        <ExpenseFormModal
          api={api}
          onClose={() => setAdding(false)}
          onRefresh={onRefresh}
          onWriteAccepted={onWriteAccepted}
        />
      ) : null}
      {editing ? (
        <ExpenseFormModal
          api={api}
          expense={editing}
          onClose={closeEdit}
          onRefresh={onRefresh}
          onWriteAccepted={onWriteAccepted}
        />
      ) : null}
      {voiding ? (
        <VoidExpenseModal
          expense={voiding}
          api={api}
          onClose={() => setVoiding(null)}
          onRefresh={onRefresh}
          onWriteAccepted={onWriteAccepted}
        />
      ) : null}
    </Page>
  );
}

function ExpenseFormModal({
  api,
  expense,
  onClose,
  onRefresh,
  onWriteAccepted,
}: {
  api: GeneralExpensesApi;
  expense?: ClinicOperatingExpense;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onWriteAccepted: () => Promise<void>;
}) {
  const [date, setDate] = useState(expense?.expenseDate ?? todayISO());
  const [amount, setAmount] = useState(expense ? String(expense.amount) : "");
  const [category, setCategory] = useState<OperatingExpenseCategory | "">(expense?.category ?? "");
  const [payee, setPayee] = useState(expense?.payee ?? "");
  const [method, setMethod] = useState<OperatingExpensePaymentMethod>(expense?.paymentMethod ?? "cash");
  const [paymentReference, setPaymentReference] = useState(expense?.paymentReference ?? "");
  const [note, setNote] = useState(expense?.note ?? "");
  const [correctionReason, setCorrectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [error, setError] = useState("");
  const [validationError, setValidationError] = useState("");
  const command = useRef<ClinicCommand<OperatingExpenseWriteResponse> | null>(null);
  const locked = saving || unknownWrite || conflicted;
  const editing = Boolean(expense);
  const amountValue = roundMoney(decimalNumber(amount));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || conflicted) return;
    if (!unknownWrite) {
      if (!date || date > todayISO()) {
        setValidationError("Choose a valid date that is today or earlier.");
        return;
      }
      if (!category) {
        setValidationError("Choose an expense category.");
        return;
      }
      if (!/^\d+(?:\.\d{0,2})?$/.test(amount) || amountValue <= 0 || amountValue > 100_000_000) {
        setValidationError("Enter a positive NPR amount up to Rs 100,000,000 with at most two decimal places.");
        return;
      }
      if (payee.trim().length > 160 || paymentReference.trim().length > 160 || note.trim().length > 1_000) {
        setValidationError("Payee and payment reference must be 160 characters or less; note must be 1,000 characters or less.");
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
        const input: OperatingExpenseWriteInput = {
          expenseDate: date,
          category: category as OperatingExpenseCategory,
          amount: amountValue,
          payee: payee.trim() || null,
          paymentMethod: method,
          paymentReference: paymentReference.trim() || null,
          note: note.trim() || null,
        };
        activeCommand = editing && expense
          ? api.correct(expense.operatingExpenseId, input, correctionReason.trim())
          : api.create(input);
        command.current = activeCommand;
      }

      await activeCommand.execute();
      command.current = null;
      await onWriteAccepted();
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        setError(errorMessage(cause, "The expense save could not be confirmed."));
      } else {
        command.current = null;
        setUnknownWrite(false);
        if (cause instanceof ClinicError && cause.code === "CONFLICT") {
          setConflicted(true);
          try { await onRefresh(); } catch { /* Keep the original conflict visible if refresh also fails. */ }
        }
        setError(errorMessage(cause, editing ? "The expense could not be corrected." : "The expense could not be recorded."));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClinicModal
      title={editing ? "Edit expense" : "Add expense"}
      onClose={onClose}
      maxWidth={440}
      closeDisabled={saving || unknownWrite}
    >
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)}>
        <FieldPair>
          <Field label="Date" required>
            <DatePicker value={date} onChange={setDate} max={todayISO()} fluid disabled={locked} />
          </Field>
          <Field label="Amount (NPR)" required error={validationError.includes("amount") ? validationError : undefined}>
            <Input
              inputMode="decimal"
              placeholder="0"
              value={amount}
              onChange={(event) => { setAmount(decimalInput(event.target.value, 2)); setValidationError(""); }}
              style={{ textAlign: "right", fontWeight: "var(--fw-bold)" }}
              disabled={locked}
            />
          </Field>
        </FieldPair>
        <Field label="Category" required error={validationError.includes("category") ? validationError : undefined}>
          <Select value={category} onChange={(event) => { setCategory(event.target.value as OperatingExpenseCategory | ""); setValidationError(""); }} disabled={locked}>
            <option value="">Select category…</option>
            {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </Field>
        <Field label="Payee (optional)">
          <Input placeholder="Who was paid" value={payee} onChange={(event) => setPayee(event.target.value)} maxLength={160} disabled={locked} />
        </Field>
        <Field label="Paid by" required>
          <Select value={method} onChange={(event) => setMethod(event.target.value as OperatingExpensePaymentMethod)} disabled={locked}>
            {paymentMethods.map((paymentMethod) => <option key={paymentMethod.value} value={paymentMethod.value}>{paymentMethod.label}</option>)}
          </Select>
        </Field>
        <Field label="Payment reference (optional)">
          <Input placeholder="Receipt, wallet, cheque, or bank reference" value={paymentReference} onChange={(event) => setPaymentReference(event.target.value)} maxLength={160} disabled={locked} />
        </Field>
        <Field label="Note (optional)">
          <Input placeholder="Anything worth recording" value={note} onChange={(event) => setNote(event.target.value)} maxLength={1_000} disabled={locked} />
        </Field>
        {editing ? (
          <Field label="Reason for correction" required error={validationError.includes("reason") ? validationError : undefined}>
            <Input
              placeholder="What was wrong in the original entry?"
              value={correctionReason}
              onChange={(event) => { setCorrectionReason(event.target.value); setValidationError(""); }}
              maxLength={500}
              disabled={locked}
            />
          </Field>
        ) : null}
        {error ? <ModalError>{error}</ModalError> : null}
        {validationError && !validationError.includes("amount") && !validationError.includes("category") && !validationError.includes("reason")
          ? <ModalError>{validationError}</ModalError>
          : null}
        <button type="submit" disabled={saving || conflicted} className="btn btn-primary">
          {saving ? "Saving…" : unknownWrite ? "Retry original save" : editing ? "Save correction" : "Add expense"}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}

function VoidExpenseModal({
  expense,
  api,
  onClose,
  onRefresh,
  onWriteAccepted,
}: {
  expense: ClinicOperatingExpense;
  api: GeneralExpensesApi;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onWriteAccepted: () => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [error, setError] = useState("");
  const command = useRef<ClinicCommand<OperatingExpenseWriteResponse> | null>(null);
  const locked = saving || unknownWrite || conflicted;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || conflicted) return;
    if (!unknownWrite) {
      if (!reason.trim()) {
        setError("Enter a reason so this correction is auditable.");
        return;
      }
      if (reason.trim().length > 500) {
        setError("The removal reason must be 500 characters or less.");
        return;
      }
    }

    setSaving(true);
    setError("");
    try {
      const activeCommand = command.current ?? api.voidExpense(expense.operatingExpenseId, reason.trim());
      command.current = activeCommand;
      await activeCommand.execute();
      command.current = null;
      await onWriteAccepted();
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        setError(errorMessage(cause, "We could not confirm whether this record was removed. Keep this dialog open and retry the original request."));
      } else {
        command.current = null;
        setUnknownWrite(false);
        if (cause instanceof ClinicError && cause.code === "CONFLICT") {
          setConflicted(true);
          try { await onRefresh(); } catch { /* Keep the original conflict visible if refresh also fails. */ }
        }
        setError(errorMessage(cause, "Could not remove this record. Review the current expense list before trying again."));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClinicModal
      title="Remove financial record?"
      onClose={onClose}
      maxWidth={440}
      closeDisabled={saving || unknownWrite}
    >
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)}>
        <p>This removes the row from active totals but preserves a traceable void record.</p>
        <Field label="Reason for removal" required>
          <Input
            value={reason}
            onChange={(event) => { setReason(event.target.value); setError(""); }}
            placeholder="Reason for removal (required)"
            maxLength={500}
            autoFocus
            disabled={locked}
          />
        </Field>
        {error ? <ModalError>{error}</ModalError> : null}
        <button type="submit" disabled={saving || conflicted} className="btn btn-danger">
          {saving ? "Removing…" : unknownWrite ? "Retry original request" : "Remove record"}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}
