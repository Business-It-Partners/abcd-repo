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
// Resume an existing case from its first step unless the route explicitly
// selects another tab. This keeps the case context visible on every fresh open.
export const inProgressStepForTab = (workTab?: string): InProgressVisibleStep => {
  if (!workTab) return 1;
  // Old links to the removed Payment tab land on Follow-up instead.
  if (workTab === "payment" || workTab === "recall") return 6;
  if (workTab === "review") return 7;
  return inProgressClinicalStepByTab[workTab] ?? 2;
};

export const tabForInProgressStep = (step: InProgressStep): string | null => {
  if (step === 6) return "recall";
  if (step === 7) return "review";
  return inProgressClinicalTabByStep[step] ?? null;
};
