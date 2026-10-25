/** Closed request contract for OS-owned native device file selection. */
export const localFileTypes = ['images', 'medical-images', 'documents', 'all'] as const;
export const localFilePurposes = ['patient-attachment', 'lab-attachment', 'staff-document', 'general'] as const;
export type FilePickInput = {
  purpose: typeof localFilePurposes[number];
  fileTypes: typeof localFileTypes[number];
  maxSelections: number;
};

export function validPickInput(value: unknown): value is FilePickInput {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join() !== 'fileTypes,maxSelections,purpose') return false;
  const candidate = value as Record<string, unknown>;
  return localFilePurposes.includes(candidate.purpose as FilePickInput['purpose']) &&
    localFileTypes.includes(candidate.fileTypes as FilePickInput['fileTypes']) &&
    Number.isSafeInteger(candidate.maxSelections) && (candidate.maxSelections as number) >= 1 && (candidate.maxSelections as number) <= 10;
}
