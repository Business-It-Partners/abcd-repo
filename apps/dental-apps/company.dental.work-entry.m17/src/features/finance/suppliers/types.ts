export const supplierTypes = ["goods", "lab", "both"] as const;

export type SupplierType = (typeof supplierTypes)[number];

export type ClinicSupplier = {
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
};

export type SupplierWriteInput = {
  name: string;
  supplierType: SupplierType;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  openingBalanceAmount: number;
  openingBalanceAsOf: string;
  active: boolean;
};

export type SupplierUpdateInput = SupplierWriteInput & { expectedRowVersion: number };

export type ClinicSupplierStatementEntry = {
  key: string;
  kind: "opening" | "purchase" | "payment";
  date: string;
  description: string;
  due: number | null;
  paid: number | null;
  balance: number;
};

export type ClinicSupplierStatement = {
  supplier: ClinicSupplier;
  totalPurchasedAmount: number;
  totalPaidAmount: number;
  currentDueAmount: number;
  entries: ClinicSupplierStatementEntry[];
};

/**
 * The Lab Supplier page is intentionally a lab-only view of the shared
 * supplier ledger. A `both` supplier can also have goods purchases, which
 * must not leak into the lab balance or statement.
 */
export type ClinicLabSupplierStatement = ClinicSupplierStatement & {
  totalLabBillAmount: number;
  labOrders: import("@/features/labs/types").ClinicLabOrder[];
};
