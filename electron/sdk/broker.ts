import { randomUUID, createHash } from 'node:crypto';
import { apiResponse, bounded, cancelRequest, handshake, parseRequest, SDK, type Cancel, type Connection, type ErrorCode, type Operation, type Outcome, type Request, type Result } from './contracts';
import { bindEnvironment, type Environment } from './environment';

export type Caller = { sender: object; frame: object | null; url: string };
export type Identity = {
  snapshot(): { generation: number; active: boolean; userLabel: string; clinicLabel: string };
  credential(generation: number, signal: AbortSignal): Promise<string>;
};
type Registration = { sender: object; frame: object; origin: string; appId: string; appVersion: string; capabilities: Operation[]; connection?: string; generation?: number; preferences: { textScale: number }; report(value: { dirty: boolean; modal: boolean }): void };
type Pending = { controller: AbortController; write: boolean };
export type Transport = (url: string, init: RequestInit) => Promise<Response>;
const messages: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'Invalid SDK request.', UNKNOWN_CALLER: 'Unregistered application frame.', INCOMPATIBLE_SDK: 'Unsupported SDK contract.', STALE_SESSION: 'Session changed; discard this result.', FORBIDDEN: 'Operation is not granted to this app.', BUSY: 'Request capacity reached.', AUTH_REQUIRED: 'Sign in is required.', ACCESS_DENIED: 'Access denied by the service.', CONFLICT: 'The record changed; refresh before deciding.', VALIDATION: 'The service rejected the input.', OFFLINE: 'Service connection failed.', MAINTENANCE: 'Service temporarily unavailable.', TIMEOUT: 'Request deadline exceeded.', CANCELLED: 'Request stopped locally.', UNKNOWN_OUTCOME: 'Write outcome is unknown. Reconcile using the original operation key.', INVALID_RESPONSE: 'Service response did not match the contract.', REDIRECT_DENIED: 'Service redirect refused.', UNAVAILABLE: 'This platform adapter is not available yet.',
};
export const failure = (code: ErrorCode, outcome: Outcome = 'not_sent', r?: Request): Result<never> => ({ ok: false, error: { code, message: messages[code], outcome, ...(r ? { requestId: r.requestId, ...(r.operation === 'appointments.setStatus' ? { operationId: r.input.idempotencyKey as string } : {}) } : {}) } });
const success = <T>(value: T): Result<T> => ({ ok: true, value });
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const aborted = () => reject(new Error('Aborted'));
    if (signal.aborted) { aborted(); return; }
    signal.addEventListener('abort', aborted, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}
class TransportError extends Error { constructor(readonly code: ErrorCode) { super(code); } }

/** Credentials and transport remain in main. App-supplied identity/URLs/headers never enter this API. */
export class ApiBroker {
  private registrations = new Map<object, Registration>();
  private pending = new Map<Registration, Map<string, Pending>>();
  private writing = new Set<string>();
  private writes = new Map<string, string>();
  private flight?: { generation: number; controller: AbortController; promise: Promise<string> };
  private environment: Environment;
  private generation: number;
  constructor(environment: unknown, private identity: Identity, private transport: Transport = fetch, private limits = { timeoutMs: 8000, responseBytes: 262_144, perApp: 4, total: 8, operationKeys: 128 }) {
    this.environment = bindEnvironment(environment); this.generation = identity.snapshot().generation;
  }
  register(input: Omit<Registration, 'preferences' | 'connection' | 'generation'>) {
    this.unregister(input.sender);
    this.registrations.set(input.sender, { ...input, capabilities: [...input.capabilities], preferences: { textScale: 1 } });
  }
  private caller(caller: Caller) {
    const r = this.registrations.get(caller.sender);
    return r && r.frame === caller.frame && caller.url === r.origin ? r : undefined;
  }
  private current() {
    const s = this.identity.snapshot();
    if (s.generation !== this.generation) this.invalidateSession();
    return s;
  }
  connect(caller: Caller, input: unknown): Result<Connection> {
    const r = this.caller(caller); if (!r) return failure('UNKNOWN_CALLER');
    if (!bounded(input, 256) || !handshake(input)) return failure('INCOMPATIBLE_SDK');
    const s = this.current(); if (!s.active) return failure('AUTH_REQUIRED');
    // Repeated compatible handshakes reuse identity instead of disrupting in-flight calls.
    r.connection ??= randomUUID(); r.generation = s.generation;
    return success({ connection: r.connection, generation: s.generation, appId: r.appId, appVersion: r.appVersion, sdk: SDK, capabilities: [...r.capabilities] });
  }
  private connected(r: Registration, v: Cancel) {
    const s = this.current();
    return s.active && this.registrations.get(r.sender) === r && r.connection === v.connection && r.generation === v.generation && v.generation === s.generation;
  }
  cancel(caller: Caller, input: unknown): Result {
    const r = this.caller(caller); if (!r) return failure('UNKNOWN_CALLER');
    if (!cancelRequest(input)) return failure('INVALID_REQUEST');
    if (!this.connected(r, input)) return failure('STALE_SESSION');
    const pending = this.pending.get(r)?.get(input.requestId);
    pending?.controller.abort('cancel'); return success({ cancelledLocally: !!pending, serverCommitUndone: false });
  }
  async request(caller: Caller, input: unknown): Promise<Result> {
    const r = this.caller(caller); if (!r) return failure('UNKNOWN_CALLER');
    const v = parseRequest(input); if (!v) return failure('INVALID_REQUEST');
    if (!this.connected(r, v)) return failure('STALE_SESSION', 'not_sent', v);
    if (!r.capabilities.includes(v.operation)) return failure('FORBIDDEN', 'not_sent', v);
    const active = this.pending.get(r) ?? new Map<string, Pending>();
    const total = [...this.pending.values()].reduce((sum, list) => sum + list.size, 0);
    if (active.has(v.requestId) || active.size >= this.limits.perApp || total >= this.limits.total) return failure('BUSY', 'not_sent', v);
    const write = v.operation === 'appointments.setStatus';
    if (write) {
      const key = v.input.idempotencyKey as string;
      const fingerprint = createHash('sha256').update(JSON.stringify([v.operation, v.input.appointmentId, v.input.status, v.input.expectedRowVersion])).digest('hex');
      if (this.writing.has(key)) return failure('BUSY', 'not_sent', v);
      const prior = this.writes.get(key);
      if (prior && prior !== fingerprint) return failure('CONFLICT', 'not_sent', v);
      if (!prior && this.writes.size >= this.limits.operationKeys) return failure('BUSY', 'not_sent', v);
      this.writes.set(key, fingerprint); this.writing.add(key);
    }
    const controller = new AbortController(); active.set(v.requestId, { controller, write }); this.pending.set(r, active);
    const timer = setTimeout(() => controller.abort('timeout'), this.limits.timeoutMs);
    let dispatched = false;
    try {
      let value: unknown;
      if (v.operation.startsWith('appointments.')) {
        const token = await abortable(this.credential(v.generation), controller.signal);
        if (!this.connected(r, v)) return failure('STALE_SESSION', 'not_sent', v);
        if (typeof token !== 'string' || !token || token.length > 8192 || /[\r\n]/.test(token)) return failure('AUTH_REQUIRED', 'not_sent', v);
        const path = write ? `/v1/appointments/${v.input.appointmentId}/status` : `/v1/appointments?${new URLSearchParams({ date: v.input.date as string })}`;
        const url = new URL(path, this.environment.apiBase);
        if (url.origin !== this.environment.apiBase) return failure('FORBIDDEN', 'not_sent', v);
        const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: 'application/json', 'x-request-id': v.requestId };
        if (write) { headers['content-type'] = 'application/json'; headers['idempotency-key'] = v.input.idempotencyKey as string; }
        dispatched = true;
        const response = await abortable(this.transport(url.href, { method: write ? 'POST' : 'GET', headers, redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: controller.signal, ...(write ? { body: JSON.stringify({ status: v.input.status, expectedRowVersion: v.input.expectedRowVersion }) } : {}) }), controller.signal);
        if (!this.connected(r, v)) return failure('STALE_SESSION', write ? 'unknown' : 'not_sent', v);
        if (response.redirected || response.status >= 300 && response.status < 400) { void response.body?.cancel(); throw new TransportError('REDIRECT_DENIED'); }
        if (!response.ok) {
          void response.body?.cancel();
          const code: ErrorCode = response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'ACCESS_DENIED' : response.status === 409 ? 'CONFLICT' : response.status === 400 || response.status === 422 ? 'VALIDATION' : 'MAINTENANCE';
          if (write && response.status >= 500) return failure('UNKNOWN_OUTCOME', 'unknown', v);
          return failure(code, 'rejected', v);
        }
        const body = await this.read(response, controller.signal);
        try { value = apiResponse(v.operation, body); } catch { throw new TransportError('INVALID_RESPONSE'); }
      } else value = this.local(r, v);
      if (!this.connected(r, v)) return failure('STALE_SESSION', write && dispatched ? 'unknown' : 'not_sent', v);
      return success(value);
    } catch (error) {
      if (!this.connected(r, v)) return failure('STALE_SESSION', write && dispatched ? 'unknown' : 'not_sent', v);
      if (write && dispatched) return failure('UNKNOWN_OUTCOME', 'unknown', v);
      const code: ErrorCode = controller.signal.aborted ? controller.signal.reason === 'cancel' || controller.signal.reason === 'closed' ? 'CANCELLED' : 'TIMEOUT' : error instanceof TransportError ? error.code : error instanceof SyntaxError ? 'INVALID_RESPONSE' : 'OFFLINE';
      return failure(code, 'not_sent', v);
    } finally {
      clearTimeout(timer); if (write) this.writing.delete(v.input.idempotencyKey as string); active.delete(v.requestId); if (!active.size) this.pending.delete(r);
    }
  }
  private local(r: Registration, v: Request): unknown {
    switch (v.operation) {
      case 'platform.status': return { sdk: SDK, environment: this.environment.environment, transport: 'fixture-or-provider', activeRequests: this.pending.get(r)?.size ?? 0 };
      case 'session.context': { const s = this.current(); return { userLabel: s.userLabel, clinicLabel: s.clinicLabel, generation: s.generation }; }
      case 'preferences.read': return { ...r.preferences };
      case 'preferences.update': r.preferences.textScale = v.input.textScale as number; return { ...r.preferences };
      case 'lifecycle.report': r.report(v.input as { dirty: boolean; modal: boolean }); return { accepted: true };
      case 'notifications.show': return { accepted: true, scope: 'app', message: v.input.message };
      case 'native.intent': throw new TransportError('UNAVAILABLE');
    }
  }
  private credential(generation: number): Promise<string> {
    if (this.flight?.generation === generation) return this.flight.promise;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), this.limits.timeoutMs);
    const promise = abortable(Promise.resolve().then(() => this.identity.credential(generation, controller.signal)), controller.signal);
    const flight = { generation, controller, promise }; this.flight = flight;
    void promise.finally(() => { clearTimeout(timer); if (this.flight === flight) this.flight = undefined; }).catch(() => {});
    return promise;
  }
  private async read(response: Response, signal: AbortSignal) {
    if (!response.headers.get('content-type')?.toLowerCase().startsWith('application/json')) { void response.body?.cancel(); throw new TransportError('INVALID_RESPONSE'); }
    const size = response.headers.get('content-length');
    if (size && (!/^\d+$/.test(size) || Number(size) > this.limits.responseBytes)) { void response.body?.cancel(); throw new TransportError('INVALID_RESPONSE'); }
    if (!response.body) throw new TransportError('INVALID_RESPONSE');
    const reader = response.body.getReader(); let length = 0; const chunks: Uint8Array[] = [];
    try {
      while (true) {
        const chunk = await abortable(reader.read(), signal); if (chunk.done) break;
        length += chunk.value.length;
        if (length > this.limits.responseBytes) throw new TransportError('INVALID_RESPONSE');
        chunks.push(chunk.value);
      }
      const bytes = new Uint8Array(length); let offset = 0; for (const c of chunks) { bytes.set(c, offset); offset += c.length; }
      try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { throw new TransportError('INVALID_RESPONSE'); }
    } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  }
  invalidateSession() {
    this.generation = this.identity.snapshot().generation;
    this.flight?.controller.abort('session'); this.flight = undefined; this.writes.clear();
    for (const r of this.registrations.values()) { r.connection = undefined; r.generation = undefined; }
    for (const list of this.pending.values()) for (const p of list.values()) p.controller.abort('session');
  }
  unregister(sender: object) {
    const r = this.registrations.get(sender); if (!r) return;
    this.registrations.delete(sender);
    for (const p of this.pending.get(r)?.values() ?? []) p.controller.abort('closed');
    this.pending.delete(r);
  }
  dispose() { for (const sender of [...this.registrations.keys()]) this.unregister(sender); this.flight?.controller.abort('closed'); this.writes.clear(); }
}
