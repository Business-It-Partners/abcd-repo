import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClinicClient, ClinicError, type ClinicCommand } from '../../../../packages/app-sdk/src/clinicClient';
import type { ClinicLabOrder, LabOrderAssignmentInput, LabOrderUpdateInput } from '@/features/labs/types';
import type { ClinicSupplier, SupplierUpdateInput, SupplierWriteInput } from '@/features/labs/supplierTypes';
import { LabTrackerApi } from '@/features/labs/api';
import { toLabOrder, toLabSupplier, type LabOrder, type LabSupplier } from '@/features/labs/model/domain';
import LabTrackerView from '@/features/labs/components/LabTrackerView';
import { LabRouteProvider } from '@/shell/routing/useClinicRouteState';
import { installClinicClient } from '@/sdk/client';
import { executeClinicCommand } from '@/sdk/commands';
import { ClinicLoadingProvider } from '@/shared/ui/ClinicLoadingOverlay';
import { ClinicPageRefreshAction, ClinicPageRefreshProvider, useClinicPageRefresh } from '@/shared/ui/ClinicPageRefresh';
import { ClinicSnackbarProvider } from '@/shared/ui/ClinicSnackbar';
import { todayISO } from '@/shared/dates/nepaliDate';
import '@/shared/clinic.css';

const APP_ID = 'company.dental.lab-tracker.m17';
const MODULES = new Set(['lab-tracker', 'lab-suppliers']);

type LifecycleState = { dirty: boolean; modal: boolean };
type PendingWrite = { command: ClinicCommand<unknown>; label: string };

function friendly(cause: unknown, fallback: string) {
  if (cause instanceof ClinicError) return cause.message;
  return cause instanceof Error ? cause.message : fallback;
}

function App() {
  const [client, setClient] = useState<ClinicClient | null>(null);
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [activeModule, setActiveModule] = useState('lab-tracker');
  const [message, setMessage] = useState('Opening Lab Tracker…');
  const [lifecycle, setLifecycle] = useState<LifecycleState>({ dirty: false, modal: false });
  const reportModuleLifecycle = useCallback((moduleId: string, next: LifecycleState) => {
    if (moduleId !== activeModule) return;
    setLifecycle(current => current.dirty === next.dirty && current.modal === next.modal ? current : next);
  }, [activeModule]);

  useEffect(() => {
    let active = true;
    if (!window.dentalApp) {
      setMessage('Open Lab Tracker from the Dental OS Store.');
      return;
    }
    const sdk = new ClinicClient(window.dentalApp, () => {
      installClinicClient(null);
      if (active) {
        setClient(null);
        setCapabilities([]);
        setMessage('The clinic session changed. Reopen Lab Tracker from Dental OS.');
      }
    });
    const unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
      if (!MODULES.has(moduleId)) {
        if (active) setMessage('The selected Lab Tracker module is unavailable.');
        return;
      }
      if (active) {
        setActiveModule(moduleId);
        setMessage('');
        setLifecycle({ dirty: false, modal: false });
      }
    });
    void sdk.initialize(APP_ID).then(({ session }) => {
      const access = session.clinicUser.capabilities;
      if (!access.includes('lab_tracker.access')) throw new ClinicError('FORBIDDEN', 'Lab Tracker is unavailable for this clinic role.');
      if (active) {
        installClinicClient(sdk);
        setCapabilities(access);
        setClient(sdk);
        setMessage('');
      }
    }).catch(cause => {
      if (active) setMessage(friendly(cause, 'Lab Tracker could not be opened.'));
    });
    return () => {
      active = false;
      unsubscribe();
      installClinicClient(null);
      sdk.report({ dirty: false, modal: false });
    };
  }, []);

  useEffect(() => { client?.report(lifecycle); }, [client, lifecycle]);

  if (!client) return <main className="clinicApp" role={message.startsWith('Opening') ? 'status' : 'alert'}>{message}</main>;
  if (message) return <main className="clinicApp" role="alert">{message}</main>;
  return <ClinicSnackbarProvider><ClinicLoadingProvider><ClinicPageRefreshProvider>
    <LabTrackerWorkspace
      client={client}
      activeModule={activeModule}
      capabilities={capabilities}
      onLifecycle={reportModuleLifecycle}
    />
  </ClinicPageRefreshProvider></ClinicLoadingProvider></ClinicSnackbarProvider>;
}

function LabTrackerWorkspace({ client, activeModule, capabilities, onLifecycle }: {
  client: ClinicClient;
  activeModule: string;
  capabilities: string[];
  onLifecycle: (moduleId: string, state: LifecycleState) => void;
}) {
  const api = useMemo(() => new LabTrackerApi(client), [client]);
  const [orderRows, setOrderRows] = useState<ClinicLabOrder[]>([]);
  const [supplierRows, setSupplierRows] = useState<ClinicSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [ordersRefreshing, setOrdersRefreshing] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingWrite, setPendingWrite] = useState<PendingWrite | null>(null);
  const refreshSequence = useRef(0);
  const canManageSharedSuppliers = capabilities.includes('finance.manage');

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    setOrdersRefreshing(true);
    setLoadError('');
    const [ordersResult, suppliersResult] = await Promise.allSettled([api.listLabOrders(), api.listLabSuppliers()]);
    if (sequence !== refreshSequence.current) return;
    if (ordersResult.status === 'fulfilled') setOrderRows(ordersResult.value);
    if (suppliersResult.status === 'fulfilled') setSupplierRows(suppliersResult.value);
    const errors = [ordersResult, suppliersResult].filter(result => result.status === 'rejected');
    setLoading(false);
    setOrdersRefreshing(false);
    if (errors.length) {
      const first = errors[0];
      const message = first.status === 'rejected' ? friendly(first.reason, 'Clinic data could not be loaded.') : 'Clinic data could not be loaded.';
      setLoadError(message);
      throw new Error(message);
    }
  }, [api]);

  useEffect(() => { void refresh().catch(() => {}); }, [refresh]);
  useClinicPageRefresh({ key: activeModule, label: activeModule === 'lab-suppliers' ? 'Lab suppliers' : 'Lab Tracker', refresh, successMessage: 'Clinic lab records refreshed.', busy: ordersRefreshing });

  const runWrite = useCallback(async <T,>(command: ClinicCommand<T>, label: string) => {
    if (pendingWrite) throw new ClinicError('BUSY', 'Resolve the original save before starting another clinic change.');
    setWriteError('');
    setNotice('');
    try {
      await executeClinicCommand(command);
    } catch (cause) {
      if (cause instanceof ClinicError && cause.outcome === 'unknown') setPendingWrite({ command: command as ClinicCommand<unknown>, label });
      if (cause instanceof ClinicError && cause.code === 'CONFLICT') await refresh().catch(() => {});
      setWriteError(friendly(cause, `${label} could not be saved.`));
      throw cause;
    }
    setPendingWrite(null);
    setNotice(`${label} saved.`);
    await refresh().catch(() => {});
  }, [pendingWrite, refresh]);

  const retryPending = useCallback(async () => {
    if (!pendingWrite) return;
    const original = pendingWrite;
    setWriteError('');
    try {
      await executeClinicCommand(original.command);
      setPendingWrite(null);
      setNotice(`${original.label} confirmed.`);
      await refresh().catch(() => {});
    } catch (cause) {
      if (!(cause instanceof ClinicError && cause.outcome === 'unknown')) setPendingWrite(null);
      if (cause instanceof ClinicError && cause.code === 'CONFLICT') await refresh().catch(() => {});
      setWriteError(friendly(cause, 'The original save is still unresolved.'));
    }
  }, [pendingWrite, refresh]);

  const orderById = useCallback((id: string) => {
    const row = orderRows.find(order => order.labOrderId === id);
    if (!row) throw new Error('This lab order changed. Refresh the tracker and try again.');
    return row;
  }, [orderRows]);

  const updateStatus = useCallback(async (id: string, status: LabOrder['status']) => {
    const current = orderById(id);
    const input: LabOrderUpdateInput = { expectedRowVersion: current.rowVersion };
    if (status === 'Pending') {
      input.status = 'pending_assignment';
      input.clearAssignment = true;
    } else if (status === 'Received') input.status = 'received';
    else if (status === 'Fitted') input.status = 'fitted';
    else throw new Error('Use the assignment form to send a pending request to a lab.');
    await runWrite(api.updateLabOrder(id, input), status === 'Pending' ? 'Lab assignment returned to pending' : `Order marked ${status.toLocaleLowerCase()}`);
  }, [api, orderById, runWrite]);

  const updateReceptionNote = useCallback(async (id: string, patch: Partial<Omit<LabOrder, 'id'>>) => {
    const current = orderById(id);
    const input: LabOrderUpdateInput = { expectedRowVersion: current.rowVersion };
    if (patch.notes !== undefined) input.receptionNote = patch.notes || null;
    else return;
    await runWrite(api.updateLabOrder(id, input), 'Lab note');
  }, [api, orderById, runWrite]);

  const cancelOrder = useCallback(async (id: string, reason: string) => {
    const current = orderById(id);
    if (current.status !== 'sent' && current.status !== 'received') throw new Error('Only sent or received lab orders can be cancelled.');
    await runWrite(api.updateLabOrder(id, { status: 'cancelled', receptionNote: reason, expectedRowVersion: current.rowVersion }), 'Lab order cancellation');
  }, [api, orderById, runWrite]);

  const assignPending = useCallback(async (id: string, input: LabOrderAssignmentInput) => {
    const current = orderById(id);
    if (current.status !== 'pending_assignment' || input.expectedRowVersion !== current.rowVersion) throw new Error('This lab request changed. Refresh it before assigning a supplier.');
    await runWrite(api.assignLabRequest(id, input), 'Lab assignment');
  }, [api, orderById, runWrite]);

  const createSupplier = useCallback(async (supplier: Omit<LabSupplier, 'id' | 'isLab'>) => {
    const input: SupplierWriteInput = {
      name: supplier.name,
      supplierType: 'lab',
      contactPerson: supplier.contactPerson || null,
      phone: supplier.phone || null,
      email: supplier.email || null,
      address: supplier.address || null,
      openingBalanceAmount: supplier.openingBalance || 0,
      openingBalanceAsOf: supplier.openingAsOf || todayISO(),
      active: supplier.active,
    };
    await runWrite(api.createLabSupplier(input), 'Lab supplier');
  }, [api, runWrite]);

  const updateSupplier = useCallback(async (id: string, patch: Partial<Omit<LabSupplier, 'id'>>) => {
    const current = supplierRows.find(supplier => supplier.supplierId === id);
    if (!current) throw new Error('Lab supplier changed. Refresh the directory and try again.');
    if (current.supplierType === 'both' && !canManageSharedSuppliers) throw new ClinicError('FORBIDDEN', 'Finance permission is required to edit a supplier shared with Finance.');
    if (current.supplierType === 'goods') throw new ClinicError('FORBIDDEN', 'A goods-only supplier cannot be edited as a lab supplier.');
    const input: SupplierUpdateInput = {
      name: patch.name ?? current.name,
      supplierType: current.supplierType,
      contactPerson: patch.contactPerson === undefined ? current.contactPerson : patch.contactPerson || null,
      phone: patch.phone === undefined ? current.phone : patch.phone || null,
      email: patch.email === undefined ? current.email : patch.email || null,
      address: patch.address === undefined ? current.address : patch.address || null,
      openingBalanceAmount: patch.openingBalance ?? current.openingBalanceAmount,
      openingBalanceAsOf: patch.openingAsOf ?? current.openingBalanceAsOf,
      active: patch.active ?? current.active,
      expectedRowVersion: current.rowVersion,
    };
    await runWrite(api.updateLabSupplier(id, input), 'Lab supplier');
  }, [api, canManageSharedSuppliers, runWrite, supplierRows]);

  const orders = useMemo(() => orderRows.map(toLabOrder), [orderRows]);
  const cancelledOrders = useMemo(() => orders.filter(order => Boolean(order.voidedAt)), [orders]);
  const activeOrders = useMemo(() => orders.filter(order => !order.voidedAt), [orders]);
  const labs = useMemo(() => supplierRows.filter(supplier => supplier.supplierType !== 'goods').map(toLabSupplier), [supplierRows]);
  const pendingRequests = useMemo(() => orderRows.filter(order => order.status === 'pending_assignment'), [orderRows]);
  const trackerLifecycle = useCallback((state: LifecycleState) => onLifecycle('lab-tracker', state), [onLifecycle]);
  const supplierLifecycle = useCallback((state: LifecycleState) => onLifecycle('lab-suppliers', state), [onLifecycle]);

  return <main className="clinicApp">
    <ClinicPageRefreshAction placement="utility-bar" />
    {loadError && <div role="alert" style={{ margin: '12px 18px', padding: '10px 12px', border: '1px solid #f0c5c5', background: '#fff7f7', color: '#9f1239' }}>Lab data could not be refreshed: {loadError}</div>}
    {writeError && <div role="alert" style={{ margin: '12px 18px', padding: '10px 12px', border: '1px solid #f0c5c5', background: '#fff7f7', color: '#9f1239' }}>
      <span>{pendingWrite ? 'The original save result is not confirmed. ' : ''}{writeError}</span>
      {pendingWrite && <button type="button" className="btn btn-secondary btn-sm" onClick={() => void retryPending()} style={{ marginLeft: 10 }}>Check original save</button>}
    </div>}
    {notice && <div role="status" style={{ margin: '12px 18px', padding: '10px 12px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534' }}>{notice}</div>}
    <div hidden={activeModule !== 'lab-tracker'}>
      <LabRouteProvider tab="lab-tracker">
        <LabTrackerView
          active={activeModule === 'lab-tracker'} onLifecycle={trackerLifecycle}
          orders={activeOrders} removedOrders={cancelledOrders} labs={labs} labsLoading={loading}
          ordersRefreshing={ordersRefreshing} onUpdateOrderStatus={updateStatus} onUpdateOrder={updateReceptionNote}
          onRemoveOrder={cancelOrder} pendingRequests={pendingRequests} onAssignPendingRequest={assignPending}
          onAddLab={createSupplier} onUpdateLab={updateSupplier} canManageSharedSuppliers={canManageSharedSuppliers}
        />
      </LabRouteProvider>
    </div>
    <div hidden={activeModule !== 'lab-suppliers'}>
      <LabRouteProvider tab="labs/suppliers">
        <LabTrackerView
          active={activeModule === 'lab-suppliers'} onLifecycle={supplierLifecycle}
          orders={activeOrders} removedOrders={cancelledOrders} labs={labs} labsLoading={loading}
          ordersRefreshing={ordersRefreshing} onUpdateOrderStatus={updateStatus} onUpdateOrder={updateReceptionNote}
          onRemoveOrder={cancelOrder} pendingRequests={pendingRequests} onAssignPendingRequest={assignPending}
          onAddLab={createSupplier} onUpdateLab={updateSupplier} canManageSharedSuppliers={canManageSharedSuppliers}
        />
      </LabRouteProvider>
    </div>
  </main>;
}

createRoot(document.getElementById('root')!).render(<App />);
