import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, Receipt, Search, Trash2 } from "lucide-react";
import { ClinicClient, ClinicError, type ClinicCommand } from "@/sdk/client";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { formatDateShort, isInBSMonth, todayBSMonth, todayISO } from "@/shared/dates/nepaliDate";
import MonthPicker from "@/shared/dates/MonthPicker";
import { DataTable, EmptyState, Field, Input, ModalError, Page, PageHeader, RowActions, SearchBox, type Column } from "@/shared/ui/workspace-primitives";
import { PurchasesApi } from "./api";
import { PurchaseDetailsDialog } from "./PurchaseDetailsDialog";
import PurchaseForm from "./PurchaseForm";
import { ProductListApi } from "../product-list/api";
import { SupplierListApi } from "../supplier-list/api";
import { formatNpr } from "../internal/lib/domain";
import type { ClinicProduct, ClinicPurchase, ClinicSupplier, PurchaseWriteResponse } from "./types";

function readableWriteError(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this purchase action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "CONFLICT") return "This purchase changed or its supplier invoice is already recorded. Refresh the list and review the invoice.";
    if (cause.code === "VALIDATION") return "The clinic rejected this purchase. Review the supplier, branch setup, invoice number, items, quantities, rates, and discount.";
    if (cause.outcome === "unknown") return "The clinic could not confirm this void. Keep this dialog open and retry the same request.";
    return cause.message || "The purchase could not be changed.";
  }
  return cause instanceof Error ? cause.message : "The purchase could not be changed.";
}

type VoidWrite = {
  purchase: ClinicPurchase;
  reason: string;
  command: ClinicCommand<PurchaseWriteResponse>;
};

export default function PurchasesView({
  api,
  productApi,
  supplierApi,
  client,
  purchases,
  products,
  suppliers,
  purchasesLoading,
  referencesLoading,
  purchasesError,
  referencesError,
  onNavigationLockChange,
  onRefresh,
  onProductCreated,
  onSupplierCreated,
  onCreated,
  onCorrected,
  onVoided,
}: {
  api: PurchasesApi;
  productApi: ProductListApi;
  supplierApi: SupplierListApi;
  client: ClinicClient;
  purchases: ClinicPurchase[];
  products: ClinicProduct[];
  suppliers: ClinicSupplier[];
  purchasesLoading: boolean;
  referencesLoading: boolean;
  purchasesError: string | null;
  referencesError: string | null;
  onNavigationLockChange: (locked: boolean) => void;
  onRefresh: () => Promise<void>;
  onProductCreated: (product: ClinicProduct) => void;
  onSupplierCreated: (supplier: ClinicSupplier) => void;
  onCreated: (purchase: ClinicPurchase) => void;
  onCorrected: (purchase: ClinicPurchase) => void;
  onVoided: (purchaseId: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [month, setMonth] = useState(() => todayBSMonth());
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClinicPurchase | null>(null);
  const [viewing, setViewing] = useState<ClinicPurchase | null>(null);
  const [voidingPurchase, setVoidingPurchase] = useState<ClinicPurchase | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voidCommand, setVoidCommand] = useState<VoidWrite | null>(null);
  const [voidSaving, setVoidSaving] = useState(false);
  const [voidConflict, setVoidConflict] = useState(false);
  const [notice, setNotice] = useState("");
  const formOpen = adding || Boolean(editing);
  const modalOpen = formOpen || Boolean(viewing) || Boolean(voidingPurchase);
  const navigationLocked = formOpen || Boolean(viewing) || Boolean(voidingPurchase);

  useEffect(() => {
    client.report({ dirty: navigationLocked, modal: modalOpen });
    onNavigationLockChange(navigationLocked);
    return () => {
      client.report({ dirty: false, modal: false });
      onNavigationLockChange(false);
    };
  }, [client, modalOpen, navigationLocked, onNavigationLockChange]);

  const query = term.trim().toLocaleLowerCase();
  const activePurchases = useMemo(() => purchases.filter((purchase) => purchase.status === "recorded"), [purchases]);
  const rows = useMemo(() => activePurchases
    .filter((purchase) => isInBSMonth(purchase.purchaseDate, month))
    .filter((purchase) => !query
      || (purchase.invoiceNumber ?? "").toLocaleLowerCase().includes(query)
      || purchase.supplierName.toLocaleLowerCase().includes(query))
    .sort((left, right) => right.purchaseDate.localeCompare(left.purchaseDate) || right.recordedAt.localeCompare(left.recordedAt)),
  [activePurchases, month, query]);

  const columns: Column<ClinicPurchase>[] = [
    { key: "sn", header: "S.N.", align: "center", width: 44, render: (_purchase, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span> },
    { key: "date", header: "Date", sortable: true, nowrap: true, value: (purchase) => purchase.purchaseDate, render: (purchase) => formatDateShort(purchase.purchaseDate) },
    { key: "invoice", header: "Invoice #", sortable: true, nowrap: true, value: (purchase) => purchase.invoiceNumber ?? "", render: (purchase) => purchase.invoiceNumber || "—" },
    { key: "supplier", header: "Supplier", sortable: true, value: (purchase) => purchase.supplierName, render: (purchase) => purchase.supplierName },
    { key: "category", header: "Category", nowrap: true, value: (purchase) => purchase.purchaseType, render: (purchase) => purchase.purchaseType === "lab_service" ? "Lab work" : "Products" },
    { key: "items", header: "Items", value: (purchase) => purchase.lines.map((line) => line.itemName).join(", "), render: (purchase) => {
      const summary = purchase.lines.map((line) => line.itemName).join(", ");
      return <span title={summary} className="purchase-items-summary">{summary}</span>;
    } },
    { key: "total", header: "Total", align: "right", sortable: true, total: true, value: (purchase) => purchase.totalAmount, totalFormat: (sum) => <strong>{formatNpr(sum)}</strong>, render: (purchase) => formatNpr(purchase.totalAmount) },
    { key: "actions", header: "Action", align: "center", width: 190, render: (purchase) => (
      <RowActions>
        <div className="purchase-row-actions">
          <ClinicActionButton size="compact" onClick={() => setViewing(purchase)} title="View purchase details"><Eye size={13} /> Detail</ClinicActionButton>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setNotice(""); setEditing(purchase); }} title="Correct purchase invoice"><Pencil size={13} /> Correct</button>
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => { setVoidReason(""); setVoidError(""); setVoidCommand(null); setVoidConflict(false); setVoidingPurchase(purchase); }} title="Void purchase invoice" aria-label={`Void purchase ${purchase.invoiceNumber || purchase.purchaseId}`} style={{ color: "var(--danger, #b42318)" }}><Trash2 size={13} /></button>
        </div>
      </RowActions>
    ) },
  ];

  const completeVoid = async (write: VoidWrite) => {
    setVoidSaving(true);
    setVoidError("");
    try {
      const response = await write.command.execute();
      onVoided(response.purchase.purchaseId);
      setVoidingPurchase(null);
      setVoidCommand(null);
      setNotice("Purchase invoice voided. The supplier payment, if any, remains separate.");
      void onRefresh().catch(() => undefined);
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setVoidCommand(write);
        setVoidError(readableWriteError(cause));
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        setVoidCommand(null);
        setVoidConflict(true);
        setVoidError(readableWriteError(cause));
        void onRefresh().catch(() => undefined);
      } else {
        setVoidCommand(null);
        setVoidError(readableWriteError(cause));
      }
    } finally {
      setVoidSaving(false);
    }
  };

  const submitVoid = () => {
    if (!voidingPurchase || voidSaving || voidConflict) return;
    if (voidCommand) {
      void completeVoid(voidCommand);
      return;
    }
    const reason = voidReason.trim();
    if (!reason) { setVoidError("Enter a reason so this void is auditable."); return; }
    if (reason.length > 500) { setVoidError("The void reason must be 500 characters or less."); return; }
    void completeVoid({ purchase: voidingPurchase, reason, command: api.void(voidingPurchase.purchaseId, { reason }) });
  };

  if (formOpen) {
    return (
      <Page sheet fillSheet>
        <PurchaseForm
          api={api}
          productApi={productApi}
          supplierApi={supplierApi}
          products={products}
          suppliers={suppliers}
          purchases={activePurchases}
          referencesLoading={referencesLoading}
          referencesError={referencesError}
          purchase={editing}
          onProductCreated={onProductCreated}
          onSupplierCreated={onSupplierCreated}
          onCancel={() => { setAdding(false); setEditing(null); }}
          onRefresh={onRefresh}
          onCreated={onCreated}
          onCorrected={onCorrected}
          onNotice={setNotice}
        />
      </Page>
    );
  }

  return (
    <Page sheet standardPage>
      <PageHeader title="Purchases" icon={<Receipt size={17} style={{ color: "var(--acc)" }} />}>
        <ClinicActionButton onClick={() => { setNotice(""); setAdding(true); }}><Plus size={14} /> New purchase</ClinicActionButton>
      </PageHeader>
      {notice ? <p className="purchase-notice" role="status">{notice}</p> : null}
      {referencesError ? <p className="purchase-reference-warning" role="alert">Product and supplier choices could not be fully loaded — {referencesError}. Refresh and retry before recording or correcting an invoice.</p> : null}
      <DataTable<ClinicPurchase>
        rows={rows}
        rowKey={(purchase) => purchase.purchaseId}
        noun="purchases"
        standardPage
        minWidth={1050}
        totalsLabel="Total purchased"
        filters={<div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <MonthPicker value={month} onChange={setMonth} max={todayISO().slice(0, 7)} />
          <SearchBox placeholder="Search invoice or supplier…" value={term} onChange={(event) => setTerm(event.target.value)} />
        </div>}
        loading={purchasesLoading}
        loadingLabel="Loading purchases…"
        error={purchasesError ? `Couldn't load the list — ${purchasesError}` : undefined}
        errorHint="Check your clinic connection and refresh the purchases list."
        empty={<EmptyState icon={activePurchases.length === 0 ? <Receipt size={26} /> : <Search size={26} />} message={activePurchases.length === 0 ? "No purchases yet." : "No purchase matches this search."} />}
        columns={columns}
      />
      {viewing ? <PurchaseDetailsDialog purchase={viewing} onClose={() => setViewing(null)} /> : null}
      {voidingPurchase ? (
        <ClinicModal title="Void purchase invoice?" description="The invoice leaves purchase totals and the supplier balance but remains in the audit trail. Any supplier payment stays recorded separately." onClose={() => { if (!voidSaving && !voidCommand) setVoidingPurchase(null); }} closeDisabled={voidSaving || Boolean(voidCommand)} size="small" verticalAlign="center">
          <div className="purchase-void-form">
            <Field label="Reason for voiding" required>
              <Input value={voidReason} onChange={(event) => setVoidReason(event.target.value)} maxLength={500} placeholder="Reason for voiding (required)" disabled={voidSaving || Boolean(voidCommand) || voidConflict} autoFocus />
            </Field>
            {voidError ? <ModalError>{voidError}</ModalError> : null}
            {voidConflict ? <p className="purchase-reference-warning">Refresh the list and review the current purchase before trying again.</p> : null}
            <div className="purchase-form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setVoidingPurchase(null)} disabled={voidSaving || Boolean(voidCommand)}>Keep invoice</button>
              <button type="button" className="btn btn-danger" onClick={submitVoid} disabled={voidSaving || voidConflict}>{voidSaving ? "Voiding…" : voidCommand ? "Retry original void" : "Void invoice"}</button>
            </div>
          </div>
        </ClinicModal>
      ) : null}
    </Page>
  );
}
