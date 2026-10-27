"use client";

import { formatNpr, formatDateShort, checkDrugAllergyConflict } from "@/features/patients/model/domain";
import { type RxLine, type LabOrderInput } from "@/features/work-entry/model/caseData";
import { type CanalChartData } from "@/features/work-entry/model/canalData";
import { Table, TableWrap, Td, Th, Tr } from "@/shared/ui/ClinicTable";

// The pieces the two review sheets are built from.
//
// WHY THIS FILE EXISTS: New Patient and Daily Work close on DIFFERENT documents — one presents a
// treatment plan being agreed to, the other an account being settled — but the clinical blocks in
// between (what was done, gum readings, drugs, lab work) are the same record either way. So the
// PAGES are separate and the PARTS are shared.
//
// The one that must never be duplicated is the prescription block: it runs the last-chance drug
// allergy check before an immutable write. Two copies means two behaviours, and a fix to one that
// silently misses the other.
//
// Light mode only, by design — this is a clinical document, not a themed surface — so the palette
// is fixed here rather than driven by app tokens. Sizing still reads the shared --fs-*/--sp-*/--fw-*
// scale below wherever an exact value matches it; where nothing in the scale matches (13.5px, 15px,
// odd paddings), the original literal is kept rather than rounded — see the migration report.

export const T = {
  surface: "#ffffff",
  sunk: "#f6f4f0",
  line: "#e7e3dc",
  lineSoft: "#f0ece5",
  cardBg: "#faf8f4",
  ink: "#1c1a26",
  ink2: "#1c1a26",
  ink3: "#1c1a26",
  // Only the pending "•" bullet still uses this — it is a state marker, not text.
  ink4: "#9aa3b6",
  acc: "#7c3aed",
  accSoft: "#f1ebfe",
  accLine: "#d9c9fb",
  danger: "#b3261e",
  dangerSoft: "#fdf1f0",
  dangerLine: "#f2d4d1",
  good: "#12694a",
  warn: "#8a5a00",
  warnSoft: "#fdf6e6",
  warnLine: "#f0e0b8",
};

export interface ReviewProcedure {
  title: string;
  toothLabel: string;
  stages: { label: string; cost: number; done: boolean; custom?: boolean }[];
}

export interface PerioRow {
  tooth: string;
  pd: number[]; // db, b, mb, dl, l, ml
  bop: number;
  mobility: number;
}

/* Everything on this sheet is one ink, so rank has to come from size, weight and tracking alone.
   Three levels, far enough apart to read at a glance:
   sectionHead (structure) > fieldLabel (names a value) > body (the value itself). */
export const sectionHead: React.CSSProperties = {
  display: "block",
  fontSize: "var(--fs-14)",
  fontWeight: "var(--fw-bold)",
  letterSpacing: "0.10em",
  textTransform: "uppercase",
  color: T.ink,
};

export const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: "var(--fs-12)",
  fontWeight: "var(--fw-bold)",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: T.ink,
};

/** Each kind of information sits in its own tinted card, so a block can be found without reading it. */
export const block: React.CSSProperties = {
  padding: "18px var(--sp-5)",
  background: T.cardBg,
  border: `1px solid ${T.line}`,
  borderRadius: "0px",
};

export const cols: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr",
  gap: "14px",
};

export function Field({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <span style={fieldLabel}>{k}</span>
      <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-medium)", color: T.ink }}>{v}</span>
    </div>
  );
}

/** A cost of zero is a real, deliberate price — shown as "Free", never a blank. */
export function Amount({ n }: { n: number }) {
  if (n === 0) {
    return (
      <span style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: T.ink3, background: T.sunk, padding: "2px var(--sp-2)", borderRadius: "var(--r-pill)" }}>
        Free
      </span>
    );
  }
  return <span style={{ fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums", color: T.ink }}>{formatNpr(n)}</span>;
}

export function StageRow({ label, cost, done, custom }: { label: string; cost: number; done: boolean; custom?: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "18px 1fr auto",
        gap: "10px",
        alignItems: "baseline",
        padding: "7px 0",
        borderBottom: `1px solid ${T.lineSoft}`,
        fontSize: "var(--fs-14)",
      }}
    >
      <span style={{ color: done ? T.acc : T.ink4, fontSize: "var(--fs-13)", fontWeight: "var(--fw-bold)", fontVariantNumeric: "tabular-nums" }}>
        {done ? "✓" : "•"}
      </span>
      <span style={{ color: done ? T.ink : T.ink2, fontWeight: done ? "var(--fw-medium)" : "var(--fw-normal)" }}>
        {label}
        {custom && (
          <span style={{ marginLeft: "7px", fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: T.ink3, border: `1px solid ${T.line}`, padding: "1px 7px", borderRadius: "var(--r-pill)" }}>
            added
          </span>
        )}
      </span>
      <Amount n={cost} />
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, color: T.ink2, fontSize: "var(--fs-14)" }}>{children}</p>;
}

export function MoneyRow({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--fs-14)", color: muted ? T.ink3 : T.ink2 }}>
      <span>{k}</span>
      <span style={{ fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums", color: T.ink }}>{v}</span>
    </div>
  );
}

// ============================ SHEET HEAD ============================
/** Patient identity plus the standing medical alerts. Stays on the white ground and keeps its heavy
 *  rule, so the patient's name reads as the sheet's title rather than the first of many equal cards. */
export function SheetHead({ patientName, patientMeta, alerts }: { patientName: string; patientMeta: string; alerts: string[] }) {
  return (
    <div style={{ paddingBottom: "var(--sp-4)", borderBottom: `2px solid ${T.ink}` }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--sp-2) var(--sp-5)", alignItems: "baseline" }}>
        {/* --fs-22 is documented as "stat tile numbers ONLY", but this heading's literal value was
            already exactly 22px — the token is reused here for the same pixel value rather than
            leaving a duplicate literal. */}
        <span style={{ fontSize: "var(--fs-22)", fontWeight: "var(--fw-bold)", letterSpacing: "-0.015em" }}>{patientName || "—"}</span>
        <span style={{ fontSize: "var(--fs-14)", color: T.ink3, fontVariantNumeric: "tabular-nums" }}>{patientMeta}</span>
      </div>
      {alerts.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "var(--sp-2)",
            marginTop: "14px",
            padding: "10px 13px",
            borderRadius: "8px",
            background: T.warnSoft,
            border: `1px solid ${T.warnLine}`,
            color: T.warn,
            fontSize: "var(--fs-14)",
            fontWeight: "var(--fw-medium)",
          }}
        >
          <span>⚠</span>
          <span>Medical alert:</span>
          {alerts.map((a) => (
            <span
              key={a}
              style={{ fontSize: "var(--fs-12)", fontWeight: "var(--fw-bold)", color: T.danger, background: T.dangerSoft, border: `1px solid ${T.dangerLine}`, padding: "2px var(--sp-2)", borderRadius: "var(--r-pill)" }}
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================ CLINICAL BLOCKS ============================
export function DoneTodayBlock({ doneToday }: { doneToday: { label: string; tooth: string; cost: number }[] }) {
  return (
    <section style={block}>
      <span style={{ ...sectionHead, marginBottom: "14px" }}>Done today</span>
      {doneToday.length === 0 ? (
        <Empty>Nothing marked done this visit.</Empty>
      ) : (
        doneToday.map((d, i) => (
          <StageRow key={i} label={`${d.label}${d.tooth ? ` · tooth ${d.tooth}` : ""}`} cost={d.cost} done />
        ))
      )}
    </section>
  );
}

export function NextVisitBlock({ nextVisit }: { nextVisit: { date: string; reason: string } | null }) {
  return (
    <section style={block}>
      <span style={{ ...sectionHead, marginBottom: "12px" }}>Next visit</span>
      {nextVisit ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-medium)", fontVariantNumeric: "tabular-nums" }}>{formatDateShort(nextVisit.date)}</span>
          {nextVisit.reason && <span style={{ fontSize: "var(--fs-13)", color: T.ink3 }}>{nextVisit.reason}</span>}
        </div>
      ) : (
        <Empty>None scheduled.</Empty>
      )}
    </section>
  );
}

export function PerioBlock({ perio }: { perio: PerioRow[] }) {
  return (
    <section style={block}>
      <span style={{ ...sectionHead, marginBottom: "14px" }}>Periodontal readings</span>
      {perio.length === 0 ? (
        <Empty>No gum readings taken this visit.</Empty>
      ) : (
        <TableWrap>
          <Table minWidth={620}>
            <thead>
              <Tr>
                {["Tooth", "Probing depth (mm)", "BOP", "Mobility"].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </Tr>
            </thead>
            <tbody>
              {perio.map((t) => (
                <Tr key={t.tooth}>
                  <Td style={{ fontWeight: 550, fontVariantNumeric: "tabular-nums" }}>{t.tooth}</Td>
                  <Td style={{ fontFamily: "ui-monospace, monospace", letterSpacing: ".12em", whiteSpace: "nowrap" }}>
                    {/* 4mm is where a pocket stops being healthy — the one number a dentist scans for. */}
                    {t.pd.map((d, i) => (
                      <span key={i} style={d >= 4 ? { color: T.danger, fontWeight: "var(--fw-bold)" } : undefined}>
                        {d}
                        {i < t.pd.length - 1 ? " " : ""}
                      </span>
                    ))}
                  </Td>
                  <Td style={{ fontVariantNumeric: "tabular-nums" }}>{t.bop}/6</Td>
                  <Td>{t.mobility ? `Grade ${t.mobility}` : "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableWrap>
      )}
    </section>
  );
}

/** THE SAFETY BLOCK. Never duplicate this — it is the last drug/allergy check before the record is
 *  written, and a second copy is a second behaviour waiting to drift out of step with this one. */
export function PrescriptionBlockReview({ prescriptions, patientAlerts }: { prescriptions: RxLine[]; patientAlerts: string[] }) {
  return (
    <section style={block}>
      <span style={{ ...sectionHead, marginBottom: "14px" }}>Prescription</span>
      {prescriptions.length === 0 ? (
        <Empty>No medicine prescribed.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--sp-3)" }}>
          {prescriptions.map((r, i) => {
            const conflict = checkDrugAllergyConflict(r.medicine, patientAlerts);
            return (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                <span style={{ fontWeight: "var(--fw-bold)", fontSize: "var(--fs-14)" }}>{r.medicine}</span>
                {/* Dose, frequency, duration only — the instructions ("take after meals", "avoid
                    alcohol") are still saved on the record, just not shown on this review line. */}
                <span style={{ fontSize: "var(--fs-13)", color: T.ink3 }}>
                  {[r.dosage, r.frequency, r.duration].filter(Boolean).join(" · ")}
                </span>
                {conflict && (
                  <div style={{ display: "flex", gap: "var(--sp-2)", alignItems: "flex-start", marginTop: "var(--sp-1)", padding: "var(--sp-2) 10px", borderRadius: "var(--r-sm)", background: T.dangerSoft, border: `1px solid ${T.dangerLine}`, color: T.danger, fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)" }}>
                    <span>⚠</span>
                    <span>{conflict}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function LabBlock({ labOrders }: { labOrders: LabOrderInput[] }) {
  return (
    <section style={block}>
      <span style={{ ...sectionHead, marginBottom: "14px" }}>Lab work</span>
      {labOrders.length === 0 ? (
        <Empty>Lab work is not needed.</Empty>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {labOrders.map((l, i) => (
            <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "10px 12px", background: "#ffffff", border: `1px solid ${T.line}`, borderRadius: "0px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "8px" }}>
                <span style={{ fontWeight: "var(--fw-bold)", fontSize: "var(--fs-15)", color: T.ink }}>
                  {l.procedure || "Lab work needed"}
                  {l.tooth ? ` · Tooth ${l.tooth}` : ""}
                </span>
              </div>
              <div style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: T.ink3 }}>
                {[l.labName || "Reception will complete and send the order", l.shade && `Shade: ${l.shade}`].filter(Boolean).join(" · ")}
              </div>
              {l.notes && <div style={{ fontSize: "var(--fs-13)", color: T.ink, marginTop: "2px" }}>Note: {l.notes}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function CanalBlockReview({ canalDataMap }: { canalDataMap?: Record<string, CanalChartData> }) {
  if (!canalDataMap || Object.keys(canalDataMap).length === 0) return null;
  const entries = Object.values(canalDataMap);

  return (
    <section style={block}>
      <span style={{ ...sectionHead, marginBottom: "14px" }}>Root Canal Working Lengths</span>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {entries.map((data, idx) => (
          <div key={idx} style={{ padding: "10px var(--sp-3)", background: "#ffffff", border: `1px solid ${T.line}`, borderRadius: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <span style={{ fontSize: "var(--fs-14)", fontWeight: "var(--fw-bold)", color: T.acc }}>Tooth {data.tooth}</span>
              <span style={{ fontSize: "var(--fs-12)", color: T.ink3, fontWeight: "var(--fw-medium)" }}>{formatDateShort(data.date)}</span>
            </div>
            <div style={{ fontSize: "var(--fs-13)", fontWeight: "var(--fw-medium)", color: T.ink, display: "flex", flexWrap: "wrap", gap: "6px var(--sp-3)" }}>
              {data.canals.map((c, i) => (
                <span key={i} style={{ background: "#f5f3ff", border: "1px solid #ddd6fe", padding: "3px 9px", borderRadius: "var(--r-sm)" }}>
                  <strong>{c.canal}</strong>: {c.lengthMm || "—"}mm ({c.referencePoint || "—"}) {c.note && c.note !== "#" ? `· ${c.note}` : ""}
                </span>
              ))}
            </div>
            {data.obturationMaterial && (
              <div style={{ marginTop: "6px", fontSize: "var(--fs-12)", color: T.ink2, fontWeight: "var(--fw-medium)" }}>
                Obturation Material: {data.obturationMaterial}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
