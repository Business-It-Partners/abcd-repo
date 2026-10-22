export type RenewalObject = { base64: string; sha256: string; previousSha256: string };
export type MetadataBucket = {
  get(key: string): Promise<null | { httpEtag: string; arrayBuffer(): Promise<ArrayBuffer | Uint8Array> }>;
  put(key: string, bytes: Uint8Array, options: { onlyIf: Headers; httpMetadata: { contentType: string; cacheControl: string } }): Promise<unknown>;
};
export type RenewalPublicationResult = {
  published: boolean;
  conflict?: boolean;
  advanced: { key: string; sequence: number }[];
  packageWrites: 0;
};
export function publishMetadataRenewal(bucket: MetadataBucket, publication: Record<string, RenewalObject>, now?: number): Promise<RenewalPublicationResult>;
