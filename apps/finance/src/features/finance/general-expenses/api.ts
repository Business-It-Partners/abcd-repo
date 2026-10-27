import { ClinicError, type ClinicClient, type ClinicCommand } from "@/sdk/client";
import { operatingExpenseCategories, operatingExpensePaymentMethods } from "./types";
import type {
  ClinicOperatingExpense,
  OperatingExpenseWriteInput,
  OperatingExpenseWriteResponse,
} from "./types";

const expenseIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const categories = new Set<string>(operatingExpenseCategories);
const paymentMethods = new Set<string>(operatingExpensePaymentMethods);

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

function validExpense(value: unknown): value is ClinicOperatingExpense {
  return record(value)
    && typeof value.operatingExpenseId === "string" && expenseIdPattern.test(value.operatingExpenseId)
    && typeof value.branchId === "string" && expenseIdPattern.test(value.branchId)
    && validDate(value.expenseDate)
    && typeof value.category === "string" && categories.has(value.category)
    && typeof value.amount === "number" && Number.isFinite(value.amount) && value.amount > 0 && value.amount <= 100_000_000
    && nullableString(value.payee)
    && typeof value.paymentMethod === "string" && paymentMethods.has(value.paymentMethod)
    && nullableString(value.paymentReference)
    && nullableString(value.note)
    && (value.status === "recorded" || value.status === "voided")
    && nullableString(value.voidedAt)
    && nullableString(value.voidReason)
    && typeof value.createdAt === "string";
}

function validExpenseList(value: unknown): value is { operatingExpenses: ClinicOperatingExpense[] } {
  return record(value)
    && Array.isArray(value.operatingExpenses)
    && value.operatingExpenses.every(validExpense);
}

function validExpenseWrite(value: unknown): value is OperatingExpenseWriteResponse {
  return record(value) && validExpense(value.operatingExpense);
}

function expensePath(id: string, action?: "correct" | "void"): string {
  if (!expenseIdPattern.test(id)) throw new ClinicError("INVALID_REQUEST", "The expense identifier is invalid.");
  return `/v1/clinic/operating-expenses/${id}${action ? `/${action}` : ""}`;
}

export class GeneralExpensesApi {
  constructor(private readonly client: ClinicClient) {}

  async list(signal?: AbortSignal): Promise<ClinicOperatingExpense[]> {
    const response: unknown = await this.client.read("/v1/clinic/operating-expenses", signal);
    if (!validExpenseList(response)) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid general expenses list.");
    }
    return response.operatingExpenses;
  }

  create(input: OperatingExpenseWriteInput): ClinicCommand<OperatingExpenseWriteResponse> {
    return this.client.command(
      "POST",
      "/v1/clinic/operating-expenses",
      input,
      validExpenseWrite,
    );
  }

  correct(id: string, replacement: OperatingExpenseWriteInput, reason: string): ClinicCommand<OperatingExpenseWriteResponse> {
    return this.client.command(
      "POST",
      expensePath(id, "correct"),
      { replacement, reason },
      validExpenseWrite,
    );
  }

  voidExpense(id: string, reason: string): ClinicCommand<OperatingExpenseWriteResponse> {
    return this.client.command(
      "POST",
      expensePath(id, "void"),
      { reason },
      validExpenseWrite,
    );
  }
}
