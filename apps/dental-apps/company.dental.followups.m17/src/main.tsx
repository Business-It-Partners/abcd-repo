import { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClinicClient } from '../../../../packages/app-sdk/src/clinicClient';
import { connectBrowserRuntime } from '../../../../apps/clinic-app-runtime/runtimeBridge';
import FollowUpsView from '@/features/follow-ups/components/FollowUpsView';
import { followUpsApi } from '@/features/follow-ups/api';
import { ClinicLoadingProvider } from '@/shared/ui/ClinicLoadingOverlay';
import { ClinicPageRefreshAction, ClinicPageRefreshProvider } from '@/shared/ui/ClinicPageRefresh';
import { ClinicSnackbarProvider } from '@/shared/ui/ClinicSnackbar';
import { SnackbarProvider } from '@/shared/ui/SnackbarProvider';
import { DraftSafety } from './draftSafety';
import '@/shared/clinic.css';
import './styles.css';
import '@/shared/standard-app-page.css';

const APP_ID = 'followups';
const browserRuntime = connectBrowserRuntime();

function FollowupsApp() {
  const [ready, setReady] = useState(false), [error, setError] = useState('');
  const [doctors, setDoctors] = useState<{ staffId: string; fullName: string }[]>([]);
  const [referenceError, setReferenceError] = useState('');
  const [writeState, setWriteState] = useState<'none' | 'saving' | 'unknown'>('none');
  const [reconcileError, setReconcileError] = useState(''), [revision, setRevision] = useState(0);
  const drafts = useRef(new Set<string>()), client = useRef<ClinicClient | null>(null);
  const report = useCallback(() => client.current?.report({ dirty: drafts.current.size > 0,
    modal: !!document.querySelector('[role="dialog"][aria-modal="true"]') }), []);
  const draft = useCallback((key: string, dirty: boolean) => { if (dirty) drafts.current.add(key); else drafts.current.delete(key); report(); }, [report]);
  const reconcile = useCallback(async () => {
    setReconcileError('');
    try { await followUpsApi.reconcile(); setRevision(value => value + 1); }
    catch (cause) { setReconcileError(cause instanceof Error ? cause.message : 'The original save could not be checked.'); }
  }, []);
  useEffect(() => {
    let active = true;
    let sdk: ClinicClient | null = null;
    let unsubscribe = () => {};
    async function references() {
      try { const rows = await followUpsApi.staffReferences(); if (active) { setDoctors(rows); setReferenceError(''); } }
      catch { if (active) setReferenceError('Doctor names could not be loaded. Close and reopen Follow-ups to try again.'); }
    }
    void browserRuntime.then(async bridge => {
      if (!active) return;
      const clinicClient = new ClinicClient(bridge);
      sdk = clinicClient;
      client.current = clinicClient;
      unsubscribe = clinicClient.onModuleSelected(({ moduleId }) => { if (moduleId !== APP_ID) throw new Error('Unknown Follow-ups module.'); });
      followUpsApi.configure(clinicClient, value => { if (active) setWriteState(value); });
      const { session } = await clinicClient.initialize(APP_ID);
      if (!session.clinicUser.capabilities.includes('followups.access')) throw new Error('Follow-ups is unavailable for this clinic role.');
      if (active) { setReady(true); void references(); }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Follow-ups could not be opened.'); });
    const observer = new MutationObserver(report);
    observer.observe(document.body, { subtree: true, childList: true });
    return () => { active = false; unsubscribe(); observer.disconnect(); followUpsApi.clear(); drafts.current.clear(); sdk?.report({ dirty: false, modal: false }); };
  }, [report]);
  if (error) return <main className="app-message" role="alert"><h1>Follow-ups unavailable</h1><p>{error}</p></main>;
  if (!ready) return <main className="app-message" role="status">Opening Follow-ups…</main>;
  return <ClinicSnackbarProvider><ClinicLoadingProvider><ClinicPageRefreshProvider><SnackbarProvider>
    <DraftSafety.Provider value={draft}><main className="clinicWorkspaceCanvas" data-dental-os-app={APP_ID}>
      <p role="note" className="browser-followups-readonly">Browser verification mode: follow-up records are read-only. Creating, rescheduling, or marking calls is disabled until staging write acceptance passes.</p>
      {referenceError && <p className="app-warning" role="status">{referenceError}</p>}
      {(writeState === 'unknown' || reconcileError) && <section className="app-warning" role="alert">
        <p>{reconcileError || 'The last save has an uncertain result. Check the original save before making another change.'}</p>
        {writeState !== 'none' ? <button type="button" className="btn btn-secondary" disabled={writeState === 'saving'} onClick={() => { void reconcile(); }}>{writeState === 'saving' ? 'Checking…' : 'Retry original save'}</button> : <button type="button" className="btn btn-secondary" onClick={() => { setReconcileError(''); setRevision(value => value + 1); }}>Refresh Follow-ups</button>}
      </section>}
      <FollowUpsView readOnly key={revision} doctors={doctors}
        writeState={writeState} onReconcile={reconcile}
        onCreate={async input => { await followUpsApi.createFollowUp(input); }}
        onSearchPatients={followUpsApi.searchPatients}
        onReschedule={(id, expectedRowVersion, dueOn, dueTime, reason) => followUpsApi.rescheduleFollowUp(id, { expectedRowVersion, dueOn, dueTime: dueTime ?? null, reason })}
        onToggle={async (id, expectedRowVersion, field, checked) => { await followUpsApi.toggleFollowUp(id, { expectedRowVersion, field, checked }); }} />
      <ClinicPageRefreshAction placement="page-bottom" />
    </main></DraftSafety.Provider>
  </SnackbarProvider></ClinicPageRefreshProvider></ClinicLoadingProvider></ClinicSnackbarProvider>;
}

createRoot(document.getElementById('root')!).render(<FollowupsApp />);
