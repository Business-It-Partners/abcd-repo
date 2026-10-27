// Anatomical canal derivation and types for Root Canal Working Length tracking.

export interface CanalReading {
  canal: string;
  lengthMm: string;
  referencePoint: string;
  note: string; // file size / instrument note (e.g. #25 K-File, F2 Protaper)
  date?: string; // date of reading taken for this canal
}

export interface CanalChartData {
  tooth: string;
  treatmentId?: string;
  /** Encounter that recorded these readings, so a visit correction cannot orphan them. */
  visitId?: string;
  date: string;
  /** Legacy display metadata only; stage completion owns clinician attribution. */
  doctor?: string;
  canals: CanalReading[];
  medicament?: string;
  obturationMaterial?: string;
  obturationTechnique?: string;
}

/**
 * Replace the current canal record without severing the encounter link held by
 * legacy patient data. The canal editor does not always receive a visit ID when
 * it edits an existing record, but an omitted ID must never orphan the record
 * from the encounter that originally filed it.
 */
export function replaceCanalHistoryEntry(
  history: CanalChartData[],
  replacement: CanalChartData,
): CanalChartData[] {
  const index = history.findIndex(
    (entry) =>
      (replacement.treatmentId && entry.treatmentId === replacement.treatmentId) ||
      entry.tooth === replacement.tooth,
  );

  if (index < 0) return [...history, replacement];

  const previous = history[index];
  const visitId = replacement.visitId?.trim() ? replacement.visitId : previous.visitId;
  const next = visitId ? { ...replacement, visitId } : replacement;

  return history.map((entry, entryIndex) => (entryIndex === index ? next : entry));
}

/**
 * Derive default root canals based on FDI tooth numbers.
 * South Asian population anatomical averages:
 * - Upper molars (16, 17, 26, 27): MB, MB2, DB, P
 * - Lower molars (36, 37, 46, 47): MB, ML, D
 * - Primary upper molars (54, 55, 64, 65): MB, DB, P
 * - Primary lower molars (74, 75, 84, 85): MB, ML, D
 * - Premolars (14, 24): B, L
 * - Incisors / Canines: Canal 1
 */
export function deriveCanals(toothStr: string): string[] {
  const tooth = parseInt(toothStr, 10);
  if (isNaN(tooth)) return ["Canal 1", "Canal 2", "Canal 3"];

  if ([16, 17, 18, 26, 27, 28].includes(tooth)) {
    return ["MB", "MB2", "DB", "P"];
  }
  if ([36, 37, 38, 46, 47, 48].includes(tooth)) {
    return ["MB", "ML", "D"];
  }
  if ([54, 55, 64, 65].includes(tooth)) {
    return ["MB", "DB", "P"];
  }
  if ([74, 75, 84, 85].includes(tooth)) {
    return ["MB", "ML", "D"];
  }
  if ([14, 24, 15, 25, 34, 35, 44, 45].includes(tooth)) {
    return ["B", "L"];
  }
  return ["Canal 1"];
}

export const REFERENCE_POINTS = ["Cusp Tip", "Incisal Edge", "Marginal Ridge", "Occlusal Surface", "Restoration Edge"];
export const MEDICAMENTS = ["Ca(OH)₂ / Calcept", "Ledermix", "Odontopaste", "Formocresol", "Chlorhexidine Gel", "None"];
export const OBTURATION_MATERIALS = ["Gutta-Percha + AH Plus", "Gutta-Percha + BioCeramic Sealer", "Resilon", "Zinc Oxide Eugenol", "MTA"];
export const OBTURATION_TECHNIQUES = ["Warm Vertical Condensation", "Cold Lateral Condensation", "Single Cone (Bioceramic)", "Carrier-based (Thermafil)"];
