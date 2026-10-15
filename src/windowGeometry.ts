import { clamp, DOCK, dockHeight, type Rect } from './motion';

export type Size = { width: number; height: number };
export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';
const comingSoon = (title: string) => ({ title, preferred: { width: 760, height: 480 }, minimum: { width: 480, height: 300 } });
export const WINDOW_SPECS = {
  store: { title: 'App Store', preferred: { width: 1060, height: 660 }, minimum: { width: 560, height: 400 } },
  studio: { title: 'Motion Studio', preferred: { width: 760, height: 480 }, minimum: { width: 540, height: 340 } },
  followups: { title: 'Follow-ups', preferred: { width: 1200, height: 680 }, minimum: { width: 760, height: 420 } },
  records: { title: 'Records', preferred: { width: 1040, height: 620 }, minimum: { width: 640, height: 360 } },
  appointments: comingSoon('Appointments'),
  workentry: comingSoon('Work Entry'),
  patients: comingSoon('Patient Record'),
  treatment: comingSoon('Treatment Progress'),
  lab: { title: 'Lab Tracker', preferred: { width: 1180, height: 660 }, minimum: { width: 600, height: 400 } },
  finance: comingSoon('Finance'),
  staff: { title: 'Staff', preferred: { width: 1060, height: 650 }, minimum: { width: 540, height: 380 } },
  protocols: comingSoon('Treatment Protocols'),
  calendar: comingSoon('Calendar'),
} as const;
export type WindowId = keyof typeof WINDOW_SPECS;
export const WINDOW_IDS = Object.keys(WINDOW_SPECS) as WindowId[];

export function workArea(size: Size): Rect {
  const x = Math.min(12, size.width * .05), y = Math.min(4, size.height * .1);
  const bottom = Math.min(DOCK.bottom + dockHeight + DOCK.windowGap, size.height * .2);
  return { x, y, width: Math.max(1, size.width - 2 * x), height: Math.max(1, size.height - y - bottom) };
}

export function fitBounds(bounds: Rect, size: Size, minimum: Size): Rect {
  const area = workArea(size);
  const width = clamp(bounds.width, Math.min(minimum.width, area.width), area.width);
  const height = clamp(bounds.height, Math.min(minimum.height, area.height), area.height);
  return { x: clamp(bounds.x, area.x, area.x + area.width - width), y: clamp(bounds.y, area.y, area.y + area.height - height), width, height };
}

export function initialBounds(id: WindowId, size: Size): Rect {
  const spec = WINDOW_SPECS[id], area = workArea(size);
  if (id === 'records' || id === 'followups') return { ...area };
  const width = Math.min(spec.preferred.width, area.width), height = Math.min(spec.preferred.height, area.height);
  return fitBounds({ x: area.x + (area.width - width) / 2, y: area.y + (area.height - height) / 2, width, height }, size, spec.minimum);
}

export function resizeBounds(start: Rect, edge: ResizeEdge, dx: number, dy: number, size: Size, minimum: Size): Rect {
  const area = workArea(size), right = start.x + start.width, bottom = start.y + start.height;
  const minWidth = Math.min(minimum.width, area.width), minHeight = Math.min(minimum.height, area.height);
  let l = start.x, r = right, t = start.y, b = bottom;
  if (edge.includes('w')) l = clamp(start.x + dx, area.x, right - minWidth);
  if (edge.includes('e')) r = clamp(right + dx, start.x + minWidth, area.x + area.width);
  if (edge.includes('n')) t = clamp(start.y + dy, area.y, bottom - minHeight);
  if (edge.includes('s')) b = clamp(bottom + dy, start.y + minHeight, area.y + area.height);
  return { x: l, y: t, width: r - l, height: b - t };
}
