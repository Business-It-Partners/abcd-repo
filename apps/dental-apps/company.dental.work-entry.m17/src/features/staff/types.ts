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

export type StaffReference = Pick<StaffProfile, "staffId" | "fullName" | "staffType" | "jobTitle" | "status">;

/** Clinical reporting only; the stage charge is never salary or commission. */
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
export const staffDocumentMimeTypes = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;
export type StaffDocumentMimeType = (typeof staffDocumentMimeTypes)[number];
export type StaffDocument = {
  staffDocumentId: string;
  staffId: string;
  documentType: StaffDocumentType;
  displayFilename: string;
  mimeType: StaffDocumentMimeType;
  byteSize: number;
  checksum: string;
  expiresOn: string | null;
  status: "pending" | "active" | "withdrawn" | "rejected" | "cleanup_pending";
  createdAt: string;
  updatedAt: string;
  rowVersion: number;
};

export type StaffDocumentUploadIntentInput = {
  documentType: StaffDocumentType;
  displayFilename: string;
  mimeType: StaffDocumentMimeType;
  byteSize: number;
  checksum: string;
  expiresOn: string | null;
};
