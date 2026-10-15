import type { Size } from './windowGeometry';

/** Use one scale for all windows; balance rows, then center each row and the group. */
export function overviewLayout(windows: Size[], area: Size) {
  const gap = 32, caption = 66;
  if (!windows.length) return [];
  let best: { rows: Size[][]; scale: number } | undefined;
  for (let rowCount = 1; rowCount <= windows.length; rowCount++) {
    const rows: Size[][] = [];
    let offset = 0;
    for (let row = 0; row < rowCount; row++) {
      const count = Math.ceil((windows.length - offset) / (rowCount - row));
      rows.push(windows.slice(offset, offset + count)); offset += count;
    }
    const widthScale = Math.min(...rows.map(row => Math.max(1, area.width - gap * (row.length - 1)) / row.reduce((sum, w) => sum + w.width, 0)));
    const heightScale = Math.max(1, area.height - rowCount * caption - gap * (rowCount - 1)) / rows.reduce((sum, row) => sum + Math.max(...row.map(w => w.height)), 0);
    const scale = Math.min(.72, widthScale, heightScale);
    if (!best || scale > best.scale) best = { rows, scale };
  }
  const { rows, scale } = best!;
  const height = rows.reduce((sum, row) => sum + Math.max(...row.map(w => w.height)) * scale + caption, 0) + gap * (rows.length - 1);
  let y = Math.max(0, (area.height - height) / 2);
  return rows.flatMap((row, rowIndex) => {
    const rowHeight = Math.max(...row.map(w => w.height)) * scale;
    const rowWidth = row.reduce((sum, w) => sum + w.width * scale, 0) + gap * (row.length - 1);
    let x = (area.width - rowWidth) / 2;
    const positions = row.map(w => {
      const width = w.width * scale, height = w.height * scale;
      const position = { x, y: y + (rowHeight - height) / 2, width, height, row: rowIndex };
      x += width + gap; return position;
    });
    y += rowHeight + caption + gap;
    return positions;
  });
}
