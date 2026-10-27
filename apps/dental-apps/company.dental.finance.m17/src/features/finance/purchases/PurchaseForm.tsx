import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { ClinicError, type ClinicCommand } from "@/sdk/client";
import { todayISO, formatDateShort } from "@/shared/dates/nepaliDate";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import { ClinicActionButton } from "@/shared/ui/ClinicActionButton";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { DataTable, EmptyState, Field, Input, ModalError, PageHeader, Select, Textarea, type Column } from "@/shared/ui/workspace-primitives";
import { Table, TableWrap, Td, Th, Tr } from "@/shared/ui/ClinicTable";
import { formatNpr } from "../internal/lib/domain";
import ProductFormModal from "../product-list/ProductFormModal";
import { ProductListApi } from "../product-list/api";
import SupplierFormModal from "../supplier-list/SupplierFormModal";
import { SupplierListApi } from "../supplier-list/api";
import { PurchasesApi } from "./api";
import type { ClinicProduct, ClinicPurchase, ClinicSupplier, PurchaseLineWriteInput, PurchaseType, PurchaseWriteInput, PurchaseWriteResponse } from "./types";

const HIGH_VALUE_PURCHASE_NPR = 1_000_000;
const MAX_REQUEST_BODY_BYTES = 12_000;
const MAX_PURCHASE_LINES = 100;
const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type DraftLine = { key: number; productId: string; itemName: string; quantity: string; unit: string; rate: string };
const blankLine = (key: number): DraftLine => ({ key, productId: "", itemName: "", quantity: "1", unit: "", rate: "" });
const roundMoney = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const roundQuantity = (value: number) => Math.round((value + Number.EPSILON) * 1_000) / 1_000;
const numberOf = (value: string) => {
  const parsed = Number(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

function decimalInput(value: string, places: number): string {
  const cleaned = value.replace(/[^0-9.]/g, "");
  const point = cleaned.indexOf(".");
  if (point < 0) return cleaned.slice(0, 14);
  const whole = cleaned.slice(0, point).slice(0, 12);
  const fraction = cleaned.slice(point + 1).replaceAll(".", "").slice(0, places);
  return `${whole || "0"}.${fraction}`;
}

function errorMessage(cause: unknown, fallback: string): string {
  if (cause instanceof ClinicError) {
    if (cause.code === "FORBIDDEN" || cause.code === "ACCESS_DENIED") return "Your clinic role does not permit this purchase action.";
    if (cause.code === "AUTH_REQUIRED" || cause.code === "STALE_SESSION") return "The clinic session changed. Reopen Finance from Dental OS.";
    if (cause.code === "CONFLICT") return "This purchase changed or its supplier invoice number is already recorded. Refresh the list and reopen the invoice before correcting it.";
    if (cause.code === "VALIDATION") return "The clinic rejected this invoice. Review the selected supplier, active branch, products, amounts, dates, and invoice number.";
    if (cause.outcome === "unknown") return "The clinic could not confirm this save. Keep the review open and retry the same request.";
    return cause.message || fallback;
  }
  return cause instanceof Error ? cause.message : fallback;
}

function lineAmount(line: DraftLine): number {
  return roundMoney(numberOf(line.quantity) * numberOf(line.rate));
}

function ProductPicker({
  products,
  selectedId,
  lineKey,
  disabled,
  onSelect,
  onAdvance,
  onAddNew,
}: {
  products: ClinicProduct[];
  selectedId: string;
  lineKey: number;
  disabled: boolean;
  onSelect: (product: ClinicProduct | null) => void;
  onAdvance: () => void;
  onAddNew: () => void;
}) {
  const [query, setQuery] = useState(() => products.find((product) => product.productId === selectedId)?.name ?? "");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [optionsPosition, setOptionsPosition] = useState<{ left: number; width: number; maxHeight: number; top?: number; bottom?: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionsRef = useRef<HTMLDivElement>(null);
  const selected = products.find((product) => product.productId === selectedId);
  const options = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return products.filter((product) => !term || product.name.toLocaleLowerCase().includes(term));
  }, [products, query]);

  useEffect(() => { setQuery(selected?.name ?? ""); }, [selected?.name, selectedId]);

  useLayoutEffect(() => {
    if (!open || disabled) return;
    const positionOptions = () => {
      const input = inputRef.current;
      if (!input) return;
      const bounds = input.getBoundingClientRect();
      const gutter = 8;
      const width = Math.min(Math.max(bounds.width, 280), Math.max(0, window.innerWidth - gutter * 2));
      const left = Math.max(gutter, Math.min(bounds.left, window.innerWidth - width - gutter));
      const below = Math.max(0, window.innerHeight - bounds.bottom - gutter);
      const above = Math.max(0, bounds.top - gutter);
      const placeAbove = below < Math.min(180, optionsRef.current?.scrollHeight ?? 240) && above > below;
      const availableHeight = placeAbove ? above : below;
      const maxHeight = Math.max(48, Math.min(240, availableHeight));
      setOptionsPosition({
        left,
        width,
        maxHeight,
        ...(placeAbove ? { bottom: window.innerHeight - bounds.top + 4 } : { top: bounds.bottom + 4 }),
      });
    };

    positionOptions();
    const handleScroll = (event: Event) => {
      const list = optionsRef.current;
      const target = event.target;
      // The list is portaled to <body>, so the capture listener also sees its own scroll
      // events. Reposition only when the input's page/ancestor scrolls; otherwise the
      // highlighted-option effect can snap the list back and make the mouse wheel appear stuck.
      if (list && target instanceof Node && list.contains(target)) return;
      positionOptions();
    };

    window.addEventListener("resize", positionOptions);
    window.addEventListener("scroll", handleScroll, true);
    return () => {
      window.removeEventListener("resize", positionOptions);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [disabled, open, options.length, query]);

  useLayoutEffect(() => {
    const list = optionsRef.current;
    const activeOption = list?.querySelector<HTMLElement>(`[data-option-index="${highlight}"]`);
    if (!open || !list || !activeOption) return;

    const listBounds = list.getBoundingClientRect();
    const optionBounds = activeOption.getBoundingClientRect();
    if (optionBounds.top < listBounds.top) {
      list.scrollTop -= listBounds.top - optionBounds.top;
    } else if (optionBounds.bottom > listBounds.bottom) {
      list.scrollTop += optionBounds.bottom - listBounds.bottom;
    }
  }, [highlight, open, options.length, optionsPosition]);

  const choose = (product: ClinicProduct) => {
    onSelect(product);
    setQuery(product.name);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { setOpen(false); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setHighlight((value) => (value + 1) % (options.length + 1)); }
    if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setHighlight((value) => (value - 1 + options.length + 1) % (options.length + 1)); }
    if (event.key === "Enter" && open) {
      event.preventDefault();
      event.stopPropagation();
      if (highlight === options.length) { setOpen(false); onAddNew(); }
      else if (options[highlight]) { choose(options[highlight]); onAdvance(); }
    }
  };

  return (
    <div className="purchase-product-picker">
      <Input
        ref={inputRef}
        value={query}
        placeholder="Type product name…"
        disabled={disabled}
        aria-label="Product name"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        data-purchase-line={lineKey}
        data-purchase-field="item"
        onFocus={() => { setOpen(true); setHighlight(0); }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        onChange={(event: ChangeEvent<HTMLInputElement>) => {
          const value = event.target.value;
          setQuery(value);
          setOpen(true);
          setHighlight(0);
          if (!value.trim() && selectedId) onSelect(null);
        }}
      />
      {open && !disabled && optionsPosition ? createPortal(
        <div ref={optionsRef} className="purchase-product-options purchase-product-options-portal" role="listbox" style={{ position: "fixed", zIndex: 1200, left: optionsPosition.left, width: optionsPosition.width, maxHeight: optionsPosition.maxHeight, ...(optionsPosition.top !== undefined ? { top: optionsPosition.top } : { bottom: optionsPosition.bottom }) }}>
          {options.length ? options.map((product, index) => (
            <button key={product.productId} type="button" role="option" data-option-index={index} aria-selected={product.productId === selectedId} className={index === highlight ? "purchase-product-option highlighted" : "purchase-product-option"} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(product)}>
              <span>{product.name}</span><small>{product.unit}</small>
            </button>
          )) : <p className="purchase-product-no-match">No product matching “{query}”</p>}
          <button type="button" data-option-index={options.length} className={highlight === options.length ? "purchase-product-add highlighted" : "purchase-product-add"} onMouseDown={(event) => event.preventDefault()} onClick={() => { setOpen(false); onAddNew(); }}><Plus size={13} /> New product…</button>
        </div>, document.body
      ) : null}
    </div>
  );
}

export default function PurchaseForm({
  api,
  productApi,
  supplierApi,
  products,
  suppliers,
  purchases,
  referencesLoading,
  referencesError,
  purchase,
  reviewing,
  onDraftDirtyChange,
  onProductCreated,
  onSupplierCreated,
  onCancel,
  onReview,
  onModalOpenChange,
  onRefresh,
  onCreated,
  onCorrected,
  onNotice,
}: {
  api: PurchasesApi;
  productApi: ProductListApi;
  supplierApi: SupplierListApi;
  products: ClinicProduct[];
  suppliers: ClinicSupplier[];
  purchases: ClinicPurchase[];
  referencesLoading: boolean;
  referencesError: string | null;
  purchase: ClinicPurchase | null;
  reviewing: boolean;
  onDraftDirtyChange: (dirty: boolean) => void;
  onProductCreated: (product: ClinicProduct) => void;
  onSupplierCreated: (supplier: ClinicSupplier) => void;
  onCancel: () => void;
  onReview: () => void;
  onModalOpenChange: (open: boolean) => void;
  onRefresh: () => Promise<void>;
  onCreated: (purchase: ClinicPurchase) => void;
  onCorrected: (purchase: ClinicPurchase) => void;
  onNotice: (message: string) => void;
}) {
  const [purchaseType, setPurchaseType] = useState<PurchaseType>(purchase?.purchaseType ?? "product");
  const [supplierId, setSupplierId] = useState(purchase?.supplierId ?? "");
  const [date, setDate] = useState(purchase?.purchaseDate ?? todayISO());
  const [invoiceNumber, setInvoiceNumber] = useState(purchase?.invoiceNumber ?? "");
  const [note, setNote] = useState(purchase?.note ?? "");
  const [discount, setDiscount] = useState(purchase ? String(purchase.discountAmount) : "");
  const [correctionReason, setCorrectionReason] = useState("");
  const [lines, setLines] = useState<DraftLine[]>(() => purchase?.lines.length
    ? purchase.lines.map((line, index) => ({ key: index, productId: line.productId ?? "", itemName: line.itemName, quantity: String(line.quantity), unit: line.unit ?? "", rate: String(line.rate) }))
    : [blankLine(0)]);
  const [saving, setSaving] = useState(false);
  const [unknownWrite, setUnknownWrite] = useState(false);
  const [conflicted, setConflicted] = useState(false);
  const [error, setError] = useState("");
  const [validationDialog, setValidationDialog] = useState("");
  const [riskWarnings, setRiskWarnings] = useState<string[]>([]);
  const [discardDialog, setDiscardDialog] = useState(false);
  const [quickProductFor, setQuickProductFor] = useState<number | null>(null);
  const [quickSupplier, setQuickSupplier] = useState(false);
  const command = useRef<ClinicCommand<PurchaseWriteResponse> | null>(null);
  const nextLineKey = useRef(lines.length);
  const pendingProductLine = useRef<number | null>(null);
  const linesCardRef = useRef<HTMLDivElement>(null);
  const pendingLineFocus = useRef<{ key: number; field: string } | null>(null);
  const currentFingerprint = JSON.stringify({ purchaseType, supplierId, date, invoiceNumber, note, discount, correctionReason, lines });
  const initialFingerprint = useRef(currentFingerprint);
  const draftDirty = currentFingerprint !== initialFingerprint.current || saving || unknownWrite;
  const locked = saving || unknownWrite || conflicted;
  const isLab = purchaseType === "lab_service";
  const activeProducts = useMemo(() => products.filter((product) => product.active), [products]);
  const availableSuppliers = useMemo(() => suppliers.filter((supplier) => (supplier.active || supplier.supplierId === purchase?.supplierId)
    && (isLab ? supplier.supplierType !== "goods" : supplier.supplierType !== "lab")), [isLab, purchase?.supplierId, suppliers]);
  const selectedSupplier = suppliers.find((supplier) => supplier.supplierId === supplierId);
  const lineSubtotal = roundMoney(lines.reduce((sum, line) => sum + lineAmount(line), 0));
  const discountAmount = roundMoney(numberOf(discount));
  const totalAmount = roundMoney(lineSubtotal - discountAmount);
  const validLines: PurchaseLineWriteInput[] = lines.map((line) => {
    const product = activeProducts.find((item) => item.productId === line.productId);
    return {
      productId: isLab ? null : line.productId || null,
      itemName: isLab ? line.itemName.trim() : product?.name ?? line.itemName.trim(),
      quantity: roundQuantity(numberOf(line.quantity)),
      unit: line.unit.trim() || product?.unit || "piece",
      rate: roundMoney(numberOf(line.rate)),
      note: null,
    };
  });
  const writeInput: PurchaseWriteInput = {
    supplierId,
    purchaseDate: date,
    invoiceNumber: invoiceNumber.trim() || null,
    purchaseType,
    lines: validLines,
    discountAmount,
    note: note.trim() || null,
  };
  const operationInput = purchase ? { replacement: writeInput, reason: correctionReason.trim() } : writeInput;
  const requestBytes = new TextEncoder().encode(JSON.stringify(operationInput)).byteLength;
  const tooLargeForBroker = requestBytes > MAX_REQUEST_BODY_BYTES;
  const canReview = Boolean(selectedSupplier && date && lines.length > 0 && totalAmount > 0 && !referencesLoading && !referencesError && !locked && !tooLargeForBroker);

  useEffect(() => {
    const modalOpen = Boolean(validationDialog || riskWarnings.length || discardDialog || quickProductFor !== null || quickSupplier);
    onModalOpenChange(modalOpen);
    return () => onModalOpenChange(false);
  }, [discardDialog, onModalOpenChange, quickProductFor, quickSupplier, riskWarnings.length, validationDialog]);

  useEffect(() => {
    onDraftDirtyChange(draftDirty);
  }, [draftDirty, onDraftDirtyChange]);
  useEffect(() => () => onDraftDirtyChange(false), [onDraftDirtyChange]);

  const setLine = (key: number, patch: Partial<DraftLine>) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  const focusLineField = (key: number, field: string) => {
    const input = linesCardRef.current?.querySelector<HTMLInputElement>(`[data-purchase-line="${key}"][data-purchase-field="${field}"]`);
    if (input) {
      input.focus();
      if (field !== "item") input.select();
      return;
    }
    pendingLineFocus.current = { key, field };
  };
  const addLine = () => {
    if (lines.length >= MAX_PURCHASE_LINES) return;
    const key = nextLineKey.current++;
    pendingLineFocus.current = { key, field: "item" };
    setLines((current) => [...current, blankLine(key)]);
  };

  useLayoutEffect(() => {
    const pending = pendingLineFocus.current;
    if (!pending) return;
    const input = linesCardRef.current?.querySelector<HTMLInputElement>(`[data-purchase-line="${pending.key}"][data-purchase-field="${pending.field}"]`);
    if (!input) return;
    pendingLineFocus.current = null;
    input.focus();
  }, [lines]);

  const handleLinesKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" || event.defaultPrevented || !(event.target instanceof HTMLInputElement)) return;
    const target = event.target;
    const field = target.dataset.purchaseField;
    const key = Number(target.dataset.purchaseLine);
    if (!Number.isInteger(key) || !["item", "quantity", "unit", "rate"].includes(field ?? "")) return;
    event.preventDefault();
    if (field === "item") { focusLineField(key, "quantity"); return; }
    if (field === "quantity") { focusLineField(key, "unit"); return; }
    if (field === "unit") { focusLineField(key, "rate"); return; }
    const currentIndex = lines.findIndex((line) => line.key === key);
    const nextLine = lines[currentIndex + 1];
    if (nextLine) focusLineField(nextLine.key, "item");
    else addLine();
  };

  const validate = (): string | null => {
    if (!idPattern.test(supplierId) || !selectedSupplier) return "Supplier is compulsory — select an active compatible supplier.";
    if (selectedSupplier.active === false && selectedSupplier.supplierId !== purchase?.supplierId) return "Choose an active supplier.";
    if (selectedSupplier.supplierType === "goods" && isLab) return "A lab-service purchase requires a dental lab supplier.";
    if (selectedSupplier.supplierType === "lab" && !isLab) return "A product purchase requires a goods supplier.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayISO()) return "Choose a valid purchase date no later than today.";
    if (invoiceNumber.trim().length > 100) return "Invoice number must be 100 characters or less.";
    if (!lines.length || lines.length > MAX_PURCHASE_LINES) return "Add between 1 and 100 item lines.";
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const quantity = numberOf(line.quantity);
      const rate = numberOf(line.rate);
      if (isLab ? !line.itemName.trim() : !line.productId || !activeProducts.some((product) => product.productId === line.productId)) {
        return isLab ? `Item #${index + 1}: Enter the lab service.` : `Item #${index + 1}: Select an active product from the dropdown.`;
      }
      if (line.itemName.trim().length > 200) return `Item #${index + 1}: The item name must be 200 characters or less.`;
      if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 || !/^\d+(?:\.\d{1,3})?$/.test(line.quantity)) return `Item #${index + 1}: Quantity must be positive, at most 1,000,000, and use no more than three decimal places.`;
      if (!Number.isFinite(rate) || rate < 0 || rate > 100_000_000 || !/^\d+(?:\.\d{1,2})?$/.test(line.rate)) return `Item #${index + 1}: Rate must be a non-negative NPR amount using no more than two decimal places.`;
      if (line.unit.trim().length > 40) return `Item #${index + 1}: Unit must be 40 characters or less.`;
      if (lineAmount(line) <= 0) return `Item #${index + 1}: Amount must be greater than zero.`;
    }
    if (!Number.isFinite(discountAmount) || discountAmount < 0 || discountAmount > 100_000_000 || !/^(?:\d+)?(?:\.\d{1,2})?$/.test(discount || "0")) return "Enter a non-negative discount with no more than two decimal places.";
    if (discountAmount > lineSubtotal) return "The discount cannot exceed the invoice subtotal.";
    if (totalAmount <= 0) return "The invoice total must be greater than zero.";
    if (note.trim().length > 1_000) return "Remarks / Note must be 1,000 characters or less.";
    if (purchase && !correctionReason.trim()) return "Enter a reason for correcting this invoice.";
    if (purchase && correctionReason.trim().length > 500) return "The correction reason must be 500 characters or less.";
    if (tooLargeForBroker) return "This invoice exceeds Dental OS's 12,000-byte request limit. Reduce the number or length of line details before continuing; do not split the invoice into multiple purchases.";
    return null;
  };

  const prepareReview = () => {
    const validationError = validate();
    if (validationError) { setValidationDialog(validationError); return; }
    const warnings: string[] = [];
    const normalizedInvoice = invoiceNumber.trim().toLocaleLowerCase().replace(/\s+/g, "");
    if (normalizedInvoice && purchases.some((row) => row.purchaseId !== purchase?.purchaseId && row.supplierId === supplierId && (row.invoiceNumber ?? "").trim().toLocaleLowerCase().replace(/\s+/g, "") === normalizedInvoice)) {
      warnings.push(`Invoice ${invoiceNumber.trim()} is already recorded for this supplier. The clinic will reject a duplicate supplier invoice.`);
    }
    if (totalAmount >= HIGH_VALUE_PURCHASE_NPR) warnings.push(`This invoice is ${formatNpr(totalAmount)}. Confirm that the amount and zeros are correct.`);
    if (warnings.length) { setRiskWarnings(warnings); return; }
    setError("");
    onReview();
  };

  const save = async () => {
    if (saving || unknownWrite || conflicted) return;
    if (!command.current && !canReview) { setError(tooLargeForBroker ? "This invoice exceeds the SDK request limit." : "Review and correct the invoice details before saving."); return; }
    setSaving(true);
    setError("");
    try {
      if (!command.current) command.current = purchase ? api.correct(purchase.purchaseId, { replacement: writeInput, reason: correctionReason.trim() }) : api.create(writeInput);
      const response = await command.current.execute();
      command.current = null;
      if (purchase) onCorrected(response.purchase);
      else onCreated(response.purchase);
      onNotice(purchase ? "Purchase correction saved. The original invoice remains in the audit trail." : "Purchase recorded successfully.");
      onCancel();
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === "unknown") {
        setUnknownWrite(true);
        setError(errorMessage(cause, "The purchase save could not be confirmed."));
      } else if (cause instanceof ClinicError && cause.code === "CONFLICT") {
        command.current = null;
        setConflicted(true);
        setError(errorMessage(cause, "The purchase changed. Reload and reopen it."));
        try { await onRefresh(); } catch { /* Keep the conflict visible. */ }
      } else {
        command.current = null;
        setError(errorMessage(cause, "The purchase could not be saved."));
      }
    } finally {
      setSaving(false);
    }
  };

  const requestExit = () => {
    if (saving || unknownWrite) return;
    if (currentFingerprint !== initialFingerprint.current) setDiscardDialog(true);
    else onCancel();
  };

  const acceptQuickProduct = async (product: ClinicProduct) => {
    onProductCreated(product);
    const target = pendingProductLine.current;
    if (target !== null) setLine(target, { productId: product.productId, itemName: product.name, unit: product.unit });
    pendingProductLine.current = null;
    setQuickProductFor(null);
  };

  const acceptQuickSupplier = async (supplier: ClinicSupplier) => {
    onSupplierCreated(supplier);
    if ((isLab && supplier.supplierType !== "goods") || (!isLab && supplier.supplierType !== "lab")) {
      setSupplierId(supplier.supplierId);
      setQuickSupplier(false);
      return;
    }
    setSupplierId("");
    setQuickSupplier(false);
    setValidationDialog(isLab
      ? "This supplier was saved, but its type cannot be used for a lab-service purchase. Choose a Lab or Both supplier."
      : "This supplier was saved, but its type cannot be used for a product purchase. Choose a Goods or Both supplier.");
  };

  const tableColumns: Column<DraftLine>[] = [
    { key: "item", header: "Item name *", render: (line) => isLab ? <Input data-purchase-line={line.key} data-purchase-field="item" value={line.itemName} maxLength={200} placeholder="e.g. Zirconia Crown" disabled={locked} onChange={(event) => setLine(line.key, { itemName: event.target.value })} /> : <ProductPicker products={activeProducts} selectedId={line.productId} lineKey={line.key} disabled={locked} onSelect={(product) => setLine(line.key, { productId: product?.productId ?? "", itemName: product?.name ?? "", unit: product?.unit ?? line.unit })} onAdvance={() => focusLineField(line.key, "quantity")} onAddNew={() => { pendingProductLine.current = line.key; setQuickProductFor(line.key); }} /> },
    { key: "quantity", header: "Qty *", align: "right", render: (line) => <Input data-purchase-line={line.key} data-purchase-field="quantity" inputMode="decimal" value={line.quantity} disabled={locked} onChange={(event) => setLine(line.key, { quantity: decimalInput(event.target.value, 3) })} style={{ width: 82, textAlign: "right" }} /> },
    { key: "unit", header: "Unit", render: (line) => <Input data-purchase-line={line.key} data-purchase-field="unit" value={line.unit} maxLength={40} placeholder="Unit" disabled={locked} onChange={(event) => setLine(line.key, { unit: event.target.value })} style={{ width: 90 }} /> },
    { key: "rate", header: "Rate (NPR)", align: "right", render: (line) => <Input data-purchase-line={line.key} data-purchase-field="rate" inputMode="decimal" value={line.rate} disabled={locked} onChange={(event) => setLine(line.key, { rate: decimalInput(event.target.value, 2) })} style={{ width: 110, textAlign: "right" }} /> },
    { key: "amount", header: "Total (NPR)", align: "right", render: (line) => <strong>{formatNpr(lineAmount(line))}</strong> },
    { key: "actions", header: "", align: "center", render: (line, index) => <div className="purchase-line-actions">
      {index === lines.length - 1 ? <button type="button" className="purchase-add-row" title="Add row" aria-label="Add invoice line" disabled={locked || lines.length >= MAX_PURCHASE_LINES} onClick={addLine}><Plus size={17} /></button> : null}
      { (index !== lines.length - 1 || lines.length > 1) ? <button type="button" className="btn btn-icon btn-ghost btn-sm" title="Remove row" aria-label={`Remove invoice line ${line.itemName || ""}`} disabled={locked || lines.length <= 1} onClick={() => setLines((current) => current.filter((row) => row.key !== line.key))}><Trash2 size={15} /></button> : null}
    </div> },
  ];

  if (reviewing) {
    const metadata = [
      ["Supplier", selectedSupplier?.name ?? "—"],
      ["Invoice number", invoiceNumber.trim() || "—"],
      ["Invoice date", formatDateShort(date)],
      ["Purchase type", isLab ? "Lab service" : "Products"],
    ];
    return (
      <div className="purchase-form-page purchase-review-page">
        <PageHeader title={purchase ? "Confirm Invoice Correction" : "Confirm Purchase Order"}>
          <ClinicActionButton onClick={() => void save()} disabled={saving || conflicted || (!unknownWrite && !canReview)}>{saving ? <><Loader2 size={15} className="spin" /> {purchase ? "Saving correction…" : "Saving purchase…"}</> : unknownWrite ? "Retry original save" : purchase ? "Confirm & Save Correction" : "Confirm & Save Purchase"}</ClinicActionButton>
        </PageHeader>
        <div className="purchase-review-card">
          <dl className="purchase-review-context" aria-label="Invoice details">
            {metadata.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          <section className="purchase-review-items" aria-labelledby="purchase-review-items-heading">
            <div className="purchase-review-section-heading">
              <h3 id="purchase-review-items-heading">Invoice items</h3>
              <span>{validLines.length} {validLines.length === 1 ? "item" : "items"}</span>
            </div>
            <TableWrap>
              <Table minWidth={620} aria-label="Purchase invoice items" data-sajilo-standard-table>
                <thead><Tr><Th scope="col" align="center" style={{ width: 44 }}>#</Th><Th scope="col">Item name</Th><Th scope="col" align="right">Qty</Th><Th scope="col" align="center">Unit</Th><Th scope="col" align="right">Rate (NPR)</Th><Th scope="col" align="right">Total (NPR)</Th></Tr></thead>
                <tbody>{validLines.map((line, index) => <Tr key={`${line.itemName}-${index}`}><Td align="center" style={{ width: 44, color: "var(--ink-3)", fontVariantNumeric: "tabular-nums" }}>{index + 1}</Td><Td style={{ fontWeight: 550 }}>{line.itemName}</Td><Td align="right">{line.quantity}</Td><Td align="center">{line.unit || "unit"}</Td><Td align="right">{formatNpr(line.rate)}</Td><Td align="right" style={{ fontWeight: 550 }}>{formatNpr(roundMoney(line.quantity * line.rate))}</Td></Tr>)}</tbody>
              </Table>
            </TableWrap>
          </section>
          <div className="purchase-review-totals">
            <div><span>Sub total</span><strong>{formatNpr(lineSubtotal)}</strong></div>
            <div><span>Discount</span><strong>{formatNpr(discountAmount)}</strong></div>
            <div className="grand-total"><span>Net bill total</span><strong>{formatNpr(totalAmount)}</strong></div>
          </div>
          {note.trim() ? <p className="purchase-review-note"><strong>Note/Remarks:</strong> {note.trim()}</p> : null}
          {purchase ? <p className="purchase-correction-notice"><strong>Correction reason:</strong> {correctionReason.trim()}</p> : null}
          {tooLargeForBroker ? <ModalError>This purchase exceeds the Dental OS 12,000-byte SDK request-body limit. Do not split the invoice; reduce line details or wait for a reviewed host/API size change.</ModalError> : null}
          {error ? <ModalError>{error}</ModalError> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="purchase-form-page">
      <PageHeader title={purchase ? "Correct purchase invoice" : "New purchase"} />
      {referencesLoading ? <p className="purchase-reference-warning" role="status">Loading product and supplier choices…</p> : null}
      {referencesError ? <ModalError>Product and supplier choices are incomplete: {referencesError}. Refresh before recording or correcting a purchase.</ModalError> : null}
      {conflicted ? <ModalError>This purchase changed in the clinic. The purchase list was refreshed; close this form and reopen the current invoice before editing.</ModalError> : null}
      <div className="purchase-form-card">
        <div className="purchase-form-grid">
          <Field label="Purchase type" required>
            <Select value={purchaseType} disabled={Boolean(purchase) || locked} onChange={(event) => { setPurchaseType(event.target.value as PurchaseType); setSupplierId(""); setLines([blankLine(nextLineKey.current++)]); }}>
              <option value="product">Products</option><option value="lab_service">Lab service</option>
            </Select>
          </Field>
          <Field label="Supplier" required>
            <Select value={supplierId} disabled={Boolean(purchase) || locked || referencesLoading} onChange={(event) => { if (event.target.value === "__new__") { setQuickSupplier(true); return; } setSupplierId(event.target.value); }}>
              <option value="">Select supplier</option>
              {availableSuppliers.map((supplier) => <option key={supplier.supplierId} value={supplier.supplierId}>{supplier.name}{supplier.active ? "" : " (inactive)"}</option>)}
              {!purchase ? <option value="__new__">+ New supplier…</option> : null}
            </Select>
          </Field>
          <Field label="Invoice date" required><DatePicker value={date} onChange={setDate} max={todayISO()} fluid disabled={locked} /></Field>
          <Field label="Invoice #"><Input value={invoiceNumber} maxLength={100} disabled={locked} placeholder="Invoice number" onChange={(event) => setInvoiceNumber(event.target.value)} /></Field>
        </div>
      </div>
      {purchaseType === "lab_service" && selectedSupplier && selectedSupplier.supplierType === "goods" ? <p className="purchase-reference-warning" role="alert">A lab-service purchase requires a Lab or Both supplier. The selected supplier type is Goods.</p> : null}
      {purchaseType === "product" && selectedSupplier && selectedSupplier.supplierType === "lab" ? <p className="purchase-reference-warning" role="alert">A product purchase requires a Goods or Both supplier. The selected supplier type is Lab.</p> : null}
      <div className="purchase-lines-card" ref={linesCardRef} onKeyDown={handleLinesKeyDown}>
        <div className="purchase-lines-heading"><h3>Invoice items</h3><span>{lines.length} / {MAX_PURCHASE_LINES} lines</span></div>
        <DataTable<DraftLine>
          rows={lines}
          rowKey={(line) => String(line.key)}
          noun="invoice lines"
          minWidth={760}
          paginate={false}
          columns={tableColumns}
          empty={<EmptyState message="Add at least one invoice line." />}
        />
      </div>
      <div className="purchase-bottom-bar">
        <div><span>SUB TOTAL</span><strong>{formatNpr(lineSubtotal)}</strong></div>
        <Field label="DISCOUNT"><Input inputMode="decimal" placeholder="0" value={discount} disabled={locked} onChange={(event) => setDiscount(decimalInput(event.target.value, 2))} /></Field>
        <div className="purchase-grand-total"><span>GRAND TOTAL</span><strong>{formatNpr(totalAmount)}</strong></div>
        <Field label="REMARKS / NOTE"><Input placeholder="Remarks / Note" value={note} maxLength={1_000} disabled={locked} onChange={(event) => setNote(event.target.value)} /></Field>
        {purchase ? <Field label="Correction reason" required><Input placeholder="Reason for correction" value={correctionReason} maxLength={500} disabled={locked} onChange={(event) => setCorrectionReason(event.target.value)} /></Field> : null}
        <button type="button" className="btn btn-secondary" onClick={requestExit} disabled={saving || unknownWrite}>Cancel</button>
        <ClinicActionButton onClick={prepareReview} disabled={saving || unknownWrite || conflicted || referencesLoading || Boolean(referencesError)}> <Check size={15} /> Review Purchase</ClinicActionButton>
      </div>
      {validationDialog ? <ClinicModal title="Required information missing" onClose={() => setValidationDialog("")} size="small" verticalAlign="center"><p>{validationDialog}</p><div className="purchase-form-actions"><ClinicActionButton onClick={() => setValidationDialog("")}>OK</ClinicActionButton></div></ClinicModal> : null}
      {riskWarnings.length > 0 ? <ClinicModal title="Review purchase warning" onClose={() => setRiskWarnings([])} size="small" verticalAlign="center"><div className="purchase-risk-list">{riskWarnings.map((warning) => <p key={warning}>{warning}</p>)}</div><div className="purchase-form-actions"><button type="button" className="btn btn-secondary" onClick={() => setRiskWarnings([])}>Cancel</button><ClinicActionButton onClick={() => { setRiskWarnings([]); setError(""); onReview(); }}>Continue to review</ClinicActionButton></div></ClinicModal> : null}
      {discardDialog ? <ClinicModal title={purchase ? "Discard unsaved correction?" : "Discard unsaved purchase?"} onClose={() => setDiscardDialog(false)} size="small" verticalAlign="center"><p>Your changes on this form have not been saved. Return without saving them?</p><div className="purchase-form-actions"><button type="button" className="btn btn-secondary" onClick={() => setDiscardDialog(false)}>Keep editing</button><button type="button" className="btn btn-danger" onClick={() => { setDiscardDialog(false); onCancel(); }}>Discard &amp; go back</button></div></ClinicModal> : null}
      {quickProductFor !== null ? <ProductFormModal api={productApi} onClose={() => { setQuickProductFor(null); pendingProductLine.current = null; }} onSaved={acceptQuickProduct} onConflict={async () => { try { await onRefresh(); } catch { /* Product form retains its conflict state. */ } }} /> : null}
      {quickSupplier ? <SupplierFormModal api={supplierApi} onClose={() => setQuickSupplier(false)} onSaved={acceptQuickSupplier} onConflict={async () => { try { await onRefresh(); } catch { /* Supplier form retains its conflict state. */ } }} /> : null}
    </div>
  );
}
