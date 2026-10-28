"use client";

import { useState } from "react";
import { handleSandboxedFormSubmitClick, handleSandboxedFormSubmitKeyDown } from "@/shared/ui/workspace-primitives/sandboxedFormSubmit";
import { handleFormKeyboardFocus, handleFormKeyboardPointerDown } from "@/shared/ui/workspace-primitives/formKeyboardNavigation";
import { FileText, Plus, Undo2 } from "lucide-react";
import type { PatientNote } from "@/features/patients/types";
import { formatDateShort } from "@/features/patients/model/domain";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";
import { Card, CardBody, CardHeader, EmptyState, Textarea } from "@/shared/ui/workspace-primitives";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";
import styles from "./PatientNotesTab.module.css";

type Props = {
  notes: PatientNote[];
  loading: boolean;
  error?: string | null;
  onCreate: (body: string) => Promise<PatientNote>;
  onWithdraw: (patientNoteId: string, reason: string) => Promise<PatientNote>;
};

function timestamp(note: PatientNote): string {
  const created = new Date(note.createdAt);
  return Number.isNaN(created.getTime())
    ? formatDateShort(note.noteDate)
    : `${formatDateShort(note.noteDate)} · ${created.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
}

export default function PatientNotesTab({ notes, loading, error, onCreate, onWithdraw }: Props) {
  const { showError, showToast } = useSnackbar();
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [noteToWithdraw, setNoteToWithdraw] = useState<PatientNote | null>(null);
  const activeNotes = notes.filter((note) => note.status === "active");

  const save = async () => {
    if (!draft.trim() || saving) return;
    setSaving(true);
    try {
      await onCreate(draft.trim());
      setDraft("");
      showToast("Patient note saved.");
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Patient note could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const withdraw = async () => {
    if (!noteToWithdraw || withdrawing) return;
    setWithdrawing(true);
    try {
      await onWithdraw(noteToWithdraw.patientNoteId, "Removed from the active patient note list");
      setNoteToWithdraw(null);
      showToast("Patient note withdrawn. It remains in the clinical audit history.");
    } catch (cause) {
      showError(cause instanceof Error ? cause.message : "Patient note could not be withdrawn.");
    } finally {
      setWithdrawing(false);
    }
  };

  return (
    <section className={styles.notesPanel}>
      <Card>
        <CardHeader title={<span className={styles.title}><FileText size={16} /> Patient notes</span>}>
          {!loading && activeNotes.length > 0 && <span className={styles.noteCount}>{activeNotes.length} active</span>}
        </CardHeader>
        <CardBody className={styles.cardBody}>
          <p className={styles.helper}>Visible to the care team. Withdrawn notes remain in the clinical audit history.</p>
          {error && <div role="alert" className={styles.error}>{error}</div>}

          {loading ? <EmptyState message="Loading patient notes…" /> : !activeNotes.length ? <EmptyState message="No active patient notes yet." /> : (
            <div className={styles.noteList} aria-label="Active patient notes">
              {activeNotes.map((note) => (
                <article key={note.patientNoteId} className={styles.noteRow}>
                  <span className={styles.noteMarker} aria-hidden="true" />
                  <div className={styles.noteContent}>
                    <p>{note.body}</p>
                    <time className={styles.noteTime} dateTime={note.createdAt}>{timestamp(note)}</time>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm btn-icon" onClick={() => setNoteToWithdraw(note)} aria-label="Withdraw patient note" title="Withdraw note">
                    <Undo2 size={15} />
                  </button>
                </article>
              ))}
            </div>
          )}

          <form className={styles.composer} onSubmit={(event) => { event.preventDefault(); void save(); }} onClickCapture={handleSandboxedFormSubmitClick} onKeyDown={handleSandboxedFormSubmitKeyDown} onFocusCapture={handleFormKeyboardFocus} onPointerDownCapture={handleFormKeyboardPointerDown}>
            <div className={styles.composerHeader}>
              <label htmlFor="new-patient-note">Add a note</label>
              <span>Saved to the patient record</span>
            </div>
            <Textarea id="new-patient-note" className={styles.composerInput} value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Add communication preferences, support needs, or other lasting patient context…" rows={3} aria-label="New patient note" />
            <div className={styles.composerActions}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={!draft.trim() || saving}><Plus size={15} /> {saving ? "Saving…" : "Save note"}</button>
            </div>
          </form>
        </CardBody>
      </Card>

      {noteToWithdraw && <ConfirmDialog title="Withdraw patient note?" body="The note will no longer be active, but its original text and withdrawal reason remain in the clinical audit trail." confirmLabel="Withdraw note" destructive busy={withdrawing} onConfirm={() => { void withdraw(); }} onCancel={() => { if (!withdrawing) setNoteToWithdraw(null); }} />}
    </section>
  );
}
