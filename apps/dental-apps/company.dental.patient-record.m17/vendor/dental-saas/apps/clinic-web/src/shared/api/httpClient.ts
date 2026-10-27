import { runtimeConfig } from "@/shared/config/runtimeConfig";

type ApiFailure = {
  error?: {
    code?: string;
    message?: string;
  };
};

export class ClinicApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export async function clinicRequest<T>(path: string, idToken: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${idToken}`, ...init.headers },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => null) as ApiFailure | T | null;
  if (!response.ok) {
    const failure = payload as ApiFailure | null;
    throw new ClinicApiError(
      response.status,
      failure?.error?.code ?? "clinic_unavailable",
      failure?.error?.message ?? "The clinic workspace could not be opened. Please try again later.",
    );
  }
  return payload as T;
}

export async function clinicBlobObjectUrl(
  path: string,
  idToken: string,
  fallbackCode: string,
  fallbackMessage: string,
): Promise<string> {
  const response = await fetch(`${runtimeConfig.apiBaseUrl}${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${idToken}` },
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as ApiFailure | null;
    throw new ClinicApiError(
      response.status,
      failure?.error?.code ?? fallbackCode,
      failure?.error?.message ?? fallbackMessage,
    );
  }
  return URL.createObjectURL(await response.blob());
}
