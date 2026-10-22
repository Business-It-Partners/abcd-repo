import type { AppSdk, ClinicSessionContext, Connection, ErrorCode, Outcome, Result, RuntimeAppInfo } from '../../../electron/sdk/contracts';

export class ClinicError extends Error {
  constructor(readonly code: ErrorCode, message: string, readonly outcome: Outcome = 'not_sent', readonly operationId?: string) {
    super(message);
  }
}
export type ClinicResponse<T> = { status: number; body: T };

/** Browser client over the platform preload. Credentials, routes and transport stay in the host. */
export class ClinicClient {
  private connection?: Promise<Connection>;
  private invalid = false;
  constructor(private bridge: AppSdk, private sessionLost: () => void = () => {}) {}

  private unwrap<T>(result: Result<T>): T {
    if (result.ok) return result.value;
    if (['STALE_SESSION', 'AUTH_REQUIRED'].includes(result.error.code)) {
      this.invalid = true;
      this.sessionLost();
    }
    throw new ClinicError(result.error.code, result.error.message, result.error.outcome, result.error.operationId);
  }
  private connect() {
    if (this.invalid) throw new ClinicError('STALE_SESSION', 'Clinic session changed. Reopen the app.');
    this.connection ??= (async () => {
      // The signed document can mount just before the host finishes registering its frame.
      // Retry only that startup condition, before any business request is dispatched.
      for (let attempt = 0; ; attempt++) {
        const result = await this.bridge.connect({ major: 1, minor: 4 });
        if (!result.ok && result.error.code === 'UNKNOWN_CALLER' && attempt < 20) {
          await new Promise(resolve => setTimeout(resolve, 100)); continue;
        }
        return this.unwrap(result);
      }
    })();
    return this.connection;
  }
  async initialize(expectedApp: string): Promise<{ info: RuntimeAppInfo; session: ClinicSessionContext }> {
    const connection = await this.connect();
    const info = this.unwrap(await this.bridge.getAppInfo());
    if (connection.appId !== expectedApp || info.appId !== expectedApp || !connection.capabilities.includes('clinic.api.request')) {
      throw new ClinicError('FORBIDDEN', 'This app release does not have approved clinic API access.');
    }
    const context = await this.operation<{ clinicSession?: ClinicSessionContext }>('session.context', {});
    if (!context.clinicSession?.clinicUser || !context.clinicSession.clinic?.tenantId) {
      throw new ClinicError('INVALID_RESPONSE', 'Clinic session context is unavailable.');
    }
    return { info, session: context.clinicSession };
  }
  private async operation<T>(operation: 'clinic.api.request' | 'session.context', input: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
    const connection = await this.connect();
    if (signal?.aborted) throw new ClinicError('CANCELLED', 'Request stopped locally.');
    const request = { version: 1 as const, connection: connection.connection, generation: connection.generation,
      requestId: crypto.randomUUID(), operation, input };
    const cancel = () => { void this.bridge.cancel({ version: 1, connection: request.connection, generation: request.generation, requestId: request.requestId }); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      const result = this.unwrap(await this.bridge.request(request));
      return result as T;
    } finally { signal?.removeEventListener('abort', cancel); }
  }
  async read<T>(path: string, signal?: AbortSignal): Promise<T> {
    const result = await this.operation<ClinicResponse<T>>('clinic.api.request', { path, method: 'GET', body: null, idempotencyKey: null }, signal);
    if (!result || !Number.isInteger(result.status) || result.status < 200 || result.status >= 300 || !Object.hasOwn(result, 'body')) {
      throw new ClinicError('INVALID_RESPONSE', 'The clinic returned an invalid response.');
    }
    return result.body;
  }
  command<T>(method: 'POST' | 'PATCH' | 'PUT', path: string, body: unknown, valid: (value: unknown) => boolean = () => true): ClinicCommand<T> {
    // Serialize once: a retry must send the original intent, even if the form changes.
    return new ClinicCommand<T>(this, method, path, JSON.stringify(body), crypto.randomUUID(), valid);
  }
  async send<T>(command: ClinicCommand<T>): Promise<T> {
    const result = await this.operation<ClinicResponse<T>>('clinic.api.request', {
      path: command.path, method: command.method, body: command.body, idempotencyKey: command.operationId,
    });
    if (!result || !Number.isInteger(result.status) || !Object.hasOwn(result, 'body')) {
      throw new ClinicError('INVALID_RESPONSE', 'The save receipt is invalid. Check the original save.', 'unknown', command.operationId);
    }
    if (result.status === 409) throw new ClinicError('CONFLICT', 'This record changed. Refresh it and try again.', 'rejected', command.operationId);
    if (result.status < 200 || result.status >= 300) {
      throw new ClinicError('INVALID_RESPONSE', 'The save receipt is invalid. Check the original save.', 'unknown', command.operationId);
    }
    return result.body;
  }
  report(value: { dirty: boolean; modal: boolean }) { this.bridge.report(value); }
  onModuleSelected(listener: (value: { moduleId: string }) => void) { return this.bridge.onModuleSelected(listener); }
}

/** One explicit write intent. Retry uses the same immutable payload and operation identity. */
export class ClinicCommand<T> {
  private running = false;
  private completed = false;
  private saved?: T;
  constructor(private client: ClinicClient, readonly method: 'POST' | 'PATCH' | 'PUT', readonly path: string,
    readonly body: string, readonly operationId: string, private valid: (value: unknown) => boolean) {}
  async execute(): Promise<T> {
    if (this.completed) return this.saved as T;
    if (this.running) throw new ClinicError('BUSY', 'This save is already running.');
    this.running = true;
    try {
      const value = await this.client.send(this);
      if (!this.valid(value)) throw new ClinicError('INVALID_RESPONSE', 'The save receipt is invalid. Check the original save.', 'unknown', this.operationId);
      this.saved = value; this.completed = true; return value;
    }
    finally { this.running = false; }
  }
}
