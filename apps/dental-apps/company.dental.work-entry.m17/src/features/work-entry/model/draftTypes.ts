import type { CanalChartData } from "@/features/work-entry/model/canalData";

/**
 * UI-preview shapes retained from the staging screens.  They are deliberately
 * data-only: the migration does not issue browser commands or claim an audit
 * trail.  The entry component keeps these changes in React state for the
 * lifetime of the current browser session.
 */
export interface PlanAppendDraft {
  phase: "urgent" | "basic" | "elective";
  steps: Array<{
    agreedCost: number;
    grade?: string;
    gradeLabel?: string;
    label: string;
    procedureCode?: string;
    recordCanals?: boolean;
    tooth: string;
  }>;
  title: string;
  tooth: string;
  toothSpecific: boolean;
}

export interface CanalHistoryDraft {
  patientId: string;
  reading: CanalChartData;
  target: { tooth: string; treatmentId?: string };
}

export function newClientCommandId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "")}`;
}
