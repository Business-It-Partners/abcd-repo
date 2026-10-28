import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Wallet } from "lucide-react";
import { ClinicError, type ClinicCommand } from "@/sdk/client";
import { bsMonthLabel, bsMonthToADRange, formatDateShort, todayISO } from "@/shared/dates/nepaliDate";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import MonthPicker from "@/shared/dates/MonthPicker";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { useClinicSnackbar } from "@/shared/ui/ClinicSnackbar";
import {
  DataTable,
  EmptyState,
  Field,
  FieldPair,
  Input,
  Modal,
  ModalBody,
  ModalError,
  Page,
  PageHeader,
  Select,
  StackCell,
  Tabs,
  type Column,
} from "@/shared/ui/workspace-primitives";
import { decimalInput, decimalNumber, roundMoney } from "./money";
import { PatientPaymentsApi } from "./api";
import type {
  PatientLedger,
  PatientLedgerEntry,
  PatientPaymentInput,
  PatientPaymentMethod,
  PatientPaymentResponse,
  PatientPaymentsReport,
} from "./types";
import { formatNpr } from "@/features/finance/internal/lib/domain";

type PatientRow = PatientPaymentsReport["outstanding"][number];
type ReceivedRow = PatientPaymentsReport["received"][number];
type PaymentView = "received" | "outstanding";

const methodLabels: Record<PatientPaymentMethod, string> = {
  cash: "Cash",
  esewa: "eSewa",
  khalti: "Khalti",
  card: "Card",
  bank_transfer: "Bank transfer",
  cheque: "Cheque",
};

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") {
      return "Your clinic role does not permit this patient payment action.";
    }
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") {
      return "The clinic session changed. Reopen Finance from Dental OS.";
    }
    return cause.message || fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

function initials(name: string): string {
  return name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "P";
}

export default function PatientPaymentsView({
  report,
  month,
  onMonthChange,
  loading,
  loadError,
  capabilities,
  api,
  onReportReload,
}: {
  report: PatientPaymentsReport | null;
  month: string;
  onMonthChange: (value: string) => void;
  loading: boolean;
  loadError: string | null;
  capabilities: readonly string[];
  api: PatientPaymentsApi;
  onReportReload: () => Promise<void>;
}) {
  const { showSuccess, showError } = useClinicSnackbar();
  const canReadReceived = capabilities.includes("patient_payments.received.read");
  const canReadLedger = capabilities.includes("patient_billing_ledger.read");
  const canCollect = capabilities.includes("patient_payments.collect") && canReadLedger;
  const [view, setView] = useState<PaymentView>(() => canReadReceived ? "received" : "outstanding");
  const [selectedPatient, setSelectedPatient] = useState<PatientRow | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [ledger, setLedger] = useState<PatientLedger | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerLoadingMore, setLedgerLoadingMore] = useState(false);
  const [dialogError, setDialogError] = useState("");
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [paymentDate, setPaymentDate] = useState(todayISO);
  const [amount, setAmount] = useState("");
  const [discount, setDiscount] = useState("0");
  const [method, setMethod] = useState<PatientPaymentMethod>("cash");
  const paymentCommand = useRef<ClinicCommand<PatientPaymentResponse> | null>(null);
  const ledgerSequence = useRef(0);

  useEffect(() => {
    if (!canReadReceived && view !== "outstanding") setView("outstanding");
  }, [canReadReceived, view]);

  const outstanding = report?.outstanding ?? [];
  const received = useMemo(() => {
    const rows = report?.received ?? [];
    if (month === "all") return rows;
    const [year, monthNumber] = month.split("-").map(Number);
    const range = bsMonthToADRange(year, monthNumber);
    return range ? rows.filter((row) => row.paymentDate >= range.start && row.paymentDate <= range.end) : [];
  }, [month, report]);

  const closeDialog = useCallback(() => {
    if (saving || unknownWrite) return;
    ledgerSequence.current += 1;
    setSelectedPatient(null);
    setLedger(null);
    setCollecting(false);
    setLedgerLoading(false);
    setLedgerLoadingMore(false);
    setDialogError("");
    paymentCommand.current = null;
  }, [saving, unknownWrite]);

  const openPatient = useCallback(async (patient: PatientRow, collect: boolean) => {
    const sequence = ++ledgerSequence.current;
    setSelectedPatient(patient);
    setCollecting(collect);
    setLedger(null);
    setLedgerLoading(true);
    setLedgerLoadingMore(false);
    setDialogError("");
    setPaymentDate(todayISO());
    setAmount("");
    setDiscount("0");
    setMethod("cash");
    setUnknownWrite(false);
    paymentCommand.current = null;
    try {
      if (!canReadLedger) throw new ClinicError("FORBIDDEN", "Your clinic role cannot read this patient ledger.");
      const nextLedger = await api.ledger(patient.patientId);
      if (sequence === ledgerSequence.current) setLedger(nextLedger);
    } catch (cause) {
      if (sequence === ledgerSequence.current) {
        setDialogError(errorMessage(cause, "The patient ledger could not be loaded."));
      }
    } finally {
      if (sequence === ledgerSequence.current) setLedgerLoading(false);
    }
  }, [api, canReadLedger]);

  const loadMoreLedger = useCallback(async () => {
    if (!selectedPatient || !ledger?.nextCursor || ledgerLoadingMore) return;
    const sequence = ledgerSequence.current;
    const patientId = selectedPatient.patientId;
    setLedgerLoadingMore(true);
    setDialogError("");
    try {
      const next = await api.ledger(patientId, ledger.nextCursor);
      if (sequence === ledgerSequence.current) {
        setLedger((current) => current
          ? { ...current, entries: [...current.entries, ...next.entries], nextCursor: next.nextCursor }
          : next);
      }
    } catch (cause) {
      if (sequence === ledgerSequence.current) setDialogError(errorMessage(cause, "Older ledger entries could not be loaded."));
    } finally {
      if (sequence === ledgerSequence.current) setLedgerLoadingMore(false);
    }
  }, [api, ledger?.nextCursor, ledgerLoadingMore, selectedPatient]);

  const refreshCurrentBalance = useCallback(async () => {
    if (!selectedPatient) return;
    setLedgerLoading(true);
    setLedger(null);
    try {
      const nextLedger = await api.ledger(selectedPatient.patientId);
      setLedger(nextLedger);
      setDialogError("The current balance changed. The latest balance is loaded; review the amounts before recording again.");
    } catch (cause) {
      setDialogError(errorMessage(cause, "The current balance could not be refreshed. Do not retry until the ledger has loaded."));
    } finally {
      setLedgerLoading(false);
    }
  }, [api, selectedPatient]);

  const beginCollection = () => {
    setCollecting(true);
    setPaymentDate(todayISO());
    setAmount("");
    setDiscount("0");
    setMethod("cash");
    setDialogError("");
  };

  const updateAmount = (value: string) => {
    if (unknownWrite) return;
    setAmount(decimalInput(value, 2));
    setDialogError("");
  };

  const updateDiscount = (value: string) => {
    if (unknownWrite) return;
    setDiscount(decimalInput(value, 2));
    setDialogError("");
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPatient || !ledger || saving || ledgerLoading) return;

    let command = paymentCommand.current;
    if (!command) {
      const paymentAmount = roundMoney(decimalNumber(amount));
      const discountAmount = roundMoney(decimalNumber(discount));
      const due = ledger.summary.outstandingDue;
      const validDecimal = (value: string) => value === "" || /^\d+(?:\.\d{0,2})?$/.test(value);
      if (!validDecimal(amount) || !validDecimal(discount)) {
        setDialogError("Payment and discount must be non-negative NPR amounts with at most two decimal places.");
        return;
      }
      if (paymentAmount < 0 || discountAmount < 0 || paymentAmount > 100_000_000 || discountAmount > 100_000_000) {
        setDialogError("Payment and discount amounts must be non-negative NPR amounts within the clinic limit.");
        return;
      }
      if (paymentAmount + discountAmount <= 0) {
        setDialogError("Enter a payment or discount amount.");
        return;
      }
      if (paymentAmount + discountAmount > due) {
        setDialogError("Payment and discount cannot exceed the current due of " + formatNpr(due) + ".");
        return;
      }
      if (paymentDate > todayISO()) {
        setDialogError("Payment date cannot be in the future.");
        return;
      }
      const input: PatientPaymentInput = {
        patientId: selectedPatient.patientId,
        paymentDate,
        amount: paymentAmount,
        discountAmount,
        paymentMethod: method,
      };
      command = api.createPayment(input);
      paymentCommand.current = command;
    }

    setSaving(true);
    setDialogError("");
    try {
      await command.execute();
      paymentCommand.current = null;
      setUnknownWrite(false);
      setSelectedPatient(null);
      setLedger(null);
      setCollecting(false);
      try {
        await onReportReload();
        showSuccess("Patient payment recorded successfully.");
      } catch {
        showError("Patient payment recorded, but the Finance report could not be refreshed.");
      }
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        const message = "We could not confirm whether this payment was recorded. Keep this window open and retry the original save to check the same request.";
        setDialogError(message);
        showError(message);
      } else {
        paymentCommand.current = null;
        setUnknownWrite(false);
        const message = errorMessage(cause, "The payment could not be recorded.");
        setDialogError(message);
        showError(message);
        if (cause instanceof ClinicError && cause.code === "CONFLICT") {
          await refreshCurrentBalance();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const tabs = canReadReceived
    ? [{ key: "received", label: "Received" }, { key: "outstanding", label: "Outstanding" }]
    : [{ key: "outstanding", label: "Outstanding" }];
  const tabBar = <Tabs tabs={tabs} active={view} onChange={(key) => setView(key as PaymentView)} />;
  const listFilters = <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
    <MonthPicker value={month} onChange={onMonthChange} allowAll max={todayISO().slice(0, 7)} />
    {tabBar}
  </div>;
  const dueForDisplay = ledger?.summary.outstandingDue ?? selectedPatient?.currentDueAmount;
  const amountValue = decimalNumber(amount);
  const discountValue = decimalNumber(discount);
  const resultingDue = ledger
    ? Math.max(0, ledger.summary.outstandingDue - amountValue - discountValue)
    : null;

  const outstandingColumns: Column<PatientRow>[] = [
    {
      key: "sn",
      header: "S.N.",
      align: "center",
      width: 44,
      render: (_patient, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span>,
    },
    {
      key: "patient",
      header: "Patient",
      sortable: true,
      value: (patient) => patient.patientName,
      render: (patient) => <StackCell avatar={initials(patient.patientName)} primary={patient.patientName} secondary={patient.patientNumber} />,
    },
    { key: "planTitle", header: "Treatment", render: (patient) => patient.planTitle },
    {
      key: "balance",
      header: "Outstanding",
      align: "right",
      sortable: true,
      value: (patient) => patient.currentDueAmount,
      render: (patient) => <span style={{ fontWeight: "var(--fw-bold)", color: "var(--ink-1)", fontVariantNumeric: "tabular-nums" }}>{formatNpr(patient.currentDueAmount)}</span>,
    },
    {
      key: "action",
      header: "Action",
      align: "right",
      nowrap: true,
      render: (patient) => (
        <div className="patientPaymentActions">
          {canReadLedger ? <button className="btn btn-secondary btn-sm" type="button" onClick={() => void openPatient(patient, false)}>View</button> : null}
          {canCollect ? <ClinicActionButton size="compact" onClick={() => void openPatient(patient, true)}>Collect payment</ClinicActionButton> : null}
        </div>
      ),
    },
  ];

  const receivedColumns: Column<ReceivedRow>[] = [
    {
      key: "sn",
      header: "S.N.",
      align: "center",
      width: 44,
      render: (_entry, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span>,
    },
    {
      key: "date",
      header: "Date",
      sortable: true,
      value: (entry) => entry.paymentDate,
      render: (entry) => <span style={{ fontVariantNumeric: "tabular-nums" }}>{formatDateShort(entry.paymentDate)}</span>,
    },
    { key: "patientName", header: "Patient", sortable: true, render: (entry) => entry.patientName },
    { key: "method", header: "Method", render: (entry) => methodLabels[entry.paymentMethod] ?? entry.paymentMethod },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      value: (entry) => entry.amount,
      render: (entry) => <span className="patientPaymentReceivedAmount">{formatNpr(entry.amount)}</span>,
    },
  ];

  const patientDialog = selectedPatient ? (
    <Modal
      title={collecting ? "Collect payment — " + selectedPatient.patientName : "Payment details — " + selectedPatient.patientName}
      onClose={closeDialog}
      maxWidth={collecting ? 600 : 920}
    >
      {collecting ? (
        <ModalBody as="form" noValidate onSubmit={(event) => void submitPayment(event)}>
          <PatientPaymentIdentity name={selectedPatient.patientName} patientNumber={selectedPatient.patientNumber} />
          <div className="patientPaymentSummaryGrid">
            <PaymentSummary label="Total charges" value={ledger?.summary.totalBilled} tone="billed" />
            <PaymentSummary label="Total paid" value={ledger?.summary.totalCollected} tone="paid" />
            <PaymentSummary
              label={ledger ? "Due" : "Reported due"}
              value={dueForDisplay}
              tone="due"
            />
          </div>
          {ledgerLoading ? <p className="patientPaymentBalanceHint" role="status">Loading current balance…</p> : null}
          {!ledger && !ledgerLoading ? <p className="patientPaymentBalanceHint">The current ledger balance is unavailable. Reload it before recording a payment.</p> : null}
          <FieldPair>
            <Field label="Payment date" required>
              <DatePicker value={paymentDate} onChange={(value) => { setPaymentDate(value); setDialogError(""); }} max={todayISO()} fluid disabled={unknownWrite} />
            </Field>
            <Field label="Payment method" required>
              <Select value={method} disabled={unknownWrite} onChange={(event) => { setMethod(event.target.value as PatientPaymentMethod); setDialogError(""); }}>
                {Object.entries(methodLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
            </Field>
          </FieldPair>
          <FieldPair>
            <Field label="Amount paid (NPR)" required>
              <Input inputMode="decimal" min={0} max={100_000_000} step={0.01} value={amount} disabled={unknownWrite} onChange={(event) => updateAmount(event.target.value)} />
            </Field>
            <Field label="Discount (NPR)">
              <Input inputMode="decimal" min={0} max={100_000_000} step={0.01} value={discount} disabled={unknownWrite} onChange={(event) => updateDiscount(event.target.value)} />
            </Field>
          </FieldPair>
          <PaymentSummary label="Resulting due" value={resultingDue ?? undefined} tone="result" />
          {dialogError ? <ModalError>{dialogError}</ModalError> : null}
          <div className="dialogActions">
            <button className="btn btn-secondary" type="button" disabled={saving || unknownWrite} onClick={closeDialog}>Cancel</button>
            <ClinicActionButton type="submit" disabled={saving || ledgerLoading || !ledger}>
              {saving ? "Recording…" : unknownWrite ? "Retry original save" : "Record payment"}
            </ClinicActionButton>
          </div>
        </ModalBody>
      ) : (
        <ModalBody>
          <PatientPaymentIdentity name={selectedPatient.patientName} patientNumber={selectedPatient.patientNumber} />
          <div className="patientPaymentSummaryGrid">
            <PaymentSummary label="Total charges" value={ledger?.summary.totalBilled} tone="billed" />
            <PaymentSummary label="Total paid" value={ledger?.summary.totalCollected} tone="paid" />
            <PaymentSummary label={ledger ? "Due" : "Reported due"} value={dueForDisplay} tone="due" />
          </div>
          {ledgerLoading ? <p className="patientPaymentBalanceHint" role="status">Loading current balance…</p> : null}
          {dialogError && ledger ? <ModalError>{dialogError}</ModalError> : null}
          <div className="patientPaymentSectionHeader">
            <div>
              <strong>Account activity</strong>
              <span>Charges increase the balance. Payments and discounts reduce it.</span>
            </div>
          </div>
          <DataTable<PatientLedgerEntry>
            rows={ledger?.entries ?? []}
            rowKey={(entry) => entry.patientLedgerEntryId}
            rowStyle={(entry) => entry.entryType === "charge"
              ? { background: "#fffbeb" }
              : entry.entryType === "payment"
                ? { background: "#f0fdf4" }
                : undefined}
            noun="ledger entries"
            loading={ledgerLoading}
            error={ledgerLoading || ledger ? null : dialogError || null}
            minWidth={760}
            empty={<EmptyState message="No charge or payment entries have been recorded yet." />}
            columns={[
              { key: "date", header: "Date", sortable: true, value: (entry) => entry.entryDate, render: (entry) => formatDateShort(entry.entryDate) },
              { key: "type", header: "Type", render: (entry) => <LedgerTypeBadge type={entry.entryType} /> },
              { key: "for", header: "For", render: (entry) => entry.forLabel || entry.note || "—" },
              { key: "method", header: "Method", render: (entry) => entry.paymentMethod ? methodLabels[entry.paymentMethod] : "—" },
              { key: "receipt", header: "Receipt", render: (entry) => entry.receiptNumber || "—" },
              { key: "charge", header: "Charge (+)", align: "right", render: (entry) => entry.entryType === "charge" ? <LedgerAmount tone="charge" prefix="+" value={entry.amount} /> : "—" },
              { key: "paid", header: "Payment (−)", align: "right", render: (entry) => entry.entryType === "payment" ? <LedgerAmount tone="paid" prefix="−" value={entry.amount} /> : "—" },
              { key: "discount", header: "Discount (−)", align: "right", render: (entry) => entry.discountAmount ? <LedgerAmount tone="discount" prefix="−" value={entry.discountAmount} /> : "—" },
              { key: "balance", header: "Balance", align: "right", render: (entry) => <span className="patientLedgerBalance">{formatNpr(entry.runningBalance)}</span> },
            ]}
          />
          {ledger?.nextCursor ? (
            <div className="patientPaymentLoadOlder">
              <button className="btn btn-secondary" type="button" disabled={ledgerLoadingMore} onClick={() => void loadMoreLedger()}>
                {ledgerLoadingMore ? "Loading…" : "Load older entries"}
              </button>
            </div>
          ) : null}
          <div className="dialogActions">
            <button className="btn btn-secondary" type="button" onClick={closeDialog}>Close</button>
            {canCollect ? <ClinicActionButton disabled={!ledger || ledgerLoading} onClick={beginCollection}>Collect payment</ClinicActionButton> : null}
          </div>
        </ModalBody>
      )}
    </Modal>
  ) : null;

  return (
    <Page sheet standardPage>
      <PageHeader
        title="Patient payments"
        icon={<Wallet size={17} style={{ color: "var(--acc)" }} />}
      />

      {view === "outstanding" ? (
        <>
          <DataTable<PatientRow>
            rows={outstanding}
            rowKey={(patient) => patient.patientId}
            noun="patients"
            standardPage
            filters={listFilters}
            loading={loading}
            error={loadError}
            empty={<EmptyState message="All balances cleared — nothing outstanding." />}
            columns={outstandingColumns}
          />
          {patientDialog}
        </>
      ) : (
        <>
          <DataTable<ReceivedRow>
            rows={received}
            rowKey={(entry) => entry.patientLedgerEntryId}
            noun="payments"
            standardPage
            filters={listFilters}
            loading={loading}
            error={loadError}
            empty={<EmptyState message={"No payments received in " + bsMonthLabel(month, "All months") + "."} />}
            columns={receivedColumns}
          />
          {patientDialog}
        </>
      )}
    </Page>
  );
}

function PatientPaymentIdentity({ name, patientNumber }: { name: string; patientNumber: string }) {
  return (
    <div className="patientPaymentIdentity">
      <span className="patientPaymentAvatar" aria-hidden="true">{initials(name)}</span>
      <div>
        <strong>{name}</strong>
        <span>{patientNumber}</span>
      </div>
    </div>
  );
}

type PaymentSummaryTone = "billed" | "paid" | "due" | "result";

function PaymentSummary({ label, value, tone = "billed" }: { label: string; value: number | undefined; tone?: PaymentSummaryTone }) {
  return (
    <div className={"patientPaymentSummary patientPaymentSummary--" + tone}>
      <span>{label}</span>
      <strong>{value === undefined ? "—" : formatNpr(value)}</strong>
    </div>
  );
}

function LedgerTypeBadge({ type }: { type: PatientLedgerEntry["entryType"] }) {
  return <span className={"patientLedgerType patientLedgerType--" + type}>{type}</span>;
}

function LedgerAmount({ tone, prefix, value }: { tone: "charge" | "paid" | "discount"; prefix: string; value: number }) {
  return <span className={"patientLedgerAmount patientLedgerAmount--" + tone}>{prefix}{formatNpr(value)}</span>;
}
