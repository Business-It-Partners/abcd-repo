"use client";

import { AlertCircle, ShieldAlert, Pill, Stethoscope, FileText } from "lucide-react";
import { formatNpr } from "@/features/patients/model/domain";
import { type RxLine, type LabOrderInput } from "@/features/work-entry/model/caseData";
import { type PerioRow } from "./ReviewBlocks";
import { Table, TableWrap, Td, Th, Tr } from "@/shared/ui/ClinicTable";

interface WorkReviewSheetProps {
  patientName: string;
  patientMeta: string;
  alerts: string[];
  doctor: string;
  visitDate: string;
  chiefComplaint: string;
  caseStatus?: string;
  doneToday: { label: string; tooth: string; cost: number }[];
  nextVisit: { date: string; reason: string } | null;
  perio: PerioRow[];
  prescriptions: RxLine[];
  labOrders: LabOrderInput[];
  patientAlerts: string[];
  money: { todayCharges: number; discount?: number; previousDue: number; paid: number; balance: number };
}

type LegacyLabOrderInput = LabOrderInput & {
  workType?: string;
  supplierName?: string;
};

export default function WorkReviewSheet(props: WorkReviewSheetProps) {
  const { patientName, patientMeta, doctor, visitDate, chiefComplaint, caseStatus } = props;
  const { doneToday, prescriptions, labOrders, patientAlerts, money } = props;

  const netBillTotal = Math.max(0, money.todayCharges - (money.discount || 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", color: "#000000" }}>
      {/* Top Metadata Grid */}
      <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0px", padding: "18px 20px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px 24px" }}>
          <div>
            <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>
              Patient
            </span>
            <span style={{ fontSize: "16px", fontWeight: "var(--fw-bold)", color: "#000000", display: "block" }}>
              {patientName || "Walk-in Patient"}
            </span>
            <span style={{ fontSize: "13px", fontWeight: "var(--fw-semibold)", color: "#000000", display: "block", marginTop: "3px" }}>{patientMeta}</span>
          </div>

          <div>
            <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>
              Attending Clinician(s)
            </span>
            <span style={{ fontSize: "15px", fontWeight: "var(--fw-bold)", color: "#5b21b6", display: "block" }}>
              {doctor || "Dr. Arpana Tiwari"}
            </span>
          </div>

          <div>
            <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>
              Visit Date
            </span>
            <span style={{ fontSize: "15px", fontWeight: "var(--fw-bold)", color: "#000000", display: "block" }}>
              {visitDate}
            </span>
          </div>

          <div>
            <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>
              Chief Complaint
            </span>
            <span style={{ fontSize: "15px", fontWeight: "var(--fw-bold)", color: "#000000", display: "block" }}>
              {chiefComplaint.trim() || "Routine Clinical Visit"}
            </span>
          </div>
          {caseStatus ? <div>
            <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block", marginBottom: "4px" }}>Case status</span>
            <span style={{ fontSize: "15px", fontWeight: "var(--fw-bold)", color: "#b45309", display: "block" }}>{caseStatus}</span>
          </div> : null}
        </div>

        {patientAlerts.length > 0 && (
          <div style={{ marginTop: "14px", padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "0px", color: "#991b1b", fontSize: "13px", fontWeight: "var(--fw-bold)", display: "flex", alignItems: "center", gap: "8px" }}>
            <ShieldAlert size={16} />
            <span>Medical Warnings: {patientAlerts.join(" · ")}</span>
          </div>
        )}
      </div>

      {/* Procedures Performed Today Table */}
      <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0px", overflow: "hidden" }}>
        <div style={{ padding: "14px 18px", background: "#f8fafc", borderBottom: "1px solid #cbd5e1", fontSize: "14px", fontWeight: "var(--fw-bold)", color: "#000000", display: "flex", alignItems: "center", gap: "8px" }}>
          <Stethoscope size={18} style={{ color: "#6d28d9" }} /> Procedures Performed Summary ({doneToday.length})
        </div>

        {doneToday.length === 0 ? (
          <div style={{ padding: "18px", textAlign: "center", color: "#000000", fontSize: "14px", fontWeight: "var(--fw-semibold)" }}>
            No procedure lines recorded for this visit.
          </div>
        ) : (
          <TableWrap><Table>
            <thead>
              <Tr><Th>Procedure name</Th><Th align="center">Tooth #</Th><Th align="right">Amount (NPR)</Th></Tr>
            </thead>
            <tbody>
              {doneToday.map((line, idx) => (
                <Tr key={idx}>
                  <Td style={{ fontWeight: 550, color: "#000000" }}>{line.label}</Td>
                  <Td align="center" style={{ color: "#5b21b6", fontWeight: 550 }}>{line.tooth || "—"}</Td>
                  <Td align="right" style={{ fontWeight: 550, color: "#000000", fontVariantNumeric: "tabular-nums" }}>{formatNpr(line.cost)}</Td>
                </Tr>
              ))}
            </tbody>
          </Table></TableWrap>
        )}
      </div>

      {/* 4 Bottom Financial Summary Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "14px" }}>
        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", padding: "14px 16px", borderRadius: "0px" }}>
          <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
            Sub Total
          </span>
          <span style={{ fontSize: "17px", fontWeight: "var(--fw-bold)", color: "#000000", fontVariantNumeric: "tabular-nums", marginTop: "4px", display: "block" }}>
            {formatNpr(money.todayCharges)}
          </span>
        </div>

        <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", padding: "14px 16px", borderRadius: "0px" }}>
          <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
            Discount
          </span>
          <span style={{ fontSize: "17px", fontWeight: "var(--fw-bold)", color: money.discount ? "#5b21b6" : "#000000", fontVariantNumeric: "tabular-nums", marginTop: "4px", display: "block" }}>
            {money.discount ? `− ${formatNpr(money.discount)}` : "Rs 0"}
          </span>
        </div>

        <div style={{ background: "#f3e8ff", border: "1.5px solid #c084fc", padding: "14px 16px", borderRadius: "0px" }}>
          <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#5b21b6", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
            Net Bill Total
          </span>
          <span style={{ fontSize: "17px", fontWeight: "var(--fw-bold)", color: "#4c1d95", fontVariantNumeric: "tabular-nums", marginTop: "4px", display: "block" }}>
            {formatNpr(netBillTotal)}
          </span>
        </div>

        <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", padding: "14px 16px", borderRadius: "0px" }}>
          <span style={{ fontSize: "13px", fontWeight: "var(--fw-bold)", color: "#000000", textTransform: "uppercase", letterSpacing: "0.04em", display: "block" }}>
            Paid Today / Due
          </span>
          <span style={{ fontSize: "15px", fontWeight: "var(--fw-bold)", marginTop: "4px", display: "block" }}>
            <span style={{ color: "#15803d" }}>{formatNpr(money.paid)} paid</span>
            {money.balance > 0 && <span style={{ color: "#b91c1c", marginLeft: "6px" }}>({formatNpr(money.balance)} due)</span>}
          </span>
        </div>
      </div>

      {/* Prescriptions & Lab Work Blocks (if issued) */}
      {(prescriptions.length > 0 || labOrders.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
          {prescriptions.length > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0px", padding: "14px 16px" }}>
              <div style={{ fontSize: "14px", fontWeight: "var(--fw-bold)", color: "#5b21b6", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <Pill size={16} /> Prescribed Medications ({prescriptions.length})
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "13px" }}>
                {prescriptions.map((rx, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < prescriptions.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                    <span style={{ fontWeight: "var(--fw-bold)", color: "#000000" }}>{rx.medicine}</span>
                    <span style={{ color: "#000000", fontWeight: "var(--fw-semibold)" }}>{rx.dosage} · {rx.frequency} · {rx.duration}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {labOrders.length > 0 && (
            <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0px", padding: "14px 16px" }}>
              <div style={{ fontSize: "14px", fontWeight: "var(--fw-bold)", color: "#0f766e", display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <FileText size={16} /> Lab Work Needed
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "13px" }}>
                {labOrders.map((lab, i) => {
                  const legacyLab = lab as LegacyLabOrderInput;
                  const title = lab.procedure || legacyLab.workType || "Lab Work";
                  const supplier = lab.labName || legacyLab.supplierName || "";
                  const toothStr = lab.tooth ? ` · Tooth ${lab.tooth}` : "";
                  const shadeStr = lab.shade ? `Shade ${lab.shade}` : "";
                  return (
                    <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3px", padding: "6px 0", borderBottom: i < labOrders.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "var(--fw-bold)", color: "#000000", fontSize: "14px" }}>
                          {title}{toothStr}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", color: "#000000", fontWeight: "var(--fw-semibold)", fontSize: "13px" }}>
                        <span>{[supplier, shadeStr].filter(Boolean).join(" · ")}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Warning Notice Banner */}
      <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", color: "#78350f", padding: "12px 16px", borderRadius: "0px", fontSize: "13px", fontWeight: "var(--fw-bold)", display: "flex", alignItems: "center", gap: "8px" }}>
        <AlertCircle size={16} style={{ flexShrink: 0 }} />
        <span>Once saved, this encounter updates patient history, clinical timeline, and financial ledger automatically.</span>
      </div>
    </div>
  );
}
