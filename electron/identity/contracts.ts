export type Phase = 'restoring' | 'signed-out' | 'signing-in' | 'ready' | 'locked' | 'expired' | 'unavailable';
export type ClinicRole = 'admin' | 'doctor' | 'reception';
export type SessionView = { phase: Phase; generation: number; userLabel: string; clinicLabel: string; role: string; accountRole?: ClinicRole; workspaceRoles?: ClinicRole[]; rememberAvailable: boolean; remembered: boolean; restoreAvailable: boolean; message: string; mode: 'staging' | 'fixture' | 'demo-fixture' };
export type LoginInput = { email: string; password: string };
export type ActionResult = { ok: true } | { ok: false; code: 'INVALID_INPUT' | 'BUSY' | 'DENIED' | 'UNAVAILABLE' | 'STORAGE_UNAVAILABLE' | 'STALE' };
const clinicRoles: readonly ClinicRole[] = ['admin', 'doctor', 'reception'];
export function isClinicRole(value: unknown): value is ClinicRole { return typeof value === 'string' && clinicRoles.includes(value as ClinicRole); }
export function workspaceRoleInput(input: unknown): input is { role: ClinicRole; pin?: string } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const keys = Object.keys(input).sort().join(',');
  const value = input as { role?: unknown; pin?: unknown };
  return (keys === 'role' || keys === 'pin,role') && isClinicRole(value.role)
    && (value.pin === undefined || typeof value.pin === 'string' && /^\d{4}$/.test(value.pin));
}
export function loginInput(input: unknown): input is LoginInput {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).sort().join() !== 'email,password') return false;
  const v = input as LoginInput;
  return typeof v.email === 'string' && v.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email) && typeof v.password === 'string' && v.password.length > 0 && v.password.length <= 1024;
}
