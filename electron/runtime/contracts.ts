export const runtimeIds = ['studio', 'records'] as const;
/** Historical display aliases for the two original sample packages. New first-party apps use package IDs. */
export type RuntimeId = string;
export function isRuntimeId(value: unknown): value is RuntimeId { return value === 'studio' || value === 'records' || typeof value === 'string' && /^company\.[a-z][a-z0-9.-]{1,70}$/.test(value); }
export function packageIdForRuntime(id: RuntimeId) { return id === 'studio' ? 'company.sample.alpha' : id === 'records' ? 'company.sample.beta' : id; }
export function runtimeIdForPackage(id: string) { return id === 'company.sample.alpha' ? 'studio' : id === 'company.sample.beta' ? 'records' : id; }
export function runtimeHost(id: RuntimeId) { return id === 'studio' ? 'alpha' : id === 'records' ? 'beta' : packageIdForRuntime(id); }
export type RuntimeRect = { x: number; y: number; width: number; height: number };
export type RuntimeLayout = { id: RuntimeId; open: boolean; visible: boolean; rect: RuntimeRect };
export type RuntimeState = { id: RuntimeId; phase: 'loading' | 'ready' | 'failed'; dirty: boolean; modal: boolean; writeState?: 'none' | 'pending' | 'unknown'; reason?: string; snapshot?: string };
export function parseLayout(input: unknown): RuntimeLayout[] {
  if (!Array.isArray(input) || input.length > 16) throw new Error('Invalid runtime layout');
  const seen = new Set();
  for (const v of input) {
    if (!v || Object.keys(v).sort().join() !== 'id,open,rect,visible' || !isRuntimeId(v.id) || seen.has(v.id) || typeof v.open !== 'boolean' || typeof v.visible !== 'boolean' || !v.rect || Object.keys(v.rect).sort().join() !== 'height,width,x,y') throw new Error('Invalid runtime layout');
    seen.add(v.id);
    if (!Object.values(v.rect).every(n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 8192) || v.rect.width < 1 || v.rect.height < 1 || v.rect.width * v.rect.height > 16_000_000) throw new Error('Invalid runtime bounds');
  }
  if (input.filter(v => v.visible).length > 1) throw new Error('Only one native input surface');
  return input;
}
export function fixtureAsset(url: string, host: string): string | undefined {
  try { const u = new URL(url); return u.protocol === 'dental-fixture:' && u.host === host && !u.search && !u.hash && ['/index.html', '/app.js', '/app.css'].includes(u.pathname) ? u.pathname.slice(1) : undefined; } catch { return undefined; }
}
/** BGRA/RGBA buffers share byte order; copy opaque/alpha pixels without channel conversion. */
export function compositePixels(base: Uint8Array, width: number, height: number, layer: Uint8Array, lw: number, lh: number, target: RuntimeRect & { radius?: number }) {
  if (base.length !== width * height * 4 || layer.length !== lw * lh * 4) throw new Error('Invalid bitmap');
  const radius = Math.max(0, Math.min(target.radius ?? 0, target.width / 2, target.height / 2));
  for (let y = Math.max(0, Math.floor(target.y)); y < Math.min(height, Math.ceil(target.y + target.height)); y++) {
    for (let x = Math.max(0, Math.floor(target.x)); x < Math.min(width, Math.ceil(target.x + target.width)); x++) {
      const sx = Math.min(lw - 1, Math.max(0, Math.floor((x - target.x) / target.width * lw)));
      const sy = Math.min(lh - 1, Math.max(0, Math.floor((y - target.y) / target.height * lh)));
      const b = (y * width + x) * 4, s = (sy * lw + sx) * 4, sourceAlpha = layer[s + 3] / 255;
      const cx = Math.max(target.x + radius, Math.min(x + 0.5, target.x + target.width - radius));
      const cy = Math.max(target.y + radius, Math.min(y + 0.5, target.y + target.height - radius));
      const coverage = radius ? Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy))) : 1;
      const alpha = sourceAlpha * coverage;
      for (let c = 0; c < 3; c++) base[b + c] = Math.round(layer[s + c] * alpha + base[b + c] * (1 - alpha));
      base[b + 3] = Math.round(alpha * 255 + base[b + 3] * (1 - alpha));
    }
  }
}
