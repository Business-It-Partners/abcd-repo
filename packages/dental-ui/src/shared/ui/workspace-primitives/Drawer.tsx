"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import styles from "./ui.module.css";

/* The right-hand detail sheet — patient, product, supplier, staff, lab order. Five components
   carried their own copy of the backdrop, the slide-in, the sticky header and the tab strip,
   all leaning on patient-record.module.css. Both migration agents stopped at these files for
   exactly this reason: there was nothing to migrate them onto. */

interface DrawerProps {
  title: React.ReactNode;
  subtitle?: string;
  onClose: () => void;
  /** Sits in the header beside the close button — Edit, Print, and friends. */
  actions?: React.ReactNode;
  /** Rendered flush under the header, outside the scroll region, so it stays put. */
  tabs?: React.ReactNode;
  /** Compact detail panel for a single focused record, such as one lab order. */
  compact?: boolean;
  children: React.ReactNode;
}

export function Drawer({ title, subtitle, onClose, actions, tabs, compact = false, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className={styles.drawerBackdrop} onClick={onClose} />
      <aside className={`${styles.drawerSheet} ${compact ? styles.drawerSheetCompact : ""}`} role="dialog" aria-modal="true">
        <div className={styles.drawerHeader}>
          <div>
            <h2 className={styles.drawerTitle}>{title}</h2>
            {subtitle && <div className={styles.drawerSubtitle}>{subtitle}</div>}
          </div>
          <div className={styles.pageActions}>
            {actions}
            <button
              type="button"
              onClick={onClose}
              className={styles.modalClose}
              aria-label="Close"
            >
              <X size={15} />
            </button>
          </div>
        </div>
        {tabs}
        <div className={styles.drawerBody}>{children}</div>
      </aside>
    </>
  );
}

export interface TabDef {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

export function Tabs({
  tabs,
  active,
  onChange,
  variant = "line",
}: {
  tabs: TabDef[];
  active: string;
  onChange: (key: string) => void;
  variant?: "line" | "segmented";
}) {
  return (
    <div className={`${styles.tabBar} ${variant === "segmented" ? styles.tabBarSegmented : ""}`} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={t.key === active}
          onClick={() => onChange(t.key)}
          className={`${styles.tabBtn} ${t.key === active ? styles.tabBtnActive : ""}`}
        >
          {t.icon}
          {t.label}
        </button>
      ))}
    </div>
  );
}
