import { Layers, Table2 } from 'lucide-react';
import { sampleWindows } from '../electron/distribution/contracts';
import { runtimeIdForPackage } from '../electron/runtime/contracts';

/** Shared Store/dock thumbnail for company packages without a packaged icon. */
export function StoreArtwork({ appId, className = '' }: { appId: string; className?: string }) {
  const records = sampleWindows[appId] === 'records';
  const runtimeId = runtimeIdForPackage(appId);
  return <span data-store-art={runtimeId} className={`delivery-art ${records ? 'delivery-art-records' : 'delivery-art-studio'} ${className}`.trim()} aria-hidden="true">
    {records ? <Table2 size={29}/> : <Layers size={29}/>}
  </span>;
}
