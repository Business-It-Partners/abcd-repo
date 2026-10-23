export const productCategories = ["consumable", "instrument", "ppe", "lab_material", "office", "other"] as const;
export const productUnits = ["box", "packet", "piece", "set", "bottle", "tube", "ml", "gram"] as const;

export type ProductCategory = (typeof productCategories)[number];
export type ProductUnit = (typeof productUnits)[number];

export interface ClinicProduct {
  productId: string;
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  note: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface ProductWriteInput {
  name: string;
  category: ProductCategory;
  unit: ProductUnit;
  note: string | null;
  active: boolean;
}

export type ProductUpdateInput = ProductWriteInput & { expectedRowVersion: number };

export interface ProductPurchaseLine {
  purchaseLineId: string;
  productId: string | null;
  itemName: string;
  quantity: number;
  unit: string | null;
  rate: number;
  amount: number;
  note: string | null;
}

export interface ProductPurchase {
  purchaseId: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  purchaseDate: string;
  invoiceNumber: string | null;
  purchaseType: "product" | "lab_service";
  subtotalAmount: number;
  discountAmount: number;
  totalAmount: number;
  note: string | null;
  status: "recorded" | "voided";
  recordedAt: string;
  correctsPurchaseId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  lines: ProductPurchaseLine[];
}

export interface ProductWriteResponse {
  product: ClinicProduct;
}
