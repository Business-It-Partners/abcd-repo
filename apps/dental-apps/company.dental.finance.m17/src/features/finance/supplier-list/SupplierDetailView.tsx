import { useEffect, useMemo, useState } from "react";
import { Plus, Receipt, Truck } from "lucide-react";
import { ClinicClient } from "@/sdk/client";
import MonthPicker from "@/shared/dates/MonthPicker";
import { bsMonthToADRange, formatDateShort, todayISO, isInBSMonth } from "@/shared/dates/nepaliDate";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { DataTable, EmptyState, ModalBody, Page, PageHeader, RowActions, StatTile, Tabs, TileGrid, type Column } from "@/shared/ui/workspace-primitives";
import { formatNpr } from "@/features/finance/internal/lib/domain";
import SupplierPaymentModal from "./SupplierPaymentModal";
import type { SupplierListApi } from "./api";
import type { ClinicPurchase, ClinicSupplier, ClinicSupplierPayment, ClinicSupplierStatement, SupplierStatementEntry } from "./types";

const DETAIL_TABS = [
  { key: "statement", label: "Account Statement", icon: <Receipt size={14} /> },
  { key: "purchases", label: "Purchases", icon: <Truck size={14} /> },
];

const NEUTRAL_TONE = { tone: "#8b8b9a", toneBg: "#f1f0f5", toneNum: "var(--ink-1)" };
const PAID_TONE = { tone: "var(--ok)", toneBg: "#eaf7f0", toneNum: "var(--ok)" };
const DUE_TONE = { tone: "var(--warn)", toneBg: "#fbf0da", toneNum: "var(--warn)" };

function entryId(key: string, kind: "purchase" | "payment"): string | null {
  const prefix = `${kind}:`;
  return key.startsWith(prefix) ? key.slice(prefix.length) : null;
}

export default function SupplierDetailView({
  api,
  client,
  supplier,
  purchases,
  purchasesLoading,
  purchasesError,
  payments,
  paymentsLoading,
  paymentsError,
  statement,
  statementLoading,
  statementError,
  onNavigationLockChange,
  onRecordPayment,
}: {
  api: SupplierListApi;
  client: ClinicClient;
  supplier: ClinicSupplier;
  purchases: ClinicPurchase[];
  purchasesLoading: boolean;
  purchasesError: string | null;
  payments: ClinicSupplierPayment[];
  paymentsLoading: boolean;
  paymentsError: string | null;
  statement: ClinicSupplierStatement | null;
  statementLoading: boolean;
  statementError: string | null;
  onNavigationLockChange: (locked: boolean) => void;
  onRecordPayment: (payment: ClinicSupplierPayment) => Promise<void>;
}) {
  const [tab, setTab] = useState("statement");
  const [recording, setRecording] = useState(false);
  const [viewingPurchase, setViewingPurchase] = useState<ClinicPurchase | null>(null);
  const [viewingPayment, setViewingPayment] = useState<ClinicSupplierPayment | null>(null);
  const [month, setMonth] = useState("all");
  const [paymentNotice, setPaymentNotice] = useState("");
  const modalOpen = recording || Boolean(viewingPurchase) || Boolean(viewingPayment);

  useEffect(() => {
    client.report({ dirty: modalOpen, modal: modalOpen });
    onNavigationLockChange(modalOpen);
    return () => {
      client.report({ dirty: false, modal: false });
      onNavigationLockChange(false);
    };
  }, [client, modalOpen, onNavigationLockChange]);

  const supplierPurchases = useMemo(() => purchases.filter((purchase) => purchase.supplierId === supplier.supplierId), [purchases, supplier.supplierId]);
  const shownStatement = useMemo(() => {
    if (!statement) return [];
    if (month === "all") return [...statement.entries].reverse();
    const [year, monthNumber] = month.split("-").map(Number);
    const range = bsMonthToADRange(year, monthNumber);
    if (!range) return [];
    const inMonth = statement.entries.filter((entry) => entry.date >= range.start && entry.date <= range.end);
    if (inMonth.length === 0) return [];
    const before = statement.entries.filter((entry) => entry.date < range.start);
    const broughtForward = before.length ? before[before.length - 1].balance : 0;
    const rows: SupplierStatementEntry[] = [
      { key: "brought-forward", kind: "opening", date: range.start, description: "Balance brought forward", paid: null, due: null, balance: broughtForward },
      ...inMonth,
    ];
    return rows.reverse();
  }, [month, statement]);

  const shownPurchases = useMemo(() => {
    const rows = month === "all" ? supplierPurchases : supplierPurchases.filter((purchase) => isInBSMonth(purchase.purchaseDate, month));
    return [...rows].sort((a, b) => b.purchaseDate.localeCompare(a.purchaseDate));
  }, [month, supplierPurchases]);

  const selectedOpening = statement?.supplier.openingBalanceAmount ?? supplier.openingBalanceAmount;
  const statementValue = (value: number | undefined) => statementLoading ? "Loading…" : statementError || value === undefined ? "Unavailable" : formatNpr(value);
  const purchaseColumns: Column<ClinicPurchase>[] = [
    { key: "sn", header: "S.N.", align: "center", width: 44, render: (_purchase, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span> },
    { key: "date", header: "Date", sortable: true, nowrap: true, value: (purchase) => purchase.purchaseDate, render: (purchase) => formatDateShort(purchase.purchaseDate) },
    { key: "invoice", header: "Invoice #", sortable: true, nowrap: true, value: (purchase) => purchase.invoiceNumber ?? "", render: (purchase) => purchase.invoiceNumber || "—" },
    { key: "totalAmount", header: "Total", align: "right", sortable: true, total: true, value: (purchase) => purchase.totalAmount, totalFormat: (sum) => <strong>{formatNpr(sum)}</strong>, render: (purchase) => formatNpr(purchase.totalAmount) },
    { key: "action", header: "Action", align: "center", width: 80, render: (purchase) => <RowActions><ClinicActionButton size="compact" onClick={() => setViewingPurchase(purchase)} title="View purchase details"><Receipt size={13} /> Detail</ClinicActionButton></RowActions> },
  ];

  const statementColumns: Column<SupplierStatementEntry>[] = [
    { key: "date", header: "Date", nowrap: true, value: (entry) => entry.date, render: (entry) => formatDateShort(entry.date) },
    { key: "description", header: "Description", render: (entry) => entry.kind === "opening" ? <strong>{entry.description}</strong> : entry.description },
    { key: "paid", header: "Paid", align: "right", value: (entry) => entry.paid ?? undefined, render: (entry) => entry.paid == null ? "—" : <span style={{ color: "var(--ok)" }}>{formatNpr(entry.paid)}</span> },
    { key: "due", header: "Due", align: "right", value: (entry) => entry.due ?? undefined, render: (entry) => entry.due == null ? "—" : <span style={{ color: "var(--warn)" }}>{formatNpr(entry.due)}</span> },
    { key: "balance", header: "Balance", align: "right", value: (entry) => entry.balance, render: (entry) => <strong>{formatNpr(entry.balance)}</strong> },
    {
      key: "action", header: "Action", align: "center", width: 80,
      render: (entry) => {
        if (entry.kind === "purchase") {
          const purchase = supplierPurchases.find((row) => row.purchaseId === entryId(entry.key, "purchase"));
          return <RowActions><ClinicActionButton size="compact" disabled={!purchase || purchasesLoading} onClick={() => purchase && setViewingPurchase(purchase)} title="View purchase details"><Receipt size={13} /> Detail</ClinicActionButton></RowActions>;
        }
        if (entry.kind === "payment") {
          const payment = payments.find((row) => row.supplierPaymentId === entryId(entry.key, "payment"));
          return <RowActions><ClinicActionButton size="compact" disabled={!payment || paymentsLoading} onClick={() => payment && setViewingPayment(payment)} title="View payment details"><Receipt size={13} /> Detail</ClinicActionButton></RowActions>;
        }
        return null;
      },
    },
  ];
  const listFilters = <div style={{ display: "flex", alignItems: "center", gap: "var(--sp-3)", flexWrap: "wrap" }}>
    <Tabs tabs={DETAIL_TABS} active={tab} onChange={setTab} />
    <MonthPicker value={month} onChange={setMonth} allowAll allLabel="All months" max={todayISO().slice(0, 7)} />
  </div>;

  return (
    <Page sheet standardPage>
      <PageHeader title={supplier.name} icon={<Truck size={17} style={{ color: "var(--acc)" }} />}>
        <ClinicActionButton onClick={() => { setPaymentNotice(""); setRecording(true); }}><Plus size={14} /> Record payment</ClinicActionButton>
      </PageHeader>
      {paymentNotice ? <p className="finance-supplier-success" role="status">{paymentNotice}</p> : null}

      <TileGrid>
        <StatTile value={formatNpr(selectedOpening)} label="Opening balance" tone={NEUTRAL_TONE} />
        <StatTile value={statementValue(statement?.totalPurchasedAmount)} label="Total purchased" tone={NEUTRAL_TONE} />
        <StatTile value={statementValue(statement?.totalPaidAmount)} label="Total paid" tone={PAID_TONE} />
        <StatTile value={statementValue(statement?.currentDueAmount)} label="Balance due" tone={DUE_TONE} />
      </TileGrid>

      {statementError ? <div className="finance-supplier-statement-error" role="alert">
        <strong>Couldn't load the supplier statement — {statementError}</strong>
        <span>Authoritative balance and statement values are hidden until the clinic statement is available.</span>
      </div> : null}

      {(tab === "statement" && (purchasesError || paymentsError)) ? <p className="finance-supplier-supporting-error" role="alert">
        {purchasesError ? `Purchase details are unavailable — ${purchasesError}. ` : ""}
        {paymentsError ? `Payment details are unavailable — ${paymentsError}.` : ""}
      </p> : null}
      {tab === "statement" ? <DataTable<SupplierStatementEntry>
        rows={shownStatement}
        rowKey={(entry) => entry.key}
        noun="entries"
        standardPage
        filters={listFilters}
        pageSize={25}
        loading={statementLoading}
        loadingLabel="Loading supplier statement…"
        error={statementError ? `Couldn't load supplier statement — ${statementError}` : undefined}
        errorHint="Check your clinic connection and refresh the supplier account."
        empty={<EmptyState message={month === "all" ? "No supplier statement entries yet." : "No statement entries in the selected month."} />}
        columns={statementColumns}
      /> : <DataTable<ClinicPurchase>
        rows={shownPurchases}
        rowKey={(purchase) => purchase.purchaseId}
        noun="purchases"
        standardPage
        filters={listFilters}
        totalsLabel="Total purchased"
        loading={purchasesLoading}
        loadingLabel="Loading supplier purchases…"
        error={purchasesError ? `Couldn't load supplier purchases — ${purchasesError}` : undefined}
        errorHint="Check your clinic connection and refresh the supplier account."
        empty={<EmptyState icon={<Receipt size={26} />} message={supplierPurchases.length === 0 ? "No purchases yet" : "No purchases found in the selected month."} />}
        columns={purchaseColumns}
      />}

      {recording ? <SupplierPaymentModal
        api={api}
        supplier={supplier}
        purchases={purchases}
        purchasesLoading={purchasesLoading}
        purchasesError={purchasesError}
        onClose={() => setRecording(false)}
        onSaved={async (payment) => { await onRecordPayment(payment); setPaymentNotice("Payment recorded."); }}
      /> : null}
      {viewingPurchase ? <PurchaseDetailsModal purchase={viewingPurchase} onClose={() => setViewingPurchase(null)} /> : null}
      {viewingPayment ? <PaymentDetailsModal payment={viewingPayment} onClose={() => setViewingPayment(null)} /> : null}
    </Page>
  );
}

function PurchaseDetailsModal({ purchase, onClose }: { purchase: ClinicPurchase; onClose: () => void }) {
  const lineColumns: Column<ClinicPurchase["lines"][number]>[] = [
    { key: "product", header: "Product", value: (line) => line.itemName, render: (line) => line.itemName },
    { key: "quantity", header: "Qty", align: "right", value: (line) => line.quantity, render: (line) => `${line.quantity}${line.unit ? ` ${line.unit}` : ""}` },
    { key: "rate", header: "Unit price", align: "right", value: (line) => line.rate, render: (line) => formatNpr(line.rate) },
    { key: "amount", header: "Subtotal", align: "right", value: (line) => line.amount, render: (line) => formatNpr(line.amount) },
  ];
  return <ClinicModal title="Purchase details" onClose={onClose} maxWidth={860}>
    <ModalBody>
      <div className="finance-supplier-detail-fields">
        <DetailField label="Date" value={formatDateShort(purchase.purchaseDate)} />
        <DetailField label="Invoice" value={purchase.invoiceNumber || "Not recorded"} />
        <DetailField label="Supplier" value={purchase.supplierName} />
        <DetailField label="Total amount" value={formatNpr(purchase.totalAmount)} strong />
      </div>
      {purchase.correctsPurchaseId ? <p className="finance-supplier-correction-note">This invoice is a corrected replacement for a previous purchase record.</p> : null}
      {purchase.discountAmount > 0 ? <div className="finance-supplier-detail-fields"><DetailField label="Discount" value={formatNpr(purchase.discountAmount)} /></div> : null}
      <div className="finance-supplier-detail-heading"><h3>Purchased items</h3><span>{purchase.lines.length} {purchase.lines.length === 1 ? "item" : "items"}</span></div>
      <DataTable rows={purchase.lines} rowKey={(line) => line.purchaseLineId} noun="purchase lines" minWidth={544} empty={<EmptyState message="No purchase lines." />} columns={lineColumns} />
      {purchase.note ? <div className="finance-supplier-note"><strong>Notes</strong><p>{purchase.note}</p></div> : null}
    </ModalBody>
  </ClinicModal>;
}

function PaymentDetailsModal({ payment, onClose }: { payment: ClinicSupplierPayment; onClose: () => void }) {
  return <ClinicModal title="Payment Details" onClose={onClose} maxWidth={500}>
    <ModalBody>
      <div className="finance-supplier-detail-fields">
        <DetailField label="Date" value={formatDateShort(payment.paymentDate)} />
        <DetailField label="Amount" value={formatNpr(payment.amount)} strong />
        <DetailField label="Method" value={payment.paymentMethod || "—"} />
        <DetailField label="Reference" value={payment.paymentReference || "—"} />
      </div>
      {payment.note?.trim() && payment.note.trim() !== "Paid on delivery" ? <div className="finance-supplier-note"><strong>Notes</strong><p>{payment.note.trim()}</p></div> : null}
      {payment.voidReason ? <div className="finance-supplier-note"><strong>Removal reason</strong><p>{payment.voidReason}</p></div> : null}
    </ModalBody>
  </ClinicModal>;
}

function DetailField({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div>
    <div className="finance-supplier-detail-label">{label}</div>
    <div className={strong ? "finance-supplier-detail-value-strong" : "finance-supplier-detail-value"}>{value}</div>
  </div>;
}
