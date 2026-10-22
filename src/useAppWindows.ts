import { createRef, useMemo, type RefObject } from 'react';
import { useManagedWindow } from './ManagedWindow';
import { WINDOW_IDS, type WindowId } from './windowGeometry';

/** Stable refs and explicit hooks: one shared controller per registered app. */
export function useAppWindows() {
  const targets = useMemo(() => Object.fromEntries(WINDOW_IDS.map(id => [id, createRef<HTMLButtonElement>()])) as Record<WindowId, RefObject<HTMLButtonElement | null>>, []);
  const controllers = {
    files: useManagedWindow('files', targets.files),
    store: useManagedWindow('store', targets.store),
    studio: useManagedWindow('studio', targets.studio),
    records: useManagedWindow('records', targets.records),
    followups: useManagedWindow('followups', targets.followups),
    appointments: useManagedWindow('appointments', targets.appointments),
    workentry: useManagedWindow('workentry', targets.workentry),
    patients: useManagedWindow('patients', targets.patients),
    treatment: useManagedWindow('treatment', targets.treatment),
    lab: useManagedWindow('lab', targets.lab),
    finance: useManagedWindow('finance', targets.finance),
    staff: useManagedWindow('staff', targets.staff),
    protocols: useManagedWindow('protocols', targets.protocols),
    calendar: useManagedWindow('calendar', targets.calendar),
  };
  return { targets, controllers };
}
