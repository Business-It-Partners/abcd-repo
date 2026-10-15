/// <reference types="vite/client" />
export {};
declare global {
  interface Window {
    desktop?: {
      runtime: { sync(value: unknown): Promise<void>; restart(id: string): Promise<void>; subscribe(callback: (kind: string, value: unknown) => void): () => void };
      preferences(value?: { overviewShortcutEnabled: boolean }): Promise<{ overviewShortcutEnabled: boolean }>;
      status(): Promise<{ phase: string }>;
      onHostTransition(listener: (transitioning: boolean) => void): () => void;
      control(action: 'close' | 'minimize'): Promise<void>;
      capture(rect: { x: number; y: number; width: number; height: number }): Promise<string>;
    };
    motionStats?: { frames: number; intervals: number[]; renderer: string; direction: string; active: boolean };
  }
}
