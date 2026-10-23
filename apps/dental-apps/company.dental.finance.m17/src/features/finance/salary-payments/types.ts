export const salaryPayoutTypes = ["advance", "salary", "adjustment", "other"] as const;
export const salaryPaymentMethods = ["cash", "bank_transfer", "other"] as const;

export type SalaryPayoutType = (typeof salaryPayoutTypes)[number];
export type SalaryPaymentMethod = (typeof salaryPaymentMethods)[number];
export type SalaryPayoutStatus = "recorded" | "voided";

export interface SalaryPayoutWriteInput {
  staffId: string;
  payPeriod: string;
  payoutType: SalaryPayoutType;
  baseAmount: number;
  bonusAmount: number;
  paidOn: string;
  paymentMethod: SalaryPaymentMethod;
  paymentReference: string | null;
  note: string | null;
}

export interface ClinicSalaryPayout {
  salaryPayoutId: string;
  staffId: string;
  staffName: string;
  branchId: string | null;
  payPeriod: string;
  payoutType: SalaryPayoutType;
  baseAmount: number;
  bonusAmount: number;
  amount: number;
  paidOn: string;
  paymentMethod: SalaryPaymentMethod;
  paymentReference: string | null;
  note: string | null;
  status: SalaryPayoutStatus;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export type ClinicStaffProfile = {
  staffId: string;
  fullName: string;
  staffType: "doctor" | "helper" | "receptionist" | "other";
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  joinedOn: string;
  baseSalaryAmount: number | null;
  status: "active" | "inactive";
};

export interface SalaryPayoutWriteResponse {
  salaryPayout: ClinicSalaryPayout;
}
