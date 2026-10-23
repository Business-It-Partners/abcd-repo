import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ClinicClient, ClinicError } from '../../../../packages/app-sdk/src/clinicClient';
import { ClinicLoadingProvider } from '@/shared/ui/ClinicLoadingOverlay';
import { ClinicPageRefreshProvider } from '@/shared/ui/ClinicPageRefresh';
import { ClinicSnackbarProvider } from '@/shared/ui/ClinicSnackbar';
import { ClinicNavigationGuardProvider } from '@/shell/navigation/ClinicNavigationGuard';
import { WorkEntryWorkspace } from '@/features/work-entry/WorkEntryWorkspace';
import { installClinicClient } from '@/sdk/client';
import '@/shared/clinic.css';
import '@/shared/standard-app-page.css';

const appId = 'company.dental.work-entry.m17';

function WorkEntryApp() {
  const [client, setClient] = useState<ClinicClient | null>(null);
  const [message, setMessage] = useState('Opening Work Entry…');
  const [capabilities, setCapabilities] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    if (!window.dentalApp) {
      setMessage('Open Work Entry from the Dental OS Store.');
      return;
    }
    const sdk = new ClinicClient(window.dentalApp, () => {
      installClinicClient(null);
      if (active) {
        setClient(null);
        setMessage('The clinic session changed. Reopen Work Entry from Dental OS.');
      }
    });
    const unsubscribe = sdk.onModuleSelected(({ moduleId }) => {
      if (moduleId !== 'work-entry' && active) {
        installClinicClient(null);
        setClient(null);
        setMessage('The selected Work Entry module is unavailable.');
      }
    });
    void sdk.initialize(appId).then(({ session }) => {
      const access = session.clinicUser.capabilities;
      if (!access.includes('work_entry.access')) throw new ClinicError('FORBIDDEN', 'Work Entry is unavailable for this clinic role.');
      if (active) {
        installClinicClient(sdk);
        setCapabilities(access);
        setClient(sdk);
        setMessage('');
      }
    }).catch(cause => {
      if (active) setMessage(cause instanceof Error ? cause.message : 'Work Entry could not be opened.');
    });
    return () => {
      active = false;
      unsubscribe();
      installClinicClient(null);
      sdk.report({ dirty: false, modal: false });
    };
  }, []);

  if (!client) return <main className="workEntryMessage" role={message.startsWith('Opening') ? 'status' : 'alert'}>{message}</main>;
  return <ClinicSnackbarProvider><ClinicNavigationGuardProvider><ClinicLoadingProvider><ClinicPageRefreshProvider>
    <WorkEntryWorkspace
      canCollectPayment={capabilities.includes('patient_payments.collect')}
      canChooseLabSupplier={capabilities.includes('lab_tracker.access')}
    />
  </ClinicPageRefreshProvider></ClinicLoadingProvider></ClinicNavigationGuardProvider></ClinicSnackbarProvider>;
}

createRoot(document.getElementById('root')!).render(<WorkEntryApp />);
