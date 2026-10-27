export type BrowserAppRole = 'admin' | 'doctor' | 'reception' | 'assistant';
export type BrowserAppContext = {
  appId: 'workentry' | 'patients';
  title: string;
  version: string;
  nonce: string;
  bundleSha256: string;
  capabilities: readonly string[];
  clinicDisplayName: string;
  role: BrowserAppRole;
};
export type ClinicResponse<T> = { status: number; body: T };
export type BrowserMediaOperation = 'clinic.media.read' | 'clinic.media.upload';
export type BrowserAppBridge = {
  context: BrowserAppContext;
  request(method: string, path: string, body?: string | null, idempotencyKey?: string | null, signal?: AbortSignal): Promise<ClinicResponse<unknown>>;
  mediaRequest<T>(operation: BrowserMediaOperation, input: Record<string, unknown>, signal?: AbortSignal): Promise<T>;
  reportLifecycle(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void;
  navigation: { report(value: { canGoBack: boolean; canNavigate: boolean }): void };
};

declare global {
  interface Window { dentalOSAppApi?: BrowserAppBridge }
}

type PendingRequest = {
  resolve(value: unknown): void;
  reject(cause: Error & { code?: string }): void;
  timeout: number;
  kind: 'api' | 'media';
};

const noncePattern = /^[a-f0-9]{48}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const capabilitiesByApp = Object.freeze({
  workentry: new Set([
    'work_entry.access', 'patient_payments.collect', 'patient_billing_ledger.read',
    'lab_tracker.access', 'lab_requests.create', 'treatment_protocols.reference.read',
    'staff.reference.read', 'followups.access',
  ]),
  patients: new Set([
    'patient_record.access', 'work_entry.access', 'patient_billing_ledger.read',
    'patient_payments.collect', 'finance.manage', 'lab_tracker.access',
    'lab_requests.create', 'staff.reference.read', 'treatment_protocols.reference.read',
  ]),
});
const pending = new Map<string, PendingRequest>();
let context: BrowserAppContext | null = null;
let port: MessagePort | null = null;

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function envelopeMatches(value: unknown): value is Record<string, unknown> {
  if (!context || !record(value)) return false;
  return value.appId === context.appId && value.version === context.version && value.nonce === context.nonce;
}

function rejectPending(code: string, message: string): void {
  for (const request of pending.values()) {
    window.clearTimeout(request.timeout);
    request.reject(Object.assign(new Error(message), { code }));
  }
  pending.clear();
}

function postCancel(requestId: string, kind: 'api' | 'media'): void {
  if (!port || !context) return;
  port.postMessage({
    type: kind === 'api' ? 'app:api-cancel' : 'app:media-cancel',
    appId: context.appId,
    version: context.version,
    nonce: context.nonce,
    requestId,
  });
}

function sendRequest<T>(kind: 'api' | 'media', message: Record<string, unknown>, signal?: AbortSignal): Promise<T> {
  if (!port || !context) return Promise.reject(Object.assign(new Error('The secure app session ended.'), { code: 'clinic_session_unavailable' }));
  if (signal?.aborted) return Promise.reject(Object.assign(new Error('Request stopped locally.'), { code: 'CANCELLED' }));
  const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(Object.assign(new Error(kind === 'media' ? 'The media result is not confirmed.' : 'The clinic request timed out.'), {
        code: kind === 'media' ? 'UNKNOWN_OUTCOME' : 'clinic_service_unavailable',
      }));
    }, 30_000);
    const abort = () => {
      if (!pending.has(requestId)) return;
      pending.delete(requestId);
      window.clearTimeout(timeout);
      postCancel(requestId, kind);
      reject(Object.assign(new Error('Request stopped locally.'), { code: 'CANCELLED' }));
    };
    pending.set(requestId, { resolve: resolve as (value: unknown) => void, reject, timeout, kind });
    signal?.addEventListener('abort', abort, { once: true });
    port?.postMessage({
      ...message,
      appId: context?.appId,
      version: context?.version,
      nonce: context?.nonce,
      requestId,
    });
    const request = pending.get(requestId);
    if (request) {
      const originalResolve = request.resolve;
      request.resolve = value => { signal?.removeEventListener('abort', abort); originalResolve(value); };
      const originalReject = request.reject;
      request.reject = cause => { signal?.removeEventListener('abort', abort); originalReject(cause); };
    }
  });
}

function handlePortMessage(event: MessageEvent): void {
  const data = event.data;
  if (!envelopeMatches(data)) {
    port?.close();
    port = null;
    rejectPending('clinic_session_unavailable', 'The secure app session ended.');
    return;
  }
  const message = data as Record<string, unknown>;
  if (message.type === 'app:navigate-back'
    && Object.keys(message).sort().join(',') === 'appId,nonce,type,version') {
    window.dispatchEvent(new CustomEvent('dental-os:navigate-back'));
    return;
  }
  if (!['app:api-response', 'app:media-response'].includes(String(message.type)) || typeof message.requestId !== 'string') return;
  const request = pending.get(message.requestId);
  const expectedKind = message.type === 'app:api-response' ? 'api' : 'media';
  if (!request || request.kind !== expectedKind) return;
  window.clearTimeout(request.timeout);
  pending.delete(message.requestId);
  if (message.ok === true && record(message.data)) {
    request.resolve(message.data);
  } else {
    request.reject(Object.assign(new Error(typeof message.message === 'string' ? message.message : 'The clinic request failed.'), {
      code: typeof message.code === 'string' ? message.code : 'clinic_service_unavailable',
    }));
  }
}

function validInitialization(data: unknown, ports: readonly MessagePort[]): data is BrowserAppContext & { type: 'dental-os:init' } {
  if (!record(data) || ports.length !== 1) return false;
  const value = data as Record<string, unknown>;
  const keys = ['appId', 'bundleSha256', 'capabilities', 'clinicDisplayName', 'nonce', 'role', 'title', 'type', 'version'];
  if (Object.keys(value).sort().join(',') !== keys.sort().join(',') || value.type !== 'dental-os:init'
    || !['workentry', 'patients'].includes(String(value.appId))
    || typeof value.title !== 'string' || value.title.length < 1 || value.title.length > 64
    || typeof value.version !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version)
    || typeof value.nonce !== 'string' || !noncePattern.test(value.nonce)
    || typeof value.bundleSha256 !== 'string' || !sha256Pattern.test(value.bundleSha256)
    || typeof value.clinicDisplayName !== 'string' || value.clinicDisplayName.length > 160 || /[\u0000-\u001f\u007f]/.test(value.clinicDisplayName)
    || !['admin', 'doctor', 'reception', 'assistant'].includes(String(value.role))
    || !Array.isArray(value.capabilities) || value.capabilities.length > 16) return false;
  const allowed = capabilitiesByApp[value.appId as keyof typeof capabilitiesByApp];
  return value.capabilities.every(capability => typeof capability === 'string' && allowed.has(capability))
    && new Set(value.capabilities).size === value.capabilities.length;
}

export function connectBrowserRuntime(): Promise<BrowserAppBridge> {
  return new Promise(resolve => {
    window.addEventListener('message', event => {
      if (port || event.source !== window.parent || !validInitialization(event.data, event.ports)) return;
      context = Object.freeze({
        appId: event.data.appId,
        title: event.data.title,
        version: event.data.version,
        nonce: event.data.nonce,
        bundleSha256: event.data.bundleSha256,
        capabilities: Object.freeze([...event.data.capabilities]),
        clinicDisplayName: event.data.clinicDisplayName,
        role: event.data.role,
      });
      port = event.ports[0];
      port.onmessage = handlePortMessage;
      port.onmessageerror = () => {
        port?.close();
        port = null;
        rejectPending('clinic_service_unavailable', 'The app communication channel failed.');
      };
      port.start();
      const bridge: BrowserAppBridge = {
        context,
        request(method, path, body = null, idempotencyKey = null, signal) {
          const write = method !== 'GET';
          if (!['GET', 'POST', 'PUT', 'PATCH'].includes(method) || typeof path !== 'string' || path.length > 1024) {
            return Promise.reject(Object.assign(new Error('This clinic request is not available.'), { code: 'route_not_granted' }));
          }
          if (write
            ? typeof body !== 'string' || new TextEncoder().encode(body).byteLength > 12_000 || typeof idempotencyKey !== 'string' || !uuidPattern.test(idempotencyKey)
            : body !== null || idempotencyKey !== null) {
            return Promise.reject(Object.assign(new Error('This clinic request is not valid.'), { code: 'invalid_request' }));
          }
          return sendRequest<ClinicResponse<unknown>>('api', { type: 'app:api-request', method, path, body, idempotencyKey }, signal);
        },
        mediaRequest<T>(operation, input, signal) {
          if (!['clinic.media.read', 'clinic.media.upload'].includes(operation) || !record(input)) {
            return Promise.reject(Object.assign(new Error('This media request is not available.'), { code: 'invalid_request' }));
          }
          return sendRequest<T>('media', { type: 'app:media-request', operation, input }, signal);
        },
        reportLifecycle(value) {
          if (!port || !context) return;
          port.postMessage({
            type: 'app:lifecycle', appId: context.appId, version: context.version, nonce: context.nonce,
            dirty: value.dirty === true, modal: value.modal === true, pendingWrite: value.pendingWrite === true,
          });
        },
        navigation: {
          report(value) {
            if (!port || !context) return;
            port.postMessage({
              type: 'app:navigation-state', appId: context.appId, version: context.version, nonce: context.nonce,
              canGoBack: value.canGoBack === true, canNavigate: value.canNavigate === true,
            });
          },
        },
      };
      Object.defineProperty(window, 'dentalOSAppApi', { value: Object.freeze(bridge), configurable: false, enumerable: false, writable: false });
      port.postMessage({
        type: 'app:ready', appId: context.appId, version: context.version, nonce: context.nonce,
        bundleSha256: context.bundleSha256,
      });
      resolve(bridge);
    }, { passive: true });
  });
}
