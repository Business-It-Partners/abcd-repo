import type { BrowserRuntimeBridge, ClinicResponse } from "../runtimeBridge";

export type ClinicOutcome = "not_sent" | "rejected" | "unknown";
export type ClinicErrorCode =
  | "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "BUSY"
  | "INVALID_REQUEST" | "INVALID_RESPONSE" | "CANCELLED";

export class ClinicError extends Error {
  constructor(
    readonly code: ClinicErrorCode,
    message: string,
    readonly outcome: ClinicOutcome = "not_sent",
    readonly operationId?: string,
  ) {
    super(message);
    this.name = "ClinicError";
  }
}

export type ClinicCommand<T> = {
  readonly method: "POST" | "PUT" | "PATCH";
  readonly path: string;
  readonly body: string;
  readonly operationId: string;
  execute(): Promise<T>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function responseMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) return fallback;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (isRecord(body.error) && typeof body.error.message === "string" && body.error.message.trim()) return body.error.message;
  return fallback;
}

function statusError(status: number, body: unknown, operationId?: string): ClinicError {
  const message = responseMessage(body, "The clinic rejected this request. Review the details and try again.");
  if (status === 401) return new ClinicError("AUTH_REQUIRED", "Your clinic session has expired. Sign in again.", "rejected", operationId);
  if (status === 403) return new ClinicError("FORBIDDEN", "Your clinic role does not permit this action.", "rejected", operationId);
  if (status === 409) return new ClinicError("CONFLICT", message, "rejected", operationId);
  if (status >= 400 && status < 500 && status !== 408) return new ClinicError("VALIDATION", message, "rejected", operationId);
  return new ClinicError("INVALID_RESPONSE", "The save result is not confirmed. Check the original save before making another change.", "unknown", operationId);
}

function bridgeError(cause: unknown, operationId?: string): ClinicError {
  const code = cause instanceof Error ? (cause as Error & { code?: string }).code : undefined;
  if (code === "clinic_session_unavailable") return new ClinicError("AUTH_REQUIRED", "A verified clinic session is required.", "rejected", operationId);
  if (code === "route_not_granted" || code === "clinic_access_denied" || code === "invalid_request") {
    return new ClinicError("FORBIDDEN", "The clinic host did not authorize this request.", "rejected", operationId);
  }
  if (code === "invalid_clinic_response") return new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid response.", "rejected", operationId);
  return new ClinicError(
    "INVALID_RESPONSE",
    operationId
      ? "The save result is not confirmed. Check the original save before making another change."
      : "The clinic service could not be reached.",
    operationId ? "unknown" : "rejected",
    operationId,
  );
}

class BrowserClinicCommand<T> implements ClinicCommand<T> {
  private running = false;
  private completed = false;
  private saved?: T;

  constructor(
    private readonly client: ClinicClient,
    readonly method: "POST" | "PUT" | "PATCH",
    readonly path: string,
    readonly body: string,
    readonly operationId: string,
    private readonly valid: (value: unknown) => boolean,
  ) {}

  async execute(): Promise<T> {
    if (this.completed) return this.saved as T;
    if (this.running) throw new ClinicError("BUSY", "This save is already running.");
    this.running = true;
    try {
      const result = await this.client.send<T>(this);
      if (!this.valid(result)) {
        throw new ClinicError("INVALID_RESPONSE", "The save receipt is not confirmed. Check the original save before making another change.", "unknown", this.operationId);
      }
      this.saved = result;
      this.completed = true;
      return result;
    } finally {
      this.running = false;
    }
  }
}

export class ClinicClient {
  constructor(private readonly bridge: BrowserRuntimeBridge) {}

  async read<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
    let response: ClinicResponse;
    try {
      response = await this.bridge.request("GET", path, null, null);
    } catch (cause) {
      if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
      throw bridgeError(cause);
    }
    if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
    if (!response || !Number.isInteger(response.status) || !Object.hasOwn(response, "body")) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid response.");
    }
    if (response.status < 200 || response.status >= 300) throw statusError(response.status, response.body);
    return response.body as T;
  }

  command<T>(
    method: "POST" | "PUT" | "PATCH",
    path: string,
    input: unknown,
    valid: (value: unknown) => boolean = () => true,
  ): ClinicCommand<T> {
    let body: string;
    try {
      if (!isRecord(input)) throw new Error("Expected a JSON object.");
      body = JSON.stringify(input);
    } catch {
      throw new ClinicError("INVALID_REQUEST", "This Calendar change could not be prepared for saving.");
    }
    if (new TextEncoder().encode(body).byteLength > 12_000) {
      throw new ClinicError("INVALID_REQUEST", "This Calendar request is too large to save.");
    }
    return new BrowserClinicCommand<T>(this, method, path, body, crypto.randomUUID(), valid);
  }

  async send<T>(command: ClinicCommand<T>): Promise<T> {
    let response: ClinicResponse;
    try {
      response = await this.bridge.request(command.method, command.path, command.body, command.operationId);
    } catch (cause) {
      throw bridgeError(cause, command.operationId);
    }
    if (!response || !Number.isInteger(response.status) || !Object.hasOwn(response, "body")) {
      throw new ClinicError("INVALID_RESPONSE", "The save result is not confirmed. Check the original save before making another change.", "unknown", command.operationId);
    }
    if (response.status < 200 || response.status >= 300) throw statusError(response.status, response.body, command.operationId);
    return response.body as T;
  }

  report(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void {
    this.bridge.reportLifecycle(value);
  }
}
