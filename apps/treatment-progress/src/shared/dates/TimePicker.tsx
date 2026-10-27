"use client";

// A visible, low-friction time control. Staff choose hour, minute, and AM/PM
// directly in the form — no modal and no browser-specific segmented time widget.
// The saved contract remains the existing 24-hour "HH:MM" string.
interface TimePickerProps {
  id?: string;
  value: string;
  onChange: (hhmm: string) => void;
  placeholder?: string;
  /** Minute choices are generated at this interval. */
  minuteStep?: number;
  /** Stretch the selector to fill its container — for a form field vs. compact inline use. */
  fluid?: boolean;
  /** Make all parts of the control unavailable while its parent choice is off. */
  disabled?: boolean;
}

type Period = "AM" | "PM";

interface TimeParts {
  hour: number;
  minute: number;
  period: Period;
}

const HOURS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

/**
 * Clinics normally work from 8 AM through 7 PM. Selecting an hour should
 * therefore choose the period staff are most likely to mean, while the AM/PM
 * buttons always remain available for an exception.
 */
export function clinicPeriodForHour(hour: number): Period {
  return hour >= 8 && hour <= 11 ? "AM" : "PM";
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function splitTime(value: string): TimeParts | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour24 = Number(match[1]);
  const minute = Number(match[2]);
  if (hour24 > 23 || minute > 59) return null;
  return {
    hour: hour24 % 12 || 12,
    minute,
    period: hour24 >= 12 ? "PM" : "AM",
  };
}

function joinTime({ hour, minute, period }: TimeParts) {
  let hour24 = hour % 12;
  if (period === "PM") hour24 += 12;
  return `${pad(hour24)}:${pad(minute)}`;
}

export default function TimePicker({ id, value, onChange, placeholder = "Select time", minuteStep = 5, fluid = false, disabled = false }: TimePickerProps) {
  const selected = splitTime(value);
  const minuteChoices: number[] = [];
  for (let minute = 0; minute < 60; minute += Math.max(1, minuteStep)) minuteChoices.push(minute);

  const update = (patch: Partial<TimeParts>, changed: keyof TimeParts) => {
    // Changing the hour is the one moment we can apply the clinic-hours
    // shortcut. Changing minute or AM/PM must respect the staff member's
    // explicit choice.
    const hour = patch.hour ?? selected?.hour ?? 9;
    const period = changed === "hour" ? clinicPeriodForHour(hour) : patch.period ?? selected?.period ?? "AM";
    onChange(joinTime({ hour, minute: patch.minute ?? selected?.minute ?? 0, period }));
  };

  const selectStyle: React.CSSProperties = {
    height: "38px",
    minWidth: 0,
    padding: "0 8px",
    border: "1px solid #94a3b8",
    borderRadius: "7px",
    background: "#fff",
    color: "#0f172a",
    fontSize: "var(--fs-14)",
    fontWeight: "var(--fw-medium)",
    fontFamily: "inherit",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.68 : 1,
  };

  return (
    <div
      data-entry-field="true"
      aria-label={placeholder}
      style={{ display: "flex", alignItems: "flex-end", gap: "6px", width: fluid ? "100%" : "250px", minWidth: 0 }}
    >
      <label aria-label="Hour" style={{ display: "flex", flex: 1, minWidth: 0, flexDirection: "column", color: "#475569" }}>
        <select
          id={id}
          aria-label="Hour"
          disabled={disabled}
          value={selected?.hour ?? ""}
          onChange={(event) => {
            const hour = Number(event.target.value);
            if (HOURS.includes(hour)) update({ hour }, "hour");
          }}
          style={{ ...selectStyle, width: "100%" }}
        >
          <option value="">Hour</option>
          {HOURS.map((hour) => <option key={hour} value={hour}>{hour}</option>)}
        </select>
      </label>
      <span aria-hidden="true" style={{ color: "#64748b", fontWeight: "var(--fw-bold)" }}>:</span>
      <label aria-label="Minute" style={{ display: "flex", flex: 1, minWidth: 0, flexDirection: "column", color: "#475569" }}>
        <select
          aria-label="Minute"
          disabled={disabled}
          value={selected ? selected.minute : ""}
          onChange={(event) => update({ minute: Number(event.target.value) }, "minute")}
          style={{ ...selectStyle, width: "100%" }}
        >
          <option value="">Minute</option>
          {minuteChoices.map((minute) => <option key={minute} value={minute}>{pad(minute)}</option>)}
        </select>
      </label>
      <div aria-label="AM or PM" style={{ display: "flex", flexDirection: "column" }}>
        <div aria-label="AM or PM" style={{ display: "inline-flex", height: "38px", padding: "3px", gap: "2px", border: "1px solid #cbd5e1", borderRadius: "7px", background: "#f8fafc" }}>
          {(["AM", "PM"] as const).map((period) => {
            const active = selected?.period === period;
            return (
              <button
                key={period}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                onClick={() => update({ period }, "period")}
                style={{
                  minWidth: "37px",
                  border: "none",
                  borderRadius: "4px",
                  padding: "0 7px",
                  background: active ? "#0284c7" : "transparent",
                  color: active ? "#fff" : "#475569",
                  fontSize: "var(--fs-12)",
                  fontWeight: "var(--fw-bold)",
                  fontFamily: "inherit",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.68 : 1,
                }}
              >
                {period}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
