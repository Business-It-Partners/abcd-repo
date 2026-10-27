import { ClinicClient, ClinicError } from "../../../../../../packages/app-sdk/src/clinicClient";
import type { StaffDocumentMimeType } from "./types";

export type PendingStaffDocumentUpload = {
  transferId: string;
  idempotencyKey: string;
  staffId: string;
  file: File;
  offset: number;
  total: number;
  commitStarted: boolean;
};

/**
 * The Browser host currently has no signed Staff document media policy.
 * Keep the Staff UI's document controls fail-closed until host-side metadata,
 * byte verification, and bounded transfer support are implemented.
 */
export class StaffDocumentMediaSdk {
  constructor(_client: ClinicClient) {}

  async capabilities(): Promise<string[]> {
    return [];
  }

  read(_staffId: string, _assetId: string): Promise<{ mimeType: StaffDocumentMimeType; bytes: Uint8Array }> {
    return Promise.reject(this.unavailable());
  }

  begin(_staffId: string, _file: File): Promise<PendingStaffDocumentUpload> {
    return Promise.reject(this.unavailable());
  }

  transfer(_pending: PendingStaffDocumentUpload, _onProgress?: (sent: number, total: number) => void): Promise<string> {
    return Promise.reject(this.unavailable());
  }

  cancel(_pending: PendingStaffDocumentUpload): Promise<{ cancelled: boolean; committed: boolean; assetId?: string }> {
    return Promise.reject(this.unavailable());
  }

  private unavailable() {
    return new ClinicError("FORBIDDEN", "Staff document viewing and upload are not enabled in the Browser edition yet.");
  }
}
