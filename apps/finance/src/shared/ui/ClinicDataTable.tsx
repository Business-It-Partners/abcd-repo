"use client";

import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { Pagination, Table, TableWrap, Td, Th, Tr, clinicTableStyles as styles } from "./ClinicTable";

export interface ClinicTableColumn<T> { key: string; header: ReactNode; align?: "left" | "center" | "right"; width?: number | string; sortable?: boolean; value?: (row: T) => string | number | null | undefined; render?: (row: T, index: number) => ReactNode; total?: boolean; totalFormat?: (sum: number) => ReactNode; nowrap?: boolean; tone?: "default" | "semantic"; emphasis?: "regular" | "strong"; }
interface ClinicDataTableProps<T> { rows: T[]; columns: ClinicTableColumn<T>[]; rowKey: (row: T) => string; title?: ReactNode; action?: ReactNode; filters?: ReactNode; pageSize?: number; paginate?: boolean; minWidth?: number; noun?: string; loading?: boolean; loadingLabel?: string; skeletonRows?: number; error?: string | null; errorHint?: string; empty?: ReactNode; onRowClick?: (row: T) => void; rowStyle?: (row: T) => CSSProperties | undefined; totalsLabel?: string; totalsAlign?: "left" | "center" | "right"; square?: boolean; standardPage?: boolean; }
type SortDir = "asc" | "desc";
export const CLINIC_TABLE_SKELETON_ROWS = 7;
function cellValue<T>(column: ClinicTableColumn<T>, row: T) { return column.value ? column.value(row) : (row as Record<string, unknown>)[column.key] as string | number | null | undefined; }
const semanticColumnPattern = /(status|progress|balance|amount|price|paid|payment|due|total|salary|type|role|action|arrived|no.?show|cancel|sent|received|fitted|restore)/i;
function cellTone<T>(column: ClinicTableColumn<T>) { return column.tone ?? (semanticColumnPattern.test(column.key) ? "semantic" : "default"); }
function cellEmphasis<T>(column: ClinicTableColumn<T>, columnIndex: number) {
  // A row needs one scanning anchor, not a wall of competing bold values.
  // Pages can still opt in through `emphasis`, but only the first column is
  // primary by default.
  return column.emphasis ?? (columnIndex === 0 ? "strong" : "regular");
}

export function ClinicDataTable<T>({ rows, columns, rowKey, title, action, filters, pageSize = 10, paginate = true, minWidth, noun = "records", loading, loadingLabel = "Loading…", skeletonRows = CLINIC_TABLE_SKELETON_ROWS, error, errorHint, empty, onRowClick, rowStyle, totalsLabel = "Total:", totalsAlign = "right", standardPage = false }: ClinicDataTableProps<T>) {
  const [page, setPage] = useState(1); const [sortKey, setSortKey] = useState<string | null>(null); const [sortDir, setSortDir] = useState<SortDir>("asc");
  useEffect(() => setPage(1), [rows.length, pageSize]);
  const sorted = useMemo(() => { if (!sortKey) return rows; const column = columns.find((item) => item.key === sortKey); if (!column) return rows; return [...rows].sort((a, b) => { const av = cellValue(column, a); const bv = cellValue(column, b); if (av == null || av === "") return 1; if (bv == null || bv === "") return -1; const comparison = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }); return sortDir === "asc" ? comparison : -comparison; }); }, [columns, rows, sortDir, sortKey]);
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize)); const safePage = Math.min(page, totalPages); const start = paginate ? (safePage - 1) * pageSize : 0; const pageRows = paginate ? sorted.slice(start, start + pageSize) : sorted; const firstTotalIndex = columns.findIndex((column) => column.total); const hasTotals = firstTotalIndex >= 0;
  const sums = useMemo(() => Object.fromEntries(columns.filter((column) => column.total).map((column) => [column.key, sorted.reduce((sum, row) => { const value = cellValue(column, row); return sum + (typeof value === "number" ? value : Number(value) || 0); }, 0)])), [columns, sorted]);
  function toggleSort(key: string) { if (sortKey === key) setSortDir((current) => current === "asc" ? "desc" : "asc"); else { setSortKey(key); setSortDir("asc"); } }
  const tableHead = <thead><tr>{columns.map((column) => <Th key={column.key} align={column.align} aria-sort={column.sortable && sortKey === column.key ? sortDir === "asc" ? "ascending" : "descending" : undefined} className={column.sortable ? styles.sortable : undefined} onClick={!loading && column.sortable ? () => toggleSort(column.key) : undefined} style={column.width ? { width: typeof column.width === "number" ? `${column.width}px` : column.width } : undefined}>{column.header}{column.sortable ? <span className={`${styles.sortArrow} ${sortKey === column.key ? styles.sortArrowActive : ""}`}>{sortKey === column.key ? sortDir === "asc" ? "▲" : "▼" : "⇅"}</span> : null}</Th>)}</tr></thead>;

  const tableSection = <section className={styles.card} data-clinic-data-table aria-busy={loading || undefined}>
    {(title || action) ? <header className={styles.cardHeader}>{title ? <h3 className={styles.cardTitle}>{title}</h3> : <span />}{action}</header> : null}
    {(filters || standardPage) ? <div className={styles.toolbar} data-sajilo-table-toolbar={standardPage ? "" : undefined}>
      {filters ? standardPage ? <div data-sajilo-table-filters="">{filters}</div> : filters : null}
      {standardPage ? <span data-sajilo-table-count="" aria-live="polite">{sorted.length} {noun}</span> : null}
    </div> : null}
    {loading ? <>
      <span className={styles.srOnly} role="status">{loadingLabel}</span>
      <TableWrap><Table minWidth={minWidth} striped data-sajilo-standard-table={standardPage ? "" : undefined}>{tableHead}<tbody aria-hidden="true">{Array.from({ length: Math.max(1, skeletonRows) }, (_, rowIndex) => <Tr key={`skeleton-${rowIndex}`} className={styles.skeletonRow}>{columns.map((column, columnIndex) => <Td key={column.key} align={column.align}><span className={styles.skeletonLine} style={{ width: `${48 + ((rowIndex + columnIndex) % 4) * 10}%` }} /></Td>)}</Tr>)}</tbody></Table></TableWrap>
    </> : error ? <div className={`${styles.state} ${styles.stateError}`} role="alert"><strong>{error}</strong>{errorHint ? <span>{errorHint}</span> : null}</div> : rows.length === 0 ? empty ?? <div className={styles.state}>No {noun} found.</div> : <>
      <TableWrap><Table minWidth={minWidth} striped data-sajilo-standard-table={standardPage ? "" : undefined}>{tableHead}<tbody>{pageRows.map((row, rowIndex) => <Tr key={rowKey(row)} className={onRowClick ? styles.clickableRow : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined} onKeyDown={onRowClick ? (event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onRowClick(row); } } : undefined} role={onRowClick ? "button" : undefined} tabIndex={onRowClick ? 0 : undefined} style={rowStyle?.(row)}>{columns.map((column, columnIndex) => <Td key={column.key} align={column.align} className={/action/i.test(column.key) ? styles.actionCell : undefined} style={column.nowrap ? { whiteSpace: "nowrap" } : undefined}><div className={`${styles.cellContent} ${cellTone(column) === "semantic" ? styles.semanticCell : styles.defaultCell} ${cellEmphasis(column, columnIndex) === "strong" ? styles.strongCell : styles.regularCell}`}>{column.render ? column.render(row, start + rowIndex) : cellValue(column, row) as ReactNode}</div></Td>)}</Tr>)}</tbody>{hasTotals ? <tfoot><tr className={styles.tfootRow}>{firstTotalIndex > 0 ? <Td colSpan={firstTotalIndex} align={totalsAlign}>{totalsLabel}</Td> : null}{columns.slice(firstTotalIndex).map((column) => <Td key={column.key} align={column.align}>{column.total ? column.totalFormat ? column.totalFormat(sums[column.key]) : sums[column.key] : null}</Td>)}</tr></tfoot> : null}</Table></TableWrap>
      {!standardPage && paginate && sorted.length > 0 ? <Pagination page={safePage} totalPages={totalPages} from={start + 1} to={Math.min(start + pageSize, sorted.length)} total={sorted.length} noun={noun} onPage={setPage} /> : null}
    </>}
  </section>;
  if (!standardPage) return tableSection;
  const from = sorted.length > 0 ? start + 1 : 0;
  const to = sorted.length > 0 ? Math.min(start + pageSize, sorted.length) : 0;
  return <div data-sajilo-table-root="">
    {tableSection}
    {paginate ? <div data-sajilo-pagination=""><Pagination page={safePage} totalPages={totalPages} from={from} to={to} total={sorted.length} noun={noun} onPage={setPage} /></div> : null}
  </div>;
}
