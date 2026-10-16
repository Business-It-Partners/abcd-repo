/// <reference types="vite/client" />
export {};
declare global {
  interface Window {
    desktop?: {
      store: { action(kind: 'view', input?: undefined, generation?: number): Promise<import('../electron/distribution/contracts').StoreView>; action(kind: 'refresh' | 'cancel' | 'install' | 'uninstall' | 'update-now', input?: string, generation?: number): Promise<import('../electron/distribution/contracts').StoreResult>; subscribe(callback: (value: import('../electron/distribution/contracts').StoreView) => void): () => void };
      identity: { view(): Promise<import('../electron/identity/contracts').SessionView>; action(kind: 'login' | 'lock' | 'logout', input?: unknown): Promise<import('../electron/identity/contracts').ActionResult>; subscribe(callback: (value: import('../electron/identity/contracts').SessionView) => void): () => void };
      runtime: { sync(value: unknown, generation?: number): Promise<void>; restart(id: string, generation?: number): Promise<void>; subscribe(callback: (kind: string, value: unknown) => void): () => void };
      preferences(value?: { overviewShortcutEnabled: boolean }): Promise<{ overviewShortcutEnabled: boolean }>;
      status(): Promise<{ phase: string }>;
      onHostTransition(listener: (transitioning: boolean) => void): () => void;
      control(action: 'close' | 'minimize'): Promise<void>;
      capture(rect: { x: number; y: number; width: number; height: number }, generation?: number): Promise<string>;
    };
    motionStats?: { frames: number; intervals: number[]; renderer: string; direction: string; active: boolean };
  }
}
