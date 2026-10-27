import type { BrowserRuntimeBridge, ClinicResponse } from "../runtimeBridge";

export class ClinicError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ClinicError";
  }
}

function bridgeFailure(cause: unknown): ClinicError {
  const code = cause instanceof Error ? (cause as Error & { code?: string }).code : undefined;
  if (code === "clinic_session_unavailable") return new ClinicError("AUTH_REQUIRED", "A verified clinic session is required.");
  if (code === "route_not_granted" || code === "clinic_access_denied") return new ClinicError("FORBIDDEN", "Your clinic role does not permit this request.");
  return new ClinicError("SERVICE_UNAVAILABLE", "The clinic service could not be reached.");
}

export class ClinicClient {
  constructor(private readonly bridge: BrowserRuntimeBridge) {}

  async read<T>(path: string, signal?: AbortSignal): Promise<T> {
    if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
    let response: ClinicResponse;
    try {
      response = await this.bridge.request("GET", path, null, null);
    } catch (cause) {
      if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
      throw bridgeFailure(cause);
    }
    if (signal?.aborted) throw new ClinicError("CANCELLED", "This request is no longer needed.");
    if (!response || !Number.isInteger(response.status) || !Object.hasOwn(response, "body")) {
      throw new ClinicError("INVALID_RESPONSE", "The clinic returned an invalid response.");
    }
    if (response.status === 401) throw new ClinicError("AUTH_REQUIRED", "Your clinic session has expired. Sign in again.");
    if (response.status === 403) throw new ClinicError("FORBIDDEN", "Your clinic role does not permit this request.");
    if (response.status < 200 || response.status >= 300) throw new ClinicError("SERVICE_UNAVAILABLE", "Treatment progress could not be loaded.");
    return response.body as T;
  }

  report(value: { dirty: boolean; modal: boolean; pendingWrite?: boolean }): void {
    this.bridge.reportLifecycle(value);
  }
}
