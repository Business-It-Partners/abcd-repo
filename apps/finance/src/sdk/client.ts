import type { FinanceAppBridge, FinanceClinicResponse } from "../runtimeBridge";

export type ClinicOutcome = "not_sent" | "rejected" | "unknown";
export type ClinicErrorCode =
  | "AUTH_REQUIRED" | "FORBIDDEN" | "ACCESS_DENIED" | "VALIDATION" | "CONFLICT"
  | "BUSY" | "INVALID_REQUEST" | "INVALID_RESPONSE" | "STALE_SESSION" | "CANCELLED";

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

export type AppHistory<T> = {
  current(): T;
  subscribe(listener: (page: T) => void): () => void;
  push(page: T): void;
  replace(page: T): void;
  reset(page: T): void;
  back(discardForward?: boolean): boolean;
  refresh(): void;
  dispose(): void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function responseMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) return fallback;
  if (typeof body.message === "string" && body.message.trim()) return body.message;
  if (isRecord(body.error) && typeof body.error.message === "string" && body.error.message.trim()) {
    return body.error.message;
  }
  return fallback;
}

function statusError(status: number, body: unknown, operationId?: string): ClinicError {
  const message = responseMessage(body, "The clinic rejected this request. Review the details and try again.");
  if (status === 401) return new ClinicError("AUTH_REQUIRED", "Your clinic session has expired. Sign in again.", "rejected", operationId);
  if (status === 403) return new ClinicError("FORBIDDEN", "Your clinic role does not permit this action.", "rejected", operationId);
  if (status === 409) return new ClinicError("CONFLICT", message || "This record changed elsewhere. Refresh and try again.", "rejected", operationId);
  if (status >= 400 && status < 500 && status !== 408) return new ClinicError("VALIDATION", message, "rejected", operationId);
  if (status < 200 || status >= 300) {
    return new ClinicError("INVALID_RESPONSE", "The save result is not confirmed. Check the original save before making another change.", "unknown", operationId);
  }
  return new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid response.", "unknown", operationId);
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
        throw new ClinicError(
          "INVALID_RESPONSE",
          "The save receipt is not confirmed. Check the original save before making another change.",
          "unknown",
          this.operationId,
        );
      }
      this.saved = result;
      this.completed = true;
      return result;
    } finally {
      this.running = false;
    }
  }
}

class BrowserAppHistory<T> implements AppHistory<T> {
  private entries: Array<{ id: string; page: T }>;
  private index = 0;
  private listeners = new Set<(page: T) => void>();
  private readonly onNavigateBack = () => {
    if (this.index <= 0 || !this.canNavigate()) return;
    this.index -= 1;
    this.publish();
    this.notify();
  };

  constructor(
    private readonly bridge: FinanceAppBridge,
    initialPage: T,
    private readonly canNavigate: () => boolean = () => true,
    private readonly backPreservesDraft: (page: T, previousPage?: T) => boolean = () => false,
  ) {
    this.entries = [{ id: crypto.randomUUID(), page: initialPage }];
    window.addEventListener("dental-os:navigate-back", this.onNavigateBack);
    this.publish();
  }

  current(): T { return this.entries[this.index].page; }

  subscribe(listener: (page: T) => void): () => void {
    this.listeners.add(listener);
    listener(this.current());
    return () => this.listeners.delete(listener);
  }

  push(page: T): void {
    this.entries = [...this.entries.slice(0, this.index + 1), { id: crypto.randomUUID(), page }];
    if (this.entries.length > 64) this.entries.shift();
    this.index = this.entries.length - 1;
    this.publish();
    this.notify();
  }

  replace(page: T): void {
    this.entries[this.index] = { ...this.entries[this.index], page };
    this.publish();
    this.notify();
  }

  reset(page: T): void {
    this.entries = [{ id: crypto.randomUUID(), page }];
    this.index = 0;
    this.publish();
    this.notify();
  }

  back(discardForward = false): boolean {
    if (this.index <= 0) return false;
    this.index -= 1;
    if (discardForward) this.entries = this.entries.slice(0, this.index + 1);
    this.publish();
    this.notify();
    return true;
  }

  refresh(): void { this.publish(); }

  dispose(): void {
    window.removeEventListener("dental-os:navigate-back", this.onNavigateBack);
    this.listeners.clear();
  }

  private publish(): void {
    const page = this.entries[this.index].page;
    const previousPage = this.index > 0 ? this.entries[this.index - 1].page : undefined;
    this.bridge.navigation.report({
      canGoBack: this.index > 0,
      canNavigate: this.canNavigate() || this.backPreservesDraft(page, previousPage),
    });
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.current());
  }
}

export class ClinicClient {
  constructor(private readonly bridge: FinanceAppBridge) {}

  async initialize(appId: string): Promise<{ session: { clinicUser: { capabilities: string[] } } }> {
    if (appId !== this.bridge.appId || appId !== "finance") {
      throw new ClinicError("FORBIDDEN", "The Finance session could not be verified.");
    }
    return { session: { clinicUser: { capabilities: [...this.bridge.capabilities] } } };
  }

  async read<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
    let response: FinanceClinicResponse;
    try {
      response = await this.bridge.request("GET", path, null, null);
    } catch (cause) {
      if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
      const code = cause instanceof Error ? (cause as Error & { code?: string }).code : undefined;
      if (code === "clinic_session_unavailable") throw new ClinicError("AUTH_REQUIRED", "A verified clinic session is required.", "rejected");
      if (code === "route_not_granted" || code === "clinic_access_denied") {
        throw new ClinicError("FORBIDDEN", "Your clinic role does not permit this request.", "rejected");
      }
      throw new ClinicError("INVALID_RESPONSE", "The clinic service could not be reached.");
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
      throw new ClinicError("INVALID_REQUEST", "This Finance change could not be prepared for saving.");
    }
    if (new TextEncoder().encode(body).byteLength > 12_000) {
      throw new ClinicError("INVALID_REQUEST", "This Finance request is too large to save.");
    }
    return new BrowserClinicCommand<T>(this, method, path, body, crypto.randomUUID(), valid);
  }

  async send<T>(command: ClinicCommand<T>): Promise<T> {
    let response: FinanceClinicResponse;
    try {
      response = await this.bridge.request(command.method, command.path, command.body, command.operationId);
    } catch (cause) {
      const code = cause instanceof Error ? (cause as Error & { code?: string }).code : undefined;
      if (code === "clinic_session_unavailable") {
        throw new ClinicError("AUTH_REQUIRED", "A verified clinic session is required.", "rejected", command.operationId);
      }
      if (code === "route_not_granted" || code === "clinic_access_denied" || code === "invalid_request") {
        throw new ClinicError("FORBIDDEN", "The clinic did not authorize this Finance change.", "rejected", command.operationId);
      }
      throw new ClinicError(
        "INVALID_RESPONSE",
        "The save result is not confirmed. Check the original save before making another change.",
        "unknown",
        command.operationId,
      );
    }
    if (!response || !Number.isInteger(response.status) || !Object.hasOwn(response, "body")) {
      throw new ClinicError(
        "INVALID_RESPONSE",
        "The save result is not confirmed. Check the original save before making another change.",
        "unknown",
        command.operationId,
      );
    }
    if (response.status < 200 || response.status >= 300) {
      throw statusError(response.status, response.body, command.operationId);
    }
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
