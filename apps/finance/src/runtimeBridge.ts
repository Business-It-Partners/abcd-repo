export type FinanceRuntimeContext = {
  appId: string;
  title: string;
  version: string;
  nonce: string;
  bundleSha256: string;
  capabilities: readonly string[];
};

export type FinanceClinicResponse = { status: number; body: unknown };

export type FinanceAppBridge = {
  appId: string;
  capabilities: readonly string[];
  request(method: string, path: string, body: string | null, idempotencyKey: string | null): Promise<FinanceClinicResponse>;
  reportLifecycle(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void;
  navigation: { report(value: { canGoBack: boolean; canNavigate: boolean }): void };
};

type PendingRequest = {
  resolve(value: FinanceClinicResponse): void;
  reject(cause: Error & { code?: string }): void;
  timeout: number;
};

const noncePattern = /^[a-f0-9]{48}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const capabilityPattern = /^[a-z0-9][a-z0-9_.-]{0,99}$/;
const supportedCapabilities = new Set([
  "finance.manage",
  "patient_payments.outstanding.read",
  "patient_payments.received.read",
  "patient_billing_ledger.read",
  "patient_payments.collect",
  "staff.manage",
]);
const pending = new Map<string, PendingRequest>();
let context: FinanceRuntimeContext | null = null;
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

function request(
  method: string,
  path: string,
  body: string | null = null,
  idempotencyKey: string | null = null,
): Promise<FinanceClinicResponse> {
  const validMethod = ["GET", "POST", "PUT", "PATCH"].includes(method);
  const write = method !== "GET";
  const bodyValid = write
    ? typeof body === "string" && new TextEncoder().encode(body).byteLength <= 12_000
      && typeof idempotencyKey === "string" && uuidPattern.test(idempotencyKey)
    : body === null && idempotencyKey === null;
  if (!port || !context || !validMethod || typeof path !== "string" || path.length > 1_024 || !bodyValid) {
    return Promise.reject(Object.assign(new Error("This Finance request is not available."), { code: "route_not_granted" }));
  }
  const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(Object.assign(new Error(write ? "The save result is not confirmed." : "The clinic request timed out."), {
        code: write ? "unknown_outcome" : "clinic_service_unavailable",
      }));
    }, 30_000);
    pending.set(requestId, { resolve, reject, timeout });
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
    rejectPending("clinic_session_unavailable", "The secure Finance session ended.");
    return;
  }
  const message = data as Record<string, unknown>;
  if (message.type === "app:navigate-back"
    && Object.keys(message).sort().join(",") === "appId,nonce,type,version") {
    window.dispatchEvent(new CustomEvent("dental-os:navigate-back"));
    return;
  }
  if (message.type !== "app:api-response" || typeof message.requestId !== "string") return;
  const request = pending.get(message.requestId);
  if (!request) return;
  window.clearTimeout(request.timeout);
  pending.delete(message.requestId);
  if (message.ok === true && message.data && typeof message.data === "object" && !Array.isArray(message.data)) {
    request.resolve(message.data as FinanceClinicResponse);
  } else {
    const code = typeof message.code === "string" ? message.code : "clinic_service_unavailable";
    const error = Object.assign(new Error(typeof message.message === "string" ? message.message : "The clinic request failed."), { code });
    request.reject(error);
  }
}

function validInitialization(data: unknown, ports: readonly MessagePort[], expectedAppId: string): data is FinanceRuntimeContext & { type: "dental-os:init" } {
  if (!data || typeof data !== "object" || Array.isArray(data) || ports.length !== 1) return false;
  const value = data as Record<string, unknown>;
  if (Object.keys(value).sort().join(",") !== "appId,bundleSha256,capabilities,nonce,title,type,version"
    || value.type !== "dental-os:init" || value.appId !== expectedAppId || expectedAppId !== "finance"
    || typeof value.title !== "string" || value.title.length < 1 || value.title.length > 64
    || typeof value.version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version)
    || typeof value.nonce !== "string" || !noncePattern.test(value.nonce)
    || typeof value.bundleSha256 !== "string" || !sha256Pattern.test(value.bundleSha256)
    || !Array.isArray(value.capabilities) || value.capabilities.length > 16
    || !value.capabilities.every((capability) => typeof capability === "string"
      && capabilityPattern.test(capability) && supportedCapabilities.has(capability))
    || new Set(value.capabilities).size !== value.capabilities.length) return false;
  return true;
}

export function connectBrowserRuntime(expectedAppId: string): Promise<FinanceAppBridge> {
  return new Promise((resolve) => {
    const onWindowMessage = (event: MessageEvent) => {
      if (port || event.source !== window.parent || !validInitialization(event.data, event.ports, expectedAppId)) return;
      window.removeEventListener("message", onWindowMessage);
      context = Object.freeze({
        appId: event.data.appId,
        title: event.data.title,
        version: event.data.version,
        nonce: event.data.nonce,
        bundleSha256: event.data.bundleSha256,
        capabilities: Object.freeze([...event.data.capabilities]),
      });
      port = event.ports[0];
      port.onmessage = handlePortMessage;
      port.onmessageerror = () => {
        port?.close();
        port = null;
        rejectPending("clinic_service_unavailable", "The Finance communication channel failed.");
      };
      port.start();
      const api: FinanceAppBridge = {
        appId: context.appId,
        capabilities: context.capabilities,
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
        navigation: {
          report(value) {
            if (!port || !context) return;
            port.postMessage({
              type: "app:navigation-state",
              appId: context.appId,
              version: context.version,
              nonce: context.nonce,
              canGoBack: value.canGoBack === true,
              canNavigate: value.canNavigate === true,
            });
          },
        },
      };
      port.postMessage({
        type: "app:ready",
        appId: context.appId,
        version: context.version,
        nonce: context.nonce,
        bundleSha256: context.bundleSha256,
      });
      resolve(api);
    };
    window.addEventListener("message", onWindowMessage, { passive: true });
  });
}
