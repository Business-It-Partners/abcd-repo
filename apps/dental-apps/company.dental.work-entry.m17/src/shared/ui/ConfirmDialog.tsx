"use client";

import { Loader2 } from "lucide-react";
import { ClinicModal } from "@/shared/ui/ClinicModal";

interface ConfirmDialogProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Use a single acknowledgement action for informational success messages. */
  showCancel?: boolean;
  /** Slightly taller actions for a terminal/success confirmation. */
  largeActions?: boolean;
  /** Keep a short acknowledgement in the visual center, unlike a form modal. */
  centered?: boolean;
  destructive?: boolean;
  busy?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  body,
  confirmLabel,
  cancelLabel = "Cancel",
  showCancel = true,
  largeActions = false,
  centered = false,
  destructive = false,
  busy = false,
  confirmDisabled = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <ClinicModal closeDisabled={busy} onClose={onCancel} title={title} verticalAlign={centered ? "center" : "top"}>
      <div style={{ fontSize: "var(--fs-14)", color: "var(--ink-1)", lineHeight: 1.55 }}>{body}</div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
        {showCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={`btn btn-secondary${largeActions ? " btn-tall" : ""}`}
          >
            {cancelLabel}
          </button>
        )}
        <button
          type="button"
          autoFocus={!confirmDisabled}
          onClick={onConfirm}
          disabled={busy || confirmDisabled}
          className={`${destructive ? "btn btn-danger" : "btn btn-primary"}${largeActions ? " btn-tall" : ""}`}
        >
          {busy && <Loader2 size={14} style={{ animation: "spin 0.8s linear infinite" }} />}
          {confirmLabel}
        </button>
      </div>
    </ClinicModal>
  );
}
