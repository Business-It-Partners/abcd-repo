"use client";

import { formatNpr } from "@/features/patients/model/domain";
import { type RxLine, type LabOrderInput } from "@/features/work-entry/model/caseData";
import { type CanalChartData } from "@/features/work-entry/model/canalData";
import {
  T,
  block,
  cols,
  sectionHead,
  Field,
  Empty,
  MoneyRow,
  StageRow,
  SheetHead,
  DoneTodayBlock,
  NextVisitBlock,
  PerioBlock,
  CanalBlockReview,
  PrescriptionBlockReview,
  LabBlock,
  type ReviewProcedure,
  type PerioRow,
} from "./ReviewBlocks";

export { type ReviewProcedure, type PerioRow };

interface CaseReviewLedgerProps {
  patientName: string;
  patientMeta: string;
  alerts: string[];
  doctor: string;
  doctors?: string[];
  visitDate: string;
  chiefComplaint: string;
  procedures: ReviewProcedure[];
  doneToday: { label: string; tooth: string; cost: number }[];
  nextVisit: { date: string; reason: string } | null;
  perio: PerioRow[];
  canalDataMap?: Record<string, CanalChartData>;
  prescriptions: RxLine[];
  labOrders: LabOrderInput[];
  /** The flat alert list the drug interlock reads, for the last-chance conflict banner. */
  patientAlerts: string[];
  money: { agreed: number; todayCharges: number; discount?: number; paid: number; balance: number };
}

export default function CaseReviewLedger(props: CaseReviewLedgerProps) {
  const { patientName, patientMeta, alerts, doctor, doctors, visitDate, chiefComplaint } = props;
  const { procedures, doneToday, nextVisit, perio, canalDataMap, prescriptions, labOrders, patientAlerts, money } = props;

  return (
    <div style={{ color: T.ink, marginTop: "6px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <SheetHead patientName={patientName} patientMeta={patientMeta} alerts={alerts} />

      <div style={{ ...block, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "18px 26px" }}>
        <Field k="Attending" v={doctors && doctors.length > 0 ? doctors.join(", ") : (doctor || "—")} />
        <Field k="Visit date" v={visitDate} />
        <Field k="Chief complaint" v={chiefComplaint.trim() || "—"} />
        <Field k="Procedures" v={`${procedures.length} planned`} />
      </div>

      {/* The plan — this sheet's reason for existing, so it leads. */}
      <section style={block}>
        <span style={{ ...sectionHead, marginBottom: "14px" }}>Treatment plan</span>
        {procedures.length === 0 ? (
          <Empty>No plan yet — chart a tooth or add a procedure in the Chart &amp; plan step.</Empty>
        ) : (
          procedures.map((p, i) => {
            const sub = p.stages.reduce((s, st) => s + st.cost, 0);
            return (
              <div key={i} style={{ marginBottom: i === procedures.length - 1 ? 0 : "26px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "var(--sp-3)", marginBottom: "var(--sp-1)" }}>
                  <h4 style={{ margin: 0, fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", letterSpacing: "0.02em", textTransform: "uppercase" }}>{p.title}</h4>
                  {p.toothLabel && <span style={{ fontSize: "var(--fs-13)", color: T.acc, fontWeight: "var(--fw-bold)" }}>{p.toothLabel}</span>}
                </div>
                <div>
                  {p.stages.map((st, j) => (
                    <StageRow key={j} label={st.label} cost={st.cost} done={st.done} custom={st.custom} />
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "9px", marginTop: "3px", borderTop: `1px solid ${T.line}`, fontSize: "var(--fs-13)", color: T.ink3 }}>
                  <span>{p.stages.length} {p.stages.length === 1 ? "stage" : "stages"}</span>
                  <b style={{ color: T.ink, fontVariantNumeric: "tabular-nums" }}>{formatNpr(sub)}</b>
                </div>
              </div>
            );
          })
        )}
      </section>

      {/* 2-Column Clinical & Billing layout */}
      <div style={cols}>
        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <DoneTodayBlock doneToday={doneToday} />
          <NextVisitBlock nextVisit={nextVisit} />
          <PerioBlock perio={perio} />
          <PrescriptionBlockReview prescriptions={prescriptions} patientAlerts={patientAlerts} />
        </div>

        {/* Right Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <section style={{ ...block, background: T.accSoft, borderColor: T.accLine }}>
            <span style={{ ...sectionHead, marginBottom: "var(--sp-3)" }}>Billing</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
              <MoneyRow k="Agreed total" v={formatNpr(money.agreed)} />
              <MoneyRow k="Today’s charges" v={formatNpr(money.todayCharges)} muted />
              {money.discount ? <MoneyRow k="Discount" v={`− ${formatNpr(money.discount)}`} muted /> : null}
              <MoneyRow k="Paid today" v={`− ${formatNpr(money.paid)}`} muted />
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: `2px solid ${T.ink}`, marginTop: "6px", paddingTop: "10px" }}>
                <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)" }}>Balance</span>
                <span style={{ fontSize: "var(--fs-17)", fontWeight: "var(--fw-bold)", fontVariantNumeric: "tabular-nums", color: money.balance > 0 ? T.danger : T.good }}>
                  {formatNpr(money.balance)}
                </span>
              </div>
            </div>
          </section>
          <CanalBlockReview canalDataMap={canalDataMap} />
          <LabBlock labOrders={labOrders} />
        </div>
      </div>
    </div>
  );
}
