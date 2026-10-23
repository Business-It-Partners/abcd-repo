import { ClinicError, type ClinicClient } from "@/sdk/client";
import type { ClinicTransactionRecordReport, TransactionRecordKind } from "./types";

const kinds = new Set<TransactionRecordKind>([
  "patient_payment",
  "operating_expense",
  "salary_payout",
  "supplier_payment",
]);
const overviewFields = [
  "patientOutstandingDueAmount",
  "generalExpenseAmount",
  "purchaseAmount",
  "supplierPayoutAmount",
  "salaryPayoutAmount",
  "currentSupplierOutstandingAmount",
  "labPurchaseAmount",
  "labPayoutAmount",
  "currentLabOutstandingAmount",
] as const;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validReport(value: unknown): value is ClinicTransactionRecordReport {
  if (!record(value) || !Array.isArray(value.transactions)) return false;
  if (!finiteNumber(value.cashInTotal) || value.cashInTotal < 0
    || !finiteNumber(value.cashOutTotal) || value.cashOutTotal < 0
    || !finiteNumber(value.netCashAmount) || !record(value.overview)) return false;
  if (!overviewFields.every((field) => finiteNumber(value.overview[field]))) return false;

  return value.transactions.every((item) => record(item)
    && typeof item.transactionId === "string" && item.transactionId.length > 0
    && typeof item.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
    && typeof item.kind === "string" && kinds.has(item.kind as TransactionRecordKind)
    && typeof item.description === "string"
    && (item.paymentMethod === null || typeof item.paymentMethod === "string")
    && finiteNumber(item.cashInAmount) && item.cashInAmount >= 0
    && finiteNumber(item.cashOutAmount) && item.cashOutAmount >= 0);
}

export class TransactionRecordApi {
  constructor(private readonly client: ClinicClient) {}

  async transactionRecord(from?: string, to?: string, signal?: AbortSignal): Promise<ClinicTransactionRecordReport> {
    const query = new URLSearchParams();
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    const queryString = query.toString();
    const response: unknown = await this.client.read(
      `/v1/clinic/transaction-record${queryString ? `?${queryString}` : ""}`,
      signal,
    );
    if (!record(response) || !validReport(response.report)) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid transaction report.");
    }
    return response.report;
  }
}
