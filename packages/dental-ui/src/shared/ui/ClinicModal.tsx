"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { useBodyScrollLock } from "./bodyScrollLock";
import styles from "./ClinicModal.module.css";

type ClinicModalProps = {
  children: ReactNode;
  onClose: () => void;
  title: ReactNode;
  description?: string;
  size?: "small" | "medium" | "large";
  /** Use for an existing compact form whose measured width is part of its UI contract. */
  maxWidth?: number;
  /** Lets an adopted legacy form keep its field layout inside the shared shell. */
  bodyClassName?: string;
  verticalAlign?: "top" | "center";
  closeDisabled?: boolean;
};

/** Shared clinic form/modal shell. Feature forms own their fields and actions. */
export function ClinicModal({ children, onClose, title, description, size = "medium", maxWidth, bodyClassName, verticalAlign = "top", closeDisabled = false }: ClinicModalProps) {
  const titleId = useId();
  const descriptionId = useId();
  const modalRef = useRef<HTMLElement>(null);
  useBodyScrollLock();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !closeDisabled) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDisabled, onClose]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const modal = modalRef.current;
    const focusable = modal?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
    focusable?.[0]?.focus();
    return () => previousFocus?.focus();
  }, []);

  return (
    <div className={`${styles.backdrop} ${verticalAlign === "center" ? styles.centered : ""}`} role="presentation" onMouseDown={() => !closeDisabled && onClose()}>
      <section
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`${styles.modal} ${styles[size]}`}
        ref={modalRef}
        role="dialog"
        style={maxWidth ? { maxWidth: `${maxWidth}px` } : undefined}
        onKeyDown={(event) => {
          if (event.key !== "Tab") return;
          const focusable = Array.from(modalRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])') ?? []);
          if (!focusable.length) return;
          const first = focusable[0];
          const last = focusable[focusable.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
        }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.header}>
          <h3 id={titleId}>{title}</h3>
          <button aria-label="Close" className={styles.closeButton} disabled={closeDisabled} onClick={onClose} type="button">×</button>
        </header>
        <div className={`${styles.body}${bodyClassName ? ` ${bodyClassName}` : ""}`}>
          {description ? <p className={styles.description} id={descriptionId}>{description}</p> : null}
          {children}
        </div>
      </section>
    </div>
  );
}
