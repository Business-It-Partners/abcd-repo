import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import { salaryPaymentMethods, salaryPayoutTypes } from "./types";
import type {
  ClinicSalaryPayout,
  ClinicStaffProfile,
  SalaryPayoutWriteInput,
  SalaryPayoutWriteResponse,
} from "./types";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const periodPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const payoutTypes = new Set<string>(salaryPayoutTypes);
const paymentMethods = new Set<string>(salaryPaymentMethods);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validPayout(value: unknown): value is ClinicSalaryPayout {
  return record(value)
    && typeof value.salaryPayoutId === "string" && idPattern.test(value.salaryPayoutId)
    && typeof value.staffId === "string" && idPattern.test(value.staffId)
    && typeof value.staffName === "string"
    && (value.branchId === null || (typeof value.branchId === "string" && idPattern.test(value.branchId)))
    && typeof value.payPeriod === "string" && periodPattern.test(value.payPeriod)
    && typeof value.payoutType === "string" && payoutTypes.has(value.payoutType)
    && typeof value.baseAmount === "number" && Number.isFinite(value.baseAmount) && value.baseAmount >= 0
    && typeof value.bonusAmount === "number" && Number.isFinite(value.bonusAmount) && value.bonusAmount >= 0
    && typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount > 0 && value.amount <= 100_000_000
    && validDate(value.paidOn)
    && typeof value.paymentMethod === "string" && paymentMethods.has(value.paymentMethod)
    && nullableString(value.paymentReference)
    && nullableString(value.note)
    && (value.status === "recorded" || value.status === "voided")
    && typeof value.createdAt === "string"
    && nullableString(value.voidedAt)
    && nullableString(value.voidReason);
}

function validPayoutList(value: unknown): value is { salaryPayouts: ClinicSalaryPayout[] } {
  return record(value) && Array.isArray(value.salaryPayouts) && value.salaryPayouts.every(validPayout);
}

function validStaffProfile(value: unknown): value is ClinicStaffProfile {
  return record(value)
    && typeof value.staffId === "string" && idPattern.test(value.staffId)
    && typeof value.fullName === "string" && value.fullName.length > 0
    && ["doctor", "helper", "receptionist", "other"].includes(String(value.staffType))
    && nullableString(value.jobTitle)
    && nullableString(value.phone)
    && nullableString(value.email)
    && validDate(value.joinedOn)
    && (value.baseSalaryAmount === null || (typeof value.baseSalaryAmount === "number" && Number.isFinite(value.baseSalaryAmount) && value.baseSalaryAmount >= 0))
    && (value.status === "active" || value.status === "inactive");
}

function validStaffList(value: unknown): value is { staff: ClinicStaffProfile[] } {
  return record(value) && Array.isArray(value.staff) && value.staff.every(validStaffProfile);
}

function validWriteResponse(value: unknown): value is SalaryPayoutWriteResponse {
  return record(value) && validPayout(value.salaryPayout);
}

function payoutPath(id: string, action?: "correct" | "void"): string {
  if (!idPattern.test(id)) throw new ClinicError("INVALID_REQUEST", "The salary payout identifier is invalid.");
  return `/v1/clinic/salary-payouts/${id}${action ? `/${action}` : ""}`;
}

export class SalaryPaymentsApi {
  constructor(private readonly client: ClinicClient) {}

  async listPayouts(signal?: AbortSignal): Promise<ClinicSalaryPayout[]> {
    const response: unknown = await this.client.read("/v1/clinic/salary-payouts", signal);
    if (!validPayoutList(response)) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid salary payments list.");
    }
    return response.salaryPayouts;
  }

  async listStaff(signal?: AbortSignal): Promise<ClinicStaffProfile[]> {
    const response: unknown = await this.client.read("/v1/clinic/staff", signal);
    if (!validStaffList(response)) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid staff directory.");
    }
    return response.staff.filter((profile) => profile.status === "active");
  }

  create(input: SalaryPayoutWriteInput): ClinicCommand<SalaryPayoutWriteResponse> {
    return this.client.command("POST", "/v1/clinic/salary-payouts", input, validWriteResponse);
  }

  correct(id: string, replacement: SalaryPayoutWriteInput, reason: string): ClinicCommand<SalaryPayoutWriteResponse> {
    return this.client.command("POST", payoutPath(id, "correct"), { replacement, reason }, validWriteResponse);
  }

  voidPayout(id: string, reason: string): ClinicCommand<SalaryPayoutWriteResponse> {
    return this.client.command("POST", payoutPath(id, "void"), { reason }, validWriteResponse);
  }
}
