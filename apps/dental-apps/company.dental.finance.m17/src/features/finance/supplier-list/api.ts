import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import { supplierPaymentMethods, supplierPaymentScopes, supplierTypes } from "./types";
import type {
  ClinicPurchase,
  ClinicPurchaseLine,
  ClinicSupplier,
  ClinicSupplierPayment,
  ClinicSupplierStatement,
  SupplierPaymentWriteInput,
  SupplierStatementEntry,
  SupplierPaymentCorrectionInput,
  SupplierPaymentVoidInput,
  SupplierUpdateInput,
  SupplierWriteInput,
  SupplierWriteResponse,
  SupplierPaymentWriteResponse,
} from "./types";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const supplierTypeSet = new Set<string>(supplierTypes);
const paymentMethodSet = new Set<string>(supplierPaymentMethods);
const paymentScopeSet = new Set<string>(supplierPaymentScopes);

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function validSupplier(value: unknown): value is ClinicSupplier {
  return record(value)
    && typeof value.supplierId === "string" && idPattern.test(value.supplierId)
    && typeof value.name === "string" && value.name.length > 0
    && typeof value.supplierType === "string" && supplierTypeSet.has(value.supplierType)
    && nullableString(value.contactPerson)
    && nullableString(value.phone)
    && nullableString(value.email)
    && nullableString(value.address)
    && finiteNumber(value.openingBalanceAmount)
    && validDate(value.openingBalanceAsOf)
    && typeof value.active === "boolean"
    && finiteNumber(value.currentDueAmount)
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
    && typeof value.rowVersion === "number" && Number.isSafeInteger(value.rowVersion) && value.rowVersion >= 1;
}

function validSupplierList(value: unknown): value is { suppliers: ClinicSupplier[] } {
  return record(value) && Array.isArray(value.suppliers) && value.suppliers.every(validSupplier);
}

function validSupplierWrite(value: unknown): value is SupplierWriteResponse {
  return record(value) && validSupplier(value.supplier);
}

function validStatementEntry(value: unknown): value is SupplierStatementEntry {
  return record(value)
    && typeof value.key === "string"
    && (value.kind === "opening" || value.kind === "purchase" || value.kind === "payment")
    && validDate(value.date)
    && typeof value.description === "string"
    && (value.due === null || finiteNumber(value.due))
    && (value.paid === null || finiteNumber(value.paid))
    && finiteNumber(value.balance);
}

function validSupplierStatement(value: unknown): value is ClinicSupplierStatement {
  return record(value)
    && validSupplier(value.supplier)
    && finiteNumber(value.totalPurchasedAmount)
    && finiteNumber(value.totalPaidAmount)
    && finiteNumber(value.currentDueAmount)
    && Array.isArray(value.entries) && value.entries.every(validStatementEntry);
}

function validStatementResponse(value: unknown): value is { statement: ClinicSupplierStatement } {
  return record(value) && validSupplierStatement(value.statement);
}

function validPurchaseLine(value: unknown): value is ClinicPurchaseLine {
  return record(value)
    && typeof value.purchaseLineId === "string" && idPattern.test(value.purchaseLineId)
    && (value.productId === null || (typeof value.productId === "string" && idPattern.test(value.productId)))
    && typeof value.itemName === "string"
    && finiteNumber(value.quantity) && value.quantity > 0
    && nullableString(value.unit)
    && finiteNumber(value.rate) && value.rate >= 0
    && finiteNumber(value.amount) && value.amount >= 0
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
    && (value.purchaseType === "product" || value.purchaseType === "lab_service")
    && finiteNumber(value.subtotalAmount) && value.subtotalAmount >= 0
    && finiteNumber(value.discountAmount) && value.discountAmount >= 0
    && finiteNumber(value.totalAmount) && value.totalAmount >= 0
    && nullableString(value.note)
    && (value.status === "recorded" || value.status === "voided")
    && typeof value.recordedAt === "string"
    && nullableString(value.correctsPurchaseId)
    && nullableString(value.voidedAt)
    && nullableString(value.voidReason)
    && Array.isArray(value.lines) && value.lines.every(validPurchaseLine);
}

function validPurchaseList(value: unknown): value is { purchases: ClinicPurchase[] } {
  return record(value) && Array.isArray(value.purchases) && value.purchases.every(validPurchase);
}

function validSupplierPayment(value: unknown): value is ClinicSupplierPayment {
  return record(value)
    && typeof value.supplierPaymentId === "string" && idPattern.test(value.supplierPaymentId)
    && typeof value.supplierId === "string" && idPattern.test(value.supplierId)
    && typeof value.supplierName === "string"
    && typeof value.branchId === "string" && idPattern.test(value.branchId)
    && validDate(value.paymentDate)
    && finiteNumber(value.amount) && value.amount > 0
    && typeof value.paymentMethod === "string" && paymentMethodSet.has(value.paymentMethod)
    && nullableString(value.paymentReference)
    && nullableString(value.purchaseId)
    && typeof value.paymentScope === "string" && paymentScopeSet.has(value.paymentScope)
    && nullableString(value.note)
    && (value.status === "recorded" || value.status === "voided")
    && typeof value.recordedAt === "string"
    && nullableString(value.voidedAt)
    && nullableString(value.voidReason);
}

function validSupplierPaymentList(value: unknown): value is { supplierPayments: ClinicSupplierPayment[] } {
  return record(value) && Array.isArray(value.supplierPayments) && value.supplierPayments.every(validSupplierPayment);
}

function validSupplierPaymentWrite(value: unknown): value is SupplierPaymentWriteResponse {
  return record(value) && validSupplierPayment(value.supplierPayment);
}

function supplierPath(id: string, suffix = ""): string {
  if (!idPattern.test(id)) throw new ClinicError("INVALID_REQUEST", "The supplier identifier is invalid.");
  return `/v1/clinic/suppliers/${id}${suffix}`;
}

function supplierPaymentPath(id: string, action: "correct" | "void"): string {
  if (!idPattern.test(id)) throw new ClinicError("INVALID_REQUEST", "The supplier payment identifier is invalid.");
  return `/v1/clinic/supplier-payments/${id}/${action}`;
}

export class SupplierListApi {
  constructor(private readonly client: ClinicClient) {}

  async listSuppliers(signal?: AbortSignal): Promise<ClinicSupplier[]> {
    const response: unknown = await this.client.read("/v1/clinic/suppliers", signal);
    if (!validSupplierList(response)) throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid supplier list.");
    return response.suppliers;
  }

  async supplierStatement(supplierId: string, signal?: AbortSignal): Promise<ClinicSupplierStatement> {
    const response: unknown = await this.client.read(supplierPath(supplierId, "/statement"), signal);
    if (!validStatementResponse(response)) throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid supplier statement.");
    return response.statement;
  }

  async listPurchases(signal?: AbortSignal): Promise<ClinicPurchase[]> {
    const response: unknown = await this.client.read("/v1/clinic/purchases", signal);
    if (!validPurchaseList(response)) throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid purchase list.");
    return response.purchases;
  }

  async listSupplierPayments(signal?: AbortSignal): Promise<ClinicSupplierPayment[]> {
    const response: unknown = await this.client.read("/v1/clinic/supplier-payments", signal);
    if (!validSupplierPaymentList(response)) throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid supplier-payment list.");
    return response.supplierPayments;
  }

  createSupplier(input: SupplierWriteInput): ClinicCommand<SupplierWriteResponse> {
    return this.client.command("POST", "/v1/clinic/suppliers", input, validSupplierWrite);
  }

  updateSupplier(id: string, input: SupplierUpdateInput): ClinicCommand<SupplierWriteResponse> {
    return this.client.command("PATCH", supplierPath(id), input, validSupplierWrite);
  }

  createPayment(input: SupplierPaymentWriteInput): ClinicCommand<SupplierPaymentWriteResponse> {
    return this.client.command("POST", "/v1/clinic/supplier-payments", input, validSupplierPaymentWrite);
  }

  correctPayment(id: string, input: SupplierPaymentCorrectionInput): ClinicCommand<SupplierPaymentWriteResponse> {
    return this.client.command("POST", supplierPaymentPath(id, "correct"), input, validSupplierPaymentWrite);
  }

  voidPayment(id: string, input: SupplierPaymentVoidInput): ClinicCommand<SupplierPaymentWriteResponse> {
    return this.client.command("POST", supplierPaymentPath(id, "void"), input, validSupplierPaymentWrite);
  }
}
