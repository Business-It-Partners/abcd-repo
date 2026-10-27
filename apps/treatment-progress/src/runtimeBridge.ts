export type BrowserRuntimeContext = {
  appId: string;
  title: string;
  version: string;
  nonce: string;
  bundleSha256: string;
};

export type ClinicResponse = { status: number; body: unknown };
export type BrowserRuntimeBridge = {
  appId: string;
  request(method: string, path: string, body: string | null, idempotencyKey: string | null): Promise<ClinicResponse>;
  reportLifecycle(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void;
};

type PendingRequest = {
  write: boolean;
  resolve(value: ClinicResponse): void;
  reject(cause: Error & { code?: string }): void;
  timeout: number;
};

const noncePattern = /^[a-f0-9]{48}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const pending = new Map<string, PendingRequest>();
let context: BrowserRuntimeContext | null = null;
let port: MessagePort | null = null;

function envelopeMatches(value: unknown): value is Record<string, unknown> {
  if (!context || !value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return data.appId === context.appId && data.version === context.version && data.nonce === context.nonce;
}

function rejectPending(code: string, message: string): void {
  for (const request of pending.values()) {
    window.clearTimeout(request.timeout);
    request.reject(Object.assign(new Error(message), { code }));
  }
  pending.clear();
}

function request(method: string, path: string, body: string | null, idempotencyKey: string | null): Promise<ClinicResponse> {
  const write = method !== "GET";
  const validBody = write
    ? typeof body === "string" && new TextEncoder().encode(body).byteLength <= 12_000
      && typeof idempotencyKey === "string" && uuidPattern.test(idempotencyKey)
    : body === null && idempotencyKey === null;
  if (!port || !context || !["GET", "POST", "PUT", "PATCH"].includes(method)
    || typeof path !== "string" || path.length < 1 || path.length > 1_024 || !path.startsWith("/v1/")
    || path.includes("\\") || path.includes("#") || /[\u0000-\u001f\u007f]/.test(path) || !validBody) {
    return Promise.reject(Object.assign(new Error("This clinic request is not available."), { code: "route_not_granted" }));
  }
  if (write) {
    try {
      const value: unknown = JSON.parse(body as string);
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected JSON object.");
    } catch {
      return Promise.reject(Object.assign(new Error("This clinic request is not valid."), { code: "invalid_request" }));
    }
  }
  const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, "0")).join("");
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(Object.assign(new Error(write ? "The save result is not confirmed." : "The clinic request timed out."), {
        code: write ? "unknown_outcome" : "clinic_service_unavailable",
      }));
    }, 30_000);
    pending.set(requestId, { write, resolve, reject, timeout });
    port?.postMessage({
      type: "app:api-request",
      appId: context?.appId,
      version: context?.version,
      nonce: context?.nonce,
      requestId,
      method,
      path,
      body,
      idempotencyKey,
    });
  });
}

function handlePortMessage(event: MessageEvent): void {
  const data = event.data;
  if (!envelopeMatches(data)) {
    port?.close();
    port = null;
    rejectPending("clinic_session_unavailable", "The secure clinic session ended.");
    return;
  }
  const message = data as Record<string, unknown>;
  if (message.type !== "app:api-response" || typeof message.requestId !== "string") return;
  const request = pending.get(message.requestId);
  if (!request) return;
  window.clearTimeout(request.timeout);
  pending.delete(message.requestId);
  if (message.ok === true && message.data && typeof message.data === "object" && !Array.isArray(message.data)) {
    const response = message.data as Record<string, unknown>;
    if (Number.isInteger(response.status) && Object.hasOwn(response, "body")) {
      request.resolve({ status: response.status as number, body: response.body });
      return;
    }
  }
  const code = typeof message.code === "string" ? message.code : "clinic_service_unavailable";
  const error = Object.assign(new Error(typeof message.message === "string" ? message.message : "The clinic request failed."), { code });
  request.reject(error);
}

function validInitialization(
  value: unknown,
  ports: readonly MessagePort[],
  expectedAppId: string,
): value is BrowserRuntimeContext & { type: "dental-os:init" } {
  if (!value || typeof value !== "object" || Array.isArray(value) || ports.length !== 1) return false;
  const data = value as Record<string, unknown>;
  return Object.keys(data).sort().join(",") === "appId,bundleSha256,nonce,title,type,version"
    && data.type === "dental-os:init" && data.appId === expectedAppId
    && typeof data.title === "string" && data.title.length > 0 && data.title.length <= 64
    && typeof data.version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(data.version)
    && typeof data.nonce === "string" && noncePattern.test(data.nonce)
    && typeof data.bundleSha256 === "string" && sha256Pattern.test(data.bundleSha256);
}

export function connectBrowserRuntime(expectedAppId: string): Promise<BrowserRuntimeBridge> {
  return new Promise(resolve => {
    const onWindowMessage = (event: MessageEvent) => {
      if (port || event.source !== window.parent || !validInitialization(event.data, event.ports, expectedAppId)) return;
      window.removeEventListener("message", onWindowMessage);
      context = Object.freeze({
        appId: event.data.appId,
        title: event.data.title,
        version: event.data.version,
        nonce: event.data.nonce,
        bundleSha256: event.data.bundleSha256,
      });
      port = event.ports[0];
      port.onmessage = handlePortMessage;
      port.onmessageerror = () => {
        port?.close();
        port = null;
        rejectPending("clinic_service_unavailable", "The app communication channel failed.");
      };
      port.start();
      const bridge: BrowserRuntimeBridge = {
        appId: context.appId,
        request,
        reportLifecycle(value) {
          if (!port || !context) return;
          port.postMessage({
            type: "app:lifecycle",
            appId: context.appId,
            version: context.version,
            nonce: context.nonce,
            dirty: value.dirty === true,
            modal: value.modal === true,
            pendingWrite: value.pendingWrite === true,
          });
        },
      };
      port.postMessage({
        type: "app:ready",
        appId: context.appId,
        version: context.version,
        nonce: context.nonce,
        bundleSha256: context.bundleSha256,
      });
      resolve(bridge);
    };
    window.addEventListener("message", onWindowMessage, { passive: true });
  });
}
