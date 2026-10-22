/** M16.4 strict typed local-file picker contract. No paths, bytes or app IDs on the wire. */
export const localFileTypes = ['images','medical-images','documents','all'] as const;
export const localFilePurposes = ['patient-attachment','lab-attachment','staff-document','general'] as const;
export type FilePickInput = { purpose: typeof localFilePurposes[number]; fileTypes: typeof localFileTypes[number]; maxSelections: number };
export type FilePickerPrompt = FilePickInput & { requestId: string; generation: number; appTitle: string };
export type FilePickerResponse =
  | { requestId: string; generation: number; action: 'cancel' }
  | { requestId: string; generation: number; action: 'native' }
  | { requestId: string; generation: number; action: 'choose'; fileIds: string[] };
const id = (x:unknown):x is string => typeof x==='string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
export function validPickInput(x:unknown):x is FilePickInput{
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!=='fileTypes,maxSelections,purpose')return false;
 const v=x as Record<string,unknown>;
 return localFilePurposes.includes(v.purpose as FilePickInput['purpose']) &&
 localFileTypes.includes(v.fileTypes as FilePickInput['fileTypes']) && Number.isSafeInteger(v.maxSelections) && (v.maxSelections as number)>=1 && (v.maxSelections as number)<=10;
}
export function validPickerResponse(x:unknown):x is FilePickerResponse{
 if(!x||typeof x!=='object'||Array.isArray(x))return false;
 const v=x as Record<string,unknown>;
 if(!id(v.requestId)||!Number.isSafeInteger(v.generation)||(v.generation as number)<1)return false;
 if(v.action==='cancel'||v.action==='native')return Object.keys(v).sort().join()==='action,generation,requestId';
 if(v.action!=='choose'||Object.keys(v).sort().join()!=='action,fileIds,generation,requestId')return false;
 return Array.isArray(v.fileIds)&&v.fileIds.length>=1&&v.fileIds.length<=10&&new Set(v.fileIds).size===v.fileIds.length&&v.fileIds.every(id);
}
export function validPickerPrompt(x:unknown):x is FilePickerPrompt {
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!=='appTitle,fileTypes,generation,maxSelections,purpose,requestId')return false;
 const v=x as Record<string,unknown>;
 return id(v.requestId)&&Number.isSafeInteger(v.generation)&&(v.generation as number)>0&&
 typeof v.appTitle==='string'&&v.appTitle.length>0&&v.appTitle.length<=80&&!/[\u0000-\u001f<>]/.test(v.appTitle)&&
 validPickInput({purpose:v.purpose,fileTypes:v.fileTypes,maxSelections:v.maxSelections});
}
