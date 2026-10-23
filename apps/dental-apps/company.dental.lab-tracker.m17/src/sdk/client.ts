import { ClinicClient, ClinicError } from '../../../../../packages/app-sdk/src/clinicClient';
import type { AppSdk } from '../../../../../electron/sdk/contracts';

export { ClinicCommand, ClinicError } from '../../../../../packages/app-sdk/src/clinicClient';

let activeClient: ClinicClient | null = null;

export function installClinicClient(client: ClinicClient | null) {
  activeClient = client;
}

export function clinicClient(): ClinicClient {
  if (!activeClient) throw new ClinicError('STALE_SESSION', 'The clinic session is not available. Reopen Lab Tracker from Dental OS.');
  return activeClient;
}

declare global {
  interface Window { dentalApp?: AppSdk }
}
