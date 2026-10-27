"use client";

import { useState } from "react";
import { User, Phone, AlertTriangle, ShieldCheck, Pencil, Plus, X, Check } from "lucide-react";
import { type PatientDetail } from "@/features/patients/model/domain";
import { Card, CardHeader, CardBody, Chip, Input, Select } from "@/shared/ui/workspace-primitives";
import { useSnackbar } from "@/shared/ui/SnackbarProvider";

interface PatientProfileTabProps {
  patientName: string;
  patientDetail: PatientDetail;
  phone: string;
  onUpdatePatient?: (patch: Partial<PatientDetail>) => Promise<void> | void;
  doctorsList?: string[];
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        borderBottom: "1px solid #f1f5f9",
        paddingBottom: "var(--sp-2)",
        alignItems: "center",
      }}
    >
      <span style={{ color: "var(--ink-2)", fontWeight: "var(--fw-normal)", fontSize: "var(--fs-14)" }}>{label}</span>
      <span style={{ fontWeight: "var(--fw-medium)", color: "var(--ink-1)", fontSize: "var(--fs-14)" }}>{value}</span>
    </div>
  );
}

export default function PatientProfileTab({
  patientName,
  patientDetail,
  phone,
  onUpdatePatient,
}: PatientProfileTabProps) {
  const { showToast } = useSnackbar();
  const ec = patientDetail.emergencyContact;
  const contactPhone = patientDetail.phone || phone;
  const displayName = patientName || patientDetail.name || "";
  // Clinicians are deliberately scoped to each active case in Work Entry. A
  // patient-level picker would make a clinically ambiguous assignment.

  // Editable fields state
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(displayName);
  const [editAge, setEditAge] = useState<number>(patientDetail.age || 0);
  const [editSex, setEditSex] = useState<"M" | "F">(patientDetail.sex || "M");
  const [editPhone, setEditPhone] = useState(contactPhone);
  const [editAddress, setEditAddress] = useState(patientDetail.address || "");
  const [editLanguage, setEditLanguage] = useState(patientDetail.language || "Nepali");
  const [alerts, setAlerts] = useState<string[]>(patientDetail.alerts || []);
  const [newAlertText, setNewAlertText] = useState("");
  const [ecName, setEcName] = useState(ec?.name || "");
  const [ecRelation, setEcRelation] = useState(ec?.relation || "");
  const [ecPhone, setEcPhone] = useState(ec?.phone || "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const handleSaveProfile = async () => {
    if (!onUpdatePatient || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onUpdatePatient({
        name: editName,
        age: editAge,
        sex: editSex,
        phone: editPhone,
        address: editAddress,
        language: editLanguage,
        alerts: alerts,
        emergencyContact: {
          name: ecName,
          relation: ecRelation,
          phone: ecPhone,
        },
      });
      setIsEditing(false);
      showToast("Patient profile saved.");
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "The patient profile could not be saved.");
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(displayName);
    setEditAge(patientDetail.age || 0);
    setEditSex(patientDetail.sex || "M");
    setEditPhone(contactPhone);
    setEditAddress(patientDetail.address || "");
    setEditLanguage(patientDetail.language || "Nepali");
    setAlerts(patientDetail.alerts || []);
    setEcName(ec?.name || "");
    setEcRelation(ec?.relation || "");
    setEcPhone(ec?.phone || "");
    setIsEditing(false);
  };

  const handleAddAlert = () => {
    if (!newAlertText.trim()) return;
    if (!alerts.includes(newAlertText.trim())) {
      setAlerts([...alerts, newAlertText.trim()]);
    }
    setNewAlertText("");
  };

  const handleRemoveAlert = (alertToRemove: string) => {
    setAlerts(alerts.filter((a) => a !== alertToRemove));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-5)" }}>
      {/* Grid of Profile Metadata */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--sp-5)" }}>
        {/* Contact Info Card */}
        <Card>
          <CardHeader title={<><User size={16} /> Demographics & Contact</>}>
            {onUpdatePatient && !isEditing && (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="btn btn-secondary btn-sm"
                style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "3px 9px", fontSize: "var(--fs-12)" }}
              >
                <Pencil size={12} /> Edit Profile
              </button>
            )}
            {isEditing && (
              <div style={{ display: "flex", gap: "6px" }}>
                <button type="button" onClick={handleCancel} disabled={saving} className="btn btn-secondary btn-sm" style={{ padding: "3px 9px", fontSize: "var(--fs-12)" }}>
                  Cancel
                </button>
                <button type="button" onClick={() => { void handleSaveProfile(); }} disabled={saving || !editName.trim()} className="btn btn-primary btn-sm" style={{ padding: "3px 9px", fontSize: "var(--fs-12)" }}>
                  <Check size={12} /> {saving ? "Saving…" : "Save"}
                </button>
              </div>
            )}
          </CardHeader>
          <CardBody>
            {saveError ? <p role="alert" style={{ margin: "0 0 var(--sp-3)", color: "#b91c1c", fontSize: "var(--fs-13)" }}>{saveError}</p> : null}
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {isEditing ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Full Name</span>
                    <Input
                      style={{ width: "240px" }}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Age</span>
                    <Input
                      type="number"
                      style={{ width: "180px" }}
                      value={editAge}
                      onChange={(e) => setEditAge(Number(e.target.value))}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Gender</span>
                    <Select
                      style={{ width: "180px" }}
                      value={editSex}
                      onChange={(e) => setEditSex(e.target.value as "M" | "F")}
                    >
                      <option value="M">Male</option>
                      <option value="F">Female</option>
                    </Select>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Phone Number</span>
                    <Input
                      style={{ width: "240px" }}
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Address</span>
                    <Input
                      style={{ width: "260px" }}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Preferred Language</span>
                    <Input
                      style={{ width: "220px" }}
                      value={editLanguage}
                      onChange={(e) => setEditLanguage(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <InfoRow label="Full Name" value={displayName || "—"} />
                  <InfoRow label="Age" value={patientDetail.age ? `${patientDetail.age} yrs` : "—"} />
                  <InfoRow label="Gender" value={patientDetail.sex === "M" ? "Male" : "Female"} />
                  <InfoRow
                    label="Phone Number"
                    value={
                      <span style={{ color: "var(--acc)", display: "flex", alignItems: "center", gap: "var(--sp-1)" }}>
                        <Phone size={13} /> {contactPhone || "—"}
                      </span>
                    }
                  />
                  <InfoRow label="Address" value={patientDetail.address || "—"} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--ink-2)", fontWeight: "var(--fw-normal)", fontSize: "var(--fs-14)" }}>Preferred Language</span>
                    <span style={{ fontWeight: "var(--fw-medium)", color: "var(--ink-1)", fontSize: "var(--fs-14)" }}>{patientDetail.language}</span>
                  </div>
                </>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Clinical Summary & Alerts Card */}
        <Card>
          <CardHeader title={<><AlertTriangle size={16} /> Clinical Parameters & Warnings</>} />
          <CardBody>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
              {/* Patient Record ID (STAYS READ-ONLY as requested) */}
              <InfoRow
                label="Patient Record ID"
                value={<span style={{ fontVariantNumeric: "tabular-nums" }}>{patientDetail.id}</span>}
              />

              {isEditing ? (
                <>
                  <div style={{ borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)", color: "var(--ink-3)", fontSize: "var(--fs-13)", lineHeight: 1.45 }}>
                    Attending clinicians are assigned to each active treatment case in Work Entry, so the clinical context and audit history remain clear.
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Medical Warnings</span>
                    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                      {alerts.map((a) => (
                        <span key={a} style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", padding: "2px 8px", borderRadius: "16px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                          {a}
                          <button type="button" onClick={() => handleRemoveAlert(a)} style={{ background: "none", border: "none", cursor: "pointer", color: "#dc2626", padding: 0 }}>
                            <X size={12} />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                      <Input
                        placeholder="Add warning (e.g. Diabetic, Asthma)"
                        style={{ flex: 1 }}
                        value={newAlertText}
                        onChange={(e) => setNewAlertText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddAlert();
                          }
                        }}
                      />
                      <button type="button" onClick={handleAddAlert} className="btn btn-secondary btn-sm" style={{ padding: "3px 10px", fontSize: "var(--fs-12)", height: "var(--control-h)" }}>
                        <Plus size={13} /> Add
                      </button>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "var(--sp-2)" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Emergency Contact</span>
                    <Input
                      placeholder="Name"
                      style={{ width: "220px" }}
                      value={ecName}
                      onChange={(e) => setEcName(e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#1e293b", fontWeight: "var(--fw-medium)", fontSize: "var(--fs-14)" }}>Emergency Phone</span>
                    <Input
                      placeholder="Phone"
                      style={{ width: "220px" }}
                      value={ecPhone}
                      onChange={(e) => setEcPhone(e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <InfoRow
                    label="Medical Warnings"
                    value={
                      (patientDetail.alerts || []).length > 0 ? (
                        <Chip tone="danger">{patientDetail.alerts.join(", ")}</Chip>
                      ) : (
                        <span style={{ fontWeight: "var(--fw-medium)", color: "var(--ok)", display: "flex", alignItems: "center", gap: "var(--sp-1)" }}>
                          <ShieldCheck size={14} /> None Recorded
                        </span>
                      )
                    }
                  />
                  <InfoRow
                    label="Emergency Contact"
                    value={ec?.name ? `${ec.name}${ec.relation ? ` (${ec.relation})` : ""}` : "Not recorded"}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--ink-2)", fontWeight: "var(--fw-normal)", fontSize: "var(--fs-14)" }}>Emergency Phone</span>
                    <span style={{ fontWeight: "var(--fw-medium)", color: "var(--ink-1)", fontSize: "var(--fs-14)" }}>{ec?.phone || "—"}</span>
                  </div>
                </>
              )}
            </div>
          </CardBody>
        </Card>
      </div>

    </div>
  );
}
