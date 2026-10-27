import { BrowserClinicClient, ClinicError } from '../../../../clinic-app-runtime/browserClinicClient';
export { ClinicCommand, ClinicError } from '../../../../clinic-app-runtime/browserClinicClient';

let activeClient: BrowserClinicClient | null = null;

export function installClinicClient(client: BrowserClinicClient | null) {
  activeClient = client;
}

export function clinicClient(): BrowserClinicClient {
  if (!activeClient) throw new ClinicError('STALE_SESSION', 'The clinic session is not available. Reopen Work Entry from Dental OS.');
  return activeClient;
}
