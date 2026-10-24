import { Layers, Table2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { sampleWindows } from '../electron/distribution/contracts';
import { runtimeIdForPackage } from '../electron/runtime/contracts';
import { dockArtwork } from './dockArtwork';
import { useSessionGeneration } from './SessionBoundary';
import type { WindowId } from './windowGeometry';

const dentalArtwork:Record<string,WindowId>={
  'company.dental.followups':'followups',
  'company.dental.followups.m17':'followups',
  'company.dental.appointments':'appointments',
  'company.dental.appointments.m17':'appointments',
  'company.dental.work-entry':'workentry',
  'company.dental.work-entry.m17':'workentry',
  'company.dental.patient-record':'patients',
  'company.dental.patient-record.m17':'patients',
  'company.dental.treatment-progress':'treatment',
  'company.dental.treatment-progress.m17':'treatment',
  'company.dental.lab-tracker':'lab',
  'company.dental.lab-tracker.m17':'lab',
  'company.dental.finance':'finance',
  'company.dental.finance.m17':'finance',
  'company.dental.patient-payments':'finance',
  'company.dental.staff':'staff',
  'company.dental.staff.m17':'staff',
  'company.dental.treatment-protocols':'protocols',
  'company.dental.m17.treatment-protocols':'protocols',
  'company.dental.calendar':'calendar',
  'company.dental.calendar.m17':'calendar',
};

/** Shared Store/dock art, preferring the verified image declared by the signed release. */
export function StoreArtwork({ appId, className = '', artworkSha256 }: { appId: string; className?: string; artworkSha256?: string }) {
  const generation=useSessionGeneration(),[remote,setRemote]=useState<string|null>(null);
  useEffect(()=>{
    let active=true;setRemote(null);const load=window.desktop?.store.artwork;
    if(!load)return()=>{active=false;};
    void load(appId,artworkSha256,generation).then(value=>{if(active)setRemote(value);}).catch(()=>{if(active)setRemote(null);});
    return()=>{active=false;};
  },[appId,artworkSha256,generation]);
  const records = sampleWindows[appId] === 'records';
  const runtimeId = runtimeIdForPackage(appId);
  const artwork = dentalArtwork[appId];
  if (artwork) return <span data-store-art={runtimeId} className={`delivery-art delivery-art-dental ${className}`.trim()} aria-hidden="true"><img src={remote??dockArtwork(artwork)} alt="" draggable={false}/></span>;
  return <span data-store-art={runtimeId} className={`delivery-art ${records ? 'delivery-art-records' : 'delivery-art-studio'} ${className}`.trim()} aria-hidden="true">
    {records ? <Table2 size={29}/> : <Layers size={29}/>}
  </span>;
}
