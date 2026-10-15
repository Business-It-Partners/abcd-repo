import { statfsSync } from 'node:fs';
export interface StorageHost { availableBytes(directory: string): number; privateModes: boolean }
export const storageHost: StorageHost = {
  privateModes: process.platform !== 'win32',
  availableBytes(directory) { const s = statfsSync(directory); return s.bavail * s.bsize; },
};
