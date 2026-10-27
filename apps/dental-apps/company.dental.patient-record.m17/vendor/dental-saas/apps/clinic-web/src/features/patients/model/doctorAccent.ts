import styles from "@/features/patients/patient-record.module.css";

// A stable per-doctor accent colour: the same clinician always hashes to the same stripe, so the
// timeline and the prescription history colour-code a day's work identically. Shared so the two
// views never drift apart.
const VISIT_ACCENTS = [styles.visitKarki, styles.visitRai, styles.visitMaharjan];

export function doctorAccent(doctor: string): string {
  if (!doctor) return "";
  let hash = 0;
  for (let i = 0; i < doctor.length; i++) hash = (hash * 31 + doctor.charCodeAt(i)) >>> 0;
  return VISIT_ACCENTS[hash % VISIT_ACCENTS.length];
}
