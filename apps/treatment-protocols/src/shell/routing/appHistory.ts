import type { BrowserAppBridge } from "../browserClinicClient";

type AppHistoryEntry<T> = { id: string; page: T };

export type AppHistory<T> = {
  current(): T;
  subscribe(listener: (page: T) => void): () => void;
  push(page: T): void;
  replace(page: T): void;
  reset(page: T): void;
  back(discardForward?: boolean): boolean;
  refresh(): void;
  dispose(): void;
};

export class BrowserAppHistory<T> implements AppHistory<T> {
  private entries: AppHistoryEntry<T>[];
  private index = 0;
  private listeners = new Set<(page: T) => void>();
  private onNavigateBack = () => {
    if (this.index <= 0 || !this.canNavigate()) return;
    this.index -= 1;
    this.publish();
    this.notify();
  };

  constructor(
    private readonly bridge: BrowserAppBridge,
    initialPage: T,
    private readonly canNavigate: () => boolean = () => true,
    private readonly backPreservesDraft: (page: T, previousPage?: T) => boolean = () => false,
  ) {
    this.entries = [{ id: crypto.randomUUID(), page: initialPage }];
    window.addEventListener("dental-os:navigate-back", this.onNavigateBack);
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

  back(discardForward = false): boolean {
    if (this.index <= 0) return false;
    this.index -= 1;
    if (discardForward) this.entries = this.entries.slice(0, this.index + 1);
    this.publish();
    this.notify();
    return true;
  }

  refresh(): void { this.publish(); }

  dispose(): void {
    window.removeEventListener("dental-os:navigate-back", this.onNavigateBack);
    this.listeners.clear();
  }

  private publish(): void {
    const page = this.entries[this.index].page;
    const previousPage = this.index > 0 ? this.entries[this.index - 1].page : undefined;
    this.bridge.navigation.report({
      canGoBack: this.index > 0,
      canNavigate: this.canNavigate() || this.backPreservesDraft(page, previousPage),
    });
  }

  private notify(): void {
    for (const listener of this.listeners) listener(this.current());
  }
}
