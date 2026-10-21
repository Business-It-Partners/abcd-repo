/** Renderer-safe Store view, never release URLs, bearer tokens or filesystem paths. */
export type StoreApp = { id: string; title: string; description: string; version: string; notes: string; capabilities: string[]; available: boolean; installedVersion: string | null; activeVersion: string | null; pendingVersion: string | null; pendingReady: boolean; trialVersion: string | null; knownGoodVersion: string | null; reason: string };
export type StoreView = { phase: 'idle' | 'refreshing' | 'ready' | 'unavailable'; apps: StoreApp[]; canInstall: boolean; job: null | { appId: string; phase: 'authorizing' | 'downloading' | 'verifying' | 'installing'; received: number; total: number }; message: string };
export type StoreResult = { ok: true } | { ok: false; code: 'INVALID' | 'BUSY' | 'DENIED' | 'CANCELLED' | 'UNAVAILABLE' };
export const sampleWindows: Record<string, 'studio' | 'records'> = { 'company.sample.alpha': 'studio', 'company.sample.beta': 'records' };
