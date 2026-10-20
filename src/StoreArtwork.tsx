import { Layers, Table2 } from 'lucide-react';
import { sampleWindows } from '../electron/distribution/contracts';
import { runtimeIdForPackage } from '../electron/runtime/contracts';
import { dockArtwork } from './dockArtwork';
import type { WindowId } from './windowGeometry';

const dentalArtwork:Record<string,WindowId>={
  'company.dental.followups':'followups',
  'company.dental.appointments':'appointments',
  'company.dental.work-entry':'workentry',
  'company.dental.patient-record':'patients',
  'company.dental.treatment-progress':'treatment',
  'company.dental.lab-tracker':'lab',
  'company.dental.finance':'finance',
  'company.dental.patient-payments':'finance',
  'company.dental.staff':'staff',
  'company.dental.treatment-protocols':'protocols',
  'company.dental.calendar':'calendar',
};

/** Shared Store/dock thumbnail for company packages without a packaged icon. */
export function StoreArtwork({ appId, className = '' }: { appId: string; className?: string }) {
  const records = sampleWindows[appId] === 'records';
  const runtimeId = runtimeIdForPackage(appId);
  const artwork = dentalArtwork[appId];
  if (artwork) return <span data-store-art={runtimeId} className={`delivery-art delivery-art-dental ${className}`.trim()} aria-hidden="true"><img src={dockArtwork(artwork)} alt="" draggable={false}/></span>;
  return <span data-store-art={runtimeId} className={`delivery-art ${records ? 'delivery-art-records' : 'delivery-art-studio'} ${className}`.trim()} aria-hidden="true">
    {records ? <Table2 size={29}/> : <Layers size={29}/>}
  </span>;
}
