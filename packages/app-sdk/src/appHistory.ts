import type { AppNavigationSnapshot, AppSdk } from '../../../electron/sdk/contracts';

type AppHistoryEntry<T> = { id: string; page: T };

/**
 * Keeps app-owned page state in this renderer and mirrors only random entry IDs
 * to the OS. The shell can request a page transition without learning routes or
 * patient/business identifiers.
 */
export class AppHistory<T> {
  private entries: AppHistoryEntry<T>[];
  private index = 0;
  private listeners = new Set<(page: T) => void>();
  private unsubscribe: () => void;

  constructor(private readonly bridge: Pick<AppSdk, 'navigation'>, initialPage: T, private readonly canNavigate: () => boolean = () => true) {
    this.entries = [{ id: crypto.randomUUID(), page: initialPage }];
    this.unsubscribe = bridge.navigation.onRequest(request => {
      const target = this.entries.findIndex(entry => entry.id === request.entry);
      if (target < 0 || target === this.index || !this.canNavigate()) return;
      if (request.direction === 'back' && target >= this.index) return;
      if (request.direction === 'forward' && target <= this.index) return;
      this.index = target;
      this.publish();
      this.notify();
    });
    this.publish();
  }

  current(): T { return this.entries[this.index].page; }

  subscribe(listener: (page: T) => void): () => void {
    this.listeners.add(listener);
    listener(this.current());
    return () => this.listeners.delete(listener);
  }

  push(page: T): void {
    this.entries = [...this.entries.slice(0, this.index + 1), { id: crypto.randomUUID(), page }];
    if (this.entries.length > 64) this.entries.shift();
    this.index = this.entries.length - 1;
    this.publish();
    this.notify();
  }

  replace(page: T): void {
    this.entries[this.index] = { ...this.entries[this.index], page };
    this.publish();
    this.notify();
  }

  reset(page: T): void {
    this.entries = [{ id: crypto.randomUUID(), page }];
    this.index = 0;
    this.publish();
    this.notify();
  }

  /** App-owned Cancel/Exit flows may return to the parent and discard the abandoned page. */
  back(discardForward = false): boolean {
    if (this.index <= 0) return false;
    this.index--;
    if (discardForward) this.entries = this.entries.slice(0, this.index + 1);
    this.publish();
    this.notify();
    return true;
  }

  dispose(): void {
    this.unsubscribe();
    this.listeners.clear();
  }

  private snapshot(): AppNavigationSnapshot {
    return { entries: this.entries.map(entry => entry.id), index: this.index };
  }

  private publish(): void { this.bridge.navigation.report(this.snapshot()); }
  private notify(): void { for (const listener of this.listeners) listener(this.current()); }
}
