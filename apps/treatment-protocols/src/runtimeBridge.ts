import type { BrowserAppBridge, ClinicResponse } from "./shell/browserClinicClient";

type RuntimeContext = { appId: string; title: string; version: string; nonce: string; bundleSha256: string };
type PendingRequest = { resolve(value: ClinicResponse<unknown>): void; reject(cause: Error & { code?: string }): void; timeout: number };

const noncePattern = /^[a-f0-9]{48}$/;
const sha256Pattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const pending = new Map<string, PendingRequest>();
let context: RuntimeContext | null = null;
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

function request(method: string, path: string, body: string | null = null, idempotencyKey: string | null = null): Promise<ClinicResponse<unknown>> {
  if (!port || !context || !["GET", "POST", "PUT"].includes(method)
    || typeof path !== "string" || path.length > 180) {
    return Promise.reject(Object.assign(new Error("This clinic request is not available."), { code: "route_not_granted" }));
  }
  const write = method !== "GET";
  if (write
    ? typeof body !== "string" || body.length > 12_000 || typeof idempotencyKey !== "string" || !uuidPattern.test(idempotencyKey)
    : body !== null || idempotencyKey !== null) {
    return Promise.reject(Object.assign(new Error("This clinic request is not valid."), { code: "invalid_request" }));
  }
  const requestId = Array.from(crypto.getRandomValues(new Uint8Array(16)), (value) => value.toString(16).padStart(2, "0")).join("");
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      pending.delete(requestId);
      reject(Object.assign(new Error(write ? "The save result is not confirmed." : "The clinic request timed out."), { code: write ? "unknown_outcome" : "clinic_service_unavailable" }));
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
  if (!envelopeMatches(data) || typeof data !== "object") {
    port?.close();
    port = null;
    rejectPending("clinic_session_unavailable", "The secure app session ended.");
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
  if (message.ok === true && message.data && typeof message.data === "object") {
    request.resolve(message.data as ClinicResponse<unknown>);
  } else {
    const code = typeof message.code === "string" ? message.code : "clinic_service_unavailable";
    request.reject(Object.assign(new Error(typeof message.message === "string" ? message.message : "The clinic request failed."), { code }));
  }
}

function validInitialization(data: unknown, ports: readonly MessagePort[]): data is RuntimeContext & { type: "dental-os:init" } {
  if (!data || typeof data !== "object" || Array.isArray(data) || ports.length !== 1) return false;
  const value = data as Record<string, unknown>;
  return Object.keys(value).sort().join(",") === "appId,bundleSha256,nonce,title,type,version"
    && value.type === "dental-os:init"
    && value.appId === "protocols"
    && typeof value.title === "string" && value.title.length > 0 && value.title.length <= 64
    && typeof value.version === "string" && /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value.version)
    && typeof value.nonce === "string" && noncePattern.test(value.nonce)
    && typeof value.bundleSha256 === "string" && sha256Pattern.test(value.bundleSha256);
}

export function connectBrowserRuntime(): Promise<BrowserAppBridge> {
  return new Promise((resolve) => {
    window.addEventListener("message", (event) => {
      if (port || event.source !== window.parent || !validInitialization(event.data, event.ports)) return;
      context = event.data;
      port = event.ports[0];
      port.onmessage = handlePortMessage;
      port.onmessageerror = () => {
        port?.close();
        port = null;
        rejectPending("clinic_service_unavailable", "The app communication channel failed.");
      };
      port.start();
      const api: BrowserAppBridge = {
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
      Object.defineProperty(window, "dentalOSAppApi", { value: Object.freeze(api), configurable: false, enumerable: false, writable: false });
      port.postMessage({
        type: "app:ready",
        appId: context.appId,
        version: context.version,
        nonce: context.nonce,
        bundleSha256: context.bundleSha256,
      });
      resolve(api);
    }, { passive: true });
  });
}
