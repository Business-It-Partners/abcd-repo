import { lstatSync, readFileSync } from 'node:fs';

export type DevelopmentCredentials = { email: string; password: string };

/** Read the opt-in, untracked development login file without accepting links or loose POSIX permissions. */
export function loadDevelopmentCredentials(file: string, platform = process.platform): DevelopmentCredentials | undefined {
  try {
    const stat = lstatSync(file);
    if (stat.isSymbolicLink() || !stat.isFile() || stat.size > 4096) return undefined;
    if (platform !== 'win32' && (stat.mode & 0o077) !== 0) return undefined;
    const value: unknown = JSON.parse(readFileSync(file, 'utf8'));
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    const record = value as Record<string, unknown>;
    if (Object.keys(record).sort().join() !== 'email,password' ||
      typeof record.email !== 'string' || record.email.length < 3 || record.email.length > 254 || !/^\S+@\S+\.\S+$/.test(record.email) ||
      typeof record.password !== 'string' || record.password.length < 1 || record.password.length > 1024 || record.password.includes('\0')) return undefined;
    return { email: record.email, password: record.password };
  } catch {
    return undefined;
  }
}
