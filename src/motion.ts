// FEWA dock field/motion and Genie flow/funnel/mesh; pinned reference: references/README.md.
export const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
export const GENIE_DURATION = 636;
export const canonicalProgress = (progress: number, minimizing: boolean) => minimizing ? clamp(progress) : 1 - clamp(progress);
export const DOCK = {
  size: 36, peak: 2.4, gap: 9, spread: 180, pad: 14.4,
  previewWidth: 57.6, previewHeight: 38.88, verticalPad: 12.6,
  bottom: 0,
};
export const dockHeight = DOCK.previewHeight + 2 * DOCK.verticalPad;
export const dockScaleForWidth = (width: number) => clamp(width / 1366, .72, 1.15);
export const dockHeightForWidth = (width: number) => dockHeight * dockScaleForWidth(width);
export interface Rect { x: number; y: number; width: number; height: number }
export interface DockSpec { id: string; width: number; height: number; magnifies?: boolean }
export function bell(distance: number, spread = DOCK.spread) {
  return Math.abs(distance) >= spread ? 0 : Math.cos(Math.abs(distance) / spread * Math.PI / 2) ** 2;
}
export function dockLayout(items: DockSpec[], center: number, baseline: number, cursor: number | null, intensity: number, maxWidth = Infinity, scale = 1) {
  const gap = DOCK.gap * scale;
  const total = items.reduce((n, i) => n + i.width, 0) + gap * (items.length - 1);
  let rest = center - total / 2;
  const measured = items.map(item => {
    const restCenter = rest + item.width / 2;
    rest += item.width + gap;
    const magnification = cursor === null || item.magnifies === false ? 1 : 1 + (DOCK.peak - 1) * bell(restCenter - cursor, DOCK.spread * scale) * clamp(intensity);
    return { ...item, scale: magnification, restCenter, width: item.width * magnification, height: item.height * magnification };
  });
  const liveWidth = measured.reduce((n, i) => n + i.width, 0) + gap * (items.length - 1);
  const fit = Math.min(1, Math.max(1, maxWidth) / liveWidth);
  let x = center - liveWidth * fit / 2;
  return { width: liveWidth * fit, left: x, items: measured.map(item => {
    const width = item.width * fit, height = item.height * fit;
    const result = { ...item, width, height, x, y: baseline - height };
    x += width + gap * fit;
    return result;
  }) };
}
export class Spring {
  value: number; target: number; velocity = 0;
  constructor(public stiffness: number, value = 0) { this.value = this.target = value; }
  snap(value: number) { this.value = this.target = value; this.velocity = 0; }
  tick(dt: number) {
    const steps = Math.max(1, Math.ceil(Math.min(dt, .05) / .006));
    const step = Math.min(dt, .05) / steps;
    for (let i = 0; i < steps; i++) {
      this.velocity += (this.stiffness * (this.target - this.value) - 2 * Math.sqrt(this.stiffness) * this.velocity) * step;
      this.value += this.velocity * step;
    }
    if (this.settled) this.snap(this.target);
  }
  get settled() { return Math.abs(this.target - this.value) < .0008 && Math.abs(this.velocity) < .0008; }
}
export function ease(value: number) { const t = clamp(value); return t < .5 ? 2 * t * t : -2 * t * t + 4 * t - 1; }
export function usable(source: Rect, target: Rect) {
  return source.width > 0 && source.height >= target.height && target.width > 0 && target.height > 0 && target.y > source.y;
}
export function meshPositions(source: Rect, target: Rect, progress: number, rows: number, out = new Float32Array(rows * 4)) {
  const t = clamp(progress), pinch = clamp(t / .5), travel = clamp((t - .4) / .6);
  const extent = Math.max(.000001, target.y - source.y);
  const top = source.y + extent * travel;
  const bottom = Math.min(source.y + source.height + extent * travel, target.y + target.height);
  for (let row = 0; row < rows; row++) {
    const y = top + (bottom - top) * row / (rows - 1);
    const s = ease((y - source.y) / extent);
    out[row * 4] = source.x + (target.x - source.x) * pinch * s;
    out[row * 4 + 1] = y;
    out[row * 4 + 2] = source.x + source.width + (target.x + target.width - source.x - source.width) * pinch * s;
    out[row * 4 + 3] = y;
  }
  return out;
}
