import { ClinicClient, ClinicError } from "../../../../../packages/app-sdk/src/clinicClient";
import type { AppSdk } from "../../../../../electron/sdk/contracts";

export { ClinicClient, ClinicError };
export type { ClinicCommand } from "../../../../../packages/app-sdk/src/clinicClient";

declare global {
  interface Window {
    dentalApp?: AppSdk;
  }
}
