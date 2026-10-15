import { describe, expect, it } from 'vitest';
import { overviewLayout } from '../src/overviewLayout';

describe('overview arrangement', () => {
  for (const count of [1, 3, 4, 7, 10]) {
    it(`centers ${count} proportional windows without overlap`, () => {
      const sizes = Array.from({ length: count }, (_, i) => i === 0 ? { width: 1342, height: 680 } : { width: 760, height: 480 });
      const area = { width: 1160, height: 620 };
      const positions = overviewLayout(sizes, area);
      positions.forEach((p, i) => {
        expect(p.width / p.height).toBeCloseTo(sizes[i].width / sizes[i].height);
        expect(p.x).toBeGreaterThanOrEqual(-.001);
        expect(p.x + p.width).toBeLessThanOrEqual(area.width + .001);
        expect(p.y + p.height + 66).toBeLessThanOrEqual(area.height + .001);
        positions.slice(i + 1).forEach(q => {
          expect(p.x + p.width <= q.x + .001 || q.x + q.width <= p.x + .001 || p.y + p.height + 66 <= q.y + .001 || q.y + q.height + 66 <= p.y + .001).toBe(true);
        });
      });
      const left = Math.min(...positions.map(p => p.x)), right = Math.max(...positions.map(p => p.x + p.width));
      const top = Math.min(...positions.map(p => p.y)), bottom = Math.max(...positions.map(p => p.y + p.height + 66));
      expect(left + right).toBeCloseTo(area.width);
      expect(top + bottom).toBeCloseTo(area.height);
      if (count >= 4) expect(new Set(positions.map(p => p.row)).size).toBeGreaterThan(1);
    });
  }
});
