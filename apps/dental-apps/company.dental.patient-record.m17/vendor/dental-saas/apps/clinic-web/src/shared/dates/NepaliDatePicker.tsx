"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { formatDateShort, todayISO } from "@/shared/dates/nepaliDate";
import { useBodyScrollLock } from "@/shared/ui/bodyScrollLock";
import {
  adToBS,
  bsToAD,
  daysInBSMonth,
  BS_MONTHS_LONG,
  BS_YEAR_MIN,
  BS_YEAR_MAX,
  type BSDate,
} from "@/shared/dates/nepaliDate";

// One date picker for every date field in the app (visit date, follow-up, joined date, payment
// date, X-ray date, appointment day…). The WHOLE control is the trigger — click anywhere to open,
// not a tiny calendar glyph — and the popover is a real month calendar, so it reads the same
// everywhere instead of leaving each field to whatever the browser's native `type=date` looks like.
//
// The calendar grid shows BIKRAM SAMBAT (BS) months. Clicking a day emits an AD ISO string —
// the storage format is unchanged, only the user-facing display is BS.
//
// `value` is an ISO "YYYY-MM-DD" string (or "" for empty). Every comparison here is done on that
// string — ISO dates sort lexically, so no Date object is parsed and no timezone can shift a day.

interface DatePickerProps {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
  /** Called after a date is chosen and the picker has closed. */
  onComplete?: () => void;
  /** Lower bound "YYYY-MM-DD"; days before it are disabled (e.g. a reschedule can't be in the past). */
  min?: string;
  /** Upper bound "YYYY-MM-DD"; days after it are disabled (e.g. a payment can't be in the future). */
  max?: string;
  placeholder?: string;
  /** Stretch the trigger to fill its container — for a form field, vs a compact inline control. */
  fluid?: boolean;
  /** Make the whole calendar control unavailable while its parent choice is off. */
  disabled?: boolean;
  /**
   * Render the trigger with the app's standard button classes instead of the form-field styling.
   * A date FIELD and a date ACTION are different things: one sits in a form and should look like an
   * input, the other sits in a table row beside Details and has to read as its equal.
   */
  triggerClassName?: string;
  style?: React.CSSProperties;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]; // Nepal's week runs Sun–Sat.

export default function DatePicker({ id, value, onChange, onComplete, min, max, placeholder = "Select date", fluid = false, disabled: disabledProp = false, triggerClassName, style }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  useBodyScrollLock(open);

  const today = todayISO();
  const todayBs = adToBS(today);

  // Seed the view from the current value (or today) in BS.
  const seedBs: BSDate = (value ? adToBS(value) : null) ?? todayBs ?? { year: 2083, month: 1, day: 1 };
  const [viewYear, setViewYear] = useState(seedBs.year);
  const [viewMonth, setViewMonth] = useState(seedBs.month); // 1..12 (BS months are 1-indexed)

  // The picker opens as a CENTRED modal over a dim backdrop — clear of the fields below it, so it
  // never overlaps the form and is never clipped by a scrollable ancestor.

  // Re-centre on the selected day (or today) whenever the popover opens.
  useEffect(() => {
    if (!open) return;
    const bs = (value ? adToBS(value) : null) ?? todayBs ?? { year: 2083, month: 1, day: 1 };
    setViewYear(bs.year);
    setViewMonth(bs.month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // The grid: leading blanks to the first weekday, then the month's days.
  // For BS, we convert BS day 1 to AD to get its weekday, and use daysInBSMonth for the count.
  const cells = useMemo(() => {
    const firstDayAD = bsToAD(viewYear, viewMonth, 1);
    if (!firstDayAD) return [];
    // Get weekday of the first BS day by converting to AD and reading the JS Date weekday
    const [y, m, d] = firstDayAD.split("-").map(Number);
    const firstWeekday = new Date(y, m - 1, d).getDay(); // 0=Sun..6=Sat
    const totalDays = daysInBSMonth(viewYear, viewMonth);

    const out: (string | null)[] = []; // Each entry is an ISO string or null (blank cell)
    for (let i = 0; i < firstWeekday; i++) out.push(null);
    for (let bsDay = 1; bsDay <= totalDays; bsDay++) {
      const iso = bsToAD(viewYear, viewMonth, bsDay);
      out.push(iso);
    }
    return out;
  }, [viewYear, viewMonth]);

  const disabled = (iso: string) => (min != null && iso < min) || (max != null && iso > max);

  useEffect(() => {
    if (disabledProp) setOpen(false);
  }, [disabledProp]);

  const step = (delta: number) => {
    let nextMonth = viewMonth + delta;
    let nextYear = viewYear;
    if (nextMonth < 1) { nextMonth = 12; nextYear -= 1; }
    if (nextMonth > 12) { nextMonth = 1; nextYear += 1; }
    // Clamp to the supported range
    if (nextYear < BS_YEAR_MIN || nextYear > BS_YEAR_MAX) return;
    setViewYear(nextYear);
    setViewMonth(nextMonth);
  };

  const active = Boolean(value);

  // Which BS day is selected (for highlighting)?
  const selectedBs = value ? adToBS(value) : null;
  const isSelectedDay = (bsDay: number) =>
    selectedBs != null && selectedBs.year === viewYear && selectedBs.month === viewMonth && selectedBs.day === bsDay;

  // Is today in the current view month?
  const isTodayDay = (bsDay: number) =>
    todayBs != null && todayBs.year === viewYear && todayBs.month === viewMonth && todayBs.day === bsDay;

  return (
    <div ref={rootRef} style={{ position: "relative", fontFamily: "inherit", width: fluid ? "100%" : undefined }}>
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabledProp}
        data-picker="true"
        data-entry-field="true"
        onClick={() => { if (!disabledProp) setOpen((o) => !o); }}
        className={triggerClassName}
        style={
          triggerClassName
            ? style
            : {
                display: fluid ? "flex" : "inline-flex",
                width: fluid ? "100%" : undefined,
                alignItems: "center",
                gap: "8px",
                minWidth: fluid ? undefined : "160px",
                height: "var(--control-h)",
                padding: "0 var(--sp-3)",
                borderRadius: "var(--r-sm)",
                border: `1px solid ${open ? "var(--acc, #6a5ae0)" : "var(--line-strong)"}`,
                background: disabledProp ? "#f1f5f9" : "var(--surface)",
                color: disabledProp ? "#94a3b8" : active ? "var(--ink-1)" : "var(--ink-3)",
                fontSize: "var(--fs-14)",
                fontWeight: active ? "var(--fw-medium)" : "var(--fw-normal)",
                cursor: disabledProp ? "not-allowed" : "pointer",
                opacity: disabledProp ? 0.72 : 1,
                transition: "border-color .15s ease",
                ...style,
              }
        }
      >
        {/* As a button the icon inherits the label's colour; as a field it is a muted affordance. */}
        <Calendar size={triggerClassName ? 14 : 16} style={{ flexShrink: 0, color: triggerClassName ? undefined : "#5c5670" }} />
        <span style={triggerClassName ? undefined : { flex: 1, textAlign: "left" }}>
          {active ? formatDateShort(value) : placeholder}
        </span>
      </button>

      {open && createPortal(
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(15,23,42,0.38)",
            display: "grid",
            placeItems: "center",
            padding: "20px",
          }}
        >
        <div
          ref={popRef}
          role="dialog"
          style={{
            width: "320px",
            maxWidth: "100%",
            borderRadius: "var(--r-lg)",
            background: "#ffffff",
            boxShadow: "0 20px 50px rgba(15, 23, 42, 0.22), 0 4px 12px rgba(15, 23, 42, 0.08)",
            overflow: "hidden",
          }}
        >
          {/* Month & Year stepper header with Purple Theme — now BS months */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "12px 14px", background: "var(--acc, #6a5ae0)", color: "#ffffff" }}>
            <button type="button" onClick={() => step(-1)} aria-label="Previous month" style={stepBtn}>
              <ChevronLeft size={16} />
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--r-xs)",
                  padding: "4px 8px",
                  fontSize: "var(--fs-13)",
                  fontWeight: "var(--fw-bold)",
                  cursor: "pointer",
                  outline: "none",
                }}
              >
                {BS_MONTHS_LONG.map((m, idx) => (
                  <option key={m} value={idx + 1} style={{ background: "#ffffff", color: "#1e293b" }}>
                    {m}
                  </option>
                ))}
              </select>

              <select
                value={viewYear}
                onChange={(e) => setViewYear(Number(e.target.value))}
                style={{
                  background: "rgba(255, 255, 255, 0.15)",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "var(--r-xs)",
                  padding: "4px 8px",
                  fontSize: "var(--fs-13)",
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
            </div>

            <button type="button" onClick={() => step(1)} aria-label="Next month" style={stepBtn}>
              <ChevronRight size={16} />
            </button>
          </div>

          <div style={{ padding: "14px 16px" }}>
            {/* Weekday header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px", marginBottom: "8px" }}>
              {WEEKDAYS.map((w) => (
                <span key={w} style={{ textAlign: "center", fontSize: "11px", fontWeight: "var(--fw-bold)", color: "var(--ink-3)", textTransform: "uppercase" }}>
                  {w}
                </span>
              ))}
            </div>

            {/* Day grid — now BS days */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: "4px" }}>
              {cells.map((iso, i) => {
                if (!iso) return <span key={`b${i}`} />;
                // Determine the BS day number for display
                const bsDate = adToBS(iso);
                const bsDay = bsDate?.day ?? 0;
                const isSelected = isSelectedDay(bsDay);
                const isToday = isTodayDay(bsDay);
                const off = disabled(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={off}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                      requestAnimationFrame(() => onComplete?.());
                    }}
                    style={{
                      height: "32px",
                      borderRadius: "var(--r-sm)",
                      border: isToday && !isSelected ? "1px solid var(--acc)" : "1px solid transparent",
                      background: isSelected ? "var(--acc, #6a5ae0)" : "transparent",
                      color: isSelected ? "#ffffff" : off ? "#cbd5e1" : "var(--ink-1)",
                      fontSize: "var(--fs-13)",
                      fontWeight: isSelected || isToday ? "var(--fw-bold)" : "var(--fw-medium)",
                      fontVariantNumeric: "tabular-nums",
                      cursor: off ? "not-allowed" : "pointer",
                      transition: "all .15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected && !off) {
                        e.currentTarget.style.background = "var(--acc-soft, #f0edfe)";
                        e.currentTarget.style.color = "var(--acc, #6a5ae0)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.color = off ? "#cbd5e1" : "var(--ink-1)";
                      }
                    }}
                  >
                    {bsDay}
                  </button>
                );
              })}
            </div>

            {/* Today shortcut */}
            <button
              type="button"
              disabled={disabled(today)}
              onClick={() => {
                onChange(today);
                setOpen(false);
              }}
              style={{
                width: "100%",
                marginTop: "12px",
                padding: "8px",
                borderRadius: "var(--r-sm)",
                border: "1px solid var(--acc-border, #ddd4fa)",
                background: "var(--acc-soft, #f0edfe)",
                color: disabled(today) ? "var(--ink-3)" : "var(--acc, #6a5ae0)",
                fontSize: "var(--fs-13)",
                fontWeight: "var(--fw-bold)",
                cursor: disabled(today) ? "not-allowed" : "pointer",
                transition: "background 0.15s ease",
              }}
            >
              Today
            </button>
          </div>
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
