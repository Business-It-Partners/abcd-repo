export function paginationWindow(page: number, totalPages: number, maxVisible = 10): number[] {
  if (totalPages <= 0 || maxVisible <= 0) return [];

  const visible = Math.min(Math.floor(maxVisible), Math.floor(totalPages));
  const current = Math.min(Math.max(1, Math.floor(page)), Math.floor(totalPages));
  let start = Math.max(1, current - Math.floor(visible / 2));
  const end = Math.min(totalPages, start + visible - 1);
  start = Math.max(1, end - visible + 1);

  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
