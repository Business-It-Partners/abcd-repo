"use client";

import React from "react";
import styles from "./ui.module.css";

/* Sixteen views each kept their own `const [error, setError] = useState("")` and rendered the
   message their own way — different size, different colour, different position relative to the
   control. Field owns that so a validation failure looks the same everywhere, and so a control
   height is decided once (--control-h) instead of per form. */

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ");
}

interface FieldProps {
  label?: string;
  required?: boolean;
  /** Shown below the control in danger red; also flags the control itself as invalid. */
  error?: string | null;
  /** Quiet guidance. Suppressed while an error is showing — never stack two messages. */
  hint?: string;
  htmlFor?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}

export function Field({
  label,
  required,
  error,
  hint,
  htmlFor,
  children,
  style,
}: FieldProps) {
  return (
    <div className={styles.field} style={style}>
      {label && (
        <label className={styles.fieldLabel} htmlFor={htmlFor}>
          {label}
          {required && <span className={styles.fieldRequired}>*</span>}
        </label>
      )}
      {children}
      {error ? (
        <span className={styles.fieldError}>{error}</span>
      ) : hint ? (
        <span className={styles.fieldHint}>{hint}</span>
      ) : null}
    </div>
  );
}

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ invalid, className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cx(styles.control, invalid && styles.controlInvalid, className)}
        {...rest}
      />
    );
  }
);
Input.displayName = "Input";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export function Select({ invalid, className, children, ...rest }: SelectProps) {
  return (
    <select
      className={cx(
        styles.control,
        styles.controlSelect,
        invalid && styles.controlInvalid,
        className
      )}
      {...rest}
    >
      {children}
    </select>
  );
}

/* The "Active only" style filter that sits in a toolbar. Not a Field — it has no label above
   it and no error slot; the caption IS the control. */
export function InlineCheck({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.inlineCheck}>
      <input
        type="checkbox"
        className={styles.inlineCheckBox}
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export function Textarea({ invalid, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={cx(
        styles.control,
        styles.controlArea,
        invalid && styles.controlInvalid,
        className
      )}
      {...rest}
    />
  );
}
