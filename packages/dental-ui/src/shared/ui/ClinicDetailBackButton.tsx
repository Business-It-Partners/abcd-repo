"use client";

import { ArrowLeft } from "lucide-react";
import styles from "./ClinicDetailBackButton.module.css";

type ClinicDetailBackButtonProps = {
  /** The destination name, rendered as "Back to {label}". */
  label: string;
  onClick: () => void;
  disabled?: boolean;
};

/** Consistent first control for full-page clinic detail screens. */
export function ClinicDetailBackButton({ label, onClick, disabled = false }: ClinicDetailBackButtonProps) {
  return (
    <div className={styles.row}>
      <button className={styles.button} disabled={disabled} onClick={onClick} type="button">
        <ArrowLeft aria-hidden="true" size={16} strokeWidth={2.5} />
        <span>Back to {label}</span>
      </button>
    </div>
  );
}
