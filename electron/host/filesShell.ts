/** Strict parser for OS-shell-only file listing IPC. It does not confer authority. */
export type ShellFilesList = Readonly<{
  directoryId: string;
  cursor: string | null;
  limit: number;
  generation: number;
}>;
const opaqueId = (value: unknown): value is string =>
  typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);
export function parseFilesList(value: unknown): ShellFilesList | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (Object.keys(value).sort().join(',') !== 'cursor,directoryId,generation,limit') return null;
  const candidate = value as Record<string, unknown>;
  if (!opaqueId(candidate.directoryId) ||
    !(candidate.cursor === null || opaqueId(candidate.cursor)) ||
    !Number.isSafeInteger(candidate.limit) || (candidate.limit as number) < 1 || (candidate.limit as number) > 200 ||
    !Number.isSafeInteger(candidate.generation) || (candidate.generation as number) < 1) return null;
  return { directoryId: candidate.directoryId as string, cursor: candidate.cursor as string | null,
    limit: candidate.limit as number, generation: candidate.generation as number };
}
