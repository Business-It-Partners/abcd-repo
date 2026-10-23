"use client";

import { Wallet } from "lucide-react";
import { WORK_ENTRY_PAYMENT_METHODS } from "@/features/work-entry/workEntryPayment";
import { formatNpr } from "@/features/patients/model/domain";

type WorkEntryPaymentPanelProps = {
  idPrefix: string;
  todayCharges: number;
  previousDue: number;
  outstandingDue: number;
  paidToday: string;
  discount: string;
  paymentMethod: string;
  onPaidTodayChange: (value: string) => void;
  onDiscountChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  marginBottom: "5px",
  color: "#475569",
  fontSize: "var(--fs-11)",
  fontWeight: "var(--fw-bold)",
  letterSpacing: "0.04em",
  textTransform: "uppercase",
};

const field: React.CSSProperties = {
  width: "100%",
  minHeight: "38px",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: "0px",
  background: "#ffffff",
  color: "#0f172a",
  padding: "8px 11px",
  fontSize: "var(--fs-13)",
};

function draftAmount(value: string): number {
  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : 0;
}

export default function WorkEntryPaymentPanel({
  idPrefix,
  todayCharges,
  previousDue,
  outstandingDue,
  paidToday,
  discount,
  paymentMethod,
  onPaidTodayChange,
  onDiscountChange,
  onPaymentMethodChange,
}: WorkEntryPaymentPanelProps) {
  const discountAmount = draftAmount(discount);
  const payable = Math.max(0, outstandingDue - discountAmount);
  const noBalance = outstandingDue <= 0;

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px", background: "#f6fdf8", border: "1px solid #bbf7d0", borderTop: "4px solid #16a34a" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "9px" }}>
        <div style={{ width: "28px", height: "28px", display: "grid", placeItems: "center", borderRadius: "7px", background: "#dcfce7", color: "#15803d", flexShrink: 0 }}>
          <Wallet size={15} />
        </div>
        <div>
          <div style={{ color: "#14532d", fontSize: "var(--fs-15)", fontWeight: "var(--fw-bold)" }}>Payment</div>
          <div style={{ fontSize: "var(--fs-12)", color: "#4d7660", marginTop: "2px" }}>Record an optional payment or discount for this visit.</div>
        </div>
      </div>

      <div style={{ padding: "12px", background: "#fff7ed", border: "1px solid #fed7aa", display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: "#475569", fontSize: "var(--fs-12)" }}>
          <span>Previous due</span><strong>{formatNpr(previousDue)}</strong>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", color: "#1e293b", fontSize: "var(--fs-13)" }}>
          <span>Today&apos;s charges</span><strong>{formatNpr(todayCharges)}</strong>
        </div>
        <div style={{ borderTop: "1px solid #fed7aa", paddingTop: "8px", display: "flex", justifyContent: "space-between", gap: "12px", color: "#1e293b", fontSize: "var(--fs-13)" }}>
          <span>Outstanding balance</span><strong>{formatNpr(outstandingDue)}</strong>
        </div>
      </div>

      <div>
        <label htmlFor={`${idPrefix}-discount`} style={fieldLabel}>Discount (Rs)</label>
        <input id={`${idPrefix}-discount`} style={field} type="number" inputMode="decimal" min="0" step="0.01" max={outstandingDue} disabled={noBalance} value={discount} onChange={(event) => onDiscountChange(event.target.value)} onFocus={(event) => event.currentTarget.select()} placeholder="0" />
      </div>

      <div style={{ padding: "10px 14px", background: "#f0fdf4", border: "1px solid #bbf7d0" }}>
        <span style={{ display: "block", fontSize: "var(--fs-11)", color: "#4c4c56", fontWeight: "var(--fw-bold)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "3px" }}>Payable today</span>
        <span style={{ display: "block", fontSize: "var(--fs-18)", fontWeight: "var(--fw-bold)", color: "#166534", fontVariantNumeric: "tabular-nums" }}>{formatNpr(payable)}</span>
      </div>

      <div style={{ padding: "12px", background: "#ecfdf5", border: "1px solid #a7f3d0", display: "flex", flexDirection: "column", gap: "10px" }}>
        <div>
          <label htmlFor={`${idPrefix}-paid`} style={fieldLabel}>Paid today (NPR)</label>
          <input id={`${idPrefix}-paid`} style={field} type="number" inputMode="decimal" min="0" step="0.01" max={payable} disabled={noBalance} value={paidToday} onChange={(event) => onPaidTodayChange(event.target.value)} onFocus={(event) => event.currentTarget.select()} placeholder="0" />
        </div>
        <div>
          <label htmlFor={`${idPrefix}-method`} style={fieldLabel}>Payment method</label>
          <select id={`${idPrefix}-method`} style={field} value={paymentMethod} disabled={noBalance} onChange={(event) => onPaymentMethodChange(event.target.value)}>
            {WORK_ENTRY_PAYMENT_METHODS.map((method) => <option key={method.value} value={method.label}>{method.label}</option>)}
          </select>
        </div>
      </div>
      {noBalance ? <div style={{ padding: "9px 11px", background: "#f8fafc", border: "1px solid #e2e8f0", color: "#64748b", fontSize: "var(--fs-12)" }}>There is no outstanding balance to collect.</div> : null}
    </div>
  );
}
