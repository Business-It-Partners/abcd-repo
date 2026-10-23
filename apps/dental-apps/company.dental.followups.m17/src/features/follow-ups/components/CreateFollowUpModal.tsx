"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { BellRing, Search, UserRound } from "lucide-react";
import { useDraftSafety } from '@/draftSafety';
import DatePicker from "@/shared/dates/NepaliDatePicker";
import TimePicker from "@/shared/dates/TimePicker";
import type { FollowUpCreateInput, PatientSummary } from "@/features/patients/types";
import { followUpCreateInput } from "@/features/follow-ups/createFollowUpModel";
import {
  Field,
  Input,
  Modal,
  ModalBody,
  ModalError,
  Select,
} from "@/shared/ui/workspace-primitives";

export type FollowUpDoctorOption = { staffId: string; fullName: string };

type Props = {
  doctors: FollowUpDoctorOption[];
  today: string;
  onClose: () => void;
  onSearchPatients: (query: string) => Promise<PatientSummary[]>;
  onSubmit: (input: FollowUpCreateInput) => Promise<void>;
  writeState: 'none' | 'saving' | 'unknown';
  onReconcile: () => Promise<void>;
};

const selectedPatientStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 14px",
  border: "1px solid var(--acc-border, #ddd4fa)",
  borderRadius: "12px",
  background: "var(--acc-soft, #f5f3ff)",
};

export default function CreateFollowUpModal({
  doctors,
  today,
  onClose,
  onSearchPatients,
  onSubmit,
  writeState,
  onReconcile,
}: Props) {
  const [patientQuery, setPatientQuery] = useState("");
  const [patientMatches, setPatientMatches] = useState<PatientSummary[]>([]);
  const [activeMatchIndex, setActiveMatchIndex] = useState(-1);
  const [selectedPatient, setSelectedPatient] = useState<PatientSummary | null>(null);
  const [searching, setSearching] = useState(false);
  const [requestedByStaffId, setRequestedByStaffId] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchVersion = useRef(0);
  const reasonRef = useRef<HTMLInputElement>(null);
  const safety = useDraftSafety('create-follow-up', !!(patientQuery || selectedPatient || requestedByStaffId || dueOn || dueTime || reason), () => { if (!saving) onClose(); });

  const input = followUpCreateInput({
    patientId: selectedPatient?.patientId ?? null,
    requestedByStaffId,
    dueOn,
    dueTime,
    reason,
  }, today);

  const searchPatients = async (value: string) => {
    const query = value.trim();
    const version = ++searchVersion.current;
    setPatientQuery(value);
    setPatientMatches([]);
    setActiveMatchIndex(-1);
    setError(null);
    if (!query) {
      setSearching(false);
      return;
    }

    setSearching(true);
    try {
      const matches = (await onSearchPatients(query)).slice(0, 8);
      if (version !== searchVersion.current) return;
      setPatientMatches(matches);
      setActiveMatchIndex(matches.length ? 0 : -1);
    } catch (cause) {
      if (version !== searchVersion.current) return;
      setError(cause instanceof Error ? cause.message : "Registered patients could not be searched.");
    } finally {
      if (version === searchVersion.current) setSearching(false);
    }
  };

  const choosePatient = (patient: PatientSummary) => {
    if (patient.status !== "active") return;
    searchVersion.current += 1;
    setSelectedPatient(patient);
    setPatientQuery("");
    setPatientMatches([]);
    setActiveMatchIndex(-1);
    setSearching(false);
    setError(null);
    requestAnimationFrame(() => document.getElementById("create-follow-up-doctor")?.focus());
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!patientMatches.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveMatchIndex((current) => current < patientMatches.length - 1 ? current + 1 : 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveMatchIndex((current) => current > 0 ? current - 1 : patientMatches.length - 1);
    } else if (event.key === "Enter" && activeMatchIndex >= 0) {
      event.preventDefault();
      choosePatient(patientMatches[activeMatchIndex]);
    } else if (event.key === "Escape") {
      setPatientMatches([]);
      setActiveMatchIndex(-1);
    }
  };

  const submit = async () => {
    if (!input || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit(input);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The follow-up could not be scheduled.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <><Modal title={<><BellRing size={18} style={{ color: "var(--acc)" }} /> Create follow-up</>} onClose={() => !saving && safety.close()} maxWidth={600}>
      <ModalBody as="form" noValidate onSubmit={(event) => { event.preventDefault(); void submit(); }}>
        {error ? <ModalError>{error}</ModalError> : null}
        {writeState === 'unknown' && <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '10px 12px', border: '1px solid #dfcaa0', borderRadius: '8px', background: '#fff9ed' }}>
          <span>The save may have completed. Check the original request before changing this draft.</span>
          <button type="button" className="btn btn-secondary" onClick={() => { void onReconcile(); }}>Retry original save</button>
        </div>}
        <div style={{ display: "grid", gap: "var(--sp-4)" }}>
          <Field label="Patient" required hint={selectedPatient ? undefined : "Search and select an existing patient."}>
            {selectedPatient ? (
              <section aria-label="Selected patient" style={selectedPatientStyle}>
                <span aria-hidden="true" style={{ display: "grid", width: "36px", height: "36px", placeItems: "center", flex: "0 0 auto", borderRadius: "50%", background: "var(--acc)", color: "#fff" }}><UserRound size={17} /></span>
                <span style={{ display: "grid", minWidth: 0, gap: "2px", flex: 1 }}>
                  <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedPatient.fullName}</strong>
                  <small style={{ color: "var(--ink-3)" }}>{selectedPatient.patientNumber}{selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}</small>
                </span>
                <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => { setSelectedPatient(null); setPatientQuery(""); requestAnimationFrame(() => document.getElementById("create-follow-up-patient-search")?.focus()); }}>Change</button>
              </section>
            ) : (
              <div style={{ position: "relative" }}>
                <Search aria-hidden="true" size={15} style={{ position: "absolute", zIndex: 1, top: "13px", left: "12px", color: "var(--ink-3)" }} />
                <Input
                  id="create-follow-up-patient-search"
                  autoFocus
                  autoComplete="off"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  name="sajilo-create-follow-up-patient-lookup"
                  data-1p-ignore
                  data-lpignore="true"
                  role="combobox"
                  aria-autocomplete="list"
                  aria-controls="create-follow-up-patient-matches"
                  aria-expanded={patientMatches.length > 0}
                  aria-activedescendant={activeMatchIndex >= 0 ? `create-follow-up-patient-${patientMatches[activeMatchIndex]?.patientId}` : undefined}
                  placeholder="Search by name, record ID or phone"
                  value={patientQuery}
                  onChange={(event) => void searchPatients(event.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  style={{ paddingLeft: "36px" }}
                />
                {patientMatches.length ? (
                  <div id="create-follow-up-patient-matches" role="listbox" aria-label="Patient suggestions" style={{ display: "grid", maxHeight: "220px", overflowY: "auto", marginTop: "6px", border: "1px solid var(--line)", borderRadius: "10px", background: "var(--surface)", boxShadow: "0 10px 24px rgba(15, 23, 42, .12)" }}>
                    {patientMatches.map((patient, index) => {
                      const inactive = patient.status !== "active";
                      return (
                        <button
                          key={patient.patientId}
                          id={`create-follow-up-patient-${patient.patientId}`}
                          type="button"
                          role="option"
                          aria-selected={index === activeMatchIndex}
                          disabled={inactive}
                          onClick={() => choosePatient(patient)}
                          style={{ display: "grid", gap: "3px", padding: "10px 12px", border: 0, borderBottom: "1px solid var(--line)", background: index === activeMatchIndex ? "var(--acc-soft, #f5f3ff)" : "transparent", color: "var(--ink-1)", textAlign: "left", cursor: inactive ? "not-allowed" : "pointer", opacity: inactive ? .55 : 1 }}
                        >
                          <strong>{patient.fullName}</strong>
                          <small style={{ color: "var(--ink-3)" }}>{patient.patientNumber}{patient.phone ? ` · ${patient.phone}` : ""}{inactive ? " · Inactive" : ""}</small>
                        </button>
                      );
                    })}
                  </div>
                ) : searching ? <small style={{ display: "block", marginTop: "6px", color: "var(--ink-3)" }}>Searching registered patients…</small> : patientQuery ? <small style={{ display: "block", marginTop: "6px", color: "var(--ink-3)" }}>No matching registered patient.</small> : null}
              </div>
            )}
          </Field>

          <Field label="Doctor" required htmlFor="create-follow-up-doctor" error={!doctors.length ? "No active doctor is available. Add or activate a doctor before scheduling this follow-up." : null}>
            <Select id="create-follow-up-doctor" value={requestedByStaffId} onChange={(event) => setRequestedByStaffId(event.target.value)} disabled={!doctors.length || saving}>
              <option value="">Select doctor</option>
              {doctors.map((doctor) => <option key={doctor.staffId} value={doctor.staffId}>{doctor.fullName}</option>)}
            </Select>
          </Field>

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 1fr)", gap: "var(--sp-3)" }}>
            <Field label="Follow-up date" required htmlFor="create-follow-up-date">
              <DatePicker id="create-follow-up-date" value={dueOn} onChange={setDueOn} min={today} disabled={saving} fluid />
            </Field>
            <Field label="Preferred time" hint="Optional" htmlFor="create-follow-up-time">
              <TimePicker id="create-follow-up-time" value={dueTime} onChange={setDueTime} fluid />
            </Field>
          </div>

          <Field label="Reason" required htmlFor="create-follow-up-reason">
            <Input ref={reasonRef} id="create-follow-up-reason" value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} placeholder="Enter the follow-up reason" disabled={saving} />
          </Field>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sp-2)", marginTop: "24px" }}>
          <button type="button" className="btn btn-secondary" onClick={safety.close} disabled={saving}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={!input || saving}>{saving ? "Scheduling…" : "Schedule follow-up"}</button>
        </div>
      </ModalBody>
    </Modal>{safety.confirmation}</>
  );
}
