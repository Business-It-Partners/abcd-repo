import { BrowserAppHistory, type AppHistory } from "./routing/appHistory";

export type ClinicOutcome = "not_sent" | "rejected" | "unknown";
export type ClinicErrorCode =
  | "AUTH_REQUIRED" | "FORBIDDEN" | "VALIDATION" | "CONFLICT" | "BUSY"
  | "INVALID_REQUEST" | "INVALID_RESPONSE" | "STALE_SESSION" | "CANCELLED";

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

export type ClinicResponse<T> = { status: number; body: T };
export type BrowserAppBridge = {
  request(method: string, path: string, body?: string | null, idempotencyKey?: string | null): Promise<ClinicResponse<unknown>>;
  reportLifecycle(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void;
  navigation: {
    report(value: { canGoBack: boolean; canNavigate: boolean }): void;
  };
};

declare global {
  interface Window { dentalOSAppApi?: BrowserAppBridge; }
}

function statusError(status: number, operationId?: string): ClinicError {
  if (status === 401) return new ClinicError("AUTH_REQUIRED", "Your clinic session has expired. Sign in again.", "rejected", operationId);
  if (status === 403) return new ClinicError("FORBIDDEN", "Your clinic role does not permit this action.", "rejected", operationId);
  if (status === 409) return new ClinicError("CONFLICT", "This protocol changed elsewhere. Refresh the list and try again.", "rejected", operationId);
  if (status >= 400 && status < 500 && status !== 408) return new ClinicError("VALIDATION", "The clinic rejected this save. Review the details and try again.", "rejected", operationId);
  if (status < 200 || status >= 300) return new ClinicError("INVALID_RESPONSE", "The save result is not confirmed. Check the original save before making another change.", "unknown", operationId);
  return new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid response.", "unknown", operationId);
}

export class BrowserClinicCommand<T> {
  private running = false;
  private completed = false;
  private saved?: T;

  constructor(
    private readonly client: BrowserClinicClient,
    readonly method: "POST" | "PUT",
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
      const value = await this.client.send<T>(this);
      if (!this.valid(value)) throw new ClinicError("INVALID_RESPONSE", "The save receipt is not confirmed. Check the original save before making another change.", "unknown", this.operationId);
      this.saved = value;
      this.completed = true;
      return value;
    } finally {
      this.running = false;
    }
  }
}

export class BrowserClinicClient {
  private invalid = false;

  constructor(private readonly bridge: BrowserAppBridge) {}

  async read<T>(path: string): Promise<T> {
    if (this.invalid) throw new ClinicError("STALE_SESSION", "Clinic session changed. Reopen Treatment Protocols.");
    let response: ClinicResponse<unknown>;
    try {
      response = await this.bridge.request("GET", path, null, null);
    } catch (cause) {
      if (cause instanceof Error && (cause as Error & { code?: string }).code === "clinic_session_unavailable") {
        this.invalid = true;
        throw new ClinicError("AUTH_REQUIRED", "A verified clinic session is required.");
      }
      throw new ClinicError("INVALID_RESPONSE", "The clinic service could not be reached.");
    }
    if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status >= 300 || !Object.hasOwn(response, "body")) {
      throw statusError(response?.status ?? 0);
    }
    return response.body as T;
  }

  command<T>(
    method: "POST" | "PUT",
    path: string,
    body: unknown,
    valid: (value: unknown) => boolean = () => true,
  ): BrowserClinicCommand<T> {
    let serialized: string;
    try {
      serialized = JSON.stringify(body);
    } catch {
      throw new ClinicError("INVALID_REQUEST", "This treatment protocol could not be prepared for saving.");
    }
    if (typeof serialized !== "string" || serialized.length > 12_000) {
      throw new ClinicError("INVALID_REQUEST", "This treatment protocol is too large to save.");
    }
    return new BrowserClinicCommand<T>(this, method, path, serialized, crypto.randomUUID(), valid);
  }

  async send<T>(command: BrowserClinicCommand<T>): Promise<T> {
    if (this.invalid) throw new ClinicError("STALE_SESSION", "Clinic session changed. Reopen Treatment Protocols.", "not_sent", command.operationId);
    let response: ClinicResponse<unknown>;
    try {
      response = await this.bridge.request(command.method, command.path, command.body, command.operationId);
    } catch (cause) {
      const code = cause instanceof Error ? (cause as Error & { code?: string }).code : undefined;
      if (code === "clinic_session_unavailable" || code === "clinic_access_denied" || code === "route_not_granted") {
        if (code === "clinic_session_unavailable") this.invalid = true;
        throw new ClinicError(code === "clinic_session_unavailable" ? "AUTH_REQUIRED" : "FORBIDDEN",
          "The clinic did not authorize this save.", "rejected", command.operationId);
      }
      throw new ClinicError("INVALID_RESPONSE", "The save result is not confirmed. Check the original save before making another change.", "unknown", command.operationId);
    }
    if (!response || !Number.isInteger(response.status) || !Object.hasOwn(response, "body")) {
      throw new ClinicError("INVALID_RESPONSE", "The save result is not confirmed. Check the original save before making another change.", "unknown", command.operationId);
    }
    if (response.status < 200 || response.status >= 300) throw statusError(response.status, command.operationId);
    return response.body as T;
  }

  report(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void {
    this.bridge.reportLifecycle(value);
  }

  createHistory<T>(
    initialPage: T,
    canNavigate: () => boolean = () => true,
    backPreservesDraft: (page: T, previousPage?: T) => boolean = () => false,
  ): AppHistory<T> {
    return new BrowserAppHistory(this.bridge, initialPage, canNavigate, backPreservesDraft);
  }
}
