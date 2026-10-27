"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import styles from "./ClinicTable.module.css";
import { paginationWindow } from "./pagination";

type Align = "left" | "center" | "right";
function cx(...parts: Array<string | undefined | false>) { return parts.filter(Boolean).join(" "); }
function alignClass(align?: Align) { return align === "right" ? styles.alignRight : align === "center" ? styles.alignCenter : undefined; }
export function TableWrap({ children }: { children: ReactNode }) { return <div className={styles.tableWrap}>{children}</div>; }
interface TableProps extends TableHTMLAttributes<HTMLTableElement> { minWidth?: number; striped?: boolean; }
export function Table({ minWidth, striped = true, style, className, children, ...rest }: TableProps) { return <table className={cx(styles.table, striped && styles.striped, className)} style={minWidth ? { minWidth: `${minWidth}px`, ...style } : style} {...rest}>{children}</table>; }
interface ThProps extends ThHTMLAttributes<HTMLTableCellElement> { align?: Align; }
export function Th({ align, className, children, ...rest }: ThProps) { return <th className={cx(styles.th, alignClass(align), className)} {...rest}>{children}</th>; }
interface TdProps extends TdHTMLAttributes<HTMLTableCellElement> { align?: Align; }
export function Td({ align, className, children, ...rest }: TdProps) { return <td className={cx(styles.td, alignClass(align), className)} {...rest}>{children}</td>; }
export function Tr({ className, children, ...rest }: HTMLAttributes<HTMLTableRowElement>) { return <tr className={cx(styles.tr, className)} {...rest}>{children}</tr>; }
export function RowActions({ children }: { children: ReactNode }) { return <div className={styles.rowActions}>{children}</div>; }
export function TableFooter({ children }: { children: ReactNode }) { return <div className={styles.footer}>{children}</div>; }
export function TableCellStack({ avatar, primary, secondary, badge }: { avatar?: ReactNode; primary: ReactNode; secondary?: ReactNode; badge?: ReactNode }) { return <span className={styles.cellStack}>{avatar != null ? <span className={styles.cellAvatar} data-table-decoration>{avatar}</span> : null}<span className={styles.cellText}><span className={styles.cellPrimary}>{primary}{badge}</span>{secondary ? <span className={styles.cellSecondary} data-table-secondary>{secondary}</span> : null}</span></span>; }
export function TableSerial({ children }: { children: ReactNode }) { return <span className={styles.serial}>{children}</span>; }
export function TableCheckbox({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) { return <input {...rest} type="checkbox" className={cx(styles.checkbox, className)} />; }
export function TableAction({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) { return <button type="button" className={cx(styles.tableAction, className)} {...rest}>{children}</button>; }
interface PaginationProps {
  page: number;
  totalPages: number;
  from: number;
  to: number;
  total: number;
  noun: string;
  onPage: (page: number) => void;
  canPage?: (page: number) => boolean;
}

export function Pagination({ page, totalPages, from, to, total, noun, onPage, canPage = () => true }: PaginationProps) {
  const pages = paginationWindow(page, totalPages);
  const previousPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  return (
    <TableFooter>
      <div>Showing <strong>{from}</strong> to <strong>{to}</strong> of <strong>{total}</strong> {noun}</div>
      <nav className={styles.footerNav} aria-label={`${noun} pagination`}>
        <button className={styles.pageDirection} type="button" disabled={page <= 1 || !canPage(previousPage)} onClick={() => onPage(previousPage)}>
          <ChevronLeft size={15} /> Previous
        </button>
        <div className={styles.pageNumbers}>
          {pages.map((pageNumber) => (
            <button
              className={cx(styles.pageNumber, pageNumber === page && styles.pageNumberActive)}
              type="button"
              key={pageNumber}
              aria-label={`Go to page ${pageNumber}`}
              aria-current={pageNumber === page ? "page" : undefined}
              disabled={pageNumber === page || !canPage(pageNumber)}
              onClick={() => onPage(pageNumber)}
            >
              {pageNumber}
            </button>
          ))}
        </div>
        <button className={styles.pageDirection} type="button" disabled={page >= totalPages || !canPage(nextPage)} onClick={() => onPage(nextPage)}>
          Next <ChevronRight size={15} />
        </button>
      </nav>
    </TableFooter>
  );
}
export { styles as clinicTableStyles };
