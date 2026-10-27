export type PatientPaymentMethod = "cash" | "esewa" | "khalti" | "card" | "bank_transfer" | "cheque";

export interface PatientPaymentsReport {
  received: Array<{
    patientLedgerEntryId: string;
    patientId: string;
    patientNumber: string;
    patientName: string;
    paymentDate: string;
    recordedAt: string;
    amount: number;
    discountAmount: number;
    paymentMethod: PatientPaymentMethod;
    receiptNumber: string | null;
  }>;
  outstanding: Array<{
    patientId: string;
    patientNumber: string;
    patientName: string;
    planTitle: string;
    currentDueAmount: number;
  }>;
}

export interface PatientLedgerEntry {
  patientLedgerEntryId: string;
  entryDate: string;
  recordedAt: string;
  entryType: "charge" | "payment" | "correction" | "reversal";
  amount: number;
  discountAmount: number;
  paymentMethod: PatientPaymentMethod | null;
  receiptNumber: string | null;
  forLabel: string | null;
  note: string | null;
  reversesEntryId: string | null;
  supersedesEntryId: string | null;
  correctionReason: string | null;
  rowVersion: number;
  runningBalance: number;
}

export interface PatientLedger {
  summary: {
    totalBilled: number;
    totalCollected: number;
    totalDiscount: number;
    outstandingDue: number;
  };
  entries: PatientLedgerEntry[];
  nextCursor: string | null;
}

export interface PatientPaymentInput {
  patientId: string;
  paymentDate: string;
  amount: number;
  discountAmount: number;
  paymentMethod: PatientPaymentMethod;
}

export interface PatientPaymentReceipt {
  patientLedgerEntryId: string;
  receiptNumber: string;
  amount: number;
  discountAmount: number;
  currentDueAmount: number;
}

export interface PatientPaymentResponse {
  payment: PatientPaymentReceipt;
}
