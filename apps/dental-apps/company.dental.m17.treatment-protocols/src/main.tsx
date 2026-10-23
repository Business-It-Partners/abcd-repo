import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClinicClient, ClinicError, type ClinicCommand } from '../../../../packages/app-sdk/src/clinicClient';
import { ClinicLoadingProvider, useClinicPageLoading } from '@/shared/ui/ClinicLoadingOverlay';
import { ClinicPageRefreshProvider, useClinicPageRefresh } from '@/shared/ui/ClinicPageRefresh';
import { ClinicSnackbarProvider, useClinicSnackbar } from '@/shared/ui/ClinicSnackbar';
import { TreatmentProtocolsEditor } from '@/features/treatment-protocols/internal/TreatmentProtocolsEditor';
import { TreatmentProtocolsApi } from '@/features/treatment-protocols/api';
import type { TreatmentProtocol, TreatmentProtocolInput } from '@/shell/session/types';
import '@/shared/clinic.css';
import './styles.css';
import '@/shared/standard-app-page.css';

declare global { interface Window { dentalApp?: import('../../../../electron/sdk/contracts').AppSdk } }

const appId = 'company.dental.m17.treatment-protocols';
type ProtocolReceipt = { treatmentProtocol: TreatmentProtocol };
type PendingWrite = { command: ClinicCommand<ProtocolReceipt> };

function messageFor(cause: unknown): string {
  if (cause instanceof ClinicError && cause.code === 'CONFLICT') return 'This protocol changed elsewhere. The list has been refreshed; review it and try again.';
  if (cause instanceof ClinicError && cause.outcome === 'unknown') return 'The save result is not confirmed. Check the original save before making another change.';
  return cause instanceof Error && cause.message ? cause.message : 'Treatment protocols could not be loaded.';
}

function mayHaveReachedClinic(cause: unknown): boolean {
  return !(cause instanceof ClinicError) || cause.outcome === 'unknown';
}

function TreatmentProtocolsApp() {
  const [client, setClient] = useState<ClinicClient | null>(null);
  const [unavailable, setUnavailable] = useState('Opening Treatment Protocols…');

  useEffect(() => {
    let active = true;
    if (!window.dentalApp) { setUnavailable('Open Treatment Protocols from the Dental OS Store.'); return; }
    const sdk = new ClinicClient(window.dentalApp, () => {
      if (active) {
        setClient(null);
        setUnavailable('The clinic session changed. Reopen Treatment Protocols from Dental OS.');
      }
    });
    const unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
      if (moduleId !== 'treatment-protocols' && active) {
        setClient(null);
        setUnavailable('The selected Treatment Protocols module is unavailable.');
      }
    });
    void sdk.initialize(appId).then(({ session }) => {
      if (!session.clinicUser.capabilities.includes('treatment_protocols.manage')) {
        throw new ClinicError('FORBIDDEN', 'Treatment Protocols is unavailable for this clinic role.');
      }
      if (active) { setClient(sdk); setUnavailable(''); }
    }).catch(cause => {
      if (active) setUnavailable(cause instanceof Error ? cause.message : 'Treatment Protocols could not be opened.');
    });
    return () => { active = false; unsubscribe(); sdk.report({ dirty: false, modal: false }); };
  }, []);

  if (!client) return <main className="protocolMessage" role={unavailable.startsWith('Opening') ? 'status' : 'alert'}>{unavailable}</main>;
  return <ClinicSnackbarProvider><ClinicLoadingProvider><ClinicPageRefreshProvider>
    <TreatmentProtocolsWorkspace key={appId} client={client} />
  </ClinicPageRefreshProvider></ClinicLoadingProvider></ClinicSnackbarProvider>;
}

function TreatmentProtocolsWorkspace({ client }: { client: ClinicClient }) {
  const api = useMemo(() => new TreatmentProtocolsApi(client), [client]);
  const { showSuccess } = useClinicSnackbar();
  const [protocols, setProtocols] = useState<TreatmentProtocol[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingWrite | null>(null);
  const [lifecycle, setLifecycle] = useState({ dirty: false, modal: false });
  const pendingRef = useRef<PendingWrite | null>(null);
  const loadSequence = useRef(0);
  const lifecycleRef = useRef(lifecycle); lifecycleRef.current = lifecycle;
  const history = useMemo(() => client.createHistory<Record<string, string>>({}, () =>
    !lifecycleRef.current.dirty && !lifecycleRef.current.modal && !pendingRef.current), [client]);

  const reportLifecycle = useCallback((value: { dirty: boolean; modal: boolean }) => setLifecycle(value), []);
  useEffect(() => { client.report(lifecycle); }, [client, lifecycle]);
  useEffect(() => () => { client.report({ dirty: false, modal: false }); }, [client]);
  useEffect(() => () => history.dispose(), [history]);

  useClinicPageLoading('Treatment Protocols', initialLoading);

  const refresh = useCallback(async (keepCurrentOnFailure = false) => {
    const sequence = ++loadSequence.current;
    setLoading(true);
    setError(null);
    try {
      const rows = await api.list();
      if (sequence === loadSequence.current) {
        setProtocols(rows);
        setInitialLoading(false);
      }
    } catch (cause) {
      const message = messageFor(cause);
      if (sequence === loadSequence.current) {
        setError(message);
        setInitialLoading(false);
      }
      if (!keepCurrentOnFailure) throw new Error(message, { cause });
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [api]);

  useEffect(() => { void refresh().catch(() => {}); }, [refresh]);

  useClinicPageRefresh(useMemo(() => ({
    key: 'treatment-protocols',
    label: 'Treatment Protocols',
    refresh: () => refresh(),
    successMessage: 'Treatment Protocols are up to date.',
    busy: loading || saving || !!pending,
    placement: 'page-action' as const,
  }), [loading, pending, refresh, saving]));

  const save = useCallback(async (input: TreatmentProtocolInput, protocolId?: string, rowVersion?: number): Promise<TreatmentProtocol> => {
    if (pendingRef.current) throw new ClinicError('BUSY', 'Check the original save before starting another change.');
    const command = protocolId && rowVersion !== undefined
      ? api.update(protocolId, input, rowVersion)
      : api.create(input);
    setSaving(true); setError(null);
    try {
      const receipt = await command.execute();
      const saved = receipt.treatmentProtocol;
      setProtocols(current => current.some(row => row.protocolId === saved.protocolId)
        ? current.map(row => row.protocolId === saved.protocolId ? saved : row)
        : [saved, ...current]);
      await refresh(true);
      showSuccess(protocolId ? 'Treatment protocol updated.' : 'Treatment protocol created.');
      return saved;
    } catch (cause) {
      if (mayHaveReachedClinic(cause)) {
        const unresolved = { command };
        pendingRef.current = unresolved;
        setPending(unresolved);
      } else if (cause instanceof ClinicError && cause.code === 'CONFLICT') {
        await refresh(true);
      }
      const message = messageFor(cause);
      setError(message);
      throw new Error(message, { cause });
    } finally { setSaving(false); }
  }, [api, refresh, showSuccess]);

  const retryOriginalSave = useCallback(async (): Promise<TreatmentProtocol> => {
    const unresolved = pendingRef.current;
    if (!unresolved) throw new ClinicError('INVALID_REQUEST', 'There is no treatment protocol save to check.');
    setSaving(true); setError(null);
    try {
      const receipt = await unresolved.command.execute();
      const saved = receipt.treatmentProtocol;
      pendingRef.current = null;
      setPending(null);
      setProtocols(current => current.some(row => row.protocolId === saved.protocolId)
        ? current.map(row => row.protocolId === saved.protocolId ? saved : row)
        : [saved, ...current]);
      await refresh(true);
      showSuccess('Original treatment protocol save confirmed.');
      return saved;
    } catch (cause) {
      if (!mayHaveReachedClinic(cause)) { pendingRef.current = null; setPending(null); }
      const message = messageFor(cause);
      setError(message);
      if (!mayHaveReachedClinic(cause)) await refresh(true);
      throw new Error(message, { cause });
    } finally { setSaving(false); }
  }, [refresh, showSuccess]);

  return <main className="clinicWorkspaceCanvas protocolCanvas" data-dental-os-app={appId}>
    <TreatmentProtocolsEditor
      protocols={protocols}
      loading={initialLoading}
      saving={saving}
      pendingSave={!!pending}
      error={error}
      onReload={() => { void refresh().catch(() => {}); }}
      onSave={save}
      onRetrySave={retryOriginalSave}
      onLifecycleChange={reportLifecycle}
      history={history}
    />
  </main>;
}

createRoot(document.getElementById('root')!).render(<TreatmentProtocolsApp />);
