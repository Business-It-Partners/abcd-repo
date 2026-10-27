import type { TransactionRecordKind } from "@/features/finance/transaction-record/types";

export type CashTransactionCategory = "payment" | "expense" | "salary" | "supplier_payment";

export interface CashTransaction {
  id: string;
  date: string;
  flow: "in" | "out";
  category: CashTransactionCategory;
  categoryLabel: string;
  payeeOrPatient: string;
  noteOrDetails?: string;
  method?: string;
  amount: number;
}

export function transactionPresentation(kind: TransactionRecordKind) {
  switch (kind) {
    case "patient_payment":
      return { category: "payment", categoryLabel: "Patient Payment", flow: "in" } as const;
    case "operating_expense":
      return { category: "expense", categoryLabel: "General Expense", flow: "out" } as const;
    case "salary_payout":
      return { category: "salary", categoryLabel: "Salary Payout", flow: "out" } as const;
    case "supplier_payment":
      return { category: "supplier_payment", categoryLabel: "Supplier Payout", flow: "out" } as const;
  }
}
