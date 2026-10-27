"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import styles from "./ClinicActionButton.module.css";

type ClinicActionButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  /** Compact is reserved for an action inside a data-table row. */
  size?: "default" | "compact";
};

/**
 * The clinic's affirmative action: create, add, save, open, or detail.
 *
 * Secondary actions remain outlined and destructive actions remain red. This
 * component deliberately owns only the shared filled action treatment.
 */
export function ClinicActionButton({ children, className, size = "default", type = "button", ...props }: ClinicActionButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={`${styles.button} ${size === "compact" ? styles.compact : ""}${className ? ` ${className}` : ""}`}
    >
      {children}
    </button>
  );
}
