import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import { purchaseTypes } from "./types";
import type { ClinicPurchase, PurchaseCorrectionInput, PurchaseVoidInput, PurchaseWriteInput, PurchaseWriteResponse } from "./types";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const purchaseTypeSet = new Set<string>(purchaseTypes);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function finiteNumber(value: unknown, minimum = 0): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= minimum;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validLine(value: unknown): boolean {
  return record(value)
    && typeof value.purchaseLineId === "string" && idPattern.test(value.purchaseLineId)
    && (value.productId === null || (typeof value.productId === "string" && idPattern.test(value.productId)))
    && typeof value.itemName === "string"
    && finiteNumber(value.quantity, Number.MIN_VALUE)
    && nullableString(value.unit)
    && finiteNumber(value.rate)
    && finiteNumber(value.amount)
    && nullableString(value.note);
}

function validPurchase(value: unknown): value is ClinicPurchase {
  return record(value)
    && typeof value.purchaseId === "string" && idPattern.test(value.purchaseId)
    && typeof value.supplierId === "string" && idPattern.test(value.supplierId)
    && typeof value.supplierName === "string"
    && typeof value.branchId === "string" && idPattern.test(value.branchId)
    && validDate(value.purchaseDate)
    && nullableString(value.invoiceNumber)
    && typeof value.purchaseType === "string" && purchaseTypeSet.has(value.purchaseType)
    && finiteNumber(value.subtotalAmount)
    && finiteNumber(value.discountAmount)
    && finiteNumber(value.totalAmount)
    && nullableString(value.note)
    && (value.status === "recorded" || value.status === "voided")
    && typeof value.recordedAt === "string"
    && nullableString(value.correctsPurchaseId)
    && nullableString(value.voidedAt)
    && nullableString(value.voidReason)
    && Array.isArray(value.lines) && value.lines.every(validLine);
}

function validPurchaseList(value: unknown): value is { purchases: ClinicPurchase[] } {
  return record(value) && Array.isArray(value.purchases) && value.purchases.every(validPurchase);
}

function validPurchaseWriteResponse(value: unknown): value is PurchaseWriteResponse {
  return record(value) && validPurchase(value.purchase);
}

function purchasePath(id: string, action: "correct" | "void"): string {
  if (!idPattern.test(id)) throw new ClinicError("INVALID_REQUEST", "The purchase identifier is invalid.");
  return `/v1/clinic/purchases/${id}/${action}`;
}

export class PurchasesApi {
  constructor(private readonly client: ClinicClient) {}

  async list(signal?: AbortSignal): Promise<ClinicPurchase[]> {
    const response: unknown = await this.client.read("/v1/clinic/purchases", signal);
    if (!validPurchaseList(response)) throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid purchase list.");
    return response.purchases;
  }

  create(input: PurchaseWriteInput): ClinicCommand<PurchaseWriteResponse> {
    return this.client.command("POST", "/v1/clinic/purchases", input, validPurchaseWriteResponse);
  }

  correct(id: string, input: PurchaseCorrectionInput): ClinicCommand<PurchaseWriteResponse> {
    return this.client.command("POST", purchasePath(id, "correct"), input, validPurchaseWriteResponse);
  }

  void(id: string, input: PurchaseVoidInput): ClinicCommand<PurchaseWriteResponse> {
    return this.client.command("POST", purchasePath(id, "void"), input, validPurchaseWriteResponse);
  }
}
