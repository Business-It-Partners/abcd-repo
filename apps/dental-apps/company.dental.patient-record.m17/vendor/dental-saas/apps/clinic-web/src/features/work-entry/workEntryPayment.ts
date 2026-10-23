import type { PatientPaymentInput, PatientPaymentMethod } from "@/features/patients/types";
import { decimalNumber, roundMoney } from "../../shared/money/decimal";

export const WORK_ENTRY_PAYMENT_METHODS: ReadonlyArray<{ value: PatientPaymentMethod; label: string }> = [
  { value: "cash", label: "Cash" },
  { value: "esewa", label: "eSewa" },
  { value: "khalti", label: "Khalti" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cheque", label: "Cheque" },
];

export type WorkEntryPaymentDraft = Omit<PatientPaymentInput, "patientId">;

export function patientPaymentMethod(value: string): PatientPaymentMethod {
  const normalised = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const match = WORK_ENTRY_PAYMENT_METHODS.find((method) => method.value === normalised || method.label.toLowerCase() === value.trim().toLowerCase());
  if (!match) throw new Error("Choose a valid payment method.");
  return match.value;
}

function nprAmount(value: string, field: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  const amount = decimalNumber(trimmed);
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed) || amount < 0) {
    throw new Error(`${field} must be an NPR amount of zero or more with at most two decimal places.`);
  }
  return roundMoney(amount);
}

export function parseWorkEntryPayment(input: {
  paymentDate: string;
  paidToday: string;
  discount: string;
  paymentMethod: string;
  outstandingDue: number;
}): WorkEntryPaymentDraft | null {
  const amount = nprAmount(input.paidToday, "Paid today");
  const discountAmount = nprAmount(input.discount, "Discount");
  if (amount === 0 && discountAmount === 0) return null;

  if (!input.paymentDate) throw new Error("Choose the payment date.");
  if (amount + discountAmount > input.outstandingDue) {
    throw new Error(`Payment and discount cannot exceed the outstanding balance of Rs ${input.outstandingDue.toLocaleString("en-IN")}.`);
  }

  return {
    paymentDate: input.paymentDate,
    amount,
    discountAmount,
    paymentMethod: patientPaymentMethod(input.paymentMethod),
  };
}
