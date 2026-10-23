import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import type {
  PatientLedger,
  PatientLedgerEntry,
  PatientPaymentInput,
  PatientPaymentMethod,
  PatientPaymentResponse,
  PatientPaymentsReport,
} from "./types";

const paymentMethods = new Set<PatientPaymentMethod>([
  "cash",
  "esewa",
  "khalti",
  "card",
  "bank_transfer",
  "cheque",
]);
const ledgerTypes = new Set<PatientLedgerEntry["entryType"]>([
  "charge",
  "payment",
  "correction",
  "reversal",
]);
const patientIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function validReport(value: unknown): value is PatientPaymentsReport {
  if (!record(value) || !Array.isArray(value.received) || !Array.isArray(value.outstanding)) return false;
  const receivedValid = value.received.every((item) => record(item)
    && typeof item.patientLedgerEntryId === "string" && item.patientLedgerEntryId.length > 0
    && patientIdPattern.test(String(item.patientId))
    && typeof item.patientNumber === "string"
    && typeof item.patientName === "string"
    && typeof item.paymentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.paymentDate)
    && typeof item.recordedAt === "string"
    && finiteNumber(item.amount) && item.amount >= 0
    && finiteNumber(item.discountAmount) && item.discountAmount >= 0
    && typeof item.paymentMethod === "string" && paymentMethods.has(item.paymentMethod as PatientPaymentMethod)
    && nullableString(item.receiptNumber));
  const outstandingValid = value.outstanding.every((item) => record(item)
    && patientIdPattern.test(String(item.patientId))
    && typeof item.patientNumber === "string"
    && typeof item.patientName === "string"
    && typeof item.planTitle === "string"
    && finiteNumber(item.currentDueAmount) && item.currentDueAmount >= 0);
  return receivedValid && outstandingValid;
}

function validLedgerEntry(value: unknown): value is PatientLedgerEntry {
  return record(value)
    && typeof value.patientLedgerEntryId === "string" && value.patientLedgerEntryId.length > 0
    && typeof value.entryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.entryDate)
    && typeof value.recordedAt === "string"
    && typeof value.entryType === "string" && ledgerTypes.has(value.entryType as PatientLedgerEntry["entryType"])
    && finiteNumber(value.amount) && value.amount >= 0
    && finiteNumber(value.discountAmount) && value.discountAmount >= 0
    && (value.paymentMethod === null || (typeof value.paymentMethod === "string" && paymentMethods.has(value.paymentMethod as PatientPaymentMethod)))
    && nullableString(value.receiptNumber)
    && nullableString(value.forLabel)
    && nullableString(value.note)
    && nullableString(value.reversesEntryId)
    && nullableString(value.supersedesEntryId)
    && nullableString(value.correctionReason)
    && Number.isInteger(value.rowVersion) && Number(value.rowVersion) >= 0
    && finiteNumber(value.runningBalance);
}

function validLedger(value: unknown): value is PatientLedger {
  if (!record(value) || !record(value.summary) || !Array.isArray(value.entries)) return false;
  const summary = value.summary;
  return finiteNumber(summary.totalBilled) && summary.totalBilled >= 0
    && finiteNumber(summary.totalCollected) && summary.totalCollected >= 0
    && finiteNumber(summary.totalDiscount) && summary.totalDiscount >= 0
    && finiteNumber(summary.outstandingDue) && summary.outstandingDue >= 0
    && value.entries.every(validLedgerEntry)
    && nullableString(value.nextCursor);
}

function validPaymentResponse(value: unknown): value is PatientPaymentResponse {
  if (!record(value) || !record(value.payment)) return false;
  const payment = value.payment;
  return typeof payment.patientLedgerEntryId === "string" && payment.patientLedgerEntryId.length > 0
    && typeof payment.receiptNumber === "string" && payment.receiptNumber.length > 0
    && finiteNumber(payment.amount) && payment.amount >= 0
    && finiteNumber(payment.discountAmount) && payment.discountAmount >= 0
    && finiteNumber(payment.currentDueAmount) && payment.currentDueAmount >= 0;
}

function patientPath(patientId: string, resource: "ledger" | "payments"): string {
  if (!patientIdPattern.test(patientId)) throw new ClinicError("INVALID_REQUEST", "The patient identifier is invalid.");
  return `/v1/patients/${patientId}/${resource}`;
}

export class PatientPaymentsApi {
  constructor(private readonly client: ClinicClient) {}

  async report(from?: string, to?: string, signal?: AbortSignal): Promise<PatientPaymentsReport> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const queryString = query.toString();
    const response: unknown = await this.client.read(
      `/v1/patient-payments${queryString ? `?${queryString}` : ""}`,
      signal,
    );
    if (!validReport(response)) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid patient payments report.");
    }
    return response;
  }

  async ledger(patientId: string, cursor?: string, month?: string, signal?: AbortSignal): Promise<PatientLedger> {
    const query = new URLSearchParams();
    if (month) query.set("month", month);
    if (cursor) query.set("cursor", cursor);
    const queryString = query.toString();
    const response: unknown = await this.client.read(
      `${patientPath(patientId, "ledger")}${queryString ? `?${queryString}` : ""}`,
      signal,
    );
    if (!record(response) || !validLedger(response.ledger)) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid patient ledger.");
    }
    return response.ledger;
  }

  createPayment(input: PatientPaymentInput): ClinicCommand<PatientPaymentResponse> {
    return this.client.command(
      "POST",
      patientPath(input.patientId, "payments"),
      input,
      validPaymentResponse,
    );
  }
}
