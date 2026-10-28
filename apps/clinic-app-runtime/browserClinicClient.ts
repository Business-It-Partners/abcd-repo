import { BrowserAppHistory, type BrowserAppHistoryContract } from './appHistory';
import type { BrowserAppBridge, BrowserMediaOperation, ClinicResponse } from './runtimeBridge';

export type ClinicOutcome = 'not_sent' | 'rejected' | 'unknown';
export type BrowserClinicSessionContext = {
  clinic: { displayName: string };
  clinicUser: { role: string; capabilities: string[]; clinicUserId?: string };
};
export type BrowserRuntimeInfo = { appId: string; title: string; version: string };

export class ClinicError extends Error {
  constructor(readonly code: string, message: string, readonly outcome: ClinicOutcome = 'not_sent', readonly operationId?: string) {
    super(message);
    this.name = 'ClinicError';
  }
}

function responseError(status: number, operationId?: string): ClinicError {
  if (status === 401) return new ClinicError('AUTH_REQUIRED', 'Your clinic session has expired. Sign in again.', 'rejected', operationId);
  if (status === 403) return new ClinicError('FORBIDDEN', 'Your clinic role does not permit this action.', 'rejected', operationId);
  if (status === 409) return new ClinicError('CONFLICT', 'This record changed elsewhere. Refresh it and review before saving again.', 'rejected', operationId);
  if (status >= 400 && status < 500 && status !== 408) return new ClinicError('VALIDATION', 'The clinic rejected this request. Review the details and try again.', 'rejected', operationId);
  if (status < 200 || status >= 300) return new ClinicError('UNKNOWN_OUTCOME', 'The save result is not confirmed. Check the original save before making another change.', 'unknown', operationId);
  return new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid response.', 'unknown', operationId);
}

export class ClinicCommand<T> {
  private running = false;
  private completed = false;
  private saved?: T;

  constructor(
    private readonly client: BrowserClinicClient,
    readonly method: 'POST' | 'PUT' | 'PATCH',
    readonly path: string,
    readonly body: string,
    readonly operationId: string,
    private readonly valid: (value: unknown) => boolean = () => true,
  ) {}

  async execute(): Promise<T> {
    if (this.completed) return this.saved as T;
    if (this.running) throw new ClinicError('BUSY', 'This save is already running.');
    this.running = true;
    try {
      const value = await this.client.send<T>(this);
      if (!this.valid(value)) throw new ClinicError('UNKNOWN_OUTCOME', 'The save receipt is not confirmed. Check the original save before making another change.', 'unknown', this.operationId);
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
  readonly context: BrowserAppBridge['context'];

  constructor(private readonly bridge: BrowserAppBridge, private readonly sessionLost: () => void = () => {}) {
    this.context = bridge.context;
  }

  async initialize(expectedApp: string): Promise<{ info: BrowserRuntimeInfo; session: BrowserClinicSessionContext }> {
    if (this.invalid || this.context.appId !== expectedApp) {
      throw new ClinicError('FORBIDDEN', 'This app session is not available for the selected app.');
    }
    const session = {
      clinic: { displayName: this.context.clinicDisplayName },
      clinicUser: {
        role: this.context.role,
        capabilities: [...this.context.capabilities],
        ...(this.context.clinicUserId ? { clinicUserId: this.context.clinicUserId } : {}),
      },
    };
    return { info: { appId: this.context.appId, title: this.context.title, version: this.context.version }, session };
  }

  onModuleSelected(_listener: (value: { moduleId: string }) => void): () => void {
    // Browser app windows have one fixed app workflow and no desktop module tabs.
    return () => {};
  }

  async read<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (this.invalid) throw new ClinicError('STALE_SESSION', 'Clinic session changed. Reopen the app.');
    let response: ClinicResponse<unknown>;
    try {
      response = await this.bridge.request('GET', path, null, null, signal);
    } catch (cause) {
      const code = cause instanceof Error ? (cause as Error & { code?: string }).code : undefined;
      if (code === 'clinic_session_unavailable') {
        this.invalidate();
        throw new ClinicError('AUTH_REQUIRED', 'A verified clinic session is required.');
      }
      if (code === 'CANCELLED') throw new ClinicError('CANCELLED', 'Request stopped locally.');
      if (code === 'route_not_granted') throw new ClinicError('FORBIDDEN', 'This clinic route is not available to this app.');
      if (code === 'BUSY') throw new ClinicError('BUSY', 'The clinic service is busy. Try again shortly.');
      throw new ClinicError('INVALID_RESPONSE', 'The clinic service could not be reached.');
    }
    if (!response || !Number.isInteger(response.status) || response.status < 200 || response.status >= 300 || !Object.hasOwn(response, 'body')) {
      throw responseError(response?.status ?? 0);
    }
    return response.body as T;
  }

  command<T>(method: 'POST' | 'PUT' | 'PATCH', path: string, body: unknown,
    valid: (value: unknown) => boolean = () => true): ClinicCommand<T> {
    let serialized: string;
    try { serialized = JSON.stringify(body); }
    catch { throw new ClinicError('INVALID_REQUEST', 'This clinic change could not be prepared for saving.'); }
    if (typeof serialized !== 'string' || new TextEncoder().encode(serialized).byteLength > 12_000) {
      throw new ClinicError('INVALID_REQUEST', 'This clinic change is too large to save.');
    }
    return new ClinicCommand<T>(this, method, path, serialized, crypto.randomUUID(), valid);
  }

  async send<T>(command: ClinicCommand<T>): Promise<T> {
    if (this.invalid) throw new ClinicError('STALE_SESSION', 'Clinic session changed. Reopen the app.', 'not_sent', command.operationId);
    let response: ClinicResponse<unknown>;
    try {
      response = await this.bridge.request(command.method, command.path, command.body, command.operationId);
    } catch (cause) {
      const code = cause instanceof Error ? (cause as Error & { code?: string }).code : undefined;
      if (code === 'clinic_session_unavailable') {
        this.invalidate();
        throw new ClinicError('AUTH_REQUIRED', 'A verified clinic session is required.', 'rejected', command.operationId);
      }
      if (code === 'route_not_granted' || code === 'clinic_access_denied') {
        throw new ClinicError('FORBIDDEN', 'The clinic did not authorize this change.', 'rejected', command.operationId);
      }
      if (code === 'invalid_request') {
        throw new ClinicError('INVALID_REQUEST', cause instanceof Error ? cause.message : 'The clinic request is not valid.', 'not_sent', command.operationId);
      }
      throw new ClinicError('UNKNOWN_OUTCOME', 'The save result is not confirmed. Check the original save before making another change.', 'unknown', command.operationId);
    }
    if (!response || !Number.isInteger(response.status)) {
      throw new ClinicError('UNKNOWN_OUTCOME', 'The save result is not confirmed. Check the original save before making another change.', 'unknown', command.operationId);
    }
    if (response.status < 200 || response.status >= 300) throw responseError(response.status, command.operationId);
    // A bodyless 204 is an explicit success. Routes that require a receipt still
    // validate the returned `undefined` in ClinicCommand.execute().
    if (response.status === 204 && !Object.hasOwn(response, 'body')) return undefined as T;
    if (!Object.hasOwn(response, 'body')) {
      throw new ClinicError('UNKNOWN_OUTCOME', 'The save result is not confirmed. Check the original save before making another change.', 'unknown', command.operationId);
    }
    return response.body as T;
  }

  mediaRequest<T>(operation: BrowserMediaOperation, input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    if (this.invalid) return Promise.reject(new ClinicError('STALE_SESSION', 'Clinic session changed. Reopen the app.'));
    return this.bridge.mediaRequest<T>(operation, input, signal).catch(cause => {
      if (cause instanceof Error) {
        const code = (cause as Error & { code?: string }).code;
        if (code === 'clinic_session_unavailable') {
          this.invalidate();
          throw new ClinicError('AUTH_REQUIRED', 'A verified clinic session is required.', 'rejected');
        }
        throw new ClinicError(code ?? 'UNKNOWN_OUTCOME', cause.message, code === 'FORBIDDEN' ? 'rejected' : 'unknown');
      }
      throw new ClinicError('UNKNOWN_OUTCOME', 'The private media result is not confirmed.', 'unknown');
    });
  }

  report(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void {
    this.bridge.reportLifecycle(value);
  }

  createHistory<T>(initialPage: T, canNavigate: () => boolean = () => true,
    backPreservesDraft: (page: T, previousPage?: T) => boolean = () => false): BrowserAppHistoryContract<T> {
    return new BrowserAppHistory<T>(this.bridge, initialPage, canNavigate, backPreservesDraft);
  }

  private invalidate(): void {
    if (this.invalid) return;
    this.invalid = true;
    this.sessionLost();
  }
}
