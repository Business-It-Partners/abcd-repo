import type { ClinicProduct } from "../product-list/types";
import type { ClinicSupplier } from "../supplier-list/types";
import type { ClinicPurchase as SupplierPurchase } from "../supplier-list/types";

export const purchaseTypes = ["product", "lab_service"] as const;
export type PurchaseType = (typeof purchaseTypes)[number];
export type ClinicPurchase = SupplierPurchase;
export type { ClinicProduct, ClinicSupplier };

export interface PurchaseLineWriteInput {
  productId: string | null;
  itemName: string;
  quantity: number;
  unit: string | null;
  rate: number;
  note: string | null;
}

export interface PurchaseWriteInput {
  supplierId: string;
  purchaseDate: string;
  invoiceNumber: string | null;
  purchaseType: PurchaseType;
  lines: PurchaseLineWriteInput[];
  discountAmount: number;
  note: string | null;
}

export interface PurchaseVoidInput {
  reason: string;
}

export interface PurchaseCorrectionInput {
  replacement: PurchaseWriteInput;
  reason: string;
}

export interface PurchaseWriteResponse {
  purchase: ClinicPurchase;
}
