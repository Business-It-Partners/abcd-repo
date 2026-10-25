/** Trusted main-process selector. File selection uses the device's native picker; results are opaque and recipient bound. */
import type { BrowserWindow } from 'electron';
import { dialog } from 'electron';
import { LocalFileService, LocalFilesError, type FileRecipient, type FileSelection } from './localFiles';
import { validPickInput, type FilePickInput } from './filePickerContract';

type Pending = {
  owner: FileRecipient;
  signal: AbortSignal;
  resolve(value: FileSelection): void;
  reject(reason: Error): void;
  abort(): void;
  settled: boolean;
};

export class FilePickerCancelled extends Error {
  constructor(readonly code: 'CANCELLED' | 'FORBIDDEN' | 'BUSY' | 'UNAVAILABLE' = 'CANCELLED') { super(code); }
}

export class FilePickerCoordinator {
  private pending?: Pending;
  private nativeOpen = false;
  get busy() { return !!this.pending || this.nativeOpen; }

  constructor(private win: BrowserWindow, private files: LocalFileService, private generation: () => number, private active: () => boolean) {}

  pick(input: FilePickInput, owner: FileRecipient, appTitle: string, signal: AbortSignal): Promise<FileSelection> {
    if (this.busy) return Promise.reject(new FilePickerCancelled('BUSY'));
    if (signal.aborted) return Promise.reject(new FilePickerCancelled());
    if (!validPickInput(input) || !this.authorized(owner)) return Promise.reject(new FilePickerCancelled('FORBIDDEN'));
    if (this.win.isDestroyed()) return Promise.reject(new FilePickerCancelled('UNAVAILABLE'));

    return new Promise<FileSelection>((resolve, reject) => {
      const pending: Pending = {
        owner, signal, resolve, reject, settled: false,
        abort: () => this.finish(pending, new FilePickerCancelled()),
      };
      this.pending = pending;
      this.nativeOpen = true;
      signal.addEventListener('abort', pending.abort, { once: true });

      const safeTitle = appTitle.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80);
      let picker: Promise<Electron.OpenDialogReturnValue>;
      try {
        picker = dialog.showOpenDialog(this.win, {
          title: safeTitle ? `Choose files for ${safeTitle}` : 'Choose files for Sajilo Dental',
          buttonLabel: 'Choose',
          properties: input.maxSelections > 1 ? ['openFile', 'multiSelections'] : ['openFile'],
          filters: input.fileTypes === 'all' ? [] : input.fileTypes === 'documents'
            ? [{ name: 'Documents', extensions: ['pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx'] }]
            : [{ name: 'Medical images', extensions: input.fileTypes === 'images'
              ? ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff']
              : ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff', 'dcm', 'dicom'] }],
        });
      } catch {
        this.finish(pending, new FilePickerCancelled('UNAVAILABLE'));
        this.nativeOpen = false;
        return;
      }

      void picker.then(selected => {
        if (pending.settled) return;
        if (!this.authorized(owner) || this.pending !== pending) {
          this.finish(pending, new FilePickerCancelled('FORBIDDEN'));
          return;
        }
        if (selected.canceled || selected.filePaths.length === 0) {
          this.finish(pending, new FilePickerCancelled());
          return;
        }
        if (selected.filePaths.length > input.maxSelections) {
          this.finish(pending, new FilePickerCancelled('FORBIDDEN'));
          return;
        }
        try {
          const receipt = this.files.selectNativePaths(selected.filePaths, owner, input.fileTypes);
          if (!this.authorized(owner) || this.pending !== pending) {
            this.files.cancel(receipt.selectionId, owner);
            this.finish(pending, new FilePickerCancelled('FORBIDDEN'));
            return;
          }
          this.finish(pending, undefined, receipt);
        } catch (error) {
          this.finish(pending, new FilePickerCancelled(error instanceof LocalFilesError ? 'FORBIDDEN' : 'UNAVAILABLE'));
        }
      }, () => this.finish(pending, new FilePickerCancelled('UNAVAILABLE')))
        .finally(() => { this.nativeOpen = false; });
    });
  }

  private authorized(owner: FileRecipient): boolean {
    try { return this.active() && this.generation() === owner.generation && owner.authorized() === true; }
    catch { return false; }
  }

  private finish(pending: Pending, error?: Error, result?: FileSelection) {
    if (pending.settled) return;
    pending.settled = true;
    pending.signal.removeEventListener('abort', pending.abort);
    if (this.pending === pending) this.pending = undefined;
    if (error) pending.reject(error);
    else if (result) pending.resolve(result);
    else pending.reject(new FilePickerCancelled('UNAVAILABLE'));
  }

  cancelAll() { if (this.pending) this.finish(this.pending, new FilePickerCancelled()); }

  cancelRecipient(sender: object) {
    if (this.pending?.owner.sender === sender) this.cancelAll();
    this.files.revokeRecipient(sender);
  }
}
