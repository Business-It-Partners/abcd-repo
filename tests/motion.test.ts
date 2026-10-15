import { describe, expect, it } from 'vitest';
import { DOCK, bell, canonicalProgress, dockLayout, meshPositions, Spring, type Rect } from '../src/motion';
describe('FEWA motion port', () => {
  it('has a symmetric bounded bell with smooth zero shoulders', () => {
    expect(bell(0)).toBe(1); expect(bell(200)).toBe(0); expect(bell(220)).toBe(0);
    expect(bell(-80)).toBe(bell(80)); expect(bell(199.9)).toBeLessThan(.000001);
  });
  it('centers the complete live dock and preserves gaps at every pointer position', () => {
    const specs = [{ id: 'a', width: 40, height: 40 }, { id: 'b', width: 40, height: 40 }, { id: 'preview', width: 64, height: 43.2 }];
    for (let cursor = 0; cursor < 900; cursor += 9) {
      const layout = dockLayout(specs, 450, 700, cursor, 1);
      expect(layout.left + layout.width / 2).toBeCloseTo(450);
      for (let i = 1; i < layout.items.length; i++) expect(layout.items[i].x - layout.items[i - 1].x - layout.items[i - 1].width).toBeCloseTo(DOCK.gap);
    }
  });
  it('fits a large app collection without clipping or overlapping during hover', () => {
    const specs = Array.from({ length: 25 }, (_, i) => ({ id: String(i), width: i < 13 ? 36 : 57.6, height: 36 }));
    for (const width of [480, 800, 1366]) for (const cursor of [12, width / 2, width - 12]) {
      const layout = dockLayout(specs, width / 2, 700, cursor, 1, width - 53);
      expect(layout.left).toBeGreaterThanOrEqual(26);
      expect(layout.left + layout.width).toBeLessThanOrEqual(width - 26);
      for (let i = 1; i < layout.items.length; i++) expect(layout.items[i].x).toBeGreaterThan(layout.items[i - 1].x + layout.items[i - 1].width);
      expect(layout.items.at(-1)!.x + layout.items.at(-1)!.width).toBeCloseTo(layout.left + layout.width);
    }
  });
  it('lands on both exact rectangles and keeps the mesh fold-free along the trip', () => {
    const s: Rect = { x: 250, y: 100, width: 700, height: 430 };
    for (const targetX of [30, 500, 1100]) {
      const d = { x: targetX, y: 710, width: 64, height: 43.2 };
      const start = meshPositions(s, d, 0, 100), end = meshPositions(s, d, 1, 100);
      expect([...start.slice(0, 4)]).toEqual([250, 100, 950, 100]);
      expect(end[0]).toBeCloseTo(d.x); expect(end[1]).toBeCloseTo(d.y); expect(end.at(-1)).toBeCloseTo(d.y + d.height, 3);
      for (let t = 0; t <= 1; t += .01) {
        const mesh = meshPositions(s, d, t, 100);
        for (let r = 0; r < 100; r++) {
          expect(mesh[r * 4 + 2]).toBeGreaterThan(mesh[r * 4]);
          if (r) expect(mesh[r * 4 + 1]).toBeGreaterThan(mesh[(r - 1) * 4 + 1]);
        }
      }
    }
  });
  it('pinches before traveling and shares the reverse clock', () => {
    const s = { x: 100, y: 100, width: 500, height: 300 }, d = { x: 700, y: 650, width: 64, height: 43 };
    const mesh = meshPositions(s, d, .3, 64);
    expect(mesh[1]).toBe(100); expect(mesh.at(-1)).toBe(400); expect(mesh.at(-4)).toBeGreaterThan(100);
    for (const t of [.1, .4, .8]) {
      expect(canonicalProgress(t, false)).toBeCloseTo(canonicalProgress(1 - t, true));
      expect([...meshPositions(s, d, canonicalProgress(t, false), 64)]).toEqual([...meshPositions(s, d, canonicalProgress(1 - t, true), 64)]);
    }
  });
  it('settles without overshoot at different display refresh rates', () => {
    for (const hz of [30, 60, 144]) {
      const spring = new Spring(1200); spring.target = 1;
      for (let i = 0; i < hz * 2; i++) { spring.tick(1 / hz); expect(spring.value).toBeLessThanOrEqual(1); }
      expect(spring.value).toBe(1); expect(spring.settled).toBe(true);
    }
  });
});
