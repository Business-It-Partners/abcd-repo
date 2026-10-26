/// <reference types="vite/client" />
export {};
declare global {
  interface Window {
    desktop?: {
      support():Promise<{ok:boolean;cancelled?:boolean}>;
      shell: { reload(): Promise<boolean> };
      store: { action(kind: 'view', input?: undefined, generation?: number): Promise<import('../electron/distribution/contracts').StoreView>; action(kind: 'refresh' | 'cancel' | 'install' | 'uninstall' | 'update-now', input?: string, generation?: number): Promise<import('../electron/distribution/contracts').StoreResult>; artwork(appId: string, expectedSha256?: string, generation?: number): Promise<string | null>; subscribe(callback: (value: import('../electron/distribution/contracts').StoreView) => void): () => void };
      developmentApps: { view(): Promise<import('../electron/developmentApps').DevelopmentAppView> };
      identity: { view(): Promise<import('../electron/identity/contracts').SessionView>; clinicLogo(): Promise<string | undefined>; action(kind: 'login' | 'lock' | 'logout' | 'restore' | 'workspace-role', input?: unknown): Promise<import('../electron/identity/contracts').ActionResult>; devCredentialsAvailable(): Promise<boolean>; devCredentials(): Promise<{ email: string; password: string } | undefined>; subscribe(callback: (value: import('../electron/identity/contracts').SessionView) => void): () => void };
      runtime: {
        sync(value: unknown, generation?: number): Promise<void>;
        navigate(id: string, direction: 'back' | 'forward', generation?: number, discardDirty?: boolean, preserveDraft?: boolean): Promise<boolean>;
        hideAll(generation?: number): boolean;
        restart(id: string, generation?: number): Promise<void>;
        resume(id: string, generation?: number): Promise<void>;
        selectModule(id: string, moduleId: string): Promise<{ ok: boolean; code?: string }>;
        discoverApp(id: string): Promise<{
          ok: boolean;
          value?: {
            runtimeId: string; appId: string; title: string; description: string; iconDataUrl: string;
            modules: { id: string; label: string; tab: string; capability: string }[]; preferredContentWidth?: number;
          } | null;
          error?: { code: string; message: string; outcome: 'not_sent' };
        }>;
        subscribe(callback: (kind: string, value: unknown) => void): () => void;
      };
      resourcePressure: { subscribe(callback: (value: unknown) => void): () => void; acknowledge(requestId: string): void };
      preferences(value?: { overviewShortcutEnabled: boolean }): Promise<{ overviewShortcutEnabled: boolean }>;
      status(): Promise<{ phase: string }>;
      onHostTransition(listener: (transitioning: boolean) => void): () => void;
      control(action: 'close' | 'minimize'): Promise<void>;
      capture(rect: { x: number; y: number; width: number; height: number }, generation?: number): Promise<string>;
    };
    motionStats?: { frames: number; intervals: number[]; renderer: string; direction: string; active: boolean };
  }
}
