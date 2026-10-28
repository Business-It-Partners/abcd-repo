import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserClinicClient, ClinicError } from '../../../clinic-app-runtime/browserClinicClient';
import { connectBrowserRuntime } from '../../../clinic-app-runtime/runtimeBridge';
import { ClinicLoadingProvider } from '@/shared/ui/ClinicLoadingOverlay';
import { ClinicPageRefreshProvider } from '@/shared/ui/ClinicPageRefresh';
import { ClinicSnackbarProvider } from '@/shared/ui/ClinicSnackbar';
import { ClinicNavigationGuardProvider } from '@/shell/navigation/ClinicNavigationGuard';
import { WorkEntryWorkspace } from '@/features/work-entry/WorkEntryWorkspace';
import { installClinicClient } from '@/sdk/client';
import '@/shared/clinic.css';
import '@/shared/standard-app-page.css';

const appId = 'workentry';
const browserRuntime = connectBrowserRuntime();

function WorkEntryApp() {
  const [client, setClient] = useState<BrowserClinicClient | null>(null);
  const [message, setMessage] = useState('Opening Work Entry…');
  const [capabilities, setCapabilities] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    let sdk: BrowserClinicClient | null = null;
    let unsubscribe = () => {};
    void browserRuntime.then(async bridge => {
      if (!active) return;
      sdk = new BrowserClinicClient(bridge, () => {
        installClinicClient(null);
        if (active) {
          setClient(null);
          setMessage('The clinic session changed. Reopen Work Entry from Dental OS.');
        }
      });
      unsubscribe = sdk.onModuleSelected(() => {});
      const { session } = await sdk.initialize(appId);
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
      sdk?.report({ dirty: false, modal: false });
    };
  }, []);

  if (!client) return <main className="workEntryMessage" role={message.startsWith('Opening') ? 'status' : 'alert'}>{message}</main>;
  return <ClinicSnackbarProvider><ClinicNavigationGuardProvider><ClinicLoadingProvider><ClinicPageRefreshProvider>
    <WorkEntryWorkspace
      canCollectPayment={capabilities.includes('patient_payments.collect') && capabilities.includes('patient_billing_ledger.read')}
    />
  </ClinicPageRefreshProvider></ClinicLoadingProvider></ClinicNavigationGuardProvider></ClinicSnackbarProvider>;
}

createRoot(document.getElementById('root')!).render(<WorkEntryApp />);
