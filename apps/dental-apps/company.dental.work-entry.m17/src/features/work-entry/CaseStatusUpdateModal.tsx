"use client";

import { useState } from "react";
import { ClinicModal } from "@/shared/ui/ClinicModal";
import styles from "./CaseStatusUpdateModal.module.css";

export type CaseStatusValue = "open" | "completed" | "closed";

export function displayCaseStatus(status: CaseStatusValue, inProgress = false) {
  if (status === "open") return inProgress ? "In progress" : "Open";
  return status[0].toUpperCase() + status.slice(1);
}

export function CaseStatusUpdateModal({
  caseTitle,
  currentStatus,
  pendingStageCount,
  pendingStageNames = [],
  onClose,
  onSave,
}: {
  caseTitle: string;
  currentStatus: CaseStatusValue;
  pendingStageCount: number;
  pendingStageNames?: string[];
  onClose: () => void;
  onSave: (status: CaseStatusValue, reason: string | null) => Promise<void>;
}) {
  const [status, setStatus] = useState<CaseStatusValue>(currentStatus);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const needsReason = status === "closed";
  const submit = async () => {
    const trimmedReason = reason.trim() || null;
    if (needsReason && !trimmedReason) { setError("A reason is required when closing a case."); return; }
    setSaving(true); setError("");
    try { await onSave(status, trimmedReason); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "The case status could not be updated."); }
    finally { setSaving(false); }
  };
  return <ClinicModal title="Update case status" size="medium" onClose={() => !saving && onClose()} closeDisabled={saving}>
    <div className={styles.content}>
      <div className={styles.caseSummary}><span>Case</span><strong>{caseTitle}</strong></div>
      <label className={styles.field}><span className={styles.fieldLabel}>Case status</span>
        <select className={styles.control} value={status} disabled={saving} onChange={(event) => setStatus(event.target.value as CaseStatusValue)}>
          <option value="open">Open / active</option>
          <option value="completed">Completed</option>
          <option value="closed">Closed</option>
        </select>
      </label>
      {pendingStageCount > 0 && status !== "open" ? <div className={styles.notice}>
        {pendingStageCount} treatment {pendingStageCount === 1 ? "stage remains" : "stages remain"} pending. This status change does not cancel, delete, or mark them as completed.
        {pendingStageNames.length ? <strong>Pending: {Array.from(new Set(pendingStageNames)).join(", ")}</strong> : null}
      </div> : null}
      <label className={styles.field}><span className={styles.fieldLabel}>Reason {needsReason ? "*" : "(optional)"}</span>
        <textarea className={`${styles.control} ${styles.textarea}`} value={reason} disabled={saving} onChange={(event) => setReason(event.target.value)} maxLength={2000} rows={3} placeholder={needsReason ? "Why is this case being closed?" : "Optional completion or reopening note"} />
      </label>
      {error ? <div className={styles.error} role="alert">{error}</div> : null}
      <div className={styles.actions}>
        <button type="button" className={`secondaryAction ${styles.action}`} disabled={saving} onClick={onClose}>Cancel</button>
        <button type="button" className={`primaryAction ${styles.action}`} disabled={saving} onClick={() => void submit()}>{saving ? "Updating…" : `Mark case ${status}`}</button>
      </div>
    </div>
  </ClinicModal>;
}
