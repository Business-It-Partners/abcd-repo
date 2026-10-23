import type { AppSdk, Connection, ErrorCode, Outcome } from "../../../../../../electron/sdk/contracts";
import { ClinicError } from "../../../../../../packages/app-sdk/src/clinicClient";
import type { StaffDocumentMimeType, StaffDocumentUploadMetadata } from "./types";

const maximumBytes = 25 * 1024 * 1024;
const acceptedTypes: readonly string[] = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const uuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value);

export type PendingStaffDocumentUpload = {
  transferId: string;
  idempotencyKey: string;
  staffId: string;
  file: File;
  offset: number;
  total: number;
  commitStarted: boolean;
};

export class StaffDocumentMediaSdk {
  private connection?: Promise<Connection>;

  constructor(private readonly bridge: AppSdk) {}

  private connect(): Promise<Connection> {
    this.connection ??= (async () => {
      for (let attempt = 0; ; attempt += 1) {
        const result = await this.bridge.connect({ major: 1, minor: 5 });
        if (!result.ok && result.error.code === "UNKNOWN_CALLER" && attempt < 20) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }
        if (!result.ok) {
          throw new ClinicError(result.error.code, result.error.message, result.error.outcome);
        }
        return result.value;
      }
    })();
    return this.connection;
  }

  async capabilities(): Promise<string[]> {
    return (await this.connect()).capabilities;
  }

  private async request<T>(operation: "clinic.media.read" | "clinic.media.upload", input: Record<string, unknown>): Promise<T> {
    const connection = await this.connect();
    if (!connection.capabilities.includes(operation)) {
      throw new ClinicError("FORBIDDEN", "This Staff release does not have " + operation + " permission.");
    }
    const result = await this.bridge.request({
      version: 1,
      connection: connection.connection,
      generation: connection.generation,
      requestId: crypto.randomUUID(),
      operation,
      input,
    });
    if (!result.ok) {
      throw new ClinicError(
        result.error.code as ErrorCode,
        result.error.message,
        result.error.outcome as Outcome,
        result.error.operationId,
      );
    }
    return result.value as T;
  }

  async read(staffId: string, assetId: string): Promise<{ mimeType: StaffDocumentMimeType; bytes: Uint8Array }> {
    const response = await this.request<unknown>("clinic.media.read", {
      kind: "staff_document",
      recordId: staffId,
      assetId,
    });
    if (!isRecord(response) || response.status !== 200
      || !acceptedTypes.includes(String(response.contentType))
      || !(response.body instanceof Uint8Array)
      || response.body.byteLength < 1 || response.body.byteLength > maximumBytes) {
      throw new ClinicError("INVALID_RESPONSE", "The private Staff document could not be verified.");
    }
    return {
      mimeType: response.contentType as StaffDocumentMimeType,
      bytes: new Uint8Array(response.body),
    };
  }

  async begin(staffId: string, file: File): Promise<PendingStaffDocumentUpload> {
    if (!file || file.size < 1 || file.size > maximumBytes || !acceptedTypes.includes(file.type)) {
      throw new ClinicError("VALIDATION", "Choose a PDF, PNG, JPG, or WebP file up to 25 MB.");
    }
    const displayFilename = file.name.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 200);
    if (!displayFilename) throw new ClinicError("VALIDATION", "The selected file needs a valid name.");
    const idempotencyKey = crypto.randomUUID();
    const metadata: StaffDocumentUploadMetadata = {
      documentType: "other",
      displayFilename,
      mimeType: file.type as StaffDocumentMimeType,
      byteSize: file.size,
      expiresOn: null,
    };
    const response = await this.request<unknown>("clinic.media.upload", {
      action: "begin",
      kind: "staff_document",
      recordId: staffId,
      metadata,
      idempotencyKey,
    });
    if (!isRecord(response) || !uuid(response.transferId)
      || response.received !== 0 || response.total !== file.size) {
      throw new ClinicError("INVALID_RESPONSE", "The private document transfer could not be started.");
    }
    return {
      transferId: response.transferId,
      idempotencyKey,
      staffId,
      file,
      offset: 0,
      total: file.size,
      commitStarted: false,
    };
  }

  async transfer(
    pending: PendingStaffDocumentUpload,
    onProgress: (sent: number, total: number) => void = () => {},
  ): Promise<string> {
    if (!pending.file || pending.file.size !== pending.total) {
      throw new ClinicError("VALIDATION", "The selected file changed. Select the same file again.");
    }
    const bytes = new Uint8Array(await pending.file.arrayBuffer());
    if (bytes.length !== pending.total) {
      throw new ClinicError("VALIDATION", "The selected file changed. Select the same file again.");
    }
    for (let offset = pending.offset; offset < bytes.length; offset += 8192) {
      const chunk = bytes.subarray(offset, Math.min(offset + 8192, bytes.length));
      let binary = "";
      for (const byte of chunk) binary += String.fromCharCode(byte);
      const response = await this.request<unknown>("clinic.media.upload", {
        action: "chunk",
        transferId: pending.transferId,
        offset,
        data: btoa(binary),
      });
      const nextOffset = offset + chunk.byteLength;
      if (!isRecord(response) || response.received !== nextOffset || response.total !== pending.total) {
        throw new ClinicError("UNKNOWN_OUTCOME", "The document transfer state is uncertain.", "unknown");
      }
      pending.offset = nextOffset;
      onProgress(nextOffset, pending.total);
    }
    pending.commitStarted = true;
    const receipt = await this.request<unknown>("clinic.media.upload", {
      action: "commit",
      transferId: pending.transferId,
      idempotencyKey: pending.idempotencyKey,
    });
    if (!isRecord(receipt) || receipt.committed !== true || !uuid(receipt.assetId)) {
      throw new ClinicError("UNKNOWN_OUTCOME", "The document save needs confirmation.", "unknown");
    }
    return receipt.assetId;
  }

  async cancel(pending: PendingStaffDocumentUpload): Promise<{ cancelled: boolean; committed: boolean; assetId?: string }> {
    const receipt = await this.request<unknown>("clinic.media.upload", {
      action: "cancel",
      transferId: pending.transferId,
      idempotencyKey: pending.idempotencyKey,
    });
    if (!isRecord(receipt) || typeof receipt.cancelled !== "boolean" || typeof receipt.committed !== "boolean"
      || (receipt.assetId !== undefined && !uuid(receipt.assetId))) {
      throw new ClinicError("INVALID_RESPONSE", "The document transfer result could not be confirmed.");
    }
    return receipt as { cancelled: boolean; committed: boolean; assetId?: string };
  }
}
