"use client";

import React from "react";
import { Loader2 } from "lucide-react";
import styles from "./ui.module.css";

/* Chips and the three table states (loading / error / empty). Each list view had written all
   four itself, which is why an "Active" pill was 12px here and 12.5px there, and why a failed
   read looked identical to "nothing exists yet" on some screens — a genuinely dangerous
   ambiguity in a clinic: denied permission must never read as an empty patient list. */

export type ChipTone = "neutral" | "ok" | "warn" | "danger" | "accent";

const chipToneClass: Record<ChipTone, string> = {
  neutral: styles.chipNeutral,
  ok: styles.chipOk,
  warn: styles.chipWarn,
  danger: styles.chipDanger,
  accent: styles.chipAccent,
};

export function Chip({
  tone = "neutral",
  children,
}: {
  tone?: ChipTone;
  children: React.ReactNode;
}) {
  return <span className={`${styles.chip} ${chipToneClass[tone]}`}>{children}</span>;
}

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return (
    <div aria-live="polite" className={styles.stateLoading} role="status">
      <Loader2 size={15} className={styles.spin} /> {label}
    </div>
  );
}

export function ErrorState({
  message,
  hint,
}: {
  message: string;
  hint?: string;
}) {
  return (
    <div className={`${styles.stateBlock} ${styles.stateError}`} role="alert">
      <div>{message}</div>
      {hint && <div className={styles.stateHint}>{hint}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  message,
  hint,
  children,
}: {
  icon?: React.ReactNode;
  message: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={styles.stateBlock}>
      {icon && <div className={styles.stateIcon}>{icon}</div>}
      <div className={styles.stateMessage}>{message}</div>
      {hint && <div className={styles.stateHint}>{hint}</div>}
      {children}
    </div>
  );
}
