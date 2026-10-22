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

/** Viewer only accepts opaque IDs from a bounded Files page/listing. */
export type ShellViewerOpen=Readonly<{directoryId:string;fileIds:string[];selectedId:string;generation:number}>;
export function parseViewerOpen(value:unknown):ShellViewerOpen|null {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='directoryId,fileIds,generation,selectedId')return null;
  const v=value as Record<string,unknown>;
  if(!opaqueId(v.directoryId)||!opaqueId(v.selectedId)||!Number.isSafeInteger(v.generation)||(v.generation as number)<1
    ||!Array.isArray(v.fileIds)||v.fileIds.length<1||v.fileIds.length>2048
    ||!v.fileIds.every(opaqueId)||new Set(v.fileIds).size!==v.fileIds.length||!v.fileIds.includes(v.selectedId))return null;
  return {directoryId:v.directoryId as string,fileIds:v.fileIds as string[],selectedId:v.selectedId as string,generation:v.generation as number};
}
export type ShellViewerStep=Readonly<{sessionId:string;generation:number;direction:-1|1}>;
export function parseViewerStep(value:unknown):ShellViewerStep|null {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='direction,generation,sessionId')return null;
  const v=value as Record<string,unknown>;
  if(!opaqueId(v.sessionId)||!Number.isSafeInteger(v.generation)||(v.generation as number)<1||!(v.direction===-1||v.direction===1))return null;
  return {sessionId:v.sessionId as string,generation:v.generation as number,direction:v.direction as -1|1};
}
