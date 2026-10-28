"use client";

import { BellRing } from "lucide-react";
import type { FollowUpWorklistItem } from "@/features/patients/types";
import { formatDateShort } from "@/features/patients/model/domain";
import DatePicker from "@/shared/dates/NepaliDatePicker";
import TimePicker from "@/shared/dates/TimePicker";
import { DataTable, EmptyState } from "@/shared/ui/workspace-primitives";
import ReasonPicker from "./ReasonPicker";

type Props = {
  idPrefix: string;
  date: string;
  time: string;
  reason: string;
  reasonOptions: string[];
  noFollowUpNeeded: boolean;
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onNoFollowUpChange: (value: boolean) => void;
  closeCase?: boolean;
  onCloseCaseChange?: (value: boolean) => void;
  upcoming: FollowUpWorklistItem[];
  loading?: boolean;
};

export default function DoctorRecallWorkspace({ idPrefix, date, time, reason, reasonOptions, noFollowUpNeeded, onDateChange, onTimeChange, onReasonChange, onNoFollowUpChange, closeCase, onCloseCaseChange, upcoming, loading = false }: Props) {
  return <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "16px", alignItems: "start" }}>
    <section style={{ padding: "16px", display: "grid", gap: "14px", background: "#f8fafc", border: "1px solid #cbd5e1", borderTop: "4px solid #64748b" }}>
      <div><strong style={{ color: "#1e293b" }}>Follow-up</strong><p style={{ margin: "4px 0 0", color: "#334155", fontSize: "var(--fs-13)" }}>Schedule the next clinical visit for this case.</p></div>
      <div>
        <label style={{ display: "block", marginBottom: "6px", color: "#0f172a", fontSize: "var(--fs-12)", fontWeight: 700, textTransform: "uppercase" }}><BellRing size={12} style={{ display: "inline", marginRight: 4 }} />Follow-up date & time</label>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(150px, 190px) minmax(0, 1fr)", gap: "8px" }}>
          <DatePicker id={`${idPrefix}-date`} value={date} onChange={onDateChange} fluid disabled={noFollowUpNeeded} style={{ color: "#0f172a", fontWeight: "var(--fw-medium)" }} />
          <TimePicker id={`${idPrefix}-time`} value={time} onChange={onTimeChange} fluid disabled={noFollowUpNeeded} />
        </div>
      </div>
      <ReasonPicker id={`${idPrefix}-reason`} label="Follow-up reason" value={reason} onChange={onReasonChange} options={reasonOptions} disabled={noFollowUpNeeded} />
      <label style={{ display: "flex", gap: "10px", padding: "11px 12px", background: noFollowUpNeeded ? "#dcfce7" : "#f0fdf4", border: "1px solid #86efac", cursor: "pointer" }}>
        <input type="checkbox" checked={noFollowUpNeeded} onChange={(event) => onNoFollowUpChange(event.target.checked)} style={{ "--checkbox-color": "#16a34a" } as React.CSSProperties} />
        <span><strong style={{ display: "block", color: "#14532d", fontSize: "var(--fs-14)" }}>No follow-up needed for this visit</strong></span>
      </label>
      {onCloseCaseChange ? <label style={{ display: "flex", gap: "10px", padding: "11px 12px", background: closeCase ? "#fffbeb" : "#f8fafc", border: "1px solid #cbd5e1", cursor: "pointer" }}><input type="checkbox" checked={Boolean(closeCase)} onChange={(event) => onCloseCaseChange(event.target.checked)} style={{ "--checkbox-color": "#d97706" } as React.CSSProperties} /><span><strong style={{ display: "block", color: "#92400e", fontSize: "var(--fs-14)" }}>Close the case</strong></span></label> : null}
    </section>
    <section style={{ padding: "16px", background: "#ffffff", border: "1px solid #cbd5e1", borderTop: "4px solid #0284c7" }}>
      <div style={{ marginBottom: "10px" }}><strong style={{ color: "#0c4a6e" }}>Upcoming follow-ups</strong><p style={{ margin: "4px 0 0", color: "#334155", fontSize: "var(--fs-13)" }}>Read-only clinic recall schedule.</p></div>
      <DataTable<FollowUpWorklistItem>
        rows={upcoming}
        rowKey={(item) => item.followUpId}
        noun="upcoming follow-ups"
        pageSize={5}
        loading={loading}
        loadingLabel="Loading upcoming follow-ups…"
        empty={<EmptyState icon={<BellRing size={24} />} message="No upcoming follow-ups scheduled." />}
        columns={[
          {
            key: "patient",
            header: "Patient",
            emphasis: "strong",
            sortable: true,
            value: (item) => item.patientName,
            render: (item) => item.patientName,
          },
          {
            key: "reason",
            header: "Reason / work",
            sortable: true,
            value: (item) => item.reason,
            render: (item) => item.reason || "—",
          },
          {
            key: "date",
            header: "Date",
            sortable: true,
            nowrap: true,
            value: (item) => item.dueOn,
            render: (item) => formatDateShort(item.dueOn),
          },
          {
            key: "time",
            header: "Time",
            nowrap: true,
            value: (item) => item.dueTime ?? "",
            render: (item) => item.dueTime ?? "—",
          },
        ]}
      />
    </section>
  </div>;
}
