import { useRef, useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { ClinicError, type ClinicCommand } from "@/sdk/client";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { Field, FieldPair, Input, ModalBody, ModalError, Select } from "@/shared/ui/workspace-primitives";
import { ProductListApi } from "./api";
import { productCategories, productUnits } from "./types";
import type { ClinicProduct, ProductCategory, ProductUnit, ProductWriteInput, ProductWriteResponse } from "./types";

const categoryLabels: Record<ProductCategory, string> = {
  consumable: "Consumable",
  instrument: "Instrument",
  ppe: "PPE",
  lab_material: "Lab material",
  office: "Office",
  other: "Other",
};

function errorMessage(cause: unknown): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this product action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "VALIDATION") return "The clinic rejected this product. Review the name, category, unit, and clinic setup, then refresh before trying again.";
    if (cause.code === "CONFLICT") return "This product changed in the clinic. The latest product has been reloaded; review it before editing again.";
    if (cause.outcome === "unknown") return "We could not confirm whether this product was saved. Keep this dialog open and retry the original save to check the same request.";
    return cause.message || "The product could not be saved.";
  }
  return cause instanceof Error ? cause.message : "The product could not be saved.";
}

export default function ProductFormModal({
  api,
  product,
  onClose,
  onSaved,
  onConflict,
}: {
  api: ProductListApi;
  product?: ClinicProduct;
  onClose: () => void;
  onSaved: (product: ClinicProduct) => Promise<void>;
  onConflict: () => Promise<void>;
}) {
  const [name, setName] = useState(product?.name ?? "");
  const [unit, setUnit] = useState<ProductUnit | "">(product?.unit ?? "");
  const [category, setCategory] = useState<ProductCategory | "">(product?.category ?? "");
  const [note, setNote] = useState(product?.note ?? "");
  const [active, setActive] = useState(product?.active ?? true);
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [validationError, setValidationError] = useState("");
  const [error, setError] = useState("");
  const command = useRef<ClinicCommand<ProductWriteResponse> | null>(null);
  const conflicted = error.startsWith("This product changed in the clinic.");
  const locked = saving || unknownWrite || conflicted;
  const canSave = name.trim().length > 0 && name.trim().length <= 160 && unit !== "" && category !== "" && note.trim().length <= 1_000;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || conflicted) return;
    if (!unknownWrite) {
      if (!name.trim()) { setValidationError("Enter a product name."); return; }
      if (name.trim().length > 160) { setValidationError("Product name must be 160 characters or less."); return; }
      if (!unit) { setValidationError("Choose a unit."); return; }
      if (!category) { setValidationError("Choose a category."); return; }
      if (note.trim().length > 1_000) { setValidationError("Note must be 1,000 characters or less."); return; }
    }

    setSaving(true);
    setError("");
    setValidationError("");
    try {
      let activeCommand = command.current;
      if (!activeCommand) {
        const input: ProductWriteInput = {
          name: name.trim(),
          category: category as ProductCategory,
          unit: unit as ProductUnit,
          note: note.trim() || null,
          active,
        };
        activeCommand = product
          ? api.update(product.productId, { ...input, expectedRowVersion: product.rowVersion })
          : api.create(input);
        command.current = activeCommand;
      }

      const saved = await activeCommand.execute();
      command.current = null;
      await onSaved(saved.product);
      onClose();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        setError(errorMessage(cause));
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        command.current = null;
        setUnknownWrite(false);
        setError(errorMessage(cause));
        await onConflict();
        onClose();
      } else {
        command.current = null;
        setUnknownWrite(false);
        setError(errorMessage(cause));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <ClinicModal
      title={product ? "Edit product" : "New product"}
      onClose={onClose}
      maxWidth={440}
      closeDisabled={saving || unknownWrite}
    >
      <ModalBody as="form" noValidate onSubmit={(event) => void submit(event)}>
        <Field label="Name" required>
          <Input
            autoFocus
            placeholder="e.g. Composite kit"
            value={name}
            maxLength={160}
            disabled={locked}
            onChange={(event) => { setName(event.target.value); setValidationError(""); }}
          />
        </Field>

        <FieldPair>
          <Field label="Unit" required>
            <Select value={unit} disabled={locked} onChange={(event) => { setUnit(event.target.value as ProductUnit | ""); setValidationError(""); }}>
              <option value="">Select unit</option>
              {productUnits.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
          </Field>
          <Field label="Category" required>
            <Select value={category} disabled={locked} onChange={(event) => { setCategory(event.target.value as ProductCategory | ""); setValidationError(""); }}>
              <option value="">Select category</option>
              {productCategories.map((value) => <option key={value} value={value}>{categoryLabels[value]}</option>)}
            </Select>
          </Field>
        </FieldPair>

        <Field label="Note (optional)">
          <Input
            placeholder="Brand, shade, size — anything worth remembering"
            value={note}
            maxLength={1_000}
            disabled={locked}
            onChange={(event) => { setNote(event.target.value); setValidationError(""); }}
          />
        </Field>

        {product ? (
          <label style={{ display: "inline-flex", alignItems: "center", gap: "var(--sp-2)", fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--ink-2)", whiteSpace: "nowrap", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.65 : 1 }}>
            <input
              type="checkbox"
              checked={active}
              disabled={locked}
              onChange={(event) => setActive(event.target.checked)}
              style={{ width: 15, height: 15, accentColor: "var(--acc, #6a5ae0)" }}
            />
            Active — offered when recording a purchase
          </label>
        ) : null}

        {error ? <ModalError>{error}</ModalError> : null}
        {validationError ? <ModalError>{validationError}</ModalError> : null}
        <button type="submit" disabled={saving || conflicted || (!unknownWrite && !canSave)} className="btn btn-primary">
          {saving ? "Saving…" : unknownWrite ? "Retry original save" : <><Plus size={14} /> {product ? "Save product" : "Add product"}</>}
        </button>
      </ModalBody>
    </ClinicModal>
  );
}
