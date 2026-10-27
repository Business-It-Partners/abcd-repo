export const clinicTabDefinitions = {
  followups: { area: "Follow-ups", params: ["bucket", "date", "doctor", "search", "page"] },
  appointments: { area: "Appointments", params: ["date", "doctor", "view", "appointmentId"] },
  "new-patient": { area: "New Patient", params: [] },
  "work-entry": { area: "Work Entry", params: ["patientId", "caseId", "workTab", "status", "search"] },
  patients: { area: "Patient Record", params: ["patientId", "caseId", "subpage", "search", "cohort", "month"] },
  "treatment-progress": { area: "Treatment Progress", params: ["patientId", "caseId", "status", "search", "page"] },
  // Legacy pending links now open the unified tracker, where pending rows are
  // assigned by clicking their Sent checkbox.
  "labs/pending": { area: "Lab Tracker", params: ["search", "page"] },
  "labs/orders": { area: "Lab Tracker", params: ["labOrderId", "status", "month", "search", "page"] },
  "labs/suppliers": { area: "Lab supplier record", params: ["labSupplierId", "status", "month", "search", "page"] },
  "finance/transactions": { area: "Transaction Record", params: ["date", "month", "status", "search", "page"] },
  "finance/patient-payments": { area: "Patient payments", params: ["patientId", "date", "month", "search", "page"] },
  "finance/expenses": { area: "General expenses", params: ["date", "month", "status", "search", "page"] },
  "finance/salary-payments": { area: "Salary payments", params: ["staffId", "date", "month", "search", "page"] },
  "finance/products": { area: "Product list", params: ["productId", "status", "search", "page"] },
  "finance/purchases": { area: "Purchases", params: ["purchaseId", "supplierId", "date", "month", "status", "search", "page"] },
  "finance/suppliers": { area: "Supplier list", params: ["supplierId", "status", "search", "page"] },
  "finance/supplier-payments": { area: "Supplier payments", params: ["supplierId", "date", "month", "search", "page"] },
  staff: { area: "Staff", params: ["staffId", "staffTab", "status", "search", "page"] },
  "treatment-protocols": { area: "Treatment Protocols", params: ["protocolId", "status", "search", "page"] },
  calendar: { area: "Calendar", params: ["date", "month", "day"] },
  "clinic-profile": { area: "Clinic profile", params: [] },
  "user-management": { area: "User management", params: [] },
} as const;

export type ClinicTab = keyof typeof clinicTabDefinitions;
export type ClinicArea = (typeof clinicTabDefinitions)[ClinicTab]["area"];
export type ClinicDetailParam = "patientId" | "caseId" | "staffId" | "protocolId" | "supplierId" | "labSupplierId" | "labOrderId" | "purchaseId" | "productId";
export type ClinicRouteParam = ClinicDetailParam | "bucket" | "date" | "doctor" | "view" | "workTab" | "subpage" | "cohort" | "month" | "status" | "search" | "page" | "staffTab" | "day" | "appointmentId";
export type ClinicRouteParams = Partial<Record<ClinicRouteParam, string>>;

export type ClinicRouteState = {
  tab: ClinicTab;
  area: ClinicArea;
  params: ClinicRouteParams;
  wasCanonical: boolean;
};

export const defaultClinicTab: ClinicTab = "followups";

const tabByArea = Object.fromEntries(
  Object.entries(clinicTabDefinitions).map(([tab, definition]) => [definition.area, tab]),
) as Record<ClinicArea, ClinicTab>;

export function clinicTabForArea(area: ClinicArea): ClinicTab {
  return tabByArea[area];
}

export function clinicAreaForTab(tab: ClinicTab): ClinicArea {
  return clinicTabDefinitions[tab].area;
}

export function isClinicTab(value: string | null): value is ClinicTab {
  return Boolean(value && Object.prototype.hasOwnProperty.call(clinicTabDefinitions, value));
}

function isMeaningfulValue(value: string | null | undefined): value is string {
  return Boolean(value && value.trim());
}

/** Parses only stable, non-sensitive page state. Drafts and transient UI state are deliberately absent. */
export function parseClinicRoute(searchParams: URLSearchParams): ClinicRouteState {
  const suppliedTab = searchParams.get("tab");
  const tab = isClinicTab(suppliedTab) ? suppliedTab : defaultClinicTab;
  const allowed = new Set<string>(clinicTabDefinitions[tab].params);
  const params: ClinicRouteParams = {};
  for (const key of allowed) {
    const value = searchParams.get(key);
    if (isMeaningfulValue(value)) params[key as ClinicRouteParam] = value.trim();
  }
  const canonical = serializeClinicRoute({ tab, params });
  return {
    tab,
    area: clinicAreaForTab(tab),
    params,
    wasCanonical: searchParams.toString() === canonical.toString(),
  };
}

export function serializeClinicRoute(route: Pick<ClinicRouteState, "tab" | "params">): URLSearchParams {
  const query = new URLSearchParams();
  query.set("tab", route.tab);
  const allowed = new Set<string>(clinicTabDefinitions[route.tab].params);
  for (const key of clinicTabDefinitions[route.tab].params) {
    const value = route.params[key as ClinicRouteParam];
    if (allowed.has(key) && isMeaningfulValue(value)) query.set(key, value.trim());
  }
  return query;
}

/** Moves between workspaces and drops every parameter which is not valid for the destination. */
export function routeForTab(tab: ClinicTab, params: ClinicRouteParams = {}): ClinicRouteState {
  const allowed = new Set<string>(clinicTabDefinitions[tab].params);
  const compatible = Object.fromEntries(
    Object.entries(params).filter(([key, value]) => allowed.has(key) && isMeaningfulValue(value)),
  ) as ClinicRouteParams;
  return { tab, area: clinicAreaForTab(tab), params: compatible, wasCanonical: true };
}

export function patchClinicRoute(route: ClinicRouteState, patch: Partial<Record<ClinicRouteParam, string | null | undefined>>): ClinicRouteState {
  const params: ClinicRouteParams = { ...route.params };
  for (const [key, value] of Object.entries(patch) as [ClinicRouteParam, string | null | undefined][]) {
    if (!value || !value.trim()) delete params[key];
    else params[key] = value.trim();
  }
  return routeForTab(route.tab, params);
}
