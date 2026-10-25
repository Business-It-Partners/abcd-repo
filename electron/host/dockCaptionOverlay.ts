import { BrowserWindow } from 'electron';

type Rect = { x: number; y: number; width: number; height: number };
type DockCaption = { label: string; rect: Rect };

/** Keeps the OS dock caption above native WebContentsView app surfaces. */
export class DockCaptionOverlay {
  private readonly window: BrowserWindow;
  private loaded = false;
  private disposed = false;
  private current: DockCaption | undefined;
  private lastPublished = '';

  private readonly syncBounds = () => {
    if (this.disposed || this.host.isDestroyed() || this.window.isDestroyed()) return;
    this.window.setBounds(this.host.getContentBounds(), false);
  };

  constructor(private readonly host: BrowserWindow, preloadPath: string, pagePath: string) {
    const bounds = host.getContentBounds();
    this.window = new BrowserWindow({
      ...bounds,
      parent: host,
      frame: false,
      transparent: true,
      backgroundColor: '#00000000',
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: false,
      skipTaskbar: true,
      hasShadow: false,
      show: false,
      webPreferences: {
        preload: preloadPath,
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        spellcheck: false,
        backgroundThrottling: false,
        webSecurity: true,
      },
    });
    this.window.setIgnoreMouseEvents(true, { forward: process.platform !== 'linux' });
    this.window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    this.window.webContents.on('will-navigate', event => event.preventDefault());
    this.window.webContents.on('did-finish-load', () => {
      if (this.disposed) return;
      this.loaded = true;
      this.syncBounds();
      this.publish();
    });
    this.window.on('closed', () => { this.disposed = true; });

    host.on('move', this.syncBounds);
    host.on('resize', this.syncBounds);
    host.on('enter-full-screen', this.syncBounds);
    host.on('leave-full-screen', this.syncBounds);
    host.on('blur', this.hide);
    host.on('minimize', this.hide);
    host.on('closed', this.dispose);
    void this.window.loadFile(pagePath).catch(() => this.dispose());
  }

  show(input: unknown) {
    const caption = this.parse(input);
    if (!caption) return;
    this.current = caption;
    this.publish();
  }

  hide = () => {
    const wasActive = this.current !== undefined;
    this.current = undefined;
    if (this.disposed || this.window.isDestroyed()) return;
    this.lastPublished = '';
    if (wasActive && this.loaded) this.window.webContents.send('dock-caption:update', null);
    this.window.hide();
  };

  dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    if (!this.host.isDestroyed()) {
      this.host.removeListener('move', this.syncBounds);
      this.host.removeListener('resize', this.syncBounds);
      this.host.removeListener('enter-full-screen', this.syncBounds);
      this.host.removeListener('leave-full-screen', this.syncBounds);
      this.host.removeListener('blur', this.hide);
      this.host.removeListener('minimize', this.hide);
      this.host.removeListener('closed', this.dispose);
    }
    if (!this.window.isDestroyed()) this.window.destroy();
  };

  private publish() {
    if (!this.current || !this.loaded || this.disposed || this.window.isDestroyed()) return;
    const { label, rect } = this.current;
    const key = `${label}\u0000${rect.x},${rect.y},${rect.width},${rect.height}`;
    if (key !== this.lastPublished) {
      this.lastPublished = key;
      this.window.webContents.send('dock-caption:update', this.current);
    }
    if (!this.window.isVisible() && !this.host.isDestroyed() && !this.host.isMinimized()) this.window.showInactive();
  }

  private parse(input: unknown): DockCaption | undefined {
    if (!input || typeof input !== 'object') return undefined;
    const value = input as Record<string, unknown>;
    const label = typeof value.label === 'string' ? value.label.trim() : '';
    const rect = value.rect && typeof value.rect === 'object' ? value.rect as Record<string, unknown> : undefined;
    if (!label || label.length > 100 || !rect) return undefined;
    const values = ['x', 'y', 'width', 'height'].map(key => rect[key]);
    if (!values.every(item => typeof item === 'number' && Number.isFinite(item))) return undefined;
    const [rawX, rawY, rawWidth, rawHeight] = values as number[];
    const [hostWidth, hostHeight] = this.host.getContentSize();
    if (rawWidth < 1 || rawWidth > Math.min(600, hostWidth) || rawHeight < 16 || rawHeight > 64) return undefined;
    const quantize = (number: number) => Math.round(number * 2) / 2;
    const width = quantize(rawWidth), height = quantize(rawHeight);
    const x = Math.max(0, Math.min(quantize(rawX), hostWidth - width));
    const y = Math.max(0, Math.min(quantize(rawY), hostHeight - height));
    return { label, rect: { x, y, width, height } };
  }
}
