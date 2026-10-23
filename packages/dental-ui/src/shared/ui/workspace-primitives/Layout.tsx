"use client";

import React from "react";
import { Search } from "lucide-react";
import { ClinicDetailBackButton } from "@/shared/ui/ClinicDetailBackButton";
import { ClinicPageRefreshAction } from "@/shared/ui/ClinicPageRefresh";
import { StandardPageScroll } from "@/shared/ui/StandardPageScroll";
import styles from "./ui.module.css";

/* Page chrome: the header, the card, the toolbar. Every view had its own version of these three
   with a different title size (23px here, 26px there), a different card radius and a different
   filter-bar gap, which is most of why no two screens looked like the same product. */

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

export function Page({ children, sheet = false, fillSheet = false, standardPage = false }: {
  children: React.ReactNode;
  /** One clear working surface for table-driven finance/list pages. */
  sheet?: boolean;
  /** Let a short sheet occupy the page's full available viewport height. */
  fillSheet?: boolean;
  /** Apply the Standard Window 1 main-page presentation contract. */
  standardPage?: boolean;
}) {
  const content = sheet ? <div className={cx(styles.pageSheet, fillSheet && styles.pageSheetFill)}>{children}</div> : children;
  return <div className={styles.page} data-sajilo-standard-page={standardPage ? "" : undefined}>
    {standardPage
      ? <StandardPageScroll contentClassName="clinic-standard-page-scroll-content">{content}</StandardPageScroll>
      : content}
  </div>;
}

interface PageHeaderProps {
  title: React.ReactNode;
  /** Rendered inline before the title — the page's identity, doing the job point size used to. */
  icon?: React.ReactNode;
  subtitle?: string;
  /** Clickable parent context for full-page details rendered inside the dashboard route. */
  back?: { label: string; onClick: () => void };
  children?: React.ReactNode;
}

export function PageHeader({ title, icon, subtitle, back, children }: PageHeaderProps) {
  return (
    <div className={styles.pageHeader} data-clinic-page-header>
      <div style={{ flex: 1, minWidth: 0 }}>
        {back && <ClinicDetailBackButton label={back.label} onClick={back.onClick} />}
        <h2 className={styles.pageTitle}>
          {icon}
          {title}
        </h2>
        {subtitle && <div className={styles.pageSubtitle}>{subtitle}</div>}
      </div>
      <div className={styles.pageActions}>
        <ClinicPageRefreshAction placement="page-action" />
        {children}
      </div>
    </div>
  );
}

export function Card({
  className,
  children,
  style,
  square = false,
}: {
  className?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  /** Use the crisp, square-edged clinical-section treatment. */
  square?: boolean;
}) {
  return (
    <div className={cx(styles.card, square && styles.cardSquare, className)} style={style}>
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  children,
  className,
  style,
}: {
  title?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div className={cx(styles.cardHeader, className)} style={style}>
      {title && <h3 className={styles.cardTitle}>{title}</h3>}
      {children}
    </div>
  );
}

export function CardBody({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={cx(styles.cardBody, className)} style={style}>{children}</div>;
}

export function Toolbar({ children, className, style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return <div className={cx(styles.toolbar, className)} style={style}>{children}</div>;
}

interface SearchBoxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  value: string;
}

export function SearchBox({ className, ...rest }: SearchBoxProps) {
  return (
    <div className={styles.searchWrap}>
      <Search size={15} className={styles.searchIcon} />
      <input
        type="search"
        className={cx(styles.control, styles.controlSearch, className)}
        {...rest}
      />
    </div>
  );
}
