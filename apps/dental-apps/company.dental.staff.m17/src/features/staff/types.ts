export type StaffType = "doctor" | "helper" | "receptionist" | "other";
export type StaffStatus = "active" | "inactive";

export type StaffProfile = {
  staffId: string;
  fullName: string;
  staffType: StaffType;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  joinedOn: string;
  baseSalaryAmount: number | null;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
};

/** Clinical reporting only; treatment-stage value is not salary or commission. */
export type StaffClinicalWorkRow = {
  stageId: string;
  completedOn: string;
  patientId: string;
  patientName: string;
  patientNumber: string;
  chiefComplaint: string;
  protocolName: string;
  stageName: string;
  toothScope: string | null;
  chargeAmount: number;
  supportingDoctors: string[];
};

export type StaffWriteInput = {
  fullName: string;
  staffType: StaffType;
  jobTitle: string | null;
  phone: string | null;
  email: string | null;
  joinedOn: string;
  baseSalaryAmount: number | null;
  status: StaffStatus;
};

export type StaffUpdateInput = StaffWriteInput & { expectedRowVersion: number };

export type StaffDocumentType = "identity" | "license" | "contract" | "certificate" | "other";
export type StaffDocumentMimeType = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
export type StaffDocumentStatus = "pending" | "active" | "withdrawn" | "rejected" | "cleanup_pending";
export type StaffDocument = {
  staffDocumentId: string;
  staffId: string;
  documentType: StaffDocumentType;
  displayFilename: string;
  mimeType: StaffDocumentMimeType;
  byteSize: number;
  checksum: string;
  expiresOn: string | null;
  status: StaffDocumentStatus;
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
};

export type SalaryPayoutType = "advance" | "salary" | "adjustment" | "other";
export type SalaryPaymentMethod = "cash" | "bank_transfer" | "other";
export type SalaryPayoutStatus = "recorded" | "voided";
export type ClinicSalaryPayout = {
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
};

export type StaffDocumentUploadMetadata = {
  documentType: StaffDocumentType;
  displayFilename: string;
  mimeType: StaffDocumentMimeType;
  byteSize: number;
  expiresOn: string | null;
};
