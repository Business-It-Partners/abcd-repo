export const supplierTypes = ["goods", "lab", "both"] as const;
export type SupplierType = (typeof supplierTypes)[number];

export const supplierPaymentMethods = ["cash", "eSewa", "Khalti", "card", "bank_transfer", "cheque"] as const;
export type SupplierPaymentMethod = (typeof supplierPaymentMethods)[number];
export const supplierPaymentScopes = ["general", "lab"] as const;
export type SupplierPaymentScope = (typeof supplierPaymentScopes)[number];

export interface ClinicSupplier {
  supplierId: string;
  name: string;
  supplierType: SupplierType;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingBalanceAmount: number;
  openingBalanceAsOf: string;
  active: boolean;
  currentDueAmount: number;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
}

export interface SupplierWriteInput {
  name: string;
  supplierType: SupplierType;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingBalanceAmount: number;
  openingBalanceAsOf: string;
  active: boolean;
}

export type SupplierUpdateInput = SupplierWriteInput & { expectedRowVersion: number };

export interface SupplierStatementEntry {
  key: string;
  kind: "opening" | "purchase" | "payment";
  date: string;
  description: string;
  due: number | null;
  paid: number | null;
  balance: number;
}

export interface ClinicSupplierStatement {
  supplier: ClinicSupplier;
  totalPurchasedAmount: number;
  totalPaidAmount: number;
  currentDueAmount: number;
  entries: SupplierStatementEntry[];
}

export interface ClinicPurchaseLine {
  purchaseLineId: string;
  productId: string | null;
  itemName: string;
  quantity: number;
  unit: string | null;
  rate: number;
  amount: number;
  note: string | null;
}

export interface ClinicPurchase {
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
  lines: ClinicPurchaseLine[];
}

export interface SupplierPaymentWriteInput {
  supplierId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentReference: string | null;
  purchaseId: string | null;
  paymentScope: SupplierPaymentScope;
  note: string | null;
}

export interface SupplierPaymentVoidInput {
  reason: string;
}

export interface SupplierPaymentCorrectionInput {
  replacement: SupplierPaymentWriteInput;
  reason: string;
}

export interface ClinicSupplierPayment {
  supplierPaymentId: string;
  supplierId: string;
  supplierName: string;
  branchId: string;
  paymentDate: string;
  amount: number;
  paymentMethod: SupplierPaymentMethod;
  paymentReference: string | null;
  purchaseId: string | null;
  paymentScope: SupplierPaymentScope;
  note: string | null;
  status: "recorded" | "voided";
  recordedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface SupplierWriteResponse { supplier: ClinicSupplier }
export interface SupplierStatementResponse { statement: ClinicSupplierStatement }
export interface SupplierPaymentWriteResponse { supplierPayment: ClinicSupplierPayment }
