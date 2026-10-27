import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import { productCategories, productUnits } from "./types";
import type { ClinicProduct, ProductPurchase, ProductPurchaseLine, ProductUpdateInput, ProductWriteInput, ProductWriteResponse } from "./types";

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const categorySet = new Set<string>(productCategories);
const unitSet = new Set<string>(productUnits);

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

function validProduct(value: unknown): value is ClinicProduct {
  return record(value)
    && typeof value.productId === "string" && idPattern.test(value.productId)
    && typeof value.name === "string" && value.name.length > 0
    && typeof value.category === "string" && categorySet.has(value.category)
    && typeof value.unit === "string" && unitSet.has(value.unit)
    && nullableString(value.note)
    && typeof value.active === "boolean"
    && typeof value.createdAt === "string"
    && typeof value.updatedAt === "string"
    && typeof value.rowVersion === "number" && Number.isSafeInteger(value.rowVersion) && value.rowVersion >= 1;
}

function validProductList(value: unknown): value is { products: ClinicProduct[] } {
  return record(value) && Array.isArray(value.products) && value.products.every(validProduct);
}

function validProductWrite(value: unknown): value is ProductWriteResponse {
  return record(value) && validProduct(value.product);
}

function validPurchaseLine(value: unknown): value is ProductPurchaseLine {
  return record(value)
    && typeof value.purchaseLineId === "string" && idPattern.test(value.purchaseLineId)
    && (value.productId === null || (typeof value.productId === "string" && idPattern.test(value.productId)))
    && typeof value.itemName === "string"
    && typeof value.quantity === "number" && Number.isFinite(value.quantity) && value.quantity > 0
    && nullableString(value.unit)
    && typeof value.rate === "number" && Number.isFinite(value.rate) && value.rate >= 0
    && typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount >= 0
    && nullableString(value.note);
}

function validPurchase(value: unknown): value is ProductPurchase {
  return record(value)
    && typeof value.purchaseId === "string" && idPattern.test(value.purchaseId)
    && typeof value.supplierId === "string" && idPattern.test(value.supplierId)
    && typeof value.supplierName === "string"
    && typeof value.branchId === "string" && idPattern.test(value.branchId)
    && validDate(value.purchaseDate)
    && nullableString(value.invoiceNumber)
    && (value.purchaseType === "product" || value.purchaseType === "lab_service")
    && typeof value.subtotalAmount === "number" && Number.isFinite(value.subtotalAmount) && value.subtotalAmount >= 0
    && typeof value.discountAmount === "number" && Number.isFinite(value.discountAmount) && value.discountAmount >= 0
    && typeof value.totalAmount === "number" && Number.isFinite(value.totalAmount) && value.totalAmount >= 0
    && nullableString(value.note)
    && (value.status === "recorded" || value.status === "voided")
    && typeof value.recordedAt === "string"
    && nullableString(value.correctsPurchaseId)
    && nullableString(value.voidedAt)
    && nullableString(value.voidReason)
    && Array.isArray(value.lines) && value.lines.every(validPurchaseLine);
}

function validPurchaseList(value: unknown): value is { purchases: ProductPurchase[] } {
  return record(value) && Array.isArray(value.purchases) && value.purchases.every(validPurchase);
}

function productPath(id: string): string {
  if (!idPattern.test(id)) throw new ClinicError("INVALID_REQUEST", "The product identifier is invalid.");
  return `/v1/clinic/products/${id}`;
}

export class ProductListApi {
  constructor(private readonly client: ClinicClient) {}

  async listProducts(signal?: AbortSignal): Promise<ClinicProduct[]> {
    const response: unknown = await this.client.read("/v1/clinic/products", signal);
    if (!validProductList(response)) throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid product list.");
    return response.products;
  }

  async listPurchases(signal?: AbortSignal): Promise<ProductPurchase[]> {
    const response: unknown = await this.client.read("/v1/clinic/purchases", signal);
    if (!validPurchaseList(response)) throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid purchase history.");
    return response.purchases;
  }

  create(input: ProductWriteInput): ClinicCommand<ProductWriteResponse> {
    return this.client.command("POST", "/v1/clinic/products", input, validProductWrite);
  }

  update(id: string, input: ProductUpdateInput): ClinicCommand<ProductWriteResponse> {
    return this.client.command("PATCH", productPath(id), input, validProductWrite);
  }
}
