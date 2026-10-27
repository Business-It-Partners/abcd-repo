"use client";

import { useState, useEffect } from "react";
import styles from "@/features/patients/patient-record.module.css";
import { Pill, Plus, Pencil, Trash2, Check, X, ShieldAlert, Sparkles } from "lucide-react";
import { type Prescription, type NewPrescription, type Visit, displayToISO, formatDateShort, todayShort } from "@/features/patients/model/domain";
import { type Case } from "@/features/work-entry/model/caseData";
import { Card, CardHeader, CardBody, TableWrap, Table, Th, Td, Tr, EmptyState, Field, Input, Select } from "@/shared/ui/workspace-primitives";
import ConfirmDialog from "@/shared/ui/ConfirmDialog";

const REGIMENS = [
  { short: "Amoxicillin · TDS · 5d", medicine: "Amoxicillin 500mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "5 days" },
  { short: "Ibuprofen · TDS · 3d", medicine: "Ibuprofen 400mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "3 days" },
  { short: "Metronidazole · TDS · 5d", medicine: "Metronidazole 400mg", dosage: "1 tablet", frequency: "Three times daily (TDS)", duration: "5 days" },
  { short: "Paracetamol · SOS · 3d", medicine: "Paracetamol 500mg", dosage: "1 tablet", frequency: "As needed (SOS)", duration: "3 days" },
  { short: "CHX rinse · BD · 7d", medicine: "Chlorhexidine 0.2% Mouthwash", dosage: "10 ml rinse", frequency: "Twice daily (BD)", duration: "7 days" },
];

interface PrescriptionTabProps {
  patientName: string;
  prescriptionsList: Prescription[];
  onAddPrescription: (p: NewPrescription) => void;
  onCorrectPrescription: (
    prescriptionId: string,
    replacement: Pick<Prescription, "medicine" | "dosage" | "frequency" | "duration" | "instructions" | "doctor"> | undefined,
    reason: string,
  ) => Promise<void>;
  patientAlerts?: string[];
  visits: Visit[];
  cases: Case[];
  doctorsList?: string[];
}

const NO_CASE = "__none__";

interface DrugRowInput {
  medicine: string;
  dosage: string;
  frequency: string;
  duration: string;
}

const DEFAULT_ROW: DrugRowInput = {
  medicine: "",
  dosage: "1 tablet",
  frequency: "1-0-1 (BID)",
  duration: "5 days",
};

function CaseStatusPill({ c }: { c: Case }) {
  const open = c.status === "open";
  return (
    <span
      style={{
        fontSize: "var(--fs-12)",
        fontWeight: "var(--fw-medium)",
        padding: "3px 10px",
        borderRadius: "var(--r-pill)",
        whiteSpace: "nowrap",
        ...(open
          ? { background: "#eff6ff", color: "#2563eb", border: "1px solid #bfdbfe" }
          : { background: "#f8fafc", color: "#1e293b", border: "1px solid #e2e8f0" }),
      }}
    >
      {open ? "Open" : "Completed"}{c.outcome ? ` · ${c.outcome}` : ""}
    </span>
  );
}

export default function PrescriptionTab({
  prescriptionsList: initialList,
  onAddPrescription,
  onCorrectPrescription,
  patientAlerts = [],
  visits,
  cases,
  doctorsList = ["Dr. Arpana Tiwari", "Dr. Ram Bhajan"],
}: PrescriptionTabProps) {
  const [list, setList] = useState<Prescription[]>(initialList);
  const [showAddForm, setShowAddForm] = useState(false);

  // Multi-medicine form state
  const [drugRows, setDrugRows] = useState<DrugRowInput[]>([{ ...DEFAULT_ROW }]);
  const [prescribingDoc, setPrescribingDoc] = useState(doctorsList[0] || "Dr. Arpana Tiwari");

  // Inline row editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editMed, setEditMed] = useState("");
  const [editDosage, setEditDosage] = useState("");
  const [editFreq, setEditFreq] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [editDoc, setEditDoc] = useState("");
  const [auditAction, setAuditAction] = useState<{ kind: "edit" | "delete"; index: number } | null>(null);
  const [auditReason, setAuditReason] = useState("");
  const [auditError, setAuditError] = useState("");

  useEffect(() => {
    setList(initialList);
  }, [initialList]);

  const handleAddDrugRow = () => {
    setDrugRows([...drugRows, { ...DEFAULT_ROW }]);
  };

  const handleRemoveDrugRow = (index: number) => {
    if (drugRows.length <= 1) return;
    setDrugRows(drugRows.filter((_, idx) => idx !== index));
  };

  const handleUpdateDrugRow = (index: number, field: keyof DrugRowInput, value: string) => {
    setDrugRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const handleSubmitPrescription = () => {
    const validRows = drugRows.filter((r) => r.medicine.trim() !== "");
    if (validRows.length === 0) return;

    const newPrescriptions: Prescription[] = validRows.map((r, i) => {
      const p: NewPrescription = {
        medicine: r.medicine.trim(),
        dosage: r.dosage.trim() || "1 tablet",
        frequency: r.frequency.trim() || "1-0-1",
        duration: r.duration.trim() || "5 days",
        instructions: "",
        doctor: prescribingDoc,
        date: todayShort(),
      };
      onAddPrescription(p);
      return {
        ...p,
        id: `rx-${Date.now()}-${i}`,
        recordedAt: todayShort(),
      };
    });

    setList((prev) => [...newPrescriptions, ...prev]);
    setDrugRows([{ ...DEFAULT_ROW }]);
    setShowAddForm(false);
  };

  const startEdit = (p: Prescription, uniqueId: string) => {
    setEditingId(uniqueId);
    setEditMed(p.medicine);
    setEditDosage(p.dosage || "");
    setEditFreq(p.frequency || "");
    setEditDuration(p.duration || "");
    setEditDoc(p.doctor || doctorsList[0] || "");
  };

  const handleSaveEdit = async (targetIndex: number, reason: string) => {
    const current = list[targetIndex];
    if (!current) return;
    try {
      await onCorrectPrescription(current.id, {
        medicine: editMed,
        dosage: editDosage,
        frequency: editFreq,
        duration: editDuration,
        doctor: editDoc,
        instructions: current.instructions,
      }, reason);
      setList((rows) => rows.map((row, index) => index === targetIndex
        ? { ...row, medicine: editMed, dosage: editDosage, frequency: editFreq, duration: editDuration, doctor: editDoc }
        : row));
      setEditingId(null);
      setAuditAction(null);
      setAuditReason("");
      setAuditError("");
    } catch (error) {
      setAuditError((error as Error).message || "The prescription amendment could not be saved.");
    }
  };

  const handleDelete = async (targetIndex: number, reason: string) => {
    const current = list[targetIndex];
    if (!current) return;
    try {
      await onCorrectPrescription(current.id, undefined, reason);
      setList((rows) => rows.filter((_, idx) => idx !== targetIndex));
      setEditingId(null);
      setAuditAction(null);
      setAuditReason("");
      setAuditError("");
    } catch (error) {
      setAuditError((error as Error).message || "The prescription could not be removed.");
    }
  };

  const casesById = new Map(cases.map((c) => [c.id, c]));
  const caseByDate = new Map<string, string>();
  for (const v of visits) {
    if (v.caseId && casesById.has(v.caseId) && !caseByDate.has(v.date)) {
      caseByDate.set(v.date, v.caseId);
    }
  }

  const order: string[] = [];
  const byCase = new Map<string, { item: Prescription; originalIdx: number }[]>();
  list.forEach((p, idx) => {
    const key = caseByDate.get(p.date) ?? NO_CASE;
    if (!byCase.has(key)) {
      byCase.set(key, []);
      order.push(key);
    }
    byCase.get(key)!.push({ item: p, originalIdx: idx });
  });

  const caseGroups = order
    .filter((k) => k !== NO_CASE)
    .map((k) => ({ key: k, c: casesById.get(k)!, entries: byCase.get(k)! }))
    .sort((a, b) => {
      const ao = a.c.status === "open" ? 0 : 1;
      const bo = b.c.status === "open" ? 0 : 1;
      if (ao !== bo) return ao - bo;
      return (displayToISO(b.c.createdDate) ?? "").localeCompare(displayToISO(a.c.createdDate) ?? "");
    });
  const looseEntries = byCase.get(NO_CASE) ?? [];

  const validRowCount = drugRows.filter((r) => r.medicine.trim() !== "").length;

  return (
    <div className={styles.tabContent}>
      {/* Top Header Card with + Issue Prescription button */}
      <Card style={{ marginBottom: "16px" }}>
        <CardHeader title={<><Pill size={18} style={{ color: "#7c3aed" }} /> Prescriptions & Medications</>}>
          {!showAddForm && (
            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="btn btn-primary btn-sm"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--fs-13)" }}
            >
              <Plus size={14} /> Add prescription
            </button>
          )}
        </CardHeader>

        {showAddForm && (
          <CardBody style={{ background: "#f8fafc", borderTop: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: "var(--fw-bold)", fontSize: "var(--fs-14)", color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                  <Pill size={16} style={{ color: "#7c3aed" }} /> Issue Prescriptions (Multi-Medicine)
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", color: "#475569" }}>Attending Doctor:</span>
                  <Select
                    value={prescribingDoc}
                    onChange={(e) => setPrescribingDoc(e.target.value)}
                    style={{ width: "180px", height: "32px", fontSize: "var(--fs-12)" }}
                  >
                    {doctorsList.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </Select>
                </div>
              </div>

              {patientAlerts.length > 0 && (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", padding: "8px 12px", borderRadius: "8px", color: "#dc2626", fontSize: "var(--fs-12)", display: "flex", alignItems: "center", gap: 6 }}>
                  <ShieldAlert size={14} /> Medical Warnings: {patientAlerts.join(", ")}
                </div>
              )}

              {/* Quick Add Preset Pills */}
              <div>
                <label style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#475569", display: "flex", alignItems: "center", gap: 4, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  <Sparkles size={13} style={{ color: "#7c3aed" }} /> Quick Add Prescriptions
                </label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {REGIMENS.map((reg) => (
                    <button
                      key={reg.short}
                      type="button"
                      onClick={() => {
                        setDrugRows((prev) => {
                          if (prev.length === 1 && !prev[0].medicine.trim()) {
                            return [{ medicine: reg.medicine, dosage: reg.dosage, frequency: reg.frequency, duration: reg.duration }];
                          }
                          return [...prev, { medicine: reg.medicine, dosage: reg.dosage, frequency: reg.frequency, duration: reg.duration }];
                        });
                      }}
                      style={{
                        padding: "5px 12px",
                        borderRadius: "20px",
                        fontSize: "var(--fs-12)",
                        fontWeight: "var(--fw-bold)",
                        cursor: "pointer",
                        border: "1px solid #ddd6fe",
                        background: "#f3e8ff",
                        color: "#6b21a8",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Plus size={12} /> {reg.short}
                    </button>
                  ))}
                </div>
              </div>

              {/* Dynamic Medicine Rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {drugRows.map((row, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.5fr 1fr 1fr 1fr 36px",
                      gap: "10px",
                      alignItems: "center",
                      background: "#ffffff",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      boxShadow: "0 1px 3px rgba(15, 23, 42, 0.03)",
                    }}
                  >
                    <div>
                      <label style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#475569", display: "block", marginBottom: 3 }}>
                        Medicine Name #{idx + 1} *
                      </label>
                      <Input
                        list="common-dental-medicines"
                        placeholder="e.g. Amoxicillin 500mg, Paracetamol"
                        value={row.medicine}
                        onChange={(e) => handleUpdateDrugRow(idx, "medicine", e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#475569", display: "block", marginBottom: 3 }}>Dosage</label>
                      <Input
                        list="common-dosages"
                        placeholder="e.g. 1 tablet, 500mg"
                        value={row.dosage}
                        onChange={(e) => handleUpdateDrugRow(idx, "dosage", e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#475569", display: "block", marginBottom: 3 }}>Frequency</label>
                      <Input
                        list="common-frequencies"
                        placeholder="e.g. Three times daily (TDS)"
                        value={row.frequency}
                        onChange={(e) => handleUpdateDrugRow(idx, "frequency", e.target.value)}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "var(--fs-11)", fontWeight: "var(--fw-bold)", color: "#475569", display: "block", marginBottom: 3 }}>Duration</label>
                      <Input
                        list="common-durations"
                        placeholder="e.g. 5 days, 1 week"
                        value={row.duration}
                        onChange={(e) => handleUpdateDrugRow(idx, "duration", e.target.value)}
                      />
                    </div>
                    <div style={{ display: "flex", justifyContent: "center", paddingTop: 16 }}>
                      <button
                        type="button"
                        onClick={() => handleRemoveDrugRow(idx)}
                        disabled={drugRows.length <= 1}
                        title="Remove medicine"
                        style={{
                          background: "none",
                          border: "none",
                          color: drugRows.length <= 1 ? "#cbd5e1" : "#dc2626",
                          cursor: drugRows.length <= 1 ? "not-allowed" : "pointer",
                          padding: "4px",
                          display: "flex",
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={handleAddDrugRow}
                  className="btn btn-secondary btn-sm"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Plus size={14} /> Add Another Medicine
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button type="button" onClick={() => setShowAddForm(false)} className="btn btn-secondary btn-sm">
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitPrescription}
                    disabled={validRowCount === 0}
                    className="btn btn-primary btn-sm"
                    style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                  >
                    <Check size={14} /> Save Prescription ({validRowCount} {validRowCount === 1 ? "Medicine" : "Medicines"})
                  </button>
                </div>
              </div>
            </div>
          </CardBody>
        )}
      </Card>

      {list.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState message="No prescriptions recorded for this patient yet." />
          </CardBody>
        </Card>
      ) : (
        <>
          {caseGroups.map(({ key, c, entries }) => (
            <Card key={key} style={{ marginBottom: "14px" }}>
              <CardHeader
                title={
                  <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "var(--sp-2)" }}>
                      <Pill size={16} /> {c.chiefComplaint?.trim() || c.title}
                    </span>
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-normal)", color: "#475569" }}>
                      Opened {formatDateShort(c.createdDate)}
                    </span>
                  </span>
                }
              >
                <CaseStatusPill c={c} />
              </CardHeader>
              <CardBody>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th style={{ width: "26%" }}>Medicine Name</Th>
                        <Th style={{ width: "16%" }}>Dosage</Th>
                        <Th style={{ width: "18%" }}>Frequency</Th>
                        <Th style={{ width: "12%" }}>Duration</Th>
                        <Th style={{ width: "14%" }}>Doctor</Th>
                        <Th style={{ width: "14%" }}>Prescribed Date</Th>
                        <Th style={{ width: "90px", textAlign: "right" }}>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map(({ item: p, originalIdx }) => {
                        const rowKey = `script-${originalIdx}`;
                        const isEditingThis = editingId === rowKey;

                        if (isEditingThis) {
                          return (
                            <Tr key={rowKey} style={{ background: "#f0f9ff" }}>
                              <Td><Input value={editMed} onChange={(e) => setEditMed(e.target.value)} /></Td>
                              <Td><Input value={editDosage} onChange={(e) => setEditDosage(e.target.value)} /></Td>
                              <Td><Input value={editFreq} onChange={(e) => setEditFreq(e.target.value)} /></Td>
                              <Td><Input value={editDuration} onChange={(e) => setEditDuration(e.target.value)} /></Td>
                              <Td>
                                <Select value={editDoc} onChange={(e) => setEditDoc(e.target.value)}>
                                  {doctorsList.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </Select>
                              </Td>
                              <Td style={{ color: "#475569", fontSize: "var(--fs-12)" }}>{p.date ? formatDateShort(p.date) : "—"}</Td>
                              <Td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                                  <button type="button" onClick={() => { setAuditReason(""); setAuditError(""); setAuditAction({ kind: "edit", index: originalIdx }); }} className="btn btn-primary btn-sm" style={{ padding: "4px 8px" }} title="Save">
                                    <Check size={13} />
                                  </button>
                                  <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }} title="Cancel">
                                    <X size={13} />
                                  </button>
                                </div>
                              </Td>
                            </Tr>
                          );
                        }

                        return (
                          <Tr key={rowKey}>
                            <Td style={{ fontWeight: "var(--fw-bold)", color: "#1e293b" }}>{p.medicine}</Td>
                            <Td>{p.dosage || "—"}</Td>
                            <Td style={{ color: "#7c3aed", fontWeight: "var(--fw-medium)" }}>{p.frequency || "—"}</Td>
                            <Td>{p.duration || "—"}</Td>
                            <Td><span className={styles.vtDoctor}>{p.doctor || "—"}</span></Td>
                            <Td style={{ color: "#475569", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", whiteSpace: "nowrap" }}>
                              {p.date ? formatDateShort(p.date) : "—"}
                            </Td>
                            <Td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => startEdit(p, rowKey)} className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", fontSize: "var(--fs-11)" }} title="Edit Medicine">
                                  <Pencil size={12} /> Edit
                                </button>
                                <button type="button" onClick={() => { setAuditReason(""); setAuditError(""); setAuditAction({ kind: "delete", index: originalIdx }); }} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", color: "#dc2626" }} title="Delete Medicine">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              </CardBody>
            </Card>
          ))}

          {looseEntries.length > 0 && (
            <Card>
              <CardHeader title={<><Pill size={16} /> Other Prescriptions</>} />
              <CardBody>
                <TableWrap>
                  <Table>
                    <thead>
                      <tr>
                        <Th style={{ width: "26%" }}>Medicine Name</Th>
                        <Th style={{ width: "16%" }}>Dosage</Th>
                        <Th style={{ width: "18%" }}>Frequency</Th>
                        <Th style={{ width: "12%" }}>Duration</Th>
                        <Th style={{ width: "14%" }}>Doctor</Th>
                        <Th style={{ width: "14%" }}>Prescribed Date</Th>
                        <Th style={{ width: "90px", textAlign: "right" }}>Actions</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {looseEntries.map(({ item: p, originalIdx }) => {
                        const rowKey = `loose-${originalIdx}`;
                        const isEditingThis = editingId === rowKey;

                        if (isEditingThis) {
                          return (
                            <Tr key={rowKey} style={{ background: "#f0f9ff" }}>
                              <Td><Input value={editMed} onChange={(e) => setEditMed(e.target.value)} /></Td>
                              <Td><Input value={editDosage} onChange={(e) => setEditDosage(e.target.value)} /></Td>
                              <Td><Input value={editFreq} onChange={(e) => setEditFreq(e.target.value)} /></Td>
                              <Td><Input value={editDuration} onChange={(e) => setEditDuration(e.target.value)} /></Td>
                              <Td>
                                <Select value={editDoc} onChange={(e) => setEditDoc(e.target.value)}>
                                  {doctorsList.map((d) => (
                                    <option key={d} value={d}>{d}</option>
                                  ))}
                                </Select>
                              </Td>
                              <Td style={{ color: "#475569", fontSize: "var(--fs-12)" }}>{p.date ? formatDateShort(p.date) : "—"}</Td>
                              <Td style={{ textAlign: "right" }}>
                                <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                                  <button type="button" onClick={() => { setAuditReason(""); setAuditError(""); setAuditAction({ kind: "edit", index: originalIdx }); }} className="btn btn-primary btn-sm" style={{ padding: "4px 8px" }} title="Save">
                                    <Check size={13} />
                                  </button>
                                  <button type="button" onClick={() => setEditingId(null)} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px" }} title="Cancel">
                                    <X size={13} />
                                  </button>
                                </div>
                              </Td>
                            </Tr>
                          );
                        }

                        return (
                          <Tr key={rowKey}>
                            <Td style={{ fontWeight: "var(--fw-bold)", color: "#1e293b" }}>{p.medicine}</Td>
                            <Td>{p.dosage || "—"}</Td>
                            <Td style={{ color: "#7c3aed", fontWeight: "var(--fw-medium)" }}>{p.frequency || "—"}</Td>
                            <Td>{p.duration || "—"}</Td>
                            <Td><span className={styles.vtDoctor}>{p.doctor || "—"}</span></Td>
                            <Td style={{ color: "#475569", fontSize: "var(--fs-12)", fontWeight: "var(--fw-medium)", whiteSpace: "nowrap" }}>
                              {p.date ? formatDateShort(p.date) : "—"}
                            </Td>
                            <Td style={{ textAlign: "right" }}>
                              <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                                <button type="button" onClick={() => startEdit(p, rowKey)} className="btn btn-secondary btn-sm" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", fontSize: "var(--fs-11)" }} title="Edit Medicine">
                                  <Pencil size={12} /> Edit
                                </button>
                                <button type="button" onClick={() => { setAuditReason(""); setAuditError(""); setAuditAction({ kind: "delete", index: originalIdx }); }} className="btn btn-secondary btn-sm" style={{ padding: "4px 8px", color: "#dc2626" }} title="Delete Medicine">
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </Td>
                          </Tr>
                        );
                      })}
                    </tbody>
                  </Table>
                </TableWrap>
              </CardBody>
            </Card>
          )}
        </>
      )}
      {/* Shared Datalists for Prescriptions */}
      <datalist id="common-dental-medicines">
        <option value="Amoxicillin 500mg" />
        <option value="Ibuprofen 400mg" />
        <option value="Paracetamol 500mg" />
        <option value="Metronidazole 400mg" />
        <option value="Augmentin 625mg" />
        <option value="Chlorhexidine 0.2% Mouthwash" />
        <option value="Ketorolac 10mg" />
        <option value="Azithromycin 500mg" />
        <option value="Clindamycin 300mg" />
      </datalist>
      <datalist id="common-dosages">
        <option value="1 tablet" />
        <option value="1 capsule" />
        <option value="2 tablets" />
        <option value="5 ml" />
        <option value="10 ml rinse" />
      </datalist>
      <datalist id="common-frequencies">
        <option value="Three times daily (TDS)" />
        <option value="Twice daily (BD)" />
        <option value="Once daily (QD)" />
        <option value="Four times daily (QID)" />
        <option value="As needed (SOS)" />
        <option value="1-0-1 (BID)" />
        <option value="1-1-1 (TID)" />
      </datalist>
      <datalist id="common-durations">
        <option value="3 days" />
        <option value="5 days" />
        <option value="7 days" />
        <option value="10 days" />
      </datalist>
      {auditAction && (
        <ConfirmDialog
          title={auditAction.kind === "edit" ? "Save prescription amendment?" : "Remove prescription?"}
          body={
            <div>
              {auditAction.kind === "edit"
                ? "The corrected prescription will be saved with an audit reason."
                : "The prescription will be removed from the active list while its correction history remains available."}
              <Field label="Reason *" style={{ marginTop: 12 }}><Input value={auditReason} onChange={(event) => setAuditReason(event.target.value)} autoFocus /></Field>
              {auditError && <p style={{ color: "#b91c1c", margin: "10px 0 0" }}>{auditError}</p>}
            </div>
          }
          confirmLabel={auditAction.kind === "edit" ? "Save amendment" : "Remove prescription"}
          destructive={auditAction.kind === "delete"}
          confirmDisabled={!auditReason.trim()}
          onConfirm={() => {
            const action = auditAction;
            if (action.kind === "edit") void handleSaveEdit(action.index, auditReason.trim());
            else void handleDelete(action.index, auditReason.trim());
          }}
          onCancel={() => { setAuditAction(null); setAuditReason(""); setAuditError(""); }}
        />
      )}
    </div>
  );
}
