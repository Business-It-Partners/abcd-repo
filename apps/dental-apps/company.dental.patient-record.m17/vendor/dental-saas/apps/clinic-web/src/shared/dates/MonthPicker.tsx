"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight, ChevronDown, Check } from "lucide-react";
import {
  todayBS,
  BS_MONTHS_SHORT,
  BS_YEAR_MIN,
  BS_YEAR_MAX,
  bsMonthLabel,
  adMonthToBSMonth,
} from "@/shared/dates/nepaliDate";

// One month picker for every filter (Patient Record, Follow-ups, Lab Tracker, Finance). The whole
// control is the trigger — click anywhere on it to open, not a tiny calendar glyph — and the
// popover browses ANY year + month, not only the months that already have data.
//
// The calendar grid now shows BIKRAM SAMBAT months (Baisakh–Chait). `value` is a BS "YYYY-MM"
// string (e.g. "2083-04" for Shrawan), or the literal "all" when `allowAll` is set.

interface MonthPickerProps {
  value: string;
  onChange: (value: string) => void;
  /** Offer an "All months" choice (Lab Tracker). Without it, a concrete month is always selected. */
  allowAll?: boolean;
  allLabel?: string;
  /** Upper bound AD "YYYY-MM" — months after it are disabled (Finance can't report the future). Converted to BS internally. */
  max?: string;
  /** Stretch the trigger to fill its container — for a form field, vs the compact filter default. */
  fluid?: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export default function MonthPicker({ value, onChange, allowAll = false, allLabel = "All months", max, fluid = false }: MonthPickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  // Portalled to <body>, positioned off the trigger — see the same note in DatePicker. Rendered
  // inline it gets clipped by a scrollable modal body.
  const POP_W = 290;
  const POP_H = 300;
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = r.bottom + 8;
    const above = r.top - 8 - POP_H;
    const top = below + POP_H <= window.innerHeight || above < 0 ? below : above;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - POP_W - 8);
    setCoords({ top, left });
  };
  useLayoutEffect(() => {
    if (open) place();
  }, [open]);

  // Parse BS year from the current value, or default to today's BS year
  const bsToday = todayBS();
  const selectedYear = value !== "all" ? Number(value.slice(0, 4)) : (bsToday?.year ?? 2083);
  const selectedMonth = value !== "all" ? Number(value.slice(5, 7)) : 0; // 1..12, 0 = none
  const [viewYear, setViewYear] = useState(selectedYear);

  // Re-centre the grid on the selected month whenever the popover opens.
  useEffect(() => {
    if (open) setViewYear(value !== "all" ? Number(value.slice(0, 4)) : (bsToday?.year ?? 2083));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (rootRef.current?.contains(t) || popRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const reflow = () => place();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", reflow);
    window.addEventListener("scroll", reflow, true);
    return () => {
      window.removeEventListener("resize", reflow);
      window.removeEventListener("scroll", reflow, true);
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = value !== "all";

  // Convert AD max to BS month for comparison
  const maxBS = max ? adMonthToBSMonth(max) : null;
  const maxYear = maxBS ? Number(maxBS.slice(0, 4)) : null;
  const maxMonth = maxBS ? Number(maxBS.slice(5, 7)) : null;

  const pick = (monthIndex: number) => {
    const mm = pad(monthIndex + 1);
    onChange(`${viewYear}-${mm}`);
    setOpen(false);
  };

  const disabledMonth = (monthIndex: number): boolean => {
    if (maxYear == null || maxMonth == null) return false;
    if (viewYear > maxYear) return true;
    if (viewYear === maxYear && monthIndex + 1 > maxMonth) return true;
    return false;
  };

  return (
    <div ref={rootRef} style={{ position: "relative", fontFamily: "inherit", width: fluid ? "100%" : undefined }}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        /* Sized and coloured as a plain toolbar control, matching the category <Select> beside it. */
        style={{
          display: fluid ? "flex" : "inline-flex",
          width: fluid ? "100%" : undefined,
          alignItems: "center",
          gap: "var(--sp-2)",
          minWidth: fluid ? undefined : "150px",
          height: "var(--control-h)",
          padding: "0 var(--sp-3)",
          borderRadius: "var(--r-sm)",
          border: "1px solid var(--line-strong)",
          background: "var(--surface)",
          color: "var(--ink-1)",
          fontSize: "var(--fs-14)",
          fontWeight: "var(--fw-normal)",
          cursor: "pointer",
          transition: "border-color .15s ease",
        }}
      >
        <Calendar size={16} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>{bsMonthLabel(value, allLabel)}</span>
        <ChevronDown size={16} style={{ flexShrink: 0, opacity: 0.7, transform: open ? "rotate(180deg)" : "none", transition: "transform .15s ease" }} />
      </button>

      {open && createPortal(
        <div
          ref={popRef}
          role="dialog"
          style={{
            position: "fixed",
            top: coords.top,
            left: coords.left,
            zIndex: 1000,
            width: `${POP_W}px`,
            borderRadius: "var(--r-lg)",
            background: "#ffffff",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Year stepper header with Purple Theme — now BS years */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "12px 14px", background: "var(--acc, #6a5ae0)", color: "#ffffff" }}>
            <button
              type="button"
              onClick={() => setViewYear((y) => Math.max(BS_YEAR_MIN, y - 1))}
              aria-label="Previous year"
              style={stepBtn}
            >
              <ChevronLeft size={16} />
            </button>

            <select
              value={viewYear}
              onChange={(e) => setViewYear(Number(e.target.value))}
              style={{
                background: "rgba(255, 255, 255, 0.15)",
                color: "#ffffff",
                border: "none",
                borderRadius: "var(--r-xs)",
                padding: "4px 10px",
                fontSize: "var(--fs-14)",
                fontWeight: "var(--fw-bold)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              {Array.from({ length: BS_YEAR_MAX - BS_YEAR_MIN + 1 }, (_, i) => BS_YEAR_MIN + i).map((y) => (
                <option key={y} value={y} style={{ background: "#ffffff", color: "#1e293b" }}>
                  {y}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setViewYear((y) => Math.min(BS_YEAR_MAX, y + 1))}
              aria-label="Next year"
              style={stepBtn}
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ padding: "14px" }}>
            {/* 12-month grid — now BS months */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {BS_MONTHS_SHORT.map((m, i) => {
                const isSelected = active && viewYear === selectedYear && i + 1 === selectedMonth;
                const disabled = disabledMonth(i);
                return (
                  <button
                    key={m}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(i)}
                    style={{
                      padding: "10px 0",
                      borderRadius: "var(--r-sm)",
                      border: `1px solid ${isSelected ? "var(--acc, #6a5ae0)" : "transparent"}`,
                      background: isSelected ? "var(--acc, #6a5ae0)" : disabled ? "#f8fafc" : "#f8fafc",
                      color: isSelected ? "#ffffff" : disabled ? "#cbd5e1" : "var(--ink-1)",
                      fontSize: "var(--fs-13)",
                      fontWeight: isSelected ? "var(--fw-bold)" : "var(--fw-medium)",
                      cursor: disabled ? "not-allowed" : "pointer",
                      transition: "all .15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !disabled) {
                        e.currentTarget.style.background = "var(--acc-soft, #f0edfe)";
                        e.currentTarget.style.color = "var(--acc, #6a5ae0)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected && !disabled) {
                        e.currentTarget.style.background = "#f8fafc";
                        e.currentTarget.style.color = "var(--ink-1)";
                      }
                    }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>

            {allowAll && (
              <button
                type="button"
                onClick={() => { onChange("all"); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  width: "100%",
                  marginTop: "12px",
                  padding: "9px",
                  borderRadius: "var(--r-sm)",
                  border: `1px solid ${value === "all" ? "var(--acc-border, #ddd4fa)" : "var(--line)"}`,
                  background: value === "all" ? "var(--acc-soft, #f0edfe)" : "#ffffff",
                  color: value === "all" ? "var(--acc, #6a5ae0)" : "var(--ink-2)",
                  fontSize: "var(--fs-13)",
                  fontWeight: "var(--fw-bold)",
                  cursor: "pointer",
                  transition: "background 0.15s ease",
                }}
              >
                {value === "all" && <Check size={14} />} {allLabel}
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

const stepBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: "28px",
  height: "28px",
  borderRadius: "var(--r-xs)",
  border: "none",
  background: "rgba(255, 255, 255, 0.15)",
  color: "#ffffff",
  cursor: "pointer",
  transition: "background 0.15s ease",
};
