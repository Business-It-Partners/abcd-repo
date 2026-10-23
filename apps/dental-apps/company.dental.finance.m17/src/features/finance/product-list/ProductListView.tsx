import { useEffect, useMemo, useState } from "react";
import { Edit3, Eye, Package, Plus, Search } from "lucide-react";
import { ClinicClient, ClinicError, type ClinicCommand } from "@/sdk/client";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import {
  DataTable,
  EmptyState,
  InlineCheck,
  Page,
  PageHeader,
  RowActions,
  SearchBox,
  Select,
  type Column,
} from "@/shared/ui/workspace-primitives";
import ProductDrawer from "./ProductDrawer";
import ProductFormModal from "./ProductFormModal";
import { ProductListApi } from "./api";
import { productCategories } from "./types";
import type { ClinicProduct, ProductCategory, ProductPurchase, ProductUpdateInput, ProductWriteResponse } from "./types";

const categoryLabels: Record<ProductCategory, string> = {
  consumable: "Consumable",
  instrument: "Instrument",
  ppe: "PPE",
  lab_material: "Lab material",
  office: "Office",
  other: "Other",
};

function readableStatusError(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this product action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "VALIDATION") return "The clinic rejected this update. Refresh the product list and review the record before trying again.";
    if (cause.code === "CONFLICT") return "This product changed in the clinic. The latest product has been reloaded.";
    if (cause.outcome === "unknown") return "We could not confirm this status update. Retry the original request to check the same operation.";
    return cause.message || "The product could not be updated.";
  }
  return cause instanceof Error ? cause.message : "The product could not be updated.";
}

interface UnknownStatusWrite {
  productId: string;
  productName: string;
  original: ClinicProduct;
  targetActive: boolean;
  command: ClinicCommand<ProductWriteResponse>;
}

export default function ProductListView({
  api,
  client,
  products,
  purchases,
  loading,
  loadError,
  purchasesLoading,
  purchasesError,
  onNavigationLockChange,
  onRefresh,
  onCreated,
  onUpdated,
}: {
  api: ProductListApi;
  client: ClinicClient;
  products: ClinicProduct[];
  purchases: ProductPurchase[];
  loading: boolean;
  loadError: string | null;
  purchasesLoading: boolean;
  purchasesError: string | null;
  onNavigationLockChange: (locked: boolean) => void;
  onRefresh: () => Promise<void>;
  onCreated: (product: ClinicProduct) => Promise<void>;
  onUpdated: (product: ClinicProduct) => Promise<void>;
}) {
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [activeOnly, setActiveOnly] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ClinicProduct | null>(null);
  const [viewing, setViewing] = useState<ClinicProduct | null>(null);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [unknownStatus, setUnknownStatus] = useState<UnknownStatusWrite | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const modalOpen = adding || Boolean(editing);
  const writeInProgress = Boolean(pendingStatusId) || Boolean(unknownStatus);
  const navigationLocked = modalOpen || writeInProgress;

  useEffect(() => {
    client.report({ dirty: navigationLocked, modal: modalOpen });
    onNavigationLockChange(navigationLocked);
    return () => {
      client.report({ dirty: false, modal: false });
      onNavigationLockChange(false);
    };
  }, [client, modalOpen, navigationLocked, onNavigationLockChange]);

  const query = term.trim().toLowerCase();
  const rows = useMemo(() => products.filter((product) => {
    if (activeOnly && !product.active) return false;
    if (category !== "all" && product.category !== category) return false;
    return !query || product.name.toLowerCase().includes(query);
  }), [activeOnly, category, products, query]);

  const resolveStatusCommand = async (write: UnknownStatusWrite) => {
    setPendingStatusId(write.productId);
    setStatusMessage(`Updating ${write.productName}…`);
    try {
      const response = await write.command.execute();
      setUnknownStatus(null);
      await onUpdated(response.product);
      setStatusMessage("Updated successfully.");
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownStatus(write);
        await onUpdated({ ...write.original, active: write.targetActive });
        setStatusMessage(`${readableStatusError(cause)} Product: ${write.productName}.`);
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        setUnknownStatus(null);
        try { await onRefresh(); } catch { /* Keep the conflict visible if the purchase-history read also fails. */ }
        setStatusMessage(readableStatusError(cause));
      } else {
        setUnknownStatus(null);
        await onUpdated(write.original);
        setStatusMessage(readableStatusError(cause));
      }
    } finally {
      setPendingStatusId(null);
    }
  };

  const changeStatus = async (product: ClinicProduct, active: boolean) => {
    if (pendingStatusId || unknownStatus) return;
    const input: ProductUpdateInput = {
      name: product.name,
      category: product.category,
      unit: product.unit,
      note: product.note,
      active,
      expectedRowVersion: product.rowVersion,
    };
    const write = { productId: product.productId, productName: product.name, original: product, targetActive: active, command: api.update(product.productId, input) };
    await onUpdated({ ...product, active });
    await resolveStatusCommand(write);
  };

  const columns: Column<ClinicProduct>[] = [
    { key: "sn", header: "S.N.", align: "center", width: 44, render: (_product, index) => <span style={{ color: "var(--ink-3)" }}>{index + 1}</span> },
    { key: "name", header: "Product Name", sortable: true, value: (product) => product.name, render: (product) => <span style={{ color: "var(--ink-1)" }}>{product.name}</span> },
    { key: "category", header: "Category", sortable: true, value: (product) => categoryLabels[product.category], render: (product) => categoryLabels[product.category] },
    { key: "unit", header: "Unit", sortable: true, value: (product) => product.unit },
    { key: "note", header: "Note / Spec", render: (product) => product.note || "—" },
    {
      key: "status",
      header: "Status",
      render: (product) => (
        <StatusToggle
          active={product.active}
          pending={pendingStatusId === product.productId}
          disabled={Boolean(pendingStatusId) || Boolean(unknownStatus)}
          onChange={(active) => void changeStatus(product, active)}
        />
      ),
    },
    {
      key: "actions",
      header: "Actions",
      align: "right",
      render: (product) => (
        <RowActions>
          <ClinicActionButton size="compact" onClick={() => setViewing(product)} title="View product details" disabled={writeInProgress}>
            <Eye size={13} /> Details
          </ClinicActionButton>
          <ClinicActionButton size="compact" onClick={() => setEditing(product)} title="Edit product" disabled={writeInProgress}>
            <Edit3 size={13} /> Edit
          </ClinicActionButton>
        </RowActions>
      ),
    },
  ];

  if (viewing) {
    return (
      <ProductDrawer
        product={viewing}
        purchases={purchases}
        purchasesLoading={purchasesLoading}
        purchasesError={purchasesError}
        onClose={() => setViewing(null)}
        onEdit={() => { const selected = viewing; setViewing(null); setEditing(selected); }}
      />
    );
  }

  return (
    <Page sheet>
      <PageHeader title="Product list" icon={<Package size={17} style={{ color: "var(--acc)" }} />}>
        <ClinicActionButton onClick={() => setAdding(true)} disabled={writeInProgress}>
          <Plus size={14} /> Add product
        </ClinicActionButton>
      </PageHeader>

      {statusMessage ? <p role={unknownStatus ? "alert" : "status"} style={{ margin: "0 0 var(--sp-3)", color: unknownStatus ? "var(--danger, #b42318)" : "var(--ink-2)", fontSize: "var(--fs-13)" }}>
        {statusMessage}
        {unknownStatus ? <button type="button" className="btn btn-secondary" disabled={Boolean(pendingStatusId)} onClick={() => void resolveStatusCommand(unknownStatus)} style={{ marginLeft: "var(--sp-2)" }}>Retry original update</button> : null}
      </p> : null}

      <DataTable<ClinicProduct>
        rows={rows}
        rowKey={(product) => product.productId}
        noun="products"
        filters={
          <div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", flexWrap: "wrap" }}>
            <SearchBox placeholder="Search products…" value={term} onChange={(event) => setTerm(event.target.value)} />
            <Select value={category} onChange={(event) => setCategory(event.target.value)} style={{ width: "auto" }}>
              <option value="all">All categories</option>
              {productCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
            </Select>
            <InlineCheck label="Active only" checked={activeOnly} onChange={setActiveOnly} />
          </div>
        }
        loading={loading}
        loadingLabel="Loading products…"
        error={loadError ? `Couldn't load the product catalogue — ${loadError}` : undefined}
        errorHint="Check your clinic connection and refresh the product list."
        empty={<EmptyState icon={products.length === 0 ? <Package size={26} /> : <Search size={26} />} message={products.length === 0 ? "No products yet." : "No product matches this search."} hint={products.length === 0 ? "Add the things you buy — gloves, composite, burs — so purchases can be recorded against them." : undefined} />}
        rowStyle={(product) => ({ opacity: product.active ? 1 : 0.55 })}
        columns={columns}
      />

      {!loading && !loadError && products.length > 0 ? (
        <p style={{ margin: "var(--sp-2) 0 0", color: "var(--ink-3)", fontSize: "var(--fs-12)" }}>Showing {products.length} product{products.length === 1 ? "" : "s"}.</p>
      ) : null}

      {adding ? (
        <ProductFormModal
          api={api}
          onClose={() => setAdding(false)}
          onSaved={onCreated}
          onConflict={async () => { setStatusMessage("A product changed in the clinic. The list was reloaded; review the current record before editing again."); try { await onRefresh(); } catch { /* Preserve the conflict message. */ } }}
        />
      ) : null}
      {editing ? (
        <ProductFormModal
          api={api}
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={onUpdated}
          onConflict={async () => { setStatusMessage("A product changed in the clinic. The list was reloaded; review the current record before editing again."); try { await onRefresh(); } catch { /* Preserve the conflict message. */ } }}
        />
      ) : null}
    </Page>
  );
}

function StatusToggle({
  active,
  pending,
  disabled,
  onChange,
}: {
  active: boolean;
  pending: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      data-checkbox-control
      data-loading-message="Updating product…"
      role="switch"
      aria-label={active ? "Active product. Click to retire." : "Retired product. Click to activate."}
      aria-checked={active}
      disabled={disabled}
      onClick={(event) => { event.stopPropagation(); onChange(!active); }}
      title={active ? "Active (Click to retire)" : "Retired (Click to activate)"}
      style={{
        position: "relative",
        display: "inline-block",
        width: "38px",
        height: "22px",
        borderRadius: "var(--r-pill)",
        background: active ? "var(--acc, #7c3aed)" : "#cbd5e1",
        border: "none",
        cursor: disabled ? "wait" : "pointer",
        transition: "background-color 0.2s ease",
        padding: 0,
        outline: "none",
        verticalAlign: "middle",
      }}
    >
      <span style={{
        position: "absolute",
        top: "2px",
        left: active ? "18px" : "2px",
        width: "18px",
        height: "18px",
        borderRadius: "50%",
        background: "#ffffff",
        boxShadow: "0 1px 3px rgba(15,23,42,0.25)",
        transition: "left 0.2s ease",
      }} />
      {pending ? <span className="sr-only">Updating product…</span> : null}
    </button>
  );
}
