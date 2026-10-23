"use client";

import { useEffect, useState } from "react";
import { Plus, Truck, Power, PowerOff, Search, Loader2, Edit3 } from "lucide-react";
import {
  type LabSupplier,
  todayISO,
} from "@/features/labs/model/domain";
import {
  DataTable,
  StackCell,
  Chip,
  EmptyState,
  RowActions,
  Modal,
  ModalBody,
  ModalError,
  FieldPair,
  Field,
  Input,
  SearchBox,
  Toolbar,
  PageHeader,
} from "@/shared/ui/workspace-primitives";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import { useClinicRouteState } from "@/shell/routing/useClinicRouteState";

interface LabsPanelProps {
  labs: LabSupplier[];
  onAddLab: (lab: Omit<LabSupplier, "id" | "isLab">) => Promise<void>;
  onUpdateLab: (id: string, patch: Partial<Omit<LabSupplier, "id">>) => Promise<void>;
  onOpenLabDetail?: (lab: LabSupplier) => void;
  loading: boolean;
  canManageSharedSuppliers?: boolean;
  active?: boolean;
  onLifecycle?: (state: { dirty: boolean; modal: boolean }) => void;
}

const EMPTY = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  openingBalance: "0",
  openingAsOf: todayISO(),
};

export default function LabsPanel({
  labs,
  onAddLab,
  onUpdateLab,
  onOpenLabDetail,
  loading,
  canManageSharedSuppliers = false,
  active = true,
  onLifecycle,
}: LabsPanelProps) {
  const { showError } = useSnackbar();
  const { route, patch } = useClinicRouteState();
  const [showAdd, setShowAdd] = useState(false);
  const [editingLab, setEditingLab] = useState<LabSupplier | null>(null);
  const term = route.params.search ?? "";
  const statusTab = route.params.status === "inactive" ? "inactive" : "active";

  useEffect(() => {
    if (active) onLifecycle?.({ dirty: Boolean(showAdd || editingLab), modal: Boolean(showAdd || editingLab) });
  }, [active, editingLab, onLifecycle, showAdd]);

  const q = term.trim().toLowerCase();
  const rows = labs.filter((l) => {
    if ((statusTab === "active") !== l.active) return false;
    return !q || l.name.toLowerCase().includes(q) || (l.contactPerson && l.contactPerson.toLowerCase().includes(q));
  });
  const activeCount = labs.filter((l) => l.active).length;
  const inactiveCount = labs.length - activeCount;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-4)" }}>
      <PageHeader
        title="Lab supplier record"
        icon={<Truck size={17} style={{ color: "var(--acc)" }} />}
        subtitle={`${activeCount} active supplier${activeCount === 1 ? "" : "s"} · Track laboratories and the work sent to them.`}
      >
        <button type="button" onClick={() => setShowAdd(true)} disabled={loading} className="btn btn-primary" style={{ flexShrink: 0 }}>
          <Plus size={15} /> Add Lab Supplier
        </button>
      </PageHeader>

      <Toolbar>
        <SearchBox placeholder="Search lab suppliers…" value={term} onChange={(e) => patch({ search: e.target.value || null })} />
        <div role="tablist" aria-label="Lab supplier status" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px", background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "12px" }}>
          {([
            ["active", `Active suppliers (${activeCount})`],
            ["inactive", `Inactive suppliers (${inactiveCount})`],
          ] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={statusTab === key} onClick={() => patch({ status: key === "active" ? null : key })} style={{ border: statusTab === key ? "1px solid var(--acc, #0284c7)" : "1px solid transparent", borderRadius: "8px", background: statusTab === key ? "#ffffff" : "transparent", color: statusTab === key ? "var(--acc, #0284c7)" : "#64748b", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", padding: "6px 9px", cursor: "pointer", whiteSpace: "nowrap" }}>{label}</button>)}
        </div>
      </Toolbar>

      <DataTable<LabSupplier>
        rows={rows}
        rowKey={(lab) => lab.id}
        noun="lab suppliers"
        loading={loading}
        loadingLabel="Loading lab suppliers…"
        rowStyle={(lab) => (!lab.active ? { opacity: 0.72 } : undefined)}
        empty={
          <EmptyState
            icon={labs.length === 0 ? <Truck size={26} /> : <Search size={26} />}
            message={labs.length === 0 ? "No labs registered" : "No lab supplier matches this search"}
            hint={labs.length === 0 ? "Add a lab before sending crown, bridge or denture work out." : undefined}
          />
        }
        columns={[
          {
            key: "sn",
            header: "S.N.",
            align: "center",
            width: 44,
            render: (_lab, i) => (
              <span style={{ color: "var(--ink-3)", fontWeight: "var(--fw-medium)" }}>{i + 1}</span>
            ),
          },
          {
            key: "name",
            header: "Lab Party Name",
            sortable: true,
            value: (lab) => lab.name,
            render: (lab) => (
              <StackCell
                avatar={<Truck size={13} />}
                primary={lab.name}
                secondary={lab.address || undefined}
                badge={!lab.active ? <Chip tone="neutral">Inactive</Chip> : undefined}
              />
            ),
          },
          {
            key: "contactPerson",
            header: "Contact Person",
            sortable: true,
            value: (lab) => lab.contactPerson || "",
            render: (lab) => lab.contactPerson || "—",
          },
          {
            key: "phone",
            header: "Phone",
            nowrap: true,
            sortable: true,
            value: (lab) => lab.phone || "",
            render: (lab) => lab.phone || "—",
          },
          {
            key: "actions",
            header: "Actions",
            align: "right",
            render: (lab) => {
              const canManageRecord = lab.supplierType !== "both" || canManageSharedSuppliers;
              return (
                <RowActions>
                  {onOpenLabDetail && (
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onOpenLabDetail(lab)}
                      title="Open lab orders sent"
                    >
                      <Truck size={13} /> Lab orders
                    </button>
                  )}
                  <button type="button" className="btn btn-secondary btn-sm" disabled={!canManageRecord} onClick={() => setEditingLab(lab)} title={canManageRecord ? "Edit lab supplier" : "Finance permission is required to edit a supplier shared with Finance."}>
                    <Edit3 size={13} /> Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={!canManageRecord}
                    title={lab.active ? "Deactivate" : "Reactivate"}
                    onClick={() => void onUpdateLab(lab.id, { active: !lab.active })
                      .catch((err) => {
                        showError((err as Error).message || "Could not update the lab supplier.");
                      })}
                  >
                    {lab.active ? <PowerOff size={13} /> : <Power size={13} />}
                    {lab.active ? "Deactivate" : "Reactivate"}
                  </button>
                </RowActions>
              );
            },
          },
        ]}
      />

      {!loading && labs.length > 0 && (
        <p aria-live="polite" style={{ margin: 0, color: "var(--ink-3)", fontSize: "var(--fs-12)" }}>
          Showing {labs.length} lab supplier{labs.length === 1 ? "" : "s"} from the clinic supplier directory.
        </p>
      )}

      {(showAdd || editingLab) && (
        <AddLabModal
          initialLab={editingLab || undefined}
          existingNames={labs.filter((l) => l.id !== editingLab?.id).map((l) => l.name.toLowerCase())}
          onClose={() => { setShowAdd(false); setEditingLab(null); }}
          onSave={async (lab) => {
            if (editingLab) await onUpdateLab(editingLab.id, lab);
            else await onAddLab(lab);
            setShowAdd(false); setEditingLab(null);
          }}
        />
      )}
    </div>
  );
}

function AddLabModal({
  existingNames,
  initialLab,
  onClose,
  onSave,
}: {
  existingNames: string[];
  initialLab?: LabSupplier;
  onClose: () => void;
  onSave: (lab: Omit<LabSupplier, "id" | "isLab">) => Promise<void>;
}) {
  const [form, setForm] = useState(() => initialLab ? {
    name: initialLab.name, contactPerson: initialLab.contactPerson, phone: initialLab.phone, email: initialLab.email,
    address: initialLab.address, openingBalance: String(initialLab.openingBalance), openingAsOf: initialLab.openingAsOf,
  } : EMPTY);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof EMPTY, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (error) setError("");
  };

  const advanceOnEnter = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key !== "Enter") return;
    const target = e.target as HTMLElement;
    if (target.tagName === "BUTTON") return;

    const fields = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("input, select")
    ).filter((el) => !(el as HTMLInputElement).disabled && el.offsetParent !== null);

    const idx = fields.indexOf(target);
    if (idx === -1) return;
    e.preventDefault();

    const next = fields[idx + 1];
    if (next) {
      next.focus();
      if (next instanceof HTMLInputElement) next.select();
    } else {
      const submitBtn = e.currentTarget.querySelector<HTMLButtonElement>("button[type=submit]");
      submitBtn?.focus();
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const name = form.name.trim();
    if (!name) return setError("The lab needs a name.");
    if (existingNames.includes(name.toLowerCase())) {
      return setError("A lab with that name is already registered.");
    }

    setBusy(true);
    setError("");
    try {
      await onSave({
        name,
        contactPerson: form.contactPerson.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        openingBalance: Number(form.openingBalance) || 0,
        openingAsOf: form.openingAsOf || todayISO(),
        active: initialLab?.active ?? true,
      });
    } catch (err) {
      setError((err as Error).message || "Couldn't save the lab.");
      setBusy(false);
    }
  };

  return (
    <Modal title={initialLab ? "Edit Dental Lab Supplier" : "Register a Dental Lab Supplier"} onClose={onClose}>
      <ModalBody as="form" onKeyDown={advanceOnEnter} onSubmit={submit} noValidate>
        <Field label="Lab name" required>
          <Input
            autoFocus
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="e.g. Kantipur Dental Lab"
          />
        </Field>

        <Field label="Contact person">
          <Input
            value={form.contactPerson}
            onChange={(e) => set("contactPerson", e.target.value)}
            placeholder="Who do you call?"
          />
        </Field>

        <FieldPair>
          <Field label="Phone">
            <Input
              type="tel"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="+977 …"
            />
          </Field>
          <Field label="Email">
            <Input
              type="email"
              value={form.email}
              onChange={(e) => set("email", e.target.value)}
              placeholder="orders@lab.com.np"
            />
          </Field>
        </FieldPair>

        <Field label="Location / address">
          <Input
            value={form.address}
            onChange={(e) => set("address", e.target.value)}
            placeholder="Where do we send the impressions?"
          />
        </Field>

        {error && <ModalError>{error}</ModalError>}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "var(--sp-2)" }}>
          <button type="button" onClick={onClose} disabled={busy} className="btn btn-secondary">
            Cancel
          </button>
          <button type="submit" disabled={busy} className="btn btn-primary">
            {busy ? (
              <>
                <Loader2 size={14} className="spin-icon" /> Saving…
              </>
            ) : (
              <>
                <Plus size={15} /> {initialLab ? "Save Changes" : "Add Lab Supplier"}
              </>
            )}
          </button>
        </div>
      </ModalBody>
    </Modal>
  );
}
