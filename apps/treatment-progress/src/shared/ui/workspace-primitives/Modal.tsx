"use client";

import React from "react";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import { handleSandboxedFormSubmitClick, handleSandboxedFormSubmitKeyDown } from "./sandboxedFormSubmit";
import { handleFormKeyboardFocus, handleFormKeyboardPointerDown } from "./formKeyboardNavigation";
import styles from "./ui.module.css";

/* Finance keeps this adapter for its established import path. The shared
   ClinicModal owns the overlay, focus trap, Escape handling, header, and close
   control so finance forms use the same shell as every other clinic workflow. */

interface ModalProps {
  title: React.ReactNode;
  onClose: () => void;
  /** Widest the dialog grows. Forms are 480; anything showing a table wants more. */
  maxWidth?: number;
  children: React.ReactNode;
}

export function Modal({ title, onClose, maxWidth = 480, children }: ModalProps) {
  return (
    <ClinicModal maxWidth={maxWidth} onClose={onClose} title={title}>
      {children}
    </ClinicModal>
  );
}

/* The dialog's own content area. A <form> when the modal submits, a plain div otherwise.

   Form attributes are forwarded rather than swallowed. The first version accepted only onSubmit,
   which silently dropped `noValidate` during a migration — and that is not cosmetic: without it
   the browser's own bubble fires on a type="email" or min="0" field BEFORE the app's validation
   runs, so the user gets the browser's wording instead of the clinic's. */
type ModalBodyProps =
  | ({ as?: "div" } & React.HTMLAttributes<HTMLDivElement>)
  | ({ as: "form" } & React.FormHTMLAttributes<HTMLFormElement>);

export function ModalBody(props: ModalBodyProps) {
  if (props.as === "form") {
    const { as, className, children, onKeyDown, onClickCapture, onFocusCapture, onPointerDownCapture, ...rest } = props;
    void as;
    const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
      onKeyDown?.(e);
      if (!e.defaultPrevented) handleSandboxedFormSubmitKeyDown(e);
    };
    const handleFocusCapture = (event: React.FocusEvent<HTMLFormElement>) => {
      onFocusCapture?.(event);
      if (!event.defaultPrevented) handleFormKeyboardFocus(event);
    };
    const handlePointerDownCapture = (event: React.PointerEvent<HTMLFormElement>) => {
      onPointerDownCapture?.(event);
      if (!event.defaultPrevented) handleFormKeyboardPointerDown(event);
    };
    const handleClickCapture = (e: React.MouseEvent<HTMLFormElement>) => {
      onClickCapture?.(e);
      if (!e.defaultPrevented) handleSandboxedFormSubmitClick(e);
    };

    return (
      <form className={`${styles.modalBody} ${className ?? ""}`} onKeyDown={handleKeyDown} onFocusCapture={handleFocusCapture} onPointerDownCapture={handlePointerDownCapture} onClickCapture={handleClickCapture} {...rest}>
        {children}
      </form>
    );
  }
  const { as, className, children, ...rest } = props as { as?: "div" } & React.HTMLAttributes<HTMLDivElement>;
  void as;
  return (
    <div className={`${styles.modalBody} ${className ?? ""}`} {...rest}>
      {children}
    </div>
  );
}

/** Submit-level failure. Per-value problems belong on the Field, not here. */
export function ModalError({ children }: { children: React.ReactNode }) {
  return <div className={styles.modalError}>{children}</div>;
}

/** Two fields side by side — the commonest form row in the app. */
export function FieldPair({ children }: { children: React.ReactNode }) {
  return <div className={styles.fieldPair}>{children}</div>;
}
