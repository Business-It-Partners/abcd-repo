export type Phase = 'restoring' | 'signed-out' | 'signing-in' | 'ready' | 'locked' | 'expired' | 'unavailable';
export type SessionView = { phase: Phase; generation: number; userLabel: string; clinicLabel: string; role: string; rememberAvailable: boolean; remembered: boolean; restoreAvailable: boolean; message: string; mode: 'staging' | 'fixture' | 'demo-fixture' };
export type LoginInput = { email: string; password: string };
export type ActionResult = { ok: true } | { ok: false; code: 'INVALID_INPUT' | 'BUSY' | 'DENIED' | 'UNAVAILABLE' | 'STORAGE_UNAVAILABLE' | 'STALE' };
export function loginInput(input: unknown): input is LoginInput {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join() !== 'email,password') return false;
  const v = input as LoginInput;
  return typeof v.email === 'string' && v.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) && typeof v.password === 'string' && v.password.length > 0 && v.password.length <= 1024;
}
