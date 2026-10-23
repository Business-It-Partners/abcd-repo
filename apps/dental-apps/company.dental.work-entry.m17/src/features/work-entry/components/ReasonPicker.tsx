"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

// Pick the next-visit reason from the plan's remaining stages, or type your own. A recall that
// says "Crown fitting · tooth 46" is worth far more than "Follow-up", so the dropdown leads —
// but the dentist is never trapped in it.

interface ReasonPickerProps {
  id?: string;
  label: React.ReactNode;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--fs-12)",
  fontWeight: "var(--fw-medium)",
  color: "#1e293b",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "9px 11px",
  border: "1px solid #a9b2c2",
  borderRadius: "8px",
  fontSize: "var(--fs-14)",
  color: "#1e293b",
  background: "#fff",
  fontFamily: "inherit",
};

export default function ReasonPicker({
  id,
  label,
  options,
  value,
  onChange,
  placeholder = "Type the next-visit reason",
  disabled = false,
}: ReasonPickerProps) {
  // With no plan stages left there is nothing to pick from, so free text is the only mode.
  const noOptions = options.length === 0;
  const [custom, setCustom] = useState(false);
  const typing = custom || noOptions;

  const startCustom = () => {
    setCustom(true);
    onChange("");
  };

  const cancelCustom = () => {
    setCustom(false);
    onChange("");
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "6px" }}>
        <span style={labelStyle}>{label}</span>
        {!typing && !disabled && (
          <button
            type="button"
            onClick={startCustom}
            title="Write your own reason"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              background: "transparent",
              border: "none",
              padding: 0,
              fontSize: "var(--fs-12)",
              fontWeight: "var(--fw-medium)",
              color: "var(--acc, #7c3aed)",
              cursor: "pointer",
            }}
          >
            <Plus size={12} /> Custom
          </button>
        )}
      </div>

      {typing ? (
        <div style={{ position: "relative" }}>
          <input
            id={id}
            disabled={disabled}
            autoFocus={custom}
            style={{ ...inputStyle, paddingRight: noOptions ? "11px" : "34px" }}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
          />
          {!noOptions && (
          <button
            type="button"
            disabled={disabled}
              onClick={cancelCustom}
              title="Discard and pick from the plan instead"
              style={{
                position: "absolute",
                right: "6px",
                top: "50%",
                transform: "translateY(-50%)",
                display: "grid",
                placeItems: "center",
                width: "22px",
                height: "22px",
                background: "transparent",
                border: "none",
                borderRadius: "6px",
                color: "#1e293b",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <select id={id} disabled={disabled} style={{ ...inputStyle, opacity: disabled ? 0.68 : 1, cursor: disabled ? "not-allowed" : "pointer" }} value={value} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select next-visit reason…</option>
          {options.map((opt, i) => (
            <option key={i} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
