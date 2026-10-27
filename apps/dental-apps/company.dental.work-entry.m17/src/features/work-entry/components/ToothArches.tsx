"use client";

import styles from "@/features/patients/patient-record.module.css";
import {
  type ToothValues,
  describeValues,
  isGone,
  stateMeta,
} from "@/features/work-entry/model/chartData";

// The two arches, drawn once and shared by both charts: the record's full Odontogram and the
// intake ScreeningChart. Forking this into two copies would let them drift, and a tooth that
// renders one way during the examination and another way in the record is worse than either.

// FDI Permanent Numbering Quadrants
const UPPER_RIGHT = ["18", "17", "16", "15", "14", "13", "12", "11"];
const UPPER_LEFT = ["21", "22", "23", "24", "25", "26", "27", "28"];
const LOWER_RIGHT = ["48", "47", "46", "45", "44", "43", "42", "41"];
const LOWER_LEFT = ["31", "32", "33", "34", "35", "36", "37", "38"];

// FDI Primary/Deciduous Numbering Quadrants
const PRIMARY_UPPER_RIGHT = ["55", "54", "53", "52", "51"];
const PRIMARY_UPPER_LEFT = ["61", "62", "63", "64", "65"];
const PRIMARY_LOWER_RIGHT = ["85", "84", "83", "82", "81"];
const PRIMARY_LOWER_LEFT = ["71", "72", "73", "74", "75"];

interface ToothArchesProps {
  /** What each tooth currently shows. A tooth absent here is UNRECORDED, not healthy. */
  values: Record<string, ToothValues>;
  selectedTooth: string | null;
  onSelect: (tooth: string) => void;
  /** Teeth with planned work, drawn as a dashed halo. Read from open cases, stored nowhere. */
  plannedTeeth?: Record<string, string>;
  /** Teeth something has been DONE to. Marked with a dot — colour says what it is, the dot says work happened. */
  treated?: Set<string>;
}

export default function ToothArches({ values, selectedTooth, onSelect, plannedTeeth, treated }: ToothArchesProps) {
  const renderTooth = (tooth: string, x: number, y: number) => {
    const isSelected = selectedTooth === tooth;
    const chart = values[tooth];
    const planned = plannedTeeth?.[tooth];

    // The tooth LAYERS. Structure paints the body, prosthesis rings it, endodontics marks the
    // root, presence greys the whole thing out. None of them erase another.
    const worked = treated?.has(tooth) ?? false;
    const gone = isGone(chart);
    const structure = chart?.structure;
    const prosthesis = chart?.prosthesis;
    const endo = chart?.endodontics;
    const presence = chart?.presence;

    const body = gone
      ? { fill: "#f1f5f9", border: "#9aa3b6" }
      : presence && presence !== "erupted"
        ? stateMeta(presence)
        : structure
          ? stateMeta(structure)
          : { fill: "#ffffff", border: "#9aa3b6" }; // unrecorded — blank, never "healthy"

    // "Tooth 33 — Unrecorded", not "Tooth 33 (Healthy)". A tooth nobody has looked at is not a
    // tooth found to be sound, and the tooltip must not say otherwise.
    const tooltip = [
      `Tooth ${tooth} — ${describeValues(chart)}`,
      worked ? "Work done — click for history" : null,
      planned ? `Planned: ${planned}` : null,
    ]
      .filter(Boolean)
      .join("\n");
    const isPrimary = parseInt(tooth) >= 51;

    const crownPath = isPrimary
      ? "M 8,4 L 22,4 L 25,12 L 23,24 L 15,29 L 7,24 L 5,12 Z"
      : "M 6,2 L 24,2 L 28,12 L 26,26 L 15,32 L 4,26 L 2,12 Z";

    return (
      <g
        key={tooth}
        className={`${styles.svgTooth} ${isSelected ? styles.svgToothSelected : ""}`}
        onClick={() => onSelect(tooth)}
        transform={`translate(${x}, ${y})`}
      >
        <title>{tooltip}</title>

        {planned && !gone && (
          <path
            d={isPrimary
              ? "M 6,2 L 24,2 L 27,12 L 25,25 L 15,31 L 5,25 L 3,12 Z"
              : "M 4,0 L 26,0 L 30,12 L 28,27 L 15,34 L 2,27 L 0,12 Z"}
            fill="none"
            stroke="var(--acc, #7c3aed)"
            strokeWidth={1.4}
            strokeDasharray="3 2"
            opacity={0.85}
          />
        )}

        <path
          d={crownPath}
          fill={body.fill}
          strokeWidth={isSelected ? 2 : 1.2}
          stroke={isSelected ? "var(--acc)" : body.border}
          style={{ transition: "all 0.15s ease" }}
        />

        {/* Prosthesis: a ring. A crowned tooth is still whatever it was underneath. */}
        {prosthesis && !gone && (
          <path d={crownPath} fill="none" stroke={stateMeta(prosthesis).border} strokeWidth={2.4} />
        )}

        {/* The root, and the endodontic mark ON it, which no crown can hide. */}
        {!gone && (
          <>
            <path
              d={isPrimary ? "M 13,24 L 15,38 L 17,24" : "M 12,26 L 15,44 L 18,26"}
              fill="none"
              stroke={endo ? stateMeta(endo).border : isSelected ? "var(--acc)" : "#9aa3b6"}
              strokeWidth={endo ? 2.2 : 1}
            />
            {endo && <circle cx={15} cy={isPrimary ? 34 : 39} r={2.4} fill={stateMeta(endo).border} />}
          </>
        )}

        {gone && <path d="M 5,5 L 25,27 M 25,5 L 5,27" stroke="#6b7688" strokeWidth={1.6} fill="none" />}

        {/* Work has been done on this tooth. Click it to read what. */}
        {worked && <circle cx={isPrimary ? 23 : 25} cy={isPrimary ? 6 : 4} r={3} fill="var(--acc, #7c3aed)" stroke="#fff" strokeWidth={1} />}

        <text
          x={15}
          y={isPrimary ? 16 : 18}
          textAnchor="middle"
          fontSize={isPrimary ? "9px" : "10px"}
          fontWeight="700"
          fill={gone ? "#6b7688" : chart ? "#1e293b" : "#475569"}
          style={{ pointerEvents: "none" }}
        >
          {tooth}
        </text>
      </g>
    );
  };

  return (
    <>
      <div className={styles.archTitle}>Upper Arch (Maxillary)</div>
      <svg viewBox="0 0 540 125" className={styles.svgOdontogram} style={{ height: "185px", width: "100%" }}>
        {UPPER_RIGHT.map((t, i) => renderTooth(t, 12 + i * 32, 10))}
        {UPPER_LEFT.map((t, i) => renderTooth(t, 278 + i * 32, 10))}
        {PRIMARY_UPPER_RIGHT.map((t, i) => renderTooth(t, 108 + i * 32, 65))}
        {PRIMARY_UPPER_LEFT.map((t, i) => renderTooth(t, 278 + i * 32, 65))}
        <line x1={268} y1={5} x2={268} y2={120} stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="3, 3" />
      </svg>

      <div className={styles.archTitle}>Lower Arch (Mandibular)</div>
      <svg viewBox="0 0 540 125" className={styles.svgOdontogram} style={{ height: "185px", width: "100%" }}>
        {LOWER_RIGHT.map((t, i) => renderTooth(t, 12 + i * 32, 65))}
        {LOWER_LEFT.map((t, i) => renderTooth(t, 278 + i * 32, 65))}
        {PRIMARY_LOWER_RIGHT.map((t, i) => renderTooth(t, 108 + i * 32, 10))}
        {PRIMARY_LOWER_LEFT.map((t, i) => renderTooth(t, 278 + i * 32, 10))}
        <line x1={268} y1={5} x2={268} y2={120} stroke="#e2e8f0" strokeWidth={1.5} strokeDasharray="3, 3" />
      </svg>
    </>
  );
}
