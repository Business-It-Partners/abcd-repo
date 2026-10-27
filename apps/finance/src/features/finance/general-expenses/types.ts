export const operatingExpenseCategories = [
  "rent",
  "utilities",
  "marketing",
  "maintenance",
  "equipment",
  "taxes_fees",
  "other",
] as const;

export const operatingExpensePaymentMethods = [
  "cash",
  "eSewa",
  "Khalti",
  "card",
  "bank_transfer",
  "cheque",
] as const;

export type OperatingExpenseCategory = (typeof operatingExpenseCategories)[number];
export type OperatingExpensePaymentMethod = (typeof operatingExpensePaymentMethods)[number];
export type OperatingExpenseStatus = "recorded" | "voided";

export interface ClinicOperatingExpense {
  operatingExpenseId: string;
  branchId: string;
  expenseDate: string;
  category: OperatingExpenseCategory;
  amount: number;
  payee: string | null;
  paymentMethod: OperatingExpensePaymentMethod;
  paymentReference: string | null;
  note: string | null;
  status: OperatingExpenseStatus;
  voidedAt: string | null;
  voidReason: string | null;
  createdAt: string;
}

export interface OperatingExpenseWriteInput {
  expenseDate: string;
  category: OperatingExpenseCategory;
  amount: number;
  payee: string | null;
  paymentMethod: OperatingExpensePaymentMethod;
  paymentReference: string | null;
  note: string | null;
}

export interface OperatingExpenseWriteResponse {
  operatingExpense: ClinicOperatingExpense;
}
