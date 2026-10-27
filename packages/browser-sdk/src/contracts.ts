/** Browser-only, token-free first-party app protocol. No Electron/preload/IPC imports. */
export const SDK = Object.freeze({ major: 1, minor: 7 } as const);
export type ErrorCode = 'INVALID_REQUEST' | 'UNKNOWN_CALLER' | 'INCOMPATIBLE_SDK' | 'STALE_SESSION' | 'FORBIDDEN' | 'BUSY' | 'AUTH_REQUIRED' | 'ACCESS_DENIED' | 'CONFLICT' | 'VALIDATION' | 'OFFLINE' | 'MAINTENANCE' | 'TIMEOUT' | 'CANCELLED' | 'UNKNOWN_OUTCOME' | 'INVALID_RESPONSE' | 'REDIRECT_DENIED' | 'UNAVAILABLE';
export type Outcome = 'not_sent' | 'rejected' | 'unknown';
export type Result<T = unknown> = { ok: true; value: T } | { ok: false; error: { code: ErrorCode; message: string; outcome: Outcome; operationId?: string } };
export type Connection = { connection: string; generation: number; appId: string; appVersion: string; sdk: typeof SDK; capabilities: string[] };
export type ClinicSessionContext = {
  clinicUser: { clinicUserId: string; displayName: string; role: 'admin' | 'doctor' | 'reception'; capabilities: string[] };
  clinic: { tenantId: string; displayName: string; timezone: string; currency: string; defaultBranchId: string | null; hasActiveTrial: boolean };
  branches: Array<{ branchId: string; branchCode: string; name: string }>;
};
export type RuntimeAppInfo = { appId: string; title: string; description: string; iconDataUrl: string; modules: readonly { id: string; label: string; tab: string; capability: string }[]; preferredContentWidth?: number };
export type AppNavigationSnapshot = { entries: string[]; index: number; backPreservesDraft?: true };
export type AppNavigationRequest = { direction: 'back' | 'forward'; entry: string; discard?: boolean; preserveDraft?: true };
export type Request = { version: 1; connection: string; generation: number; requestId: string; operation: string; input: Record<string, unknown> };
export type Cancel = Pick<Request, 'version' | 'connection' | 'generation' | 'requestId'>;
export type AppSdk = {
  connect(input: { major: number; minor: number }): Promise<Result<Connection>>;
  request(input: Request): Promise<Result>;
  cancel(input: Cancel): Promise<Result>;
  getAppInfo(): Promise<Result<RuntimeAppInfo>>;
  openAppExplorer(): Promise<Result>;
  onModuleSelected(listener: (value: { moduleId: string }) => void): () => void;
  navigation: {
    report(input: AppNavigationSnapshot): void;
    onRequest(listener: (value: AppNavigationRequest) => void): () => void;
  };
  report(input: { dirty: boolean; modal: boolean }): void;
};
