import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { LocalFileService, LocalFilesError, type FileRecipient } from '../electron/host/localFiles';

const directories:string[]=[];
const services:LocalFileService[]=[];
function fixture(now:()=>number=Date.now){
  const root=mkdtempSync(path.join(tmpdir(),'dental-native-file-selection-'));
  directories.push(root);
  const filePath=path.join(root,'xray.png');
  writeFileSync(filePath,'synthetic-file');
  const service=new LocalFileService(now);services.push(service);
  const owner:FileRecipient={sender:{},frame:{},appId:'company.dental.patient-record',appVersion:'1.0.0',
    windowId:'records',generation:1,requestId:'request_1234',authorized:()=>true};
  return {root,filePath,service,owner};
}
afterEach(()=>{
  for(const service of services.splice(0))service.dispose();
  for(const directory of directories.splice(0))rmSync(directory,{recursive:true,force:true});
});

describe('native device file receipts',()=>{
  it('accepts individually selected native paths and returns opaque recipient-bound metadata',()=>{
    const {root,filePath,service,owner}=fixture();
    const selection=service.selectNativePaths([filePath],owner,'medical-images');
    expect(selection.files.map(file=>file.name)).toEqual(['xray.png']);
    expect(JSON.stringify(selection)).not.toContain(root);
    expect(service.inspect(selection.selectionId,selection.files[0].receiptId,owner)).toEqual(selection.files[0]);
    expect(()=>service.inspect(selection.selectionId,selection.files[0].receiptId,{...owner,sender:{}}))
      .toThrowError(new LocalFilesError('FORBIDDEN'));
    expect('roots' in service).toBe(false);
    expect('list' in service).toBe(false);
  });

  it('rejects files outside the requested type and invalid selections',()=>{
    const {root,service,owner}=fixture();
    const document=path.join(root,'private.exe');writeFileSync(document,'synthetic-only');
    expect(()=>service.selectNativePaths([document],owner,'images')).toThrowError(new LocalFilesError('FORBIDDEN'));
    expect(()=>service.selectNativePaths([],owner,'images')).toThrowError(new LocalFilesError('INVALID_REQUEST'));
    expect(()=>service.selectNativePaths([document,document],owner,'all')).toThrowError(new LocalFilesError('INVALID_REQUEST'));
    expect(()=>service.selectNativePaths([document],owner,'all')).not.toThrow();
  });

  it('invalidates a receipt when its selected file changes',()=>{
    const {filePath,service,owner}=fixture();
    const selection=service.selectNativePaths([filePath],owner,'images');
    writeFileSync(filePath,'replacement-content');
    expect(()=>service.inspect(selection.selectionId,selection.files[0].receiptId,owner))
      .toThrowError(new LocalFilesError('STALE_SELECTION'));
  });

  it('expires selections and clears them when the recipient or session generation changes',()=>{
    let now=1_000;
    const {filePath,service,owner}=fixture(()=>now);
    const expiring=service.selectNativePaths([filePath],owner,'images');
    now+=600_001;
    expect(()=>service.inspect(expiring.selectionId,expiring.files[0].receiptId,owner))
      .toThrowError(new LocalFilesError('STALE_SELECTION'));

    const recipientSelection=service.selectNativePaths([filePath],owner,'images');
    service.revokeRecipient(owner.sender);
    expect(()=>service.inspect(recipientSelection.selectionId,recipientSelection.files[0].receiptId,owner))
      .toThrowError(new LocalFilesError('STALE_SELECTION'));

    const sessionSelection=service.selectNativePaths([filePath],owner,'images');
    service.invalidateGeneration(2);
    expect(()=>service.inspect(sessionSelection.selectionId,sessionSelection.files[0].receiptId,owner))
      .toThrowError(new LocalFilesError('STALE_SELECTION'));
  });
});
