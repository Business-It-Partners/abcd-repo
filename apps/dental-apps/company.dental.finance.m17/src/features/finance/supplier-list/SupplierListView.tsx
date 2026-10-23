import { useEffect, useMemo, useState } from "react";
import { Edit3, Plus, Receipt, Search, Truck } from "lucide-react";
import { ClinicClient, ClinicError, type ClinicCommand } from "@/sdk/client";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { Chip, DataTable, EmptyState, Page, PageHeader, RowActions, SearchBox, type Column } from "@/shared/ui/workspace-primitives";
import { formatNpr } from "@/features/finance/internal/lib/domain";
import SupplierFormModal from "./SupplierFormModal";
import { SupplierListApi } from "./api";
import type { ClinicSupplier, SupplierUpdateInput, SupplierWriteResponse } from "./types";

function readableUpdateError(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this supplier action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "VALIDATION") return "The clinic rejected this update. Refresh the supplier list and review the record before trying again.";
    if (cause.code === "CONFLICT") return "This supplier changed in the clinic. The latest list was reloaded.";
    if (cause.outcome === "unknown") return "We could not confirm this status update. Retry the original request to check the same operation.";
    return cause.message || "The supplier could not be updated.";
  }
  return cause instanceof Error ? cause.message : "The supplier could not be updated.";
}

interface UnknownStatusWrite {
  supplier: ClinicSupplier;
  targetActive: boolean;
  command: ClinicCommand<SupplierWriteResponse>;
}

export default function SupplierListView({
  api,
  client,
  suppliers,
  loading,
  loadError,
  onNavigationLockChange,
  onRefresh,
  onCreated,
  onUpdated,
  onOpenSupplier,
}: {
  api: SupplierListApi;
  client: ClinicClient;
  suppliers: ClinicSupplier[];
  loading: boolean;
  loadError: string | null;
  onNavigationLockChange: (locked: boolean) => void;
  onRefresh: () => Promise<void>;
  onCreated: (supplier: ClinicSupplier) => Promise<void>;
  onUpdated: (supplier: ClinicSupplier) => Promise<void>;
  onOpenSupplier: (supplier: ClinicSupplier) => void;
}) {
  const [term, setTerm] = useState("");
  const [statusTab, setStatusTab] = useState<"active" | "inactive">("active");
  const [editing, setEditing] = useState<ClinicSupplier | null>(null);
  const [adding, setAdding] = useState(false);
  const [pendingStatusId, setPendingStatusId] = useState<string | null>(null);
  const [unknownStatus, setUnknownStatus] = useState<UnknownStatusWrite | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const modalOpen = adding || Boolean(editing);
  const navigationLocked = modalOpen || Boolean(pendingStatusId) || Boolean(unknownStatus);

  useEffect(() => {
    client.report({ dirty: navigationLocked, modal: modalOpen });
    onNavigationLockChange(navigationLocked);
    return () => {
      client.report({ dirty: false, modal: false });
      onNavigationLockChange(false);
    };
  }, [client, modalOpen, navigationLocked, onNavigationLockChange]);

  const query = term.trim().toLowerCase();
  const rows = useMemo(() => suppliers.filter((supplier) => {
    if ((statusTab === "active") !== supplier.active) return false;
    return !query || supplier.name.toLowerCase().includes(query) || (supplier.contactPerson ?? "").toLowerCase().includes(query);
  }), [query, statusTab, suppliers]);
  const activeCount = suppliers.filter((supplier) => supplier.active).length;
  const inactiveCount = suppliers.length - activeCount;

  const resolveStatus = async (write: UnknownStatusWrite) => {
    setPendingStatusId(write.supplier.supplierId);
    setStatusMessage(`Updating ${write.supplier.name}…`);
    try {
      const result = await write.command.execute();
      setUnknownStatus(null);
      await onUpdated(result.supplier);
      setStatusMessage("Updated successfully.");
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownStatus(write);
        await onUpdated({ ...write.supplier, active: write.targetActive });
        setStatusMessage(`${readableUpdateError(cause)} Supplier: ${write.supplier.name}.`);
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        setUnknownStatus(null);
        await onUpdated(write.supplier);
        try { await onRefresh(); } catch { /* Keep the stale-version message visible. */ }
        setStatusMessage(readableUpdateError(cause));
      } else {
        setUnknownStatus(null);
        await onUpdated(write.supplier);
        setStatusMessage(readableUpdateError(cause));
      }
    } finally {
      setPendingStatusId(null);
    }
  };

  const changeStatus = async (supplier: ClinicSupplier, active: boolean) => {
    if (pendingStatusId || unknownStatus) return;
    const input: SupplierUpdateInput = {
      name: supplier.name,
      supplierType: supplier.supplierType,
      contactPerson: supplier.contactPerson,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      openingBalanceAmount: supplier.openingBalanceAmount,
      openingBalanceAsOf: supplier.openingBalanceAsOf,
      active,
      expectedRowVersion: supplier.rowVersion,
    };
    await onUpdated({ ...supplier, active });
    setStatusMessage("");
    await resolveStatus({ supplier, targetActive: active, command: api.updateSupplier(supplier.supplierId, input) });
  };

  const columns: Column<ClinicSupplier>[] = [
    { key: "sn", header: "S.N.", align: "center", width: 44, render: (_supplier, index) => <span style={{ color: "var(--ink-3)", fontWeight: "var(--fw-medium)" }}>{index + 1}</span> },
    {
      key: "name", header: "Party Name", width: 250, sortable: true, value: (supplier) => supplier.name,
      render: (supplier) => <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontWeight: "var(--fw-medium)", color: "var(--ink-1)" }}>
        {supplier.name}{supplier.supplierType === "lab" || supplier.supplierType === "both" ? <Chip tone="accent">Lab supplier</Chip> : null}
      </span>,
    },
    { key: "phone", header: "Contact number", width: 150, sortable: true, value: (supplier) => supplier.phone ?? "", render: (supplier) => supplier.phone || "—" },
    { key: "contactPerson", header: "Contact person", width: 150, sortable: true, value: (supplier) => supplier.contactPerson ?? "", render: (supplier) => supplier.contactPerson || "—" },
    { key: "address", header: "Address", width: 190, render: (supplier) => supplier.address || "—" },
    {
      key: "balance", header: "Balance", width: 150, align: "right", sortable: true, total: true,
      value: (supplier) => supplier.currentDueAmount,
      totalFormat: (sum) => <strong>{formatNpr(sum)}</strong>,
      render: (supplier) => supplier.currentDueAmount === 0
        ? <span style={{ color: "var(--ink-3)" }}>{formatNpr(0)}</span>
        : supplier.currentDueAmount < 0
          ? <Chip tone="accent">In credit {formatNpr(-supplier.currentDueAmount)}</Chip>
          : <strong style={{ color: "var(--warn)" }}>{formatNpr(supplier.currentDueAmount)}</strong>,
    },
    {
      key: "status", header: "Status", width: 88,
      render: (supplier) => <StatusToggle
        active={supplier.active}
        pending={pendingStatusId === supplier.supplierId}
        disabled={Boolean(pendingStatusId || unknownStatus)}
        onChange={(nextActive) => void changeStatus(supplier, nextActive)}
      />,
    },
    {
      key: "actions", header: "Actions", align: "right", width: 150, nowrap: true,
      render: (supplier) => <RowActions>
        <ClinicActionButton size="compact" onClick={() => onOpenSupplier(supplier)} title="Open account statement"><Receipt size={13} /> Detail</ClinicActionButton>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(pendingStatusId || unknownStatus)} onClick={() => setEditing(supplier)} title="Edit supplier details"><Edit3 size={13} /> Edit</button>
      </RowActions>,
    },
  ];

  return (
    <Page sheet>
      <PageHeader title="Supplier list" icon={<Truck size={17} style={{ color: "var(--acc)" }} />}>
        <ClinicActionButton disabled={Boolean(pendingStatusId || unknownStatus)} onClick={() => setAdding(true)}><Plus size={14} /> Add supplier</ClinicActionButton>
      </PageHeader>

      <DataTable<ClinicSupplier>
        rows={rows}
        rowKey={(supplier) => supplier.supplierId}
        noun="suppliers"
        totalsLabel="Total outstanding"
        filters={<div style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", flexWrap: "wrap" }}>
          <SearchBox placeholder="Search suppliers…" value={term} onChange={(event) => setTerm(event.target.value)} />
          <div role="tablist" aria-label="Supplier status" className="finance-supplier-status-tabs">
            {([
              ["active", `Active suppliers (${activeCount})`],
              ["inactive", `Inactive suppliers (${inactiveCount})`],
            ] as const).map(([key, label]) => <button
              key={key}
              type="button"
              role="tab"
              aria-selected={statusTab === key}
              onClick={() => setStatusTab(key)}
              className={statusTab === key ? "finance-supplier-status-tab-selected" : "finance-supplier-status-tab"}
            >{label}</button>)}
          </div>
        </div>}
        loading={loading}
        loadingLabel="Loading suppliers…"
        error={loadError ? `Couldn't load the supplier list — ${loadError}` : undefined}
        errorHint="Check your clinic connection and try again."
        empty={<EmptyState
          icon={suppliers.length === 0 ? <Truck size={26} /> : <Search size={26} />}
          message={suppliers.length === 0 ? "No suppliers yet." : "No supplier matches this search."}
          hint={suppliers.length === 0 ? "Add the vendors you buy materials from so purchases can be recorded against them." : undefined}
        />}
        rowStyle={(supplier) => ({ opacity: supplier.active ? 1 : 0.55 })}
        columns={columns}
      />

      {statusMessage ? <p className={unknownStatus || pendingStatusId ? "finance-module-message" : "finance-supplier-success"} role={unknownStatus ? "alert" : "status"}>{statusMessage}</p> : null}
      {unknownStatus ? <button type="button" className="btn btn-secondary" disabled={Boolean(pendingStatusId)} onClick={() => void resolveStatus(unknownStatus)}>
        {pendingStatusId ? "Checking original update…" : "Retry original status update"}
      </button> : null}

      {adding ? <SupplierFormModal
        api={api}
        onClose={() => setAdding(false)}
        onSaved={async (supplier) => { await onCreated(supplier); setAdding(false); setStatusMessage("Added successfully."); }}
        onConflict={onRefresh}
      /> : null}
      {editing ? <SupplierFormModal
        api={api}
        supplier={editing}
        onClose={() => setEditing(null)}
        onSaved={async (supplier) => { await onUpdated(supplier); setEditing(null); setStatusMessage("Updated successfully."); }}
        onConflict={onRefresh}
      /> : null}
    </Page>
  );
}

function StatusToggle({ active, pending, disabled, onChange }: { active: boolean; pending: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  return <button
    type="button"
    data-checkbox-control
    data-loading-message="Updating supplier…"
    role="switch"
    aria-checked={active}
    aria-label={active ? "Active supplier" : "Inactive supplier"}
    disabled={disabled}
    onClick={(event) => { event.stopPropagation(); onChange(!active); }}
    title={active ? "Active (Click to deactivate)" : "Inactive (Click to activate)"}
    style={{
      position: "relative", display: "inline-block", width: "40px", height: "22px", borderRadius: "var(--r-pill)",
      background: active ? "var(--acc, #7c3aed)" : "#cbd5e1", border: "none", cursor: disabled ? "wait" : "pointer",
      transition: "background-color 0.2s ease", padding: 0, outline: "none", verticalAlign: "middle",
    }}
  >
    <span style={{ position: "absolute", top: "2px", left: active ? "20px" : "2px", width: "18px", height: "18px", borderRadius: "50%", background: "#ffffff", boxShadow: "0 1px 3px rgba(15,23,42,0.25)", transition: "left 0.2s ease" }} />
    {pending ? <span className="sr-only">Updating supplier…</span> : null}
  </button>;
}
