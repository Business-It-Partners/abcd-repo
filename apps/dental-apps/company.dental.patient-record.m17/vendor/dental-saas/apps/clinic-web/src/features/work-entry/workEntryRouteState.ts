export type StartCaseStep = 1 | 2 | 3 | 4 | 5 | 6;
export type InProgressStep = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type InProgressVisibleStep = 1 | 2 | 4 | 5 | 6 | 7 | 8;

const startStepByTab: Record<string, StartCaseStep> = {
  patient: 1,
  plan: 2,
  imaging: 3,
  work: 4,
  recall: 5,
  review: 6,
};

const startTabByStep: Partial<Record<StartCaseStep, string>> = {
  1: "patient",
  2: "plan",
  3: "imaging",
  4: "work",
  5: "recall",
  6: "review",
};

const inProgressClinicalStepByTab: Record<string, 1 | 2 | 4 | 5> = {
  patient: 1,
  work: 2,
  perio: 4,
  imaging: 5,
};

const inProgressClinicalTabByStep: Partial<Record<InProgressStep, string>> = {
  1: "patient",
  2: "work",
  4: "perio",
  5: "imaging",
};

export const startCaseStepForTab = (workTab?: string): StartCaseStep => workTab ? startStepByTab[workTab] ?? 1 : 1;
export const tabForStartCaseStep = (step: StartCaseStep): string | null => startTabByStep[step] ?? null;
// An existing Work Entry case should open on the clinical work area. The
// patient-only step remains available through `workTab=patient`, but it is
// reference context rather than the fastest place to begin recording care.
export const inProgressStepForTab = (workTab?: string, canCollectPayment = false): InProgressVisibleStep => {
  if (!workTab) return 2;
  if (workTab === "payment") return canCollectPayment ? 6 : 2;
  if (workTab === "recall") return canCollectPayment ? 7 : 6;
  if (workTab === "review") return canCollectPayment ? 8 : 7;
  return inProgressClinicalStepByTab[workTab] ?? 2;
};

export const tabForInProgressStep = (step: InProgressStep, canCollectPayment = false): string | null => {
  if (step === (canCollectPayment ? 6 : -1)) return "payment";
  if (step === (canCollectPayment ? 7 : 6)) return "recall";
  if (step === (canCollectPayment ? 8 : 7)) return "review";
  return inProgressClinicalTabByStep[step] ?? null;
};
