import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Calendar, DollarSign, Edit3, Hash, Package, PackageCheck } from "lucide-react";
import { formatDateShort, isInBSMonth, todayISO } from "@/shared/dates/nepaliDate";
import MonthPicker from "@/shared/dates/MonthPicker";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { DataTable, EmptyState, Page, PageHeader, type Column } from "@/shared/ui/workspace-primitives";
import { formatNpr } from "@/features/finance/internal/lib/domain";
import type { ClinicProduct, ProductPurchase } from "./types";

const categoryLabels = {
  consumable: "Consumable",
  instrument: "Instrument",
  ppe: "PPE",
  lab_material: "Lab material",
  office: "Office",
  other: "Other",
} as const;

export default function ProductDrawer({
  product,
  purchases,
  purchasesLoading,
  purchasesError,
  onClose,
  onEdit,
}: {
  product: ClinicProduct;
  purchases: ProductPurchase[];
  purchasesLoading: boolean;
  purchasesError: string | null;
  onClose: () => void;
  onEdit: () => void;
}) {
  const [monthFilter, setMonthFilter] = useState("all");

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const matchingPurchases = useMemo(() => purchases
    .filter((purchase) => purchase.purchaseType !== "lab_service" && purchase.lines.some((line) => line.productId === product.productId))
    .slice()
    .sort((a, b) => (b.recordedAt || b.purchaseDate).localeCompare(a.recordedAt || a.purchaseDate)), [product.productId, purchases]);
  const filteredPurchases = useMemo(() => matchingPurchases.filter((purchase) => isInBSMonth(purchase.purchaseDate, monthFilter)), [matchingPurchases, monthFilter]);
  const totalQuantity = filteredPurchases.reduce((sum, purchase) => sum + purchase.lines
    .filter((line) => line.productId === product.productId)
    .reduce((lineSum, line) => lineSum + (line.quantity || 1), 0), 0);
  const totalInvoiceValue = filteredPurchases.reduce((sum, purchase) => sum + purchase.lines
    .filter((line) => line.productId === product.productId)
    .reduce((lineSum, line) => lineSum + (line.amount || 0), 0), 0);
  const columns: Column<ProductPurchase>[] = [
    {
      key: "date",
      header: "Date",
      sortable: true,
      value: (purchase) => purchase.purchaseDate,
      render: (purchase) => <span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", color: "var(--ink-2)" }}><Calendar size={13} style={{ color: "var(--ink-3)" }} />{formatDateShort(purchase.purchaseDate)}</span>,
    },
    { key: "supplier", header: "Supplier / payee", sortable: true, value: (purchase) => purchase.supplierName || "General Supplier", render: (purchase) => <strong>{purchase.supplierName || "General Supplier"}</strong> },
    { key: "invoice", header: "Invoice ref", value: (purchase) => purchase.invoiceNumber ?? "", render: (purchase) => purchase.invoiceNumber ? `#${purchase.invoiceNumber}` : "—" },
    {
      key: "quantity",
      header: "Qty bought",
      value: (purchase) => purchase.lines.filter((line) => line.productId === product.productId).reduce((sum, line) => sum + line.quantity, 0),
      render: (purchase) => `${purchase.lines.filter((line) => line.productId === product.productId).reduce((sum, line) => sum + line.quantity, 0)} ${product.unit}`,
    },
    {
      key: "cost",
      header: "Cost amount",
      align: "right",
      value: (purchase) => purchase.lines.filter((line) => line.productId === product.productId).reduce((sum, line) => sum + line.amount, 0),
      render: (purchase) => <strong style={{ color: "var(--success, #16803c)" }}>{formatNpr(purchase.lines.filter((line) => line.productId === product.productId).reduce((sum, line) => sum + line.amount, 0))}</strong>,
    },
  ];

  return (
    <Page sheet standardPage>
      <PageHeader
        title={product.name}
        icon={<Package size={17} style={{ color: "var(--acc)" }} />}
      >
        <ClinicActionButton size="compact" onClick={onEdit}><Edit3 size={14} /> Edit</ClinicActionButton>
      </PageHeader>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: "var(--sp-3)", marginBottom: "var(--sp-3)" }}>
        <section style={summaryCardStyle}>
          <div style={summaryLabelStyle}>Product Spec</div>
          <div style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: "var(--ink-1)", marginTop: "4px" }}>{categoryLabels[product.category]}</div>
          {product.note ? <div style={{ fontSize: "var(--fs-12)", color: "var(--ink-3)", marginTop: "2px" }}>{product.note}</div> : null}
        </section>

        <section style={summaryCardStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={summaryLabelStyle}>Total Purchased Qty</span><Hash size={15} style={{ color: "var(--acc)" }} />
          </div>
          {purchasesError ? <div style={summaryUnavailableStyle}>Purchase history unavailable</div> : purchasesLoading ? <div style={summaryHintStyle}>Loading purchase history…</div> : <>
            <div style={summaryValueStyle}>{totalQuantity} <span style={{ fontSize: "var(--fs-13)", fontWeight: "normal", color: "var(--ink-3)" }}>{product.unit}s</span></div>
          </>}
        </section>

        <section style={{ ...summaryCardStyle, background: "var(--acc-soft, #f4f0ff)", borderColor: "var(--acc-border, #e5ddfb)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ ...summaryLabelStyle, color: "var(--acc)" }}>{monthFilter === "all" ? "Total Invoice Value" : "Filtered Invoice Value"}</span><DollarSign size={15} style={{ color: "var(--acc)" }} />
          </div>
          {purchasesError ? <div style={summaryUnavailableStyle}>Purchase history unavailable</div> : purchasesLoading ? <div style={summaryHintStyle}>Loading purchase history…</div> : <>
            <div style={{ ...summaryValueStyle, color: "var(--acc)" }}>{formatNpr(totalInvoiceValue)}</div>
          </>}
        </section>
      </div>

      <DataTable<ProductPurchase>
        rows={filteredPurchases}
        rowKey={(purchase) => purchase.purchaseId}
        noun="product purchases"
        standardPage
        loading={purchasesLoading}
        loadingLabel="Loading purchase history…"
        error={purchasesError ? `Couldn't load purchase history — ${purchasesError}` : undefined}
        errorHint="Check the clinic connection and refresh the product list."
        title={<span style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)" }}><PackageCheck size={17} style={{ color: "var(--acc)" }} /> Purchase History</span>}
        filters={<MonthPicker value={monthFilter} onChange={setMonthFilter} allowAll allLabel="All Time" max={todayISO().slice(0, 7)} />}
        empty={<EmptyState message={matchingPurchases.length === 0 ? `No purchase invoices recorded for ${product.name} yet.` : `No purchases found for ${product.name} in the selected month.`} />}
        columns={columns}
      />
    </Page>
  );
}

const summaryCardStyle: CSSProperties = {
  background: "var(--surface, #fff)",
  border: "1px solid var(--line, #e5e7eb)",
  borderRadius: "var(--r-sm)",
  padding: "14px 16px",
};
const summaryLabelStyle: CSSProperties = {
  fontSize: "11px",
  fontWeight: "var(--fw-bold)",
  color: "var(--ink-3)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};
const summaryValueStyle: CSSProperties = {
  fontSize: "var(--fs-20)",
  fontWeight: "var(--fw-bold)",
  color: "var(--ink-1)",
  marginTop: "4px",
};
const summaryHintStyle: CSSProperties = {
  fontSize: "var(--fs-12)",
  color: "var(--ink-3)",
  marginTop: "2px",
};
const summaryUnavailableStyle: CSSProperties = {
  fontSize: "var(--fs-12)",
  color: "var(--danger, #b42318)",
  marginTop: "8px",
};
