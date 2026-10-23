import type { ClinicClient, ClinicCommand } from "../../../../../../packages/app-sdk/src/clinicClient";
import { ClinicError } from "../../../../../../packages/app-sdk/src/clinicClient";
import type {
  ClinicSalaryPayout,
  StaffClinicalWorkRow,
  StaffDocument,
  StaffProfile,
  StaffUpdateInput,
  StaffWriteInput,
} from "./types";

const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === "string";
const nullableText = (value: unknown): value is string | null => value === null || text(value);
const finiteAmount = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const positiveInteger = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const isoDate = (value: unknown): value is string =>
  text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && !Number.isNaN(Date.parse(value))
  && new Date(value + "T00:00:00Z").toISOString().slice(0, 10) === value;

export function isStaffProfile(value: unknown): value is StaffProfile {
  if (!object(value)) return false;
  return text(value.staffId) && text(value.fullName)
    && ["doctor", "helper", "receptionist", "other"].includes(String(value.staffType))
    && nullableText(value.jobTitle) && nullableText(value.phone) && nullableText(value.email)
    && isoDate(value.joinedOn)
    && (value.baseSalaryAmount === null || finiteAmount(value.baseSalaryAmount))
    && ["active", "inactive"].includes(String(value.status))
    && text(value.createdAt) && text(value.updatedAt) && positiveInteger(value.rowVersion);
}

export function isStaffClinicalWorkRow(value: unknown): value is StaffClinicalWorkRow {
  if (!object(value)) return false;
  return text(value.stageId) && isoDate(value.completedOn) && text(value.patientId)
    && text(value.patientName) && text(value.patientNumber) && text(value.chiefComplaint)
    && text(value.protocolName) && text(value.stageName)
    && nullableText(value.toothScope) && finiteAmount(value.chargeAmount)
    && Array.isArray(value.supportingDoctors) && value.supportingDoctors.every(text);
}

export function isStaffDocument(value: unknown): value is StaffDocument {
  if (!object(value)) return false;
  return text(value.staffDocumentId) && text(value.staffId)
    && ["identity", "license", "contract", "certificate", "other"].includes(String(value.documentType))
    && text(value.displayFilename)
    && ["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(String(value.mimeType))
    && Number.isSafeInteger(value.byteSize) && Number(value.byteSize) > 0
    && typeof value.checksum === "string" && /^[a-f0-9]{64}$/.test(value.checksum)
    && (value.expiresOn === null || isoDate(value.expiresOn))
    && ["pending", "active", "withdrawn", "rejected", "cleanup_pending"].includes(String(value.status))
    && text(value.createdAt) && text(value.updatedAt) && positiveInteger(value.rowVersion);
}

export function isClinicSalaryPayout(value: unknown): value is ClinicSalaryPayout {
  if (!object(value)) return false;
  return text(value.salaryPayoutId) && text(value.staffId) && text(value.staffName)
    && nullableText(value.branchId) && /^\d{4}-(?:[1-9]|1[0-2])$/.test(String(value.payPeriod))
    && ["advance", "salary", "adjustment", "other"].includes(String(value.payoutType))
    && finiteAmount(value.baseAmount) && finiteAmount(value.bonusAmount) && finiteAmount(value.amount)
    && isoDate(value.paidOn)
    && ["cash", "bank_transfer", "other"].includes(String(value.paymentMethod))
    && nullableText(value.paymentReference) && nullableText(value.note)
    && ["recorded", "voided"].includes(String(value.status))
    && text(value.createdAt) && (value.voidedAt === null || text(value.voidedAt))
    && nullableText(value.voidReason);
}

const receipt = <T>(name: string, validate: (value: unknown) => value is T) =>
  (value: unknown): value is Record<string, T> =>
    object(value) && validate(value[name]) && Object.keys(value).length === 1;

function invalidResponse(label: string): never {
  throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid " + label + ".");
}

export class StaffApi {
  constructor(private readonly client: ClinicClient) {}

  async listStaff(): Promise<StaffProfile[]> {
    const response = await this.client.read<unknown>("/v1/clinic/staff");
    if (!object(response) || !Array.isArray(response.staff) || !response.staff.every(isStaffProfile)) {
      return invalidResponse("staff directory");
    }
    return response.staff;
  }

  async getStaff(staffId: string): Promise<StaffProfile> {
    const response = await this.client.read<unknown>("/v1/clinic/staff/" + encodeURIComponent(staffId));
    if (!object(response) || !isStaffProfile(response.staff)) return invalidResponse("staff profile");
    return response.staff;
  }

  listClinicalWork(staffId: string, range?: { start: string; end: string }): Promise<StaffClinicalWorkRow[]> {
    const query = new URLSearchParams();
    if (range) {
      query.set("startDate", range.start);
      query.set("endDate", range.end);
    }
    const suffix = query.size ? "?" + query.toString() : "";
    return this.client.read<unknown>(
      "/v1/clinic/staff/" + encodeURIComponent(staffId) + "/clinical-work" + suffix,
    ).then((response) => {
      if (!object(response) || !Array.isArray(response.work) || !response.work.every(isStaffClinicalWorkRow)) {
        return invalidResponse("clinical work history");
      }
      return response.work;
    });
  }

  listSalaryPayouts(): Promise<ClinicSalaryPayout[]> {
    return this.client.read<unknown>("/v1/clinic/salary-payouts").then((response) => {
      if (!object(response) || !Array.isArray(response.salaryPayouts)
        || !response.salaryPayouts.every(isClinicSalaryPayout)) {
        return invalidResponse("salary history");
      }
      return response.salaryPayouts;
    });
  }

  async listDocuments(staffId: string): Promise<StaffDocument[]> {
    const response = await this.client.read<unknown>(
      "/v1/clinic/staff/" + encodeURIComponent(staffId) + "/documents",
    );
    if (!object(response) || !Array.isArray(response.documents) || !response.documents.every(isStaffDocument)) {
      return invalidResponse("Staff document list");
    }
    return response.documents;
  }

  createStaff(input: StaffWriteInput): ClinicCommand<{ staff: StaffProfile }> {
    return this.client.command("POST", "/v1/clinic/staff", input, receipt("staff", isStaffProfile));
  }

  updateStaff(staffId: string, input: StaffUpdateInput): ClinicCommand<{ staff: StaffProfile }> {
    return this.client.command(
      "PATCH",
      "/v1/clinic/staff/" + encodeURIComponent(staffId),
      input,
      receipt("staff", isStaffProfile),
    );
  }

  withdrawDocument(staffId: string, documentId: string, reason: string): ClinicCommand<null> {
    return this.client.command(
      "POST",
      "/v1/clinic/staff/" + encodeURIComponent(staffId) + "/documents/"
        + encodeURIComponent(documentId) + "/withdraw",
      { reason },
      (value): value is null => value === null,
    );
  }
}
