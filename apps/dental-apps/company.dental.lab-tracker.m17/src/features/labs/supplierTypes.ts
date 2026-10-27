export const supplierTypes = ['goods', 'lab', 'both'] as const;
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
