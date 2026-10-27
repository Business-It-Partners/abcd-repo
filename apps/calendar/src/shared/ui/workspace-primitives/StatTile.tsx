"use client";

import React from "react";
import styles from "./ui.module.css";

/* The dashboard/worklist tile: a big number, a label, and a click that filters the list below.
   Appointments and Follow-ups each had their own copy; the Appointments one is now dead CSS. */

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className={styles.tileGrid}>{children}</div>;
}

interface StatTileProps {
  value: React.ReactNode;
  label: string;
  hint?: string;
  icon?: React.ReactNode;
  active?: boolean;
  /** Accent for this tile: border/icon, its soft background, and the number's own colour. */
  tone: { tone: string; toneBg: string; toneNum: string };
  onClick?: () => void;
}

export function StatTile({ value, label, hint, icon, active, tone, onClick }: StatTileProps) {
  const className = `${styles.statTile} ${active ? styles.statTileActive : ""}`;
  const style = {
    "--tone": tone.tone,
    "--tone-bg": tone.toneBg,
    "--tone-num": tone.toneNum,
  } as React.CSSProperties;
  const content = <>
      {icon && <span className={styles.statTileIcon}>{icon}</span>}
      <span className={styles.statTileValue}>{value}</span>
      <span className={styles.statTileLabel}>{label}</span>
      {hint && <span className={styles.statTileHint}>{hint}</span>}
    </>;

  if (!onClick) return <div className={className} style={style}>{content}</div>;
  return <button type="button" onClick={onClick} aria-pressed={active} className={className} style={style}>{content}</button>;
}
