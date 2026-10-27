"use client";

import { useState, useEffect } from "react";
import styles from "@/features/patients/patient-record.module.css";
import { BellRing, Plus, Pencil, Trash2, Check } from "lucide-react";
import {
  normalizeFollowUp,
  formatTime12,
  todayISO,
  displayToISO,
  formatDateShort,
  type PatientFollowUp,
  type FollowUpEntryKind,
  type FollowUpOutcome,
} from "@/features/patients/model/domain";
import { Modal, ModalBody, Field, Card, CardHeader, CardBody, EmptyState, Input, Select } from "@/shared/ui/workspace-primitives";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import TimePicker from "@/shared/dates/TimePicker";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";

interface PatientFollowUpsTabProps {
  history: PatientFollowUp[];
  onUpdateHistory?: (expectedHistory: PatientFollowUp[], newHistory: PatientFollowUp[], reason: string) => Promise<void>;
  doctorsList?: string[];
}

const BADGE: Record<FollowUpEntryKind, { text: string; cls: string; dot: string }> = {
  scheduled: { text: "Scheduled", cls: styles.fuBadgePending, dot: styles.fuDot_pending },
  rescheduled: { text: "Rescheduled", cls: styles.fuBadgePending, dot: styles.fuDot_pending },
  caught: { text: "Caught", cls: styles.fuBadgeCaught, dot: styles.fuDot_caught },
  missed: { text: "Missed", cls: styles.fuBadgeMissed, dot: styles.fuDot_missed },
};

export default function PatientFollowUpsTab({
  history: initialHistory,
  onUpdateHistory,
  doctorsList = ["Dr. Arpana Tiwari", "Dr. Ram Bhajan"],
}: PatientFollowUpsTabProps) {
  const { showError, showToast } = useSnackbar();
  const [history, setHistory] = useState<PatientFollowUp[]>(initialHistory);
  const [showAddModal, setShowAddModal] = useState(false);

  // New follow-up state (Multi-doctor selection pills)
  // DatePicker state is always canonical AD ISO. Follow-up history remains display text for
  // backwards compatibility, so convert only at the persistence boundary below.
  const [newDate, setNewDate] = useState(todayISO());
  const [newTime, setNewTime] = useState("10:00");
  const [newReason, setNewReason] = useState("");
  const [newDoctors, setNewDoctors] = useState<string[]>([doctorsList[0] || "Dr. Arpana Tiwari"]);

  // Edit state (Multi-doctor selection pills)
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editReason, setEditReason] = useState("");
  const [editDoctors, setEditDoctors] = useState<string[]>([]);
  const [editOutcome, setEditOutcome] = useState<FollowUpOutcome>("pending");
  const [auditAction, setAuditAction] = useState<{ kind: "edit" | "delete"; index: number } | null>(null);
  const [auditReason, setAuditReason] = useState("");

  useEffect(() => {
    setHistory(initialHistory);
  }, [initialHistory]);

  const toggleNewDoctor = (doc: string) => {
    if (newDoctors.includes(doc)) {
      if (newDoctors.length > 1) {
        setNewDoctors(newDoctors.filter((d) => d !== doc));
      }
    } else {
      setNewDoctors([...newDoctors, doc]);
    }
  };

  const toggleEditDoctor = (doc: string) => {
    if (editDoctors.includes(doc)) {
      if (editDoctors.length > 1) {
        setEditDoctors(editDoctors.filter((d) => d !== doc));
      }
    } else {
      setEditDoctors([...editDoctors, doc]);
    }
  };

  const updateAndSave = async (updated: PatientFollowUp[], reason: string): Promise<boolean> => {
    const previous = history;
    setHistory(updated);
    try {
      if (onUpdateHistory) await onUpdateHistory(previous, updated, reason);
      return true;
    } catch (err) {
      setHistory(previous);
      showError((err as Error).message || "Could not update the follow-up timeline.");
      return false;
    }
  };

  const handleAddFollowUp = async () => {
    if (!newReason.trim()) return;
    const newEntry: PatientFollowUp = {
      date: formatDateShort(newDate),
      time: newTime,
      reason: newReason.trim(),
      doctor: newDoctors.join(", "),
      outcome: "pending",
    };

    const updated = [newEntry, ...history];
    if (await updateAndSave(updated, "New follow-up scheduled")) {
      setNewReason("");
      setNewDate(todayISO());
      setShowAddModal(false);
    }
  };

  const handleStartEdit = (index: number, f: PatientFollowUp) => {
    setEditingIdx(index);
    setEditDate(displayToISO(f.date || "") || todayISO());
    setEditTime(f.time || "10:00");
    setEditReason(f.reason || "");
    const parsedDocs = f.doctor
      ? f.doctor.split(",").map((d) => d.trim()).filter(Boolean)
      : [doctorsList[0]];
    setEditDoctors(parsedDocs);
    setEditOutcome(f.outcome || "pending");
  };

  const handleSaveEdit = async (index: number, reason: string) => {
    const updated = [...history];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        date: formatDateShort(editDate),
        time: editTime,
        reason: editReason,
        doctor: editDoctors.join(", "),
        outcome: editOutcome,
      };
      if (await updateAndSave(updated, reason)) {
        setEditingIdx(null);
        setAuditAction(null);
        setAuditReason("");
      }
    }
  };

  const handleToggleStatus = async (index: number, newOutcome: FollowUpOutcome) => {
    const updated = [...history];
    if (updated[index]) {
      updated[index] = {
        ...updated[index],
        outcome: newOutcome,
      };
      if (await updateAndSave(updated, `Follow-up marked ${newOutcome}`)) {
        showToast(newOutcome === "caught" ? "Follow-up marked as caught." : "Follow-up reopened.");
      }
    }
  };

  const handleDelete = async (index: number, reason: string) => {
    const updated = history.map((entry, idx) => idx === index
      ? { ...entry, voidedAt: new Date().toISOString(), voidReason: reason }
      : entry);
    if (await updateAndSave(updated, reason)) {
      setEditingIdx(null);
      setAuditAction(null);
      setAuditReason("");
    }
  };

  const indexedHistory = history.map((entry, index) => ({ entry, index })).filter(({ entry }) => !entry.voidedAt);
  const entries = indexedHistory.map(({ entry }) => normalizeFollowUp(entry));
  const caughtCount = entries.filter((e) => e.kind === "caught").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <Card>
        <CardHeader title={<><BellRing size={18} style={{ color: "#7c3aed" }} /> Follow-Up Timeline</>}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: "var(--ok)" }}>
              {caughtCount} caught
            </span>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-13)" }}
            >
              <Plus size={14} /> Book Follow-Up
            </button>
          </div>
        </CardHeader>

        <CardBody>
          {entries.length === 0 ? (
            <EmptyState message="No follow-ups recorded for this patient yet." />
          ) : (
            <ul className={styles.fuList}>
              {entries.map((e, idx) => {
                const { entry: orig, index: historyIndex } = indexedHistory[idx];
                const badge = BADGE[e.kind];

                return (
                  <li key={idx} className={styles.fuItem} style={{ position: "relative" }}>
                    <span className={`${styles.fuDot} ${badge.dot}`} />
                    <div className={styles.fuBody} style={{ flex: 1 }}>
                      <div className={styles.fuTop} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className={styles.fuDate}>
                            {formatDateShort(e.date)}
                            {e.time ? ` • ${formatTime12(e.time)}` : ""}
                          </span>
                          <span className={`${styles.fuBadge} ${badge.cls}`}>{badge.text}</span>
                        </div>

                        {/* Status Toggle & Edit / Delete Actions */}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {orig.outcome === "pending" ? (
                            <button
                              type="button"
                              data-checkbox-control
                              data-loading-message="Updating follow-up…"
                              role="checkbox"
                              aria-checked={false}
                              onClick={() => void handleToggleStatus(historyIndex, "caught")}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                padding: "4px 10px",
                                borderRadius: "14px",
                                fontSize: "var(--fs-11)",
                                fontWeight: "var(--fw-bold)",
                                background: "#ffffff",
                                border: "1.5px solid #10b981",
                                color: "#059669",
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(16, 185, 129, 0.1)",
                                transition: "all 0.15s ease",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "#10b981";
                                e.currentTarget.style.color = "#ffffff";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "#ffffff";
                                e.currentTarget.style.color = "#059669";
                              }}
                              title="Mark as Caught (Completed)"
                            >
                              <Check size={13} /> Mark as Caught
                            </button>
                          ) : (
                            <button
                              type="button"
                              data-checkbox-control
                              data-loading-message="Updating follow-up…"
                              role="checkbox"
                              aria-checked={true}
                              onClick={() => void handleToggleStatus(historyIndex, "pending")}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: "var(--fs-11)", padding: "2px 8px", color: "#64748b" }}
                              title="Revert to Scheduled"
                            >
                              Revert
                            </button>
                          )}

                          {/* Explicit Edit Button Label */}
                          <button
                            type="button"
                            onClick={() => handleStartEdit(historyIndex, orig)}
                            className="btn btn-secondary btn-sm"
                            style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", fontSize: "var(--fs-11)" }}
                            title="Edit Follow-Up"
                          >
                            <Pencil size={12} /> Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => { setAuditReason(""); setAuditAction({ kind: "delete", index: historyIndex }); }}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: "2px 6px", color: "#dc2626" }}
                            title="Remove Follow-Up"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className={styles.fuReason} style={{ fontWeight: "var(--fw-bold)", color: "#1e293b", marginTop: "2px" }}>
                        {e.title}
                      </div>

                      <div className={styles.fuDoctor} style={{ color: "#64748b" }}>
                        {e.doctor}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* Global Book New Follow-Up Popup Modal */}
      {showAddModal && (
        <Modal title={<><BellRing size={18} style={{ color: "#7c3aed" }} /> Book New Follow-Up</>} onClose={() => setShowAddModal(false)} maxWidth={520}>
          <ModalBody as="form" onSubmit={(e) => { e.preventDefault(); handleAddFollowUp(); }}>
            <Field label="Date & Time *">
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px" }}>
                <DatePicker value={newDate} onChange={setNewDate} fluid />
                <TimePicker value={newTime} onChange={setNewTime} fluid />
              </div>
            </Field>

            <Field label="Attending Doctor(s) (Select Multiple)">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "2px" }}>
                {doctorsList.map((d) => {
                  const selected = newDoctors.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleNewDoctor(d)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "var(--fs-12)",
                        fontWeight: "var(--fw-medium)",
                        cursor: "pointer",
                        border: selected ? "1.5px solid #7c3aed" : "1.5px solid #cbd5e1",
                        background: selected ? "#f3e8ff" : "#ffffff",
                        color: selected ? "#6b21a8" : "#475569",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {selected ? "✓ " : "+ "}{d}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Follow-Up Reason / Purpose *">
              <Input
                placeholder="e.g. RCT obturation · tooth 14, Suture removal, Scaling review"
                value={newReason}
                onChange={(e) => setNewReason(e.target.value)}
                required
              />
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={!newReason.trim()} className="btn btn-primary">
                <Check size={14} /> Schedule Follow-Up
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}

      {/* Global Edit Follow-Up Popup Modal */}
      {editingIdx !== null && (
        <Modal title={<><Pencil size={18} style={{ color: "#7c3aed" }} /> Edit Follow-Up Entry</>} onClose={() => setEditingIdx(null)} maxWidth={520}>
          <ModalBody as="form" onSubmit={(e) => { e.preventDefault(); setAuditReason(""); setAuditAction({ kind: "edit", index: editingIdx }); }}>
            <Field label="Date & Time *">
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px" }}>
                <DatePicker value={editDate} onChange={setEditDate} fluid />
                <TimePicker value={editTime} onChange={setEditTime} fluid />
              </div>
            </Field>

            <Field label="Attending Doctor(s) (Select Multiple)">
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", paddingTop: "2px" }}>
                {doctorsList.map((d) => {
                  const selected = editDoctors.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => toggleEditDoctor(d)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: "20px",
                        fontSize: "var(--fs-12)",
                        fontWeight: "var(--fw-medium)",
                        cursor: "pointer",
                        border: selected ? "1.5px solid #7c3aed" : "1.5px solid #cbd5e1",
                        background: selected ? "#f3e8ff" : "#ffffff",
                        color: selected ? "#6b21a8" : "#475569",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {selected ? "✓ " : "+ "}{d}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="Follow-Up Reason / Purpose *">
              <Input value={editReason} onChange={(e) => setEditReason(e.target.value)} required />
            </Field>

            <Field label="Status">
              <Select value={editOutcome} onChange={(e) => setEditOutcome(e.target.value as FollowUpOutcome)}>
                <option value="pending">Scheduled (Pending)</option>
                <option value="caught">Caught (Completed)</option>
                <option value="missed">Missed</option>
              </Select>
            </Field>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "20px" }}>
              <button type="button" onClick={() => setEditingIdx(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                <Check size={14} /> Save Changes
              </button>
            </div>
          </ModalBody>
        </Modal>
      )}
      {auditAction && (
        <ConfirmDialog
          title={auditAction.kind === "edit" ? "Save follow-up changes?" : "Remove follow-up?"}
          body={
            <div>
              {auditAction.kind === "edit"
                ? "The updated follow-up will retain an audit reason."
                : "The follow-up will be removed from the active timeline but preserved as a voided record."}
              <Field label="Reason *" style={{ marginTop: 12 }}><Input value={auditReason} onChange={(event) => setAuditReason(event.target.value)} autoFocus /></Field>
            </div>
          }
          confirmLabel={auditAction.kind === "edit" ? "Save changes" : "Remove follow-up"}
          destructive={auditAction.kind === "delete"}
          confirmDisabled={!auditReason.trim()}
          onConfirm={() => {
            const action = auditAction;
            if (action.kind === "edit") void handleSaveEdit(action.index, auditReason.trim());
            else void handleDelete(action.index, auditReason.trim());
          }}
          onCancel={() => { setAuditAction(null); setAuditReason(""); }}
        />
      )}
    </div>
  );
}
