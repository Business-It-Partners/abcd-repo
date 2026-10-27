// Browser edition compatibility surface for the migrated M17 app modules.
// The implementation remains the Browser host client: credentials never enter
// the isolated frame and requests cross only the nonce-bound message channel.
export {
  BrowserClinicClient as ClinicClient,
  ClinicCommand,
  ClinicError,
} from '../../../apps/clinic-app-runtime/browserClinicClient';
export type {
  BrowserClinicSessionContext as ClinicSessionContext,
  ClinicOutcome,
} from '../../../apps/clinic-app-runtime/browserClinicClient';
