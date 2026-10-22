import { MediaUploads, MediaUploadError, uploadKindForFamily } from './mediaUpload';
import { readClinicMedia, mediaKindForFamily, MediaReadError, type MediaKind } from './mediaRead';
import { randomUUID, createHash } from 'node:crypto';
import { apiOperations, apiResponse, bounded, cancelRequest, handshake, parseRequest, SDK, type ApiOperationId, type Cancel, type Connection, type ErrorCode, type Operation, type Outcome, type Request, type Result } from './contracts';
import { bindEnvironment, type Environment } from './environment';
import { allowedClinicApiPath, clinicAppFamily, containsPresignedHandle, type ClinicAppFamily } from './appPolicy';

export type Caller = { sender: object; frame: object | null; url: string };
export type Identity = {
  allowed?(operation: Operation): boolean;
  allowedClinicRequest?(family: ClinicAppFamily, path: string, method: string): boolean;
  allowedMediaUpload?(family: ClinicAppFamily, kind: MediaKind): boolean;
  allowedMediaRead?(family: ClinicAppFamily, kind: MediaKind): boolean;
  rejected?(status: 401 | 403): void;
  snapshot(): { generation: number; active: boolean; userLabel: string; clinicLabel: string; clinicSession?: unknown };
  credential(generation: number, signal: AbortSignal): Promise<string>;
};
type Registration = { authorize?(): boolean; authorizeApiOperation?(operation: ApiOperationId): boolean; sender: object; frame: object; origin: string; appId: string; appVersion: string; capabilities: Operation[]; family?: ClinicAppFamily; connection?: string; generation?: number; preferences: { textScale: number }; report(value: { dirty: boolean; modal: boolean }): void };
const apiEntryPoints: readonly Operation[] = [...apiOperations, 'clinic.api.request', 'clinic.api.blob.read'];
type Pending = { controller: AbortController; write: boolean; media?: boolean };
export type Transport = (url: string, init: RequestInit) => Promise<Response>;
const messages: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'Invalid SDK request.', UNKNOWN_CALLER: 'Unregistered application frame.', INCOMPATIBLE_SDK: 'Unsupported SDK contract.', STALE_SESSION: 'Session changed; discard this result.', FORBIDDEN: 'Operation is not granted to this app.', BUSY: 'Request capacity reached.', AUTH_REQUIRED: 'Sign in is required.', ACCESS_DENIED: 'Access denied by the service.', CONFLICT: 'The record changed; refresh before deciding.', VALIDATION: 'The service rejected the input.', OFFLINE: 'Service connection failed.', MAINTENANCE: 'Service temporarily unavailable.', TIMEOUT: 'Request deadline exceeded.', CANCELLED: 'Request stopped locally.', UNKNOWN_OUTCOME: 'Write outcome is unknown. Reconcile using the original operation key.', INVALID_RESPONSE: 'Service response did not match the contract.', REDIRECT_DENIED: 'Service redirect refused.', UNAVAILABLE: 'This platform adapter is not available yet.',
};
export const failure = (code: ErrorCode, outcome: Outcome = 'not_sent', r?: Request): Result<never> => ({ ok: false, error: { code, message: messages[code], outcome, ...(r ? { requestId: r.requestId, ...(['appointments.setStatus', 'clinic.api.request', 'clinic.media.upload'].includes(r.operation) && r.input.idempotencyKey ? { operationId: r.input.idempotencyKey as string } : {}) } : {}) } });
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
  private uploads = new MediaUploads(owner => this.notify((owner as Registration).appId));
  private registrations = new Map<object, Registration>();
  private pending = new Map<Registration, Map<string, Pending>>();
  private writing = new Set<string>();
  private writes = new Map<string, string>();
  private uncertain = new Set<string>();
  private writeCalls = new Map<string,number>();
  private flight?: { generation: number; controller: AbortController; promise: Promise<string> };
  private environment: Environment;
  private generation: number;
  constructor(environment: unknown, private identity: Identity, private transport: Transport = fetch, private limits = { timeoutMs: 8000, responseBytes: 262_144, perApp: 4, total: 8, operationKeys: 128 }, private activity:(appId:string)=>void=()=>{}) {
    this.environment = bindEnvironment(environment); this.generation = identity.snapshot().generation;
  }
  register(input: Omit<Registration, 'preferences' | 'connection' | 'generation'>) {
    this.unregister(input.sender);
    const capabilities = [...input.capabilities];
    this.registrations.set(input.sender, { ...input, capabilities, family: clinicAppFamily(capabilities), preferences: { textScale: 1 } });
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
    if(r.authorize?.()===false)return failure('ACCESS_DENIED');
    // Repeated compatible handshakes reuse identity instead of disrupting in-flight calls.
    r.connection ??= randomUUID(); r.generation = s.generation;
    return success({ connection: r.connection, generation: s.generation, appId: r.appId, appVersion: r.appVersion, sdk: SDK, capabilities: r.capabilities.filter(op => {
      if (this.identity.allowed?.(op) === false) return false;
      if (!apiEntryPoints.includes(op)) return true;
      return apiOperations.includes(op as ApiOperationId) && r.authorizeApiOperation?.(op as ApiOperationId) === true
        && (op !== 'clinic.media.upload' || !!r.family && !!uploadKindForFamily(r.family) && this.identity.allowed?.(r.family) !== false && this.identity.allowedMediaUpload?.(r.family, uploadKindForFamily(r.family)!) === true)
        && (op !== 'clinic.media.read' || !!r.family && !!mediaKindForFamily(r.family) && this.identity.allowed?.(r.family) !== false && this.identity.allowedMediaRead?.(r.family, mediaKindForFamily(r.family)!) === true)
        && (op !== 'clinic.api.request' || !!r.family && this.identity.allowed?.(r.family) !== false && !!this.identity.allowedClinicRequest);
    }) });
  }
  private apiAllowed(r: Registration, v: Request): boolean {
    if (!apiEntryPoints.includes(v.operation)) return true;
    if (!apiOperations.includes(v.operation as ApiOperationId) || r.authorizeApiOperation?.(v.operation as ApiOperationId) !== true) return false;
    if (v.operation === 'clinic.media.upload') {
      const kind = v.input.action === 'begin' ? v.input.kind : this.uploads.kind(r, v.input.transferId), family = r.family;
      return !!family && this.identity.allowed?.(family) !== false && !!kind && uploadKindForFamily(family) === kind && this.identity.allowedMediaUpload?.(family, kind as MediaKind) === true;
    }
    if (v.operation === 'clinic.media.read') {
      const family = r.family;
      return !!family && this.identity.allowed?.(family) !== false && mediaKindForFamily(family) === v.input.kind && this.identity.allowedMediaRead?.(family, v.input.kind as MediaKind) === true;
    }
    if (v.operation !== 'clinic.api.request') return true;
    const family = r.family;
    return !!family && this.identity.allowed?.(family) !== false
      && allowedClinicApiPath(family, v.input.path as string, v.input.method as string)
      && this.identity.allowedClinicRequest?.(family, v.input.path as string, v.input.method as string) === true;
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
  writeState(appId:string):'none'|'pending'|'unknown' {if([...this.registrations.values()].some(r=>r.appId===appId&&this.uploads.has(r))||this.writeCalls.get(appId)||[...this.pending].some(([r,list])=>r.appId===appId&&[...list.values()].some(p=>p.write)))return 'pending';return [...this.uncertain].some(k=>k.startsWith(appId+':'))?'unknown':'none';}
  private notify(appId:string){try{this.activity(appId);}catch{/* Trusted observer cannot disrupt transport/outcome bookkeeping. */}}
  hasUnsafeWrites(appId:string) {return [...this.registrations.values()].some(r=>r.appId===appId&&this.uploads.has(r))||!!this.writeCalls.get(appId)|| [...this.uncertain].some(k=>k.startsWith(appId+':'))||[...this.pending].some(([r,list])=>r.appId===appId&&[...list.values()].some(p=>p.write));}
  async request(caller: Caller, input: unknown): Promise<Result> {
    const r=this.caller(caller),v=parseRequest(input),generation=this.identity.snapshot().generation;
    const writing=!!r&&!!v&&(v.operation==='appointments.setStatus'||v.operation==='clinic.api.request'&&v.input.method!=='GET'||v.operation==='clinic.media.upload'&&['commit','cancel'].includes(v.input.action as string));
    if(writing){this.writeCalls.set(r!.appId,(this.writeCalls.get(r!.appId)??0)+1);this.notify(r!.appId);}
    try {
      const result=await this.execute(caller,input);
      if(writing&&generation===this.identity.snapshot().generation){const key=r!.appId+':'+(v!.input.idempotencyKey as string);if(!result.ok&&result.error.outcome==='unknown')this.uncertain.add(key);else if(result.ok||!result.ok&&result.error.outcome==='rejected')this.uncertain.delete(key);}
      return result;
    } finally {
      // Keep the safety gate continuous through transport cleanup and outcome recording.
      if(writing&&generation===this.identity.snapshot().generation){const count=(this.writeCalls.get(r!.appId)??1)-1;if(count>0)this.writeCalls.set(r!.appId,count);else this.writeCalls.delete(r!.appId);this.notify(r!.appId);}
    }
  }
  private async execute(caller: Caller, input: unknown): Promise<Result> {
    const r = this.caller(caller); if (!r) return failure('UNKNOWN_CALLER');
    const v = parseRequest(input); if (!v) return failure('INVALID_REQUEST');
    if (!this.connected(r, v)) return failure('STALE_SESSION', 'not_sent', v);
    if(r.authorize?.()===false)return failure('ACCESS_DENIED','not_sent',v);
    if (!this.apiAllowed(r, v)) return failure('FORBIDDEN', 'not_sent', v);
    if (!r.capabilities.includes(v.operation) || this.identity.allowed?.(v.operation) === false) return failure('FORBIDDEN', 'not_sent', v);
    const active = this.pending.get(r) ?? new Map<string, Pending>();
    const total = [...this.pending.values()].reduce((sum, list) => sum + list.size, 0);
    if (active.has(v.requestId) || active.size >= this.limits.perApp || total >= this.limits.total) return failure('BUSY', 'not_sent', v);
    if (v.operation === 'clinic.media.read') {
      const readers = [...this.pending].flatMap(([owner, list]) => [...list.values()].filter(value => value.media).map(() => owner));
      if (readers.length >= 2 || readers.includes(r)) return failure('BUSY', 'not_sent', v);
    }
    const write = v.operation === 'appointments.setStatus' || v.operation === 'clinic.api.request' && v.input.method !== 'GET' || v.operation === 'clinic.media.upload' && ['commit', 'cancel'].includes(v.input.action as string);
    if (write) {
      const key = v.input.idempotencyKey as string;
      const fingerprint = v.operation === 'appointments.setStatus'
        ? createHash('sha256').update(JSON.stringify([v.operation, v.input.appointmentId, v.input.status, v.input.expectedRowVersion])).digest('hex')
        : createHash('sha256').update(JSON.stringify(v.operation === 'clinic.media.upload' ? [v.operation, v.input.transferId] : [v.operation, v.input.method, v.input.path, v.input.body])).digest('hex');
      if (this.writing.has(key)) return failure('BUSY', 'not_sent', v);
      const prior = this.writes.get(key);
      if (prior && prior !== fingerprint) return failure('CONFLICT', 'not_sent', v);
      if (!prior && this.writes.size >= this.limits.operationKeys) return failure('BUSY', 'not_sent', v);
      this.writes.set(key, fingerprint); this.writing.add(key);
    }
    const controller = new AbortController(); active.set(v.requestId, { controller, write, media: v.operation === 'clinic.media.read' }); this.pending.set(r, active);
    const timer = setTimeout(() => controller.abort('timeout'), v.operation === 'clinic.media.upload' ? 60_000 : v.operation === 'clinic.media.read' ? 30_000 : this.limits.timeoutMs);
    let dispatched = false;
    try {
      let value: unknown;
      if (v.operation === 'clinic.media.upload') {
        if (v.input.action === 'begin') value = this.uploads.begin(r, v.input);
        else if (v.input.action === 'chunk') value = this.uploads.chunk(r, v.input);
        else {
          const remote = this.uploads.needsRemote(r, v.input);
          const token = remote ? await abortable(this.credential(v.generation), controller.signal) : 'local-transfer-only';
          const assertCurrent = () => { if (!this.connected(r, v) || r.authorize?.() === false || !this.apiAllowed(r, v)) throw new MediaUploadError('ACCESS_DENIED', dispatched ? 'unknown' : 'not_sent'); };
          assertCurrent();
          if (typeof token !== 'string' || !token || token.length > 8192 || /[\r\n]/.test(token)) return failure('AUTH_REQUIRED', 'not_sent', v);
          value = await abortable(this.uploads.finish(r, v.input, { apiBase: this.environment.apiBase, token, signal: controller.signal, requestId: v.requestId,
            assertCurrent, dispatched: () => { dispatched = true; }, rejected: status => this.identity.rejected?.(status),
            transport: (url, init) => { if (!remote) throw new MediaUploadError('FORBIDDEN'); return abortable(this.transport(url, init), controller.signal); },
          }), controller.signal);
        }
      } else       if (v.operation === 'clinic.media.read') {
        const token = await abortable(this.credential(v.generation), controller.signal);
        const assertCurrent = () => {
          if (!this.connected(r, v) || r.authorize?.() === false || !this.apiAllowed(r, v)) throw new MediaReadError('ACCESS_DENIED');
        };
        assertCurrent();
        if (typeof token !== 'string' || !token || token.length > 8192 || /[\r\n]/.test(token)) return failure('AUTH_REQUIRED', 'not_sent', v);
        value = await abortable(readClinicMedia(v.input as { kind: MediaKind; recordId: string; assetId: string }, {
          apiBase: this.environment.apiBase, token, signal: controller.signal, requestId: v.requestId,
          transport: this.transport, assertCurrent, rejected: status => this.identity.rejected?.(status),
        }), controller.signal);
      } else if (v.operation.startsWith('appointments.') || v.operation === 'clinic.api.request' || v.operation === 'clinic.api.blob.read') {
        const token = await abortable(this.credential(v.generation), controller.signal);
        if (!this.connected(r, v)) return failure('STALE_SESSION', 'not_sent', v);
        if(r.authorize?.()===false)return failure('ACCESS_DENIED','not_sent',v);
        if (!this.apiAllowed(r, v)) return failure('FORBIDDEN', 'not_sent', v);
        if (typeof token !== 'string' || !token || token.length > 8192 || /[\r\n]/.test(token)) return failure('AUTH_REQUIRED', 'not_sent', v);
        const path = v.operation === 'clinic.api.request' || v.operation === 'clinic.api.blob.read'
          ? v.input.path as string
          : write ? `/v1/appointments/${v.input.appointmentId}/status` : `/v1/appointments?${new URLSearchParams({ date: v.input.date as string })}`;
        if (v.operation === 'clinic.api.request' || v.operation === 'clinic.api.blob.read') {
          const rawPath = path.split('?', 1)[0];
          const requestMethod = v.operation === 'clinic.api.request' ? v.input.method as string : v.operation === 'clinic.api.blob.read' ? 'POST' : 'GET';
          if (rawPath.split('/').some(part => part === '.' || part === '..') || /%(?:2f|5c|2e)/i.test(rawPath) || !allowedClinicApiPath(r.family, path, requestMethod)) return failure('FORBIDDEN', 'not_sent', v);
          if (!r.family || this.identity.allowed?.(r.family) === false) return failure('FORBIDDEN', 'not_sent', v);
        }
        const url = new URL(path, this.environment.apiBase);
        if (url.origin !== this.environment.apiBase || url.username || url.password || url.hash || !url.pathname.startsWith('/v1/')) return failure('FORBIDDEN', 'not_sent', v);
        const blobRead=v.operation==='clinic.api.blob.read';
        const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: blobRead ? 'image/jpeg, image/png, image/webp, application/pdf' : 'application/json', 'x-request-id': v.requestId };
        const method = v.operation === 'clinic.api.request' ? v.input.method as string : write || blobRead ? 'POST' : 'GET';
        if (write) headers['idempotency-key'] = v.input.idempotencyKey as string;
        if (v.operation === 'clinic.api.request' && v.input.body !== null) headers['content-type'] = 'application/json';
        else if (v.operation === 'appointments.setStatus') headers['content-type'] = 'application/json';
        dispatched = true;
        const body = v.operation === 'clinic.api.request' ? v.input.body as string | null : write ? JSON.stringify({ status: v.input.status, expectedRowVersion: v.input.expectedRowVersion }) : null;
        const response = await abortable(this.transport(url.href, { method, headers, redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: controller.signal, ...(body !== null ? { body } : {}) }), controller.signal);
        if (!this.connected(r, v)) return failure('STALE_SESSION', write ? 'unknown' : 'not_sent', v);
        if (response.redirected || response.status >= 300 && response.status < 400) { void response.body?.cancel(); throw new TransportError('REDIRECT_DENIED'); }
        if (v.operation === 'clinic.api.request') {
          if (response.status === 401 || response.status === 403) this.identity.rejected?.(response.status);
          if (write && response.status >= 500) { void response.body?.cancel(); return failure('UNKNOWN_OUTCOME', 'unknown', v); }
          const responseBody = response.status === 204 ? null : await this.read(response, controller.signal);
          if(containsPresignedHandle(responseBody))throw new TransportError('INVALID_RESPONSE');
          try { value = apiResponse(v.operation, { status: response.status, body: responseBody }); }
          catch { throw new TransportError('INVALID_RESPONSE'); }
        } else if(blobRead) {
          if(response.status===401||response.status===403)this.identity.rejected?.(response.status);
          if(!response.ok){void response.body?.cancel();const code:ErrorCode=response.status===401?'AUTH_REQUIRED':response.status===403?'ACCESS_DENIED':response.status===404?'ACCESS_DENIED':'MAINTENANCE';return failure(code,'rejected',v);}
          const contentType=response.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase()??'';
          if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(contentType)){void response.body?.cancel();throw new TransportError('INVALID_RESPONSE');}
          const size=response.headers.get('content-length');
          if(size&&(!/^\d+$/.test(size)||Number(size)>8*1024*1024)){void response.body?.cancel();throw new TransportError('INVALID_RESPONSE');}
          if(!response.body)throw new TransportError('INVALID_RESPONSE');
          const reader=response.body.getReader();let length=0;const chunks:Uint8Array[]=[];
          try{while(true){const chunk=await abortable(reader.read(),controller.signal);if(chunk.done)break;length+=chunk.value.length;if(length>8*1024*1024)throw new TransportError('INVALID_RESPONSE');chunks.push(chunk.value);}const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}value={status:200,contentType,body:bytes};}
          finally{void reader.cancel().catch(()=>{});reader.releaseLock();}
          try{value=apiResponse(v.operation,value);}catch{throw new TransportError('INVALID_RESPONSE');}
        } else if (!response.ok) {
          void response.body?.cancel();
          if (response.status === 401 || response.status === 403) this.identity.rejected?.(response.status);
          const code: ErrorCode = response.status === 401 ? 'AUTH_REQUIRED' : response.status === 403 ? 'ACCESS_DENIED' : response.status === 409 ? 'CONFLICT' : response.status === 400 || response.status === 422 ? 'VALIDATION' : 'MAINTENANCE';
          if (write && response.status >= 500) return failure('UNKNOWN_OUTCOME', 'unknown', v);
          return failure(code, 'rejected', v);
        } else {
          const responseBody = await this.read(response, controller.signal);
          try { value = apiResponse(v.operation, responseBody); } catch { throw new TransportError('INVALID_RESPONSE'); }
        }
      } else value = this.local(r, v);
      if (!this.connected(r, v)) return failure('STALE_SESSION', write && dispatched ? 'unknown' : 'not_sent', v);
      return success(value);
    } catch (error) {
      if (!this.connected(r, v)) return failure('STALE_SESSION', write && dispatched ? 'unknown' : 'not_sent', v);
      if (error instanceof MediaUploadError) return failure(error.code, error.outcome, v);
      if (write && dispatched) return failure('UNKNOWN_OUTCOME', 'unknown', v);
      const code: ErrorCode = controller.signal.aborted ? controller.signal.reason === 'cancel' || controller.signal.reason === 'closed' ? 'CANCELLED' : 'TIMEOUT' : error instanceof TransportError || error instanceof MediaReadError ? error.code : error instanceof SyntaxError ? 'INVALID_RESPONSE' : 'OFFLINE';
      return failure(code, 'not_sent', v);
    } finally {
      clearTimeout(timer); if (write) this.writing.delete(v.input.idempotencyKey as string); active.delete(v.requestId); if (!active.size) this.pending.delete(r);
    }
  }
  private local(r: Registration, v: Request): unknown {
    switch (v.operation) {
      case 'platform.status': return { sdk: SDK, environment: this.environment.environment, transport: 'fixture-or-provider', activeRequests: this.pending.get(r)?.size ?? 0 };
      case 'session.context': { const s = this.current(); return { userLabel: s.userLabel, clinicLabel: s.clinicLabel, generation: s.generation, ...(s.clinicSession ? { clinicSession: s.clinicSession } : {}) }; }
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
    if (!response.body) {
      if (response.status === 204) return null;
      throw new TransportError('INVALID_RESPONSE');
    }
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
    this.uploads.dispose();
    this.flight?.controller.abort('session'); this.flight = undefined; this.writes.clear(); this.uncertain.clear(); this.writeCalls.clear();
    for (const r of this.registrations.values()) { r.connection = undefined; r.generation = undefined; }
    for (const list of this.pending.values()) for (const p of list.values()) p.controller.abort('session');
  }
  unregister(sender: object) {
    const r = this.registrations.get(sender); if (!r) return;
    this.uploads.forget(r);
    this.registrations.delete(sender);
    for (const p of this.pending.get(r)?.values() ?? []) p.controller.abort('closed');
    this.pending.delete(r);
  }
  dispose() { for (const sender of [...this.registrations.keys()]) this.unregister(sender); this.flight?.controller.abort('closed'); this.writes.clear(); this.uncertain.clear(); this.writeCalls.clear(); }
}
