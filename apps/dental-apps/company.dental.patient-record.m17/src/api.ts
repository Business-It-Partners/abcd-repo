import { BrowserClinicClient, ClinicCommand, ClinicError } from "../../../clinic-app-runtime/browserClinicClient";
import { PatientMediaClient, type PatientMediaPending, type PatientXrayMetadata } from "../../../clinic-app-runtime/patientMediaClient";
import { bsMonthToADRange, todayBS } from "../../../../packages/dental-ui/src/shared/dates/bikramSambat";
import type {
  PatientCore, PatientDirectoryPage, PatientDirectoryCounts, PatientSummary, PatientIntakeInput,
  PatientProfileUpdateInput, PatientRegistrationContext, PatientTreatmentPlan, PatientTimelineEvent,
  PatientNote, PatientNoteCreateInput, PatientPrescription, PrescriptionCreateInput,
  PatientLedger, PatientPaymentInput, PatientPayment, PatientFollowUp, FollowUpCreateInput,
  PatientMediaAsset,
} from "./types";

export const APP_ID = "company.dental.patient-record.m17";
export const today = () => {
  const now = new Date();
  return [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-");
};
export const dateValid = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v)) && new Date(v + "T00:00:00Z").toISOString().slice(0, 10) === v;
export const monthBS = () => { const bs = todayBS(); return bs ? String(bs.year) + "-" + String(bs.month).padStart(2, "0") : ""; };
export const isObject = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const check = (v: unknown, field: string): Record<string, unknown> => {
  if (!isObject(v)) throw new ClinicError("INVALID_RESPONSE", field + " returned an invalid response.");
  return v;
};
const field = <T>(value: unknown, name: string, validate: (x: unknown) => boolean): T => {
  const obj = check(value, name);
  if (!validate(obj[name])) throw new ClinicError("INVALID_RESPONSE", name + " is missing or invalid.");
  return obj[name] as T;
};
const isArray = (v: unknown): v is unknown[] => Array.isArray(v);
const isPatient = (v: unknown): v is PatientSummary => isObject(v) &&
  typeof v.patientId === "string" && typeof v.patientNumber === "string" &&
  typeof v.fullName === "string" && Number.isInteger(v.rowVersion as number);
const isCore = (v: unknown): v is PatientCore => {
  if (!isObject(v) || !isPatient(v)) return false;
  const record = v as unknown as Record<string, unknown>;
  const medicalProfile = record.medicalProfile;
  return isObject(medicalProfile) && Number.isInteger(medicalProfile.rowVersion as number)
    && Array.isArray(record.allergies);
};
const isReceipt = (key: string) => (v: unknown) => isObject(v) && isObject(v[key]);
const isList = (v: unknown) => Array.isArray(v);
export type Cohort = "all" | "new" | "regular";
export type PatientTreatmentProtocolReference = {
  id: string;
  name: string;
  recordCanals?: boolean;
  stages: Array<{ sourceProtocolStageId?: string; label: string; defaultCost?: number; toothScope?: string }>;
  grades?: Array<{ id: string; label: string; stages: Array<{ sourceProtocolStageId?: string; label: string; defaultCost?: number; toothScope?: string }> }>;
};
export type PatientLabSupplier = { supplierId: string; name: string; supplierType?: "lab" | "both" | "goods"; active: boolean };

export class PatientApi {
  constructor(private readonly sdk: BrowserClinicClient) {}
  async directory(input: {query: string; cohort: Cohort; month: string; cursor: string | null; limit: number;}): Promise<PatientDirectoryPage> {
    const search = new URLSearchParams();
    const q = input.query.trim().slice(0, 120);
    search.set("limit", String(input.limit));
    if (q) search.set("q", q);
    else {
      if (input.cohort !== "all") search.set("cohort", input.cohort);
      const [year, month] = input.month.split("-").map(Number);
      const range = Number.isInteger(year) && Number.isInteger(month) ? bsMonthToADRange(year, month) : null;
      if (input.month && !range) throw new ClinicError("VALIDATION", "Select a valid Nepali month.");
      if (range) { search.set("monthStart", range.start); search.set("monthEnd", range.end); }
    }
    if (input.cursor) search.set("cursor", input.cursor);
    const raw = check(await this.sdk.read("/v1/patients?" + search.toString()), "Patient directory");
    if (!Array.isArray(raw.patients) || !raw.patients.every(isPatient) ||
        !Number.isInteger(raw.total as number) || (raw.total as number) < 0 ||
        !(raw.nextCursor === null || typeof raw.nextCursor === "string")) {
      throw new ClinicError("INVALID_RESPONSE", "The patient directory returned an invalid page.");
    }
    const counts = isObject(raw.counts) && ["all", "new", "regular"].every(key => Number.isInteger((raw.counts as Record<string, unknown>)[key] as number))
      ? raw.counts as PatientDirectoryCounts : { all: 0, new: 0, regular: 0, [q ? "all" : input.cohort]: raw.total } as PatientDirectoryCounts;
    return { patients: raw.patients as PatientSummary[], total: raw.total as number, counts, nextCursor: raw.nextCursor as string | null };
  }
  context() { return this.sdk.read("/v1/patient-intakes/context").then(v => field<PatientRegistrationContext>(v, "context", isObject)); }
  core(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/core", signal).then(v => field<PatientCore>(v, "patient", isCore)); }
  plans(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/treatment-plans", signal).then(v => field<PatientTreatmentPlan[]>(v, "treatmentPlans", isArray)); }
  timeline(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/timeline", signal).then(v => field<PatientTimelineEvent[]>(v, "timeline", isArray)); }
  notes(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/notes", signal).then(v => field<PatientNote[]>(v, "notes", isArray)); }
  prescriptions(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/prescriptions", signal).then(v => field<PatientPrescription[]>(v, "prescriptions", isArray)); }
  followUps(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/follow-ups", signal).then(v => field<PatientFollowUp[]>(v, "followUps", isArray)); }
  ledger(id: string, month = "", cursor = "", signal?: AbortSignal) {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (cursor) params.set("cursor", cursor);
    return this.sdk.read("/v1/patients/" + id + "/ledger" + (params.size ? "?" + params : ""), signal)
      .then(v => field<PatientLedger>(v, "ledger", x => isObject(x) && isObject(x.summary) && Array.isArray(x.entries)));
  }
  media(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/media", signal).then(v => field<PatientMediaAsset[]>(v, "media", isArray)); }
  withdrawMedia(id: string, reason: string) {
    return this.sdk.command<void>("POST", "/v1/patient-media/" + id + "/withdraw", { reason }, value => value === undefined || isObject(value));
  }
  odontogram(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/odontogram", signal); }
  periodontal(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/periodontal-chart", signal); }
  canals(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/canal-measurements", signal); }
  labOrders(id: string, signal?: AbortSignal) { return this.sdk.read("/v1/patients/" + id + "/lab-orders", signal); }
  staffReferences(signal?: AbortSignal) { return this.sdk.read("/v1/clinic/staff-references", signal); }
  workEntryCase(id: string) { return this.sdk.read<{ case: import("./types").WorkEntryCase }>("/v1/chief-complaints/" + id + "/work-entry").then(v => field<import("./types").WorkEntryCase>(v, "case", isObject)); }
  treatmentProtocols() { return this.sdk.read<{ treatmentProtocols: PatientTreatmentProtocolReference[] }>("/v1/treatment-protocols").then(v => field<PatientTreatmentProtocolReference[]>(v, "treatmentProtocols", isArray)); }
  addWorkEntryProtocol(id: string, input: import("./types").WorkEntryProtocolAddInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols", input, x => isObject(x) && isObject(x.case));
  }
  cancelWorkEntryProtocol(id: string, protocolId: string, input: import("./types").WorkEntryProtocolCancelInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols/" + protocolId + "/cancel", input, x => isObject(x) && isObject(x.case));
  }
  addWorkEntryStage(id: string, protocolId: string, input: import("./types").WorkEntryStageAddInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols/" + protocolId + "/stages", input, x => isObject(x) && isObject(x.case));
  }
  cancelWorkEntryStage(id: string, protocolId: string, stageId: string, input: import("./types").WorkEntryStageCancelInput) {
    return this.sdk.command<{ case: import("./types").WorkEntryCase }>("POST", "/v1/chief-complaints/" + id + "/treatment-protocols/" + protocolId + "/stages/" + stageId + "/cancel", input, x => isObject(x) && isObject(x.case));
  }
  labSuppliers(signal?: AbortSignal) { return this.sdk.read<{ suppliers: PatientLabSupplier[] }>("/v1/clinic/suppliers?scope=lab", signal).then(v => field<PatientLabSupplier[]>(v, "suppliers", isArray)); }
  assignLabOrder(id: string, input: { supplierId: string; labWorkName: string; toothScope: string | null; shade: string | null; sentOn: string; receptionNote: string | null; expectedRowVersion: number }) {
    return this.sdk.command<{ labOrder: unknown }>("POST", "/v1/lab-orders/" + id + "/assign", input, isReceipt("labOrder"));
  }
  createIntake(input: PatientIntakeInput) {
    return this.sdk.command<{patient: PatientCore}>("POST", "/v1/patient-intakes", input, isReceipt("patient"));
  }
  updateProfile(id: string, input: PatientProfileUpdateInput) {
    return this.sdk.command<{patient: PatientCore}>("PUT", "/v1/patients/" + id + "/profile", input, isReceipt("patient"));
  }
  createCase(id: string, chiefComplaint: string, openedOn: string) {
    return this.sdk.command<{case: unknown}>("POST", "/v1/patients/" + id + "/cases", {chiefComplaint, openedOn}, isReceipt("case"));
  }
  createNote(input: PatientNoteCreateInput) { return this.sdk.command<{note: PatientNote}>("POST", "/v1/patient-notes", input, isReceipt("note")); }
  withdrawNote(id: string, reason: string) { return this.sdk.command<{note: PatientNote}>("POST", "/v1/patient-notes/" + id + "/withdraw", {reason}, isReceipt("note")); }
  createPrescription(input: PrescriptionCreateInput) { return this.sdk.command<{prescription: PatientPrescription}>("POST", "/v1/prescriptions", input, isReceipt("prescription")); }
  correctPrescription(id: string, input: PrescriptionCreateInput & {reason: string; expectedRowVersion: number}) {
    return this.sdk.command<{prescription: PatientPrescription}>("POST", "/v1/prescriptions/" + id + "/correct", input, isReceipt("prescription"));
  }
  withdrawPrescription(id: string, rowVersion: number, reason: string) {
    return this.sdk.command<{prescription: PatientPrescription}>("POST", "/v1/prescriptions/" + id + "/withdraw", {expectedRowVersion: rowVersion, reason}, isReceipt("prescription"));
  }
  collect(input: PatientPaymentInput) { return this.sdk.command<{payment: PatientPayment}>("POST", "/v1/patients/" + input.patientId + "/payments", input, isReceipt("payment")); }
  correctLedger(id: string, input: {expectedRowVersion: number; amount: number; entryDate: string; reason: string}) {
    return this.sdk.command<{correction: unknown}>("POST", "/v1/patient-ledger/" + id + "/correct", input, isReceipt("correction"));
  }
  reverseLedger(id: string, input: {expectedRowVersion: number; entryDate: string; reason: string}) {
    return this.sdk.command<{reversal: unknown}>("POST", "/v1/patient-ledger/" + id + "/reverse", input, isReceipt("reversal"));
  }
  createFollowUp(input: FollowUpCreateInput) {
    return this.sdk.command<{followUp: PatientFollowUp}>("POST", "/v1/follow-ups", input, isReceipt("followUp"));
  }
  updateCaseStatus(id: string, input: {patientId: string; expectedRowVersion: number; status: "open" | "completed" | "closed"; reason: string | null}) {
    return this.sdk.command<{case: unknown}>("POST", "/v1/chief-complaints/" + id + "/status", input, x => isObject(x));
  }
  saveOdontogram(id: string, input: {recordedOn:string;marks:import("./types").OdontogramMark[];removedMarks:import("./types").OdontogramMark[]}) {
    return this.sdk.command<{marks:import("./types").OdontogramMark[]}>("PUT","/v1/patients/"+id+"/odontogram",input,
      x=>isObject(x)&&Array.isArray(x.marks));
  }
  savePeriodontal(id: string, input: import("./types").PeriodontalChartSaveInput) {
    return this.sdk.command<{chart:import("./types").PatientPeriodontalChart}>("PUT","/v1/patients/"+id+"/periodontal-chart",input,isReceipt("chart"));
  }
  saveCanal(id: string, input: import("./types").CanalMeasurementSaveInput) {
    return this.sdk.command<{session:import("./types").PatientCanalMeasurement}>("POST","/v1/patients/"+id+"/canal-measurements",input,isReceipt("session"));
  }
  createLabRequest(input:{patientId:string;chiefComplaintId:string;labWorkName:string;toothScope:string|null;shade:string|null;clinicalNote:string|null}) {
    return this.sdk.command<{labOrder:unknown}>("POST","/v1/lab-requests",input,isReceipt("labOrder"));
  }
  updateLab(id:string,input:{expectedRowVersion:number;status?:"pending_assignment"|"sent"|"received"|"fitted"|"cancelled";clearAssignment?:boolean;receivedOn?:string|null;fittedOn?:string|null;receptionNote?:string|null}) {
    return this.sdk.command<{labOrder:unknown}>("PATCH","/v1/lab-orders/"+id,input,isReceipt("labOrder"));
  }
  // No SDK route exists for generic binary fetches, signed URLs, or native print/export.
}

export { PatientMediaClient as PatientMediaSdk };
export type XrayMetadata = PatientXrayMetadata;
export type MediaPending = PatientMediaPending;
export type WriteCommand<T> = ClinicCommand<T>;
export function readable(cause: unknown): string { return cause instanceof Error ? cause.message : "Patient Record could not complete this request."; }
export function isUnknown(cause: unknown) { return cause instanceof ClinicError && (cause.outcome === "unknown" || cause.code === "UNKNOWN_OUTCOME" || cause.code === "TIMEOUT"); }
